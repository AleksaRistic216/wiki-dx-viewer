#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');
const { Marked } = require('marked');
const { gfmHeadingId } = require('marked-gfm-heading-id');
const hljs = require('highlight.js');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;
const WIKI_REPO_URL = 'https://github.com/DevExpress/wiki-dx.git';

// Data directory - stores the cloned repo
const DATA_DIR = path.join(os.homedir(), '.wiki-dx-viewer');
const REPO_DIR = path.join(DATA_DIR, 'wiki-dx');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {};
}

function saveConfig(config) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function isRepoCloned() {
  const docsDir = path.join(REPO_DIR, 'docs');
  if (!fs.existsSync(docsDir)) return false;
  const entries = fs.readdirSync(docsDir, { withFileTypes: true });
  return entries.some(e => e.isDirectory() && fs.existsSync(path.join(docsDir, e.name, 'mkdocs.yml')));
}

function cloneRepo() {
  console.log('\n  ┌─────────────────────────────────────────────────┐');
  console.log('  │         Wiki DX Viewer - First Time Setup        │');
  console.log('  └─────────────────────────────────────────────────┘\n');
  console.log(`  📦 Cloning wiki-dx repository...`);
  console.log(`     From: ${WIKI_REPO_URL}`);
  console.log(`     To:   ${REPO_DIR}\n`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  execSync(`git clone --depth 1 "${WIKI_REPO_URL}" "${REPO_DIR}"`, { stdio: 'inherit' });
  console.log('\n  ✅ Repository cloned successfully!\n');
}

function pullRepo() {
  console.log('  🔄 Updating wiki-dx repository...');
  try {
    execSync('git pull --ff-only', { cwd: REPO_DIR, stdio: 'pipe' });
    console.log('  ✅ Up to date.\n');
  } catch (err) {
    console.log('  ⚠️  Could not update (working offline or conflict). Using existing content.\n');
  }
}

function getDocsRoot() {
  // Allow override via CLI arg or env var
  const argIdx = process.argv.indexOf('--wiki-path');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return path.join(path.resolve(process.argv[argIdx + 1]), 'docs');
  }
  if (process.env.WIKI_DX_PATH) {
    return path.join(path.resolve(process.env.WIKI_DX_PATH), 'docs');
  }

  // Auto-clone or pull
  if (!isRepoCloned()) {
    cloneRepo();
  } else if (!process.argv.includes('--offline')) {
    pullRepo();
  }

  return path.join(REPO_DIR, 'docs');
}

// --- Main startup ---
(function () {
  const DOCS_ROOT = getDocsRoot();

// Markdown renderer setup
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

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Custom YAML schema that ignores Python-specific tags
const PYTHON_TAG_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type('tag:yaml.org,2002:python/name:material.extensions.emoji.twemoji', { kind: 'scalar', construct: () => null }),
  new yaml.Type('tag:yaml.org,2002:python/name:material.extensions.emoji.to_svg', { kind: 'scalar', construct: () => null }),
  new yaml.Type('tag:yaml.org,2002:python/name:materialx.emoji.twemoji', { kind: 'scalar', construct: () => null }),
  new yaml.Type('tag:yaml.org,2002:python/name:materialx.emoji.to_svg', { kind: 'scalar', construct: () => null }),
]);

function loadYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip all !!python/name: tags before parsing as a fallback
  const sanitized = content.replace(/!!python\/name:\S+/g, "'__python_tag__'");
  return yaml.load(sanitized);
}

// List available wikis
app.get('/api/wikis', (req, res) => {
  const entries = fs.readdirSync(DOCS_ROOT, { withFileTypes: true });
  const wikis = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const ymlPath = path.join(DOCS_ROOT, e.name, 'mkdocs.yml');
    if (!fs.existsSync(ymlPath)) continue;
    try {
      const yml = loadYaml(ymlPath);
      wikis.push({ id: e.name, name: yml.site_name || e.name });
    } catch (err) {
      console.warn(`Skipping ${e.name}: ${err.message}`);
    }
  }
  res.json(wikis);
});

