const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');
const { Marked } = require('marked');
const { gfmHeadingId } = require('marked-gfm-heading-id');
const hljs = require('highlight.js');
const { execSync } = require('child_process');

const WIKI_REPO_URL = 'https://github.com/DevExpress/wiki-dx.git';
const DATA_DIR = path.join(os.homedir(), '.wiki-dx-viewer');
const REPO_DIR = path.join(DATA_DIR, 'wiki-dx');

// Markdown renderer
const marked = new Marked();
marked.use(gfmHeadingId());
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      }
      return `<pre><code class="hljs">${hljs.highlightAuto(text).value}</code></pre>`;
    }
  }
});

function loadYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sanitized = content.replace(/!!python\/name:\S+/g, "'__python_tag__'");
  return yaml.load(sanitized);
}

function getDocsRoot() {
  if (process.env.WIKI_DX_PATH) {
    return path.join(path.resolve(process.env.WIKI_DX_PATH), 'docs');
  }

  if (!isRepoCloned()) {
    cloneRepo();
  }

  return path.join(REPO_DIR, 'docs');
}

function isRepoCloned() {
  const docsDir = path.join(REPO_DIR, 'docs');
  if (!fs.existsSync(docsDir)) return false;
  const entries = fs.readdirSync(docsDir, { withFileTypes: true });
  return entries.some(e => e.isDirectory() && fs.existsSync(path.join(docsDir, e.name, 'mkdocs.yml')));
}

function cloneRepo() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  execSync(`gh repo clone DevExpress/wiki-dx "${REPO_DIR}" -- --depth 1`, { stdio: 'inherit' });
}

function listWikis() {
  const docsRoot = getDocsRoot();
  const entries = fs.readdirSync(docsRoot, { withFileTypes: true });
  const wikis = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const ymlPath = path.join(docsRoot, e.name, 'mkdocs.yml');
    if (!fs.existsSync(ymlPath)) continue;
    try {
      const yml = loadYaml(ymlPath);
      wikis.push({ id: e.name, name: yml.site_name || e.name });
    } catch (err) {
      // skip broken wikis
    }
  }
  return wikis;
}

function getWikiNav(wikiId) {
  const docsRoot = getDocsRoot();
  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return null;
  const yml = loadYaml(ymlPath);
  return { name: yml.site_name, nav: yml.nav || [] };
}

function getWikiPage(wikiId, pagePath) {
  const docsRoot = getDocsRoot();
  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return null;

  const yml = loadYaml(ymlPath);
  const docsDir = path.join(docsRoot, wikiId, yml.docs_dir || 'docs');
  const filePath = path.join(docsDir, pagePath);

  if (!filePath.startsWith(docsDir)) return null;
  if (!fs.existsSync(filePath)) return null;

  const mdContent = fs.readFileSync(filePath, 'utf8');
  const html = marked.parse(mdContent);
  return { path: pagePath, html, markdown: mdContent };
}

function searchWiki(wikiId, query) {
  const docsRoot = getDocsRoot();
  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return [];

  const yml = loadYaml(ymlPath);
  const docsDir = path.join(docsRoot, wikiId, yml.docs_dir || 'docs');
  const results = [];
  const q = query.toLowerCase();

  function searchDir(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= 20) return;
      if (entry.isDirectory()) {
        searchDir(path.join(dir, entry.name), prefix + entry.name + '/');
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        if (content.toLowerCase().includes(q)) {
          const firstLine = content.split('\n').find(l => l.trim()) || entry.name;
          const title = firstLine.replace(/^#+\s*/, '');
          const idx = content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 50);
          const end = Math.min(content.length, idx + q.length + 50);
          const snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
          results.push({ path: prefix + entry.name, title, snippet });
        }
      }
    }
  }

  searchDir(docsDir);
  return results;
}

async function chat(messages, wiki, currentPage, pageContent) {
  const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim();

  let systemMessage = `You are a helpful assistant for the DevExpress internal wiki system. You help users navigate, understand, and find information in the wiki content. Be concise and helpful.`;

  if (wiki) {
    const docsRoot = getDocsRoot();
    const ymlPath = path.join(docsRoot, wiki, 'mkdocs.yml');
    if (fs.existsSync(ymlPath)) {
      const yml = loadYaml(ymlPath);
      systemMessage += `\n\nThe user is currently viewing the "${yml.site_name}" wiki.`;
      if (yml.nav) {
        systemMessage += `\n\nWiki navigation structure:\n${yaml.dump(yml.nav)}`;
      }
    }
  }

  if (currentPage) {
    systemMessage += `\n\n--- CURRENT PAGE ---\nThe user is currently viewing: "${currentPage}"`;
  }

  if (pageContent) {
    const trimmed = pageContent.length > 8000 ? pageContent.slice(0, 8000) + '\n\n[...content truncated...]' : pageContent;
    systemMessage += `\n\nPage content (markdown):\n${trimmed}`;
  }

  const chatMessages = [{ role: 'system', content: systemMessage }, ...messages];

  const chatRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ghToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'gpt-4o', messages: chatMessages })
  });

  if (!chatRes.ok) {
    const err = await chatRes.text();
    throw new Error(`GitHub Models API error: ${err}`);
  }

  const chatData = await chatRes.json();
  return chatData.choices?.[0]?.message?.content || 'No response.';
}

module.exports = { listWikis, getWikiNav, getWikiPage, searchWiki, chat };
