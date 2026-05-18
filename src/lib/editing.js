const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');

const DATA_DIR = path.join(os.homedir(), '.wiki-dx-viewer');
const SESSION_FILE = path.join(DATA_DIR, 'edit-session.json');

function getRepoDir() {
  if (process.env.WIKI_DX_PATH) {
    return path.resolve(process.env.WIKI_DX_PATH);
  }
  return path.join(DATA_DIR, 'wiki-dx');
}

function git(args, opts = {}) {
  const repoDir = getRepoDir();
  return execSync(`git ${args}`, { cwd: repoDir, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function clearSession() {
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}

function generateBranchName() {
  const user = os.userInfo().username.replace(/[^a-zA-Z0-9]/g, '-');
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `edit/${user}-${date}-${time}`;
}

function startSession() {
  const existing = loadSession();
  if (existing) {
    throw new Error(`Editing session already active on branch: ${existing.branch}`);
  }

  const branch = generateBranchName();

  // Ensure we're on main/master and up to date
  const defaultBranch = getDefaultBranch();
  git(`checkout ${defaultBranch}`);
  git('pull');

  // Create and switch to editing branch
  git(`checkout -b ${branch}`);

  const session = {
    branch,
    startedAt: new Date().toISOString(),
    modifiedFiles: [],
  };
  saveSession(session);
  return session;
}

function getDefaultBranch() {
  try {
    const ref = git('symbolic-ref refs/remotes/origin/HEAD');
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fallback: try main, then master
    try {
      git('rev-parse --verify origin/main');
      return 'main';
    } catch {
      return 'master';
    }
  }
}

function discardSession() {
  const session = loadSession();
  if (!session) throw new Error('No active editing session');

  const defaultBranch = getDefaultBranch();

  // Discard all changes and switch back
  git('checkout -- .');
  git(`checkout ${defaultBranch}`);

  // Delete the editing branch
  try {
    git(`branch -D ${session.branch}`);
  } catch {
    // branch may not exist if nothing was committed
  }

  clearSession();
  return { discarded: true, branch: session.branch };
}

function completeSession(commitMessage) {
  const session = loadSession();
  if (!session) throw new Error('No active editing session');

  // Stage all changes
  git('add -A');

  // Check if there are uncommitted changes to commit
  const status = git('status --porcelain');
  const msg = commitMessage || `Wiki edits from ${session.branch}`;

  if (status) {
    // There are uncommitted changes — commit them
    git(`commit -m "${msg.replace(/"/g, '\\"')}"`);
  } else {
    // No uncommitted changes — check if there are commits ahead of default branch
    const defaultBranch = getDefaultBranch();
    const ahead = git(`rev-list --count ${defaultBranch}..HEAD`);
    if (ahead === '0') {
      throw new Error('No changes to commit');
    }
  }

  // Push
  git(`push -u origin ${session.branch}`);

  // Create PR
  const defaultBranch = getDefaultBranch();
  const prOutput = execSync(
    `gh pr create --base ${defaultBranch} --head ${session.branch} --title "${msg.replace(/"/g, '\\"')}" --body ""`,
    { cwd: getRepoDir(), encoding: 'utf8', stdio: 'pipe' }
  ).trim();

  // prOutput is the PR URL
  const prUrl = prOutput;

  // Switch back to default branch
  git(`checkout ${defaultBranch}`);

  clearSession();
  return { completed: true, branch: session.branch, prUrl };
}

function getStatus() {
  const session = loadSession();
  if (!session) return { active: false };

  // Get list of modified files
  let modifiedFiles = [];
  try {
    const diff = git('diff --name-only HEAD');
    const staged = git('diff --name-only --cached');
    const untracked = git('ls-files --others --exclude-standard');
    const all = [...new Set([...diff.split('\n'), ...staged.split('\n'), ...untracked.split('\n')])].filter(Boolean);
    modifiedFiles = all;
  } catch {
    // ignore
  }

  return { active: true, ...session, modifiedFiles };
}

function savePage(wikiId, pagePath, content) {
  const session = loadSession();
  if (!session) throw new Error('No active editing session. Start one first.');

  const { getDocsRoot } = require('./wiki');
  const docsRoot = getDocsRoot();
  const yaml = require('js-yaml');

  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) throw new Error(`Wiki "${wikiId}" not found`);

  const ymlContent = fs.readFileSync(ymlPath, 'utf8');
  const sanitized = ymlContent.replace(/!!python\/name:\S+/g, "'__python_tag__'");
  const yml = yaml.load(sanitized);
  const docsDir = path.join(docsRoot, wikiId, yml.docs_dir || 'docs');
  const filePath = path.join(docsDir, pagePath);

  if (!filePath.startsWith(docsDir)) throw new Error('Invalid path');
  if (!fs.existsSync(filePath)) throw new Error('Page file not found');

  fs.writeFileSync(filePath, content, 'utf8');

  // Track modified file
  if (!session.modifiedFiles.includes(`${wikiId}/${pagePath}`)) {
    session.modifiedFiles.push(`${wikiId}/${pagePath}`);
    saveSession(session);
  }

  return { saved: true, path: pagePath };
}

function editNavEntry(wikiId, oldTitle, newTitle) {
  const session = loadSession();
  if (!session) throw new Error('No active editing session. Start one first.');

  const { getDocsRoot } = require('./wiki');
  const docsRoot = getDocsRoot();
  const yaml = require('js-yaml');

  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) throw new Error(`Wiki "${wikiId}" not found`);

  const ymlContent = fs.readFileSync(ymlPath, 'utf8');

  // Replace the nav entry title using string replacement to preserve formatting
  // Nav entries look like: - "Old Title": path/to/page.md  or  - Old Title: path/to/page.md
  const patterns = [
    // Quoted: - "Old Title":
    new RegExp(`^(\\s*-\\s*)"${escapeRegex(oldTitle)}"(\\s*:)`, 'gm'),
    // Quoted single: - 'Old Title':
    new RegExp(`^(\\s*-\\s*)'${escapeRegex(oldTitle)}'(\\s*:)`, 'gm'),
    // Unquoted: - Old Title:
    new RegExp(`^(\\s*-\\s*)${escapeRegex(oldTitle)}(\\s*:)`, 'gm'),
  ];

  let updated = ymlContent;
  let replaced = false;

  for (const pattern of patterns) {
    const testResult = pattern.test(updated);
    pattern.lastIndex = 0; // Reset after test() with global flag
    if (testResult) {
      updated = updated.replace(pattern, `$1"${newTitle}"$2`);
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error(`Nav entry "${oldTitle}" not found in ${wikiId}/mkdocs.yml`);
  }

  fs.writeFileSync(ymlPath, updated, 'utf8');

  // Track modified file
  const trackPath = `${wikiId}/mkdocs.yml`;
  if (!session.modifiedFiles.includes(trackPath)) {
    session.modifiedFiles.push(trackPath);
    saveSession(session);
  }

  return { saved: true, oldTitle, newTitle };
}

function createPage(wikiId, pagePath, title, content) {
  const session = loadSession();
  if (!session) throw new Error('No active editing session. Start one first.');

  const { getDocsRoot } = require('./wiki');
  const docsRoot = getDocsRoot();
  const yaml = require('js-yaml');

  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) throw new Error(`Wiki "${wikiId}" not found`);

  const ymlContent = fs.readFileSync(ymlPath, 'utf8');
  const sanitized = ymlContent.replace(/!!python\/name:\S+/g, "'__python_tag__'");
  const yml = yaml.load(sanitized);
  const docsDir = path.join(docsRoot, wikiId, yml.docs_dir || 'docs');
  const filePath = path.join(docsDir, pagePath);

  if (!filePath.startsWith(docsDir)) throw new Error('Invalid path');
  if (fs.existsSync(filePath)) throw new Error('Page file already exists');

  // Ensure parent directory exists
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Write the new page file
  fs.writeFileSync(filePath, content, 'utf8');

  // Add nav entry to mkdocs.yml
  const updatedYml = addNavEntry(ymlContent, pagePath, title);
  fs.writeFileSync(ymlPath, updatedYml, 'utf8');

  // Track modified files
  if (!session.modifiedFiles.includes(`${wikiId}/${pagePath}`)) {
    session.modifiedFiles.push(`${wikiId}/${pagePath}`);
  }
  const trackYml = `${wikiId}/mkdocs.yml`;
  if (!session.modifiedFiles.includes(trackYml)) {
    session.modifiedFiles.push(trackYml);
  }
  saveSession(session);

  return { created: true, path: pagePath, title };
}

function addNavEntry(ymlContent, pagePath, title) {
  // Determine the nav section from the page path (first directory component)
  const pathParts = pagePath.replace(/\\/g, '/').split('/');

  // Build the new nav entry line
  const newEntry = `    - "${title}": ${pagePath}`;

  // Strategy: find the nav section matching the first directory of pagePath
  // and append the entry there. If no matching section, append at end of nav.
  if (pathParts.length > 1) {
    const sectionDir = pathParts[0];
    // Look for a section that contains entries with this directory prefix
    const sectionPattern = new RegExp(`^(\\s*-\\s*.+:\\s*$[\\s\\S]*?)((?=^\\s*-\\s*[^\\s].*:\\s*$)|$(?!\\n\\s))`, 'gm');

    // Simpler approach: find lines referencing this directory and insert after the last one
    const lines = ymlContent.split('\n');
    let lastMatchIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`${sectionDir}/`)) {
        lastMatchIdx = i;
      }
    }

    if (lastMatchIdx >= 0) {
      // Detect indentation from the matched line
      const indent = lines[lastMatchIdx].match(/^(\s*)/)[1];
      const entryLine = `${indent}- "${title}": ${pagePath}`;
      lines.splice(lastMatchIdx + 1, 0, entryLine);
      return lines.join('\n');
    }
  }

  // Fallback: append at end of nav section (before any non-nav top-level key or EOF)
  const lines = ymlContent.split('\n');
  let lastNavLineIdx = -1;
  let inNav = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^nav\s*:/.test(lines[i])) {
      inNav = true;
      lastNavLineIdx = i;
      continue;
    }
    if (inNav) {
      if (/^\S/.test(lines[i]) && lines[i].trim() !== '') {
        // New top-level key, nav section ended
        break;
      }
      lastNavLineIdx = i;
    }
  }

  if (lastNavLineIdx >= 0) {
    lines.splice(lastNavLineIdx + 1, 0, newEntry);
    return lines.join('\n');
  }

  // If no nav section found, append a nav section
  return ymlContent + `\nnav:\n${newEntry}\n`;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { startSession, discardSession, completeSession, getStatus, savePage, editNavEntry, createPage, loadSession };
