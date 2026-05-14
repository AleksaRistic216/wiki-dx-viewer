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
    code(code, lang) {
      const text = typeof code === 'object' ? code.text : code;
      const language = typeof code === 'object' ? code.lang : lang;
      if (!text) return `<pre><code class="hljs"></code></pre>`;
      if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(text, { language }).value;
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
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

function syncRepo() {
  if (process.env.WIKI_DX_PATH) {
    const repoPath = path.resolve(process.env.WIKI_DX_PATH);
    execSync('git pull', { cwd: repoPath, stdio: 'pipe' });
    return;
  }

  if (!isRepoCloned()) {
    cloneRepo();
    return;
  }

  execSync('git pull', { cwd: REPO_DIR, stdio: 'pipe' });
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

function preprocessTabs(markdown) {
  // Convert MkDocs tabbed syntax (=== "Title") into HTML tabs
  const lines = markdown.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const tabMatch = lines[i].match(/^===\s+"([^"]+)"\s*$/);
    if (!tabMatch) {
      result.push(lines[i]);
      i++;
      continue;
    }

    // Collect all tabs in this group
    const tabs = [];
    while (i < lines.length) {
      // Skip blank lines between tabs
      while (i < lines.length && lines[i].trim() === '') {
        // Peek ahead to see if there's another tab coming
        let peekIdx = i + 1;
        while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;
        if (peekIdx < lines.length && lines[peekIdx].match(/^===\s+"[^"]+"\s*$/)) {
          i++;
          continue;
        }
        break;
      }

      const match = lines[i]?.match(/^===\s+"([^"]+)"\s*$/);
      if (!match) break;

      const title = match[1];
      i++;
      const contentLines = [];

      // Collect indented content lines (4 spaces or 1 tab)
      while (i < lines.length) {
        if (lines[i].match(/^===\s+"[^"]+"\s*$/)) break;
        if (lines[i].match(/^    /) || lines[i].match(/^\t/)) {
          contentLines.push(lines[i].replace(/^    /, '').replace(/^\t/, ''));
          i++;
        } else if (lines[i].trim() === '') {
          // Blank line - check if next content is still indented or another tab
          let peekIdx = i + 1;
          while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;
          if (peekIdx < lines.length && (lines[peekIdx].match(/^    /) || lines[peekIdx].match(/^\t/) || lines[peekIdx].match(/^===\s+"[^"]+"\s*$/))) {
            contentLines.push('');
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      tabs.push({ title, content: contentLines.join('\n').trim() });
    }

    if (tabs.length > 0) {
      const tabId = `tab-${Math.random().toString(36).slice(2, 8)}`;
      let tabHtml = `<div class="wiki-tabs" data-tab-group="${tabId}">`;
      tabHtml += `<div class="wiki-tabs-nav">`;
      tabs.forEach((tab, idx) => {
        tabHtml += `<button class="wiki-tab-btn${idx === 0 ? ' active' : ''}" data-tab-index="${idx}" data-tab-group="${tabId}">${tab.title}</button>`;
      });
      tabHtml += `</div>`;
      tabs.forEach((tab, idx) => {
        tabHtml += `<div class="wiki-tab-panel${idx === 0 ? ' active' : ''}" data-tab-index="${idx}" data-tab-group="${tabId}">\n\n${tab.content}\n\n</div>`;
      });
      tabHtml += `</div>`;
      result.push(tabHtml);
    }
  }

  return result.join('\n');
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
  const preprocessed = preprocessTabs(mdContent);
  let html = marked.parse(preprocessed);

  // Rewrite relative image paths to use the media API route
  const pageDir = path.dirname(pagePath);
  html = html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, before, src, after) => {
    // Skip absolute URLs and data URIs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/')) {
      return match;
    }
    // Resolve relative path against page directory
    const resolved = path.posix.normalize(path.posix.join(pageDir.replace(/\\/g, '/'), src));
    const apiPath = `/api/wikis/${wikiId}/media/${resolved}`;
    return `<img ${before}src="${apiPath}"${after}>`;
  });

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

function extractHeaders(markdown) {
  return markdown.split('\n')
    .filter(line => /^#{1,4}\s/.test(line))
    .map(line => line.replace(/^#+\s*/, '').trim());
}

function extractPageTitle(content) {
  const firstLine = content.split('\n').find(l => l.trim());
  if (!firstLine) return '';
  return firstLine.replace(/^#+\s*/, '').trim();
}

function getWikiPageList(wikiId, excludePage) {
  const docsRoot = getDocsRoot();
  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return [];

  const yml = loadYaml(ymlPath);
  const docsDir = path.join(docsRoot, wikiId, yml.docs_dir || 'docs');
  const pages = [];

  function collectPages(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        collectPages(path.join(dir, entry.name), prefix + entry.name + '/');
      } else if (entry.name.endsWith('.md')) {
        const pagePath = prefix + entry.name;
        if (pagePath === excludePage) continue;
        const filePath = path.join(dir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const title = extractPageTitle(content);
        pages.push({ path: pagePath, title, content });
      }
    }
  }

  collectPages(docsDir);
  return pages;
}

function buildTieredContext(wikiId, query, excludePage) {
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'how', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'this', 'that', 'from', 'they', 'would', 'there', 'their', 'about', 'could', 'does', 'should']);
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  if (keywords.length === 0) return '';

  const pages = getWikiPageList(wikiId, excludePage);
  if (pages.length === 0) return '';

  // Score pages by keyword matches in title and content
  const scored = pages.map(page => {
    const lowerTitle = page.title.toLowerCase();
    const lowerContent = page.content.toLowerCase();
    let titleScore = 0;
    let contentScore = 0;
    for (const kw of keywords) {
      if (lowerTitle.includes(kw)) titleScore++;
      if (lowerContent.includes(kw)) contentScore++;
    }
    return { ...page, titleScore, contentScore, totalScore: titleScore * 3 + contentScore };
  }).filter(p => p.totalScore > 0);

  scored.sort((a, b) => b.totalScore - a.totalScore);

  if (scored.length === 0) return '';

  let context = '\n\n--- RELEVANT WIKI CONTEXT ---\n';
  let budget = 3000; // character budget for additional context

  // Tier 1: Page titles of all matched pages (very cheap)
  const titleMatched = scored.slice(0, 15);
  context += `\nRelevant pages found:\n`;
  for (const page of titleMatched) {
    const line = `- ${page.path}: "${page.title}"\n`;
    context += line;
    budget -= line.length;
  }

  // Tier 2: Headers of top-scoring pages
  const topPages = scored.slice(0, 5);
  context += `\nHeaders from most relevant pages:\n`;
  for (const page of topPages) {
    const headers = extractHeaders(page.content);
    if (headers.length > 0) {
      const headerBlock = `\n## ${page.path}\n${headers.map(h => `- ${h}`).join('\n')}\n`;
      if (headerBlock.length > budget) break;
      context += headerBlock;
      budget -= headerBlock.length;
    }
  }

  // Tier 3: Content snippet from the single best match
  if (budget > 200 && scored.length > 0) {
    const best = scored[0];
    const snippet = best.content.length > budget
      ? best.content.slice(0, budget) + '\n[...truncated...]'
      : best.content;
    context += `\n\nFull content of best match (${best.path}):\n${snippet}`;
  }

  return context;
}

async function chat(messages, wiki, currentPage, pageContent) {
  const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim();

  let systemMessage = `You are a helpful assistant for the DevExpress internal wiki system. You help users navigate, understand, and find information in the wiki content. You have access to the entire wiki section the user is browsing, not just the current page. Be concise and helpful. When referencing other wiki pages, use markdown links with the page path.`;

  if (wiki) {
    const docsRoot = getDocsRoot();
    const ymlPath = path.join(docsRoot, wiki, 'mkdocs.yml');
    if (fs.existsSync(ymlPath)) {
      const yml = loadYaml(ymlPath);
      systemMessage += `\n\nThe user is currently viewing the "${yml.site_name}" wiki.`;
      if (yml.nav) {
        const navDump = yaml.dump(yml.nav);
        const navTrimmed = navDump.length > 1500 ? navDump.slice(0, 1500) + '\n...[truncated]' : navDump;
        systemMessage += `\n\nWiki navigation structure:\n${navTrimmed}`;
      }
    }
  }

  if (currentPage) {
    systemMessage += `\n\n--- CURRENT PAGE ---\nThe user is currently viewing: "${currentPage}"`;
  }

  if (pageContent) {
    const trimmed = pageContent.length > 2000 ? pageContent.slice(0, 2000) + '\n\n[...content truncated...]' : pageContent;
    systemMessage += `\n\nPage content (markdown):\n${trimmed}`;
  }

  // Build tiered context from relevant wiki pages
  if (wiki && messages.length > 0) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      systemMessage += buildTieredContext(wiki, lastUserMsg.content, currentPage);
    }
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

module.exports = { listWikis, getWikiNav, getWikiPage, searchWiki, chat, getDocsRoot, syncRepo };
