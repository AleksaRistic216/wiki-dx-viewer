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

  // Check if there are changes to commit
  const status = git('status --porcelain');
  if (!status) {
    throw new Error('No changes to commit');
  }

  // Commit
  const msg = commitMessage || `Wiki edits from ${session.branch}`;
  git(`commit -m "${msg.replace(/"/g, '\\"')}"`);

  // Push
  git(`push -u origin ${session.branch}`);

  // Create PR
  const defaultBranch = getDefaultBranch();
  const prOutput = execSync(
    `gh pr create --base ${defaultBranch} --head ${session.branch} --title "${msg.replace(/"/g, '\\"')}" --body "Editing session started at ${session.startedAt}"`,
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

module.exports = { startSession, discardSession, completeSession, getStatus, savePage, loadSession };