// Get navigation tree for a wiki
app.get('/api/wikis/:wiki/nav', (req, res) => {
  const wikiDir = path.join(DOCS_ROOT, req.params.wiki);
  const ymlPath = path.join(wikiDir, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return res.status(404).json({ error: 'Wiki not found' });

  const yml = loadYaml(ymlPath);
  res.json({ name: yml.site_name, nav: yml.nav || [] });
});

// Render a markdown page
app.get('/api/wikis/:wiki/page/*', (req, res) => {
  const wiki = req.params.wiki;
  const pagePath = req.params[0] || 'index.md';
  const ymlPath = path.join(DOCS_ROOT, wiki, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return res.status(404).json({ error: 'Wiki not found' });

  const yml = loadYaml(ymlPath);
  const docsDir = path.join(DOCS_ROOT, wiki, yml.docs_dir || 'docs');
  const filePath = path.join(docsDir, pagePath);

  // Security: ensure path is within docs dir
  if (!filePath.startsWith(docsDir)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Page not found' });

  const mdContent = fs.readFileSync(filePath, 'utf8');
  const html = marked.parse(mdContent);
  res.json({ path: pagePath, html, markdown: mdContent });
});

// Search within a wiki
app.get('/api/wikis/:wiki/search', (req, res) => {
  const wiki = req.params.wiki;
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);

  const ymlPath = path.join(DOCS_ROOT, wiki, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return res.status(404).json({ error: 'Wiki not found' });

  const yml = loadYaml(ymlPath);
  const docsDir = path.join(DOCS_ROOT, wiki, yml.docs_dir || 'docs');
  const results = [];

  function searchDir(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        searchDir(path.join(dir, entry.name), prefix + entry.name + '/');
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        if (content.toLowerCase().includes(query)) {
          const firstLine = content.split('\n').find(l => l.trim()) || entry.name;
          const title = firstLine.replace(/^#+\s*/, '');
          results.push({ path: prefix + entry.name, title, snippet: getSnippet(content, query) });
        }
        if (results.length >= 20) return;
      }
    }
  }

  function getSnippet(content, q) {
    const idx = content.toLowerCase().indexOf(q);
    if (idx === -1) return '';
    const start = Math.max(0, idx - 50);
    const end = Math.min(content.length, idx + q.length + 50);
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
  }

  searchDir(docsDir);
  res.json(results);
});

// Chat endpoint - GitHub Models API
app.post('/api/chat', async (req, res) => {
  const { messages, wiki, currentPage, pageContent } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages' });

  try {
    // Get GitHub token from gh CLI
    const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim();

    // Build system message with full context
    let systemMessage = `You are a helpful assistant for the DevExpress internal wiki system. You help users navigate, understand, and find information in the wiki content. Be concise and helpful.`;

    if (wiki) {
      const ymlPath = path.join(DOCS_ROOT, wiki, 'mkdocs.yml');
      if (fs.existsSync(ymlPath)) {
        const yml = loadYaml(ymlPath);
        systemMessage += `\n\nThe user is currently viewing the "${yml.site_name}" wiki.`;
        if (yml.nav) {
          systemMessage += `\n\nWiki navigation structure (use this to suggest relevant pages):\n${yaml.dump(yml.nav)}`;
        }
      }
    }

    if (currentPage) {
      systemMessage += `\n\n--- CURRENT PAGE ---\nThe user is currently viewing: "${currentPage}"`;
    }

    if (pageContent) {
      // Trim to avoid excessive token usage
      const trimmed = pageContent.length > 8000 ? pageContent.slice(0, 8000) + '\n\n[...content truncated...]' : pageContent;
      systemMessage += `\n\nPage content (markdown):\n${trimmed}`;
    }

    // Call GitHub Models API
    const chatMessages = [
      { role: 'system', content: systemMessage },
      ...messages
    ];

    const chatRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: chatMessages
      })
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      return res.status(chatRes.status).json({ error: `GitHub Models API error: ${err}` });
    }

    const chatData = await chatRes.json();
    const reply = chatData.choices?.[0]?.message?.content || 'No response.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Config API - view status
app.get('/api/config', (req, res) => {
  res.json({ repoDir: REPO_DIR, docsRoot: DOCS_ROOT, configDir: DATA_DIR });
});

// Force re-pull the repo
app.post('/api/config/update', (req, res) => {
  try {
    execSync('git pull --ff-only', { cwd: REPO_DIR, encoding: 'utf8' });
    res.json({ success: true, message: 'Repository updated.' });
  } catch (err) {
    res.status(500).json({ error: `Pull failed: ${err.message}` });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`  📁 Wiki source: ${DOCS_ROOT}`);
  console.log(`  🌐 Wiki Viewer running at http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C to stop\n`);
});

})();
