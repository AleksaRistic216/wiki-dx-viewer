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

function findNavTitleForPage(wikiId, pagePath) {
  const docsRoot = getDocsRoot();
  const ymlPath = path.join(docsRoot, wikiId, 'mkdocs.yml');
  if (!fs.existsSync(ymlPath)) return null;
  const yml = loadYaml(ymlPath);
  if (!yml.nav) return null;

  function searchNav(items) {
    for (const item of items) {
      if (typeof item === 'string') continue;
      for (const [title, value] of Object.entries(item)) {
        if (typeof value === 'string' && value === pagePath) return title;
        if (Array.isArray(value)) {
          const found = searchNav(value);
          if (found) return found;
        }
      }
    }
    return null;
  }

  return searchNav(yml.nav);
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

function hasAlternateTabStyle(yml) {
  // Check if pymdownx.tabbed has alternate_style: true in the mkdocs.yml
  const extensions = yml?.markdown_extensions;
  if (!Array.isArray(extensions)) return false;
  for (const ext of extensions) {
    if (typeof ext === 'object' && ext['pymdownx.tabbed']) {
      return ext['pymdownx.tabbed'].alternate_style === true;
    }
  }
  return false;
}

function preprocessTabs(markdown, yml) {
  // Only process === "Title" tab syntax if the wiki has alternate_style: true
  if (!hasAlternateTabStyle(yml)) return markdown;

  // Convert MkDocs tabbed syntax (=== "Title") into HTML tabs
  // MkDocs requires a blank line between === "Title" and the indented content.
  // We enforce this: if no blank line follows, it's not valid tab syntax.
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

    // Verify this is valid tab syntax: next line must be blank
    if (i + 1 >= lines.length || lines[i + 1].trim() !== '') {
      // No blank line after === — not valid MkDocs tab syntax, output as-is
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

      // Valid MkDocs tabs require a blank line after === "Title"
      if (i >= lines.length || lines[i].trim() !== '') {
        // No blank line — invalid tab, treat this tab as having no content
        tabs.push({ title, content: '' });
        continue;
      }
      i++; // skip the blank line

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
  const preprocessed = preprocessTabs(mdContent, yml);
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

function extractKeywords(query) {
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'how', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'this', 'that', 'from', 'they', 'would', 'there', 'their', 'about', 'could', 'does', 'should']);
  return query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));
}

function scorePages(pages, keywords) {
  return pages.map(page => {
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
}

function formatTieredContext(scored, budget = 3000) {
  if (scored.length === 0) return '';

  let context = '\n\n--- RELEVANT WIKI CONTEXT ---\n';

  // Tier 1: Page titles of all matched pages (very cheap)
  const titleMatched = scored.slice(0, 15);
  context += `\nRelevant pages found:\n`;
  for (const page of titleMatched) {
    const wikiLabel = page.wikiId ? `[${page.wikiId}] ` : '';
    const line = `- ${wikiLabel}${page.path}: "${page.title}"\n`;
    context += line;
    budget -= line.length;
  }

  // Tier 2: Headers of top-scoring pages
  const topPages = scored.slice(0, 5);
  context += `\nHeaders from most relevant pages:\n`;
  for (const page of topPages) {
    const headers = extractHeaders(page.content);
    if (headers.length > 0) {
      const wikiLabel = page.wikiId ? `[${page.wikiId}] ` : '';
      const headerBlock = `\n## ${wikiLabel}${page.path}\n${headers.map(h => `- ${h}`).join('\n')}\n`;
      if (headerBlock.length > budget) break;
      context += headerBlock;
      budget -= headerBlock.length;
    }
  }

  // Tier 3: Content snippet from the single best match
  if (budget > 200 && scored.length > 0) {
    const best = scored[0];
    const wikiLabel = best.wikiId ? `[${best.wikiId}] ` : '';
    const snippet = best.content.length > budget
      ? best.content.slice(0, budget) + '\n[...truncated...]'
      : best.content;
    context += `\n\nFull content of best match (${wikiLabel}${best.path}):\n${snippet}`;
  }

  return context;
}

function buildTieredContext(wikiId, query, excludePage) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return '';

  const pages = getWikiPageList(wikiId, excludePage);
  if (pages.length === 0) return '';

  const scored = scorePages(pages, keywords);
  scored.sort((a, b) => b.totalScore - a.totalScore);

  return formatTieredContext(scored);
}

function buildTieredContextAllWikis(query) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return '';

  const wikis = listWikis();
  let allScored = [];

  for (const wiki of wikis) {
    const pages = getWikiPageList(wiki.id, null);
    const scored = scorePages(pages, keywords);
    // Tag each result with its wiki ID
    for (const page of scored) {
      page.wikiId = wiki.id;
    }
    allScored = allScored.concat(scored);
  }

  allScored.sort((a, b) => b.totalScore - a.totalScore);

  return formatTieredContext(allScored);
}

async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < retries) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
      const waitMs = Math.min(retryAfter, 60) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }
    return res;
  }
}

async function chat(messages, wiki, currentPage, pageContent, { enableEditing = false, model = 'gpt-4o' } = {}) {
  let result = {};
  await chatStream(messages, wiki, currentPage, pageContent, {
    enableEditing,
    model,
    onStatus() {},
    onToken() {},
    onDone(r) { result = r; },
  });
  return result;
}

async function chatStream(messages, wiki, currentPage, pageContent, { enableEditing = false, model = 'gpt-4o', onStatus, onToken, onDone } = {}) {
  onStatus('Authenticating with GitHub...');
  const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim();

  let systemMessage = `You are a helpful assistant for the DevExpress internal wiki system. You help users navigate, understand, and find information in the wiki content. You have access to the entire wiki section the user is browsing, not just the current page. Be concise and helpful. When referencing other wiki pages, use markdown links with the page path.\n\nYou can read files and list directories anywhere on the user's computer using the read_file and list_directory tools. Use these when the user asks you to look at files, check paths, or explore the file system.`;

  if (enableEditing) {
    systemMessage += `\n\nYou can edit the current wiki page when the user asks you to make changes. Use the edit_page tool to apply edits. When editing, output the FULL updated page content (not just the changed part). Only edit when the user explicitly asks for a change.\n\nYou can also rename navigation menu entries using the edit_nav_entry tool. Use it when the user asks to translate or rename a menu item. The old_title must match exactly as shown in the wiki navigation structure above.\n\nYou can create new wiki pages using the create_page tool. Use it when the user asks to create a new page. Provide the file path (relative to the docs directory, e.g. "howto/my-new-page.md"), a navigation title, and the full markdown content for the new page.`;

    // Add tab syntax instructions based on wiki configuration
    if (wiki) {
      const docsRoot = getDocsRoot();
      const ymlPath = path.join(docsRoot, wiki, 'mkdocs.yml');
      if (fs.existsSync(ymlPath)) {
        const yml = loadYaml(ymlPath);
        if (hasAlternateTabStyle(yml)) {
          systemMessage += `\n\nIMPORTANT — MkDocs Content Tabs syntax:\nThis wiki supports tabbed content (pymdownx.tabbed with alternate_style). When writing tabbed content, you MUST follow this exact format:\n\n=== "Tab Title 1"\n\n    Content for tab 1 (indented 4 spaces)\n\n=== "Tab Title 2"\n\n    Content for tab 2 (indented 4 spaces)\n\nCritical rules:\n- There MUST be a blank line between === "Title" and the indented content.\n- Tab content MUST be indented by exactly 4 spaces.\n- If tabs are nested inside an admonition (??? or !!!), add 4 more spaces for the admonition level:\n\n??? note "Example"\n    === "Tab 1"\n\n        Content (8 spaces: 4 for admonition + 4 for tab)\n\n    === "Tab 2"\n\n        Content (8 spaces: 4 for admonition + 4 for tab)\n\nWithout the blank line after ===, tabs will NOT render on the deployed wiki.`;
        } else {
          systemMessage += `\n\nIMPORTANT: This wiki does NOT support the === "Title" content tabs syntax (pymdownx.tabbed alternate_style is not enabled). Do NOT use === "Tab Name" syntax. Instead, use headings or bold text to separate content that might otherwise be tabbed.`;
        }
      }
    }
  }

  if (wiki) {
    onStatus('Loading wiki structure...');
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
  } else {
    systemMessage += `\n\nNo specific wiki is selected. You have access to search across ALL available wikis. When you find relevant content, mention which wiki it came from (shown in [brackets] in the context). When linking to wiki pages, use the format [title](wikiId:path/to/page.md) — for example [CPM Tests](winformswiki:howto/cpm-tests.md).`;
  }

  if (currentPage) {
    systemMessage += `\n\n--- CURRENT PAGE ---\nThe user is currently viewing: "${currentPage}"`;
    if (wiki && enableEditing) {
      const navTitle = findNavTitleForPage(wiki, currentPage);
      if (navTitle) {
        systemMessage += `\nThe navigation menu entry for this page is: "${navTitle}"`;
      }
    }
  }

  if (pageContent) {
    // When editing is enabled, provide full content so the AI can edit it
    const maxLen = enableEditing ? 15000 : 2000;
    const trimmed = pageContent.length > maxLen ? pageContent.slice(0, maxLen) + '\n\n[...content truncated...]' : pageContent;
    systemMessage += `\n\nPage content (markdown):\n${trimmed}`;
  }

  // Build tiered context from relevant wiki pages
  if (messages.length > 0) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      if (wiki) {
        onStatus('Searching wiki for relevant pages...');
        systemMessage += buildTieredContext(wiki, lastUserMsg.content, currentPage);
      } else {
        onStatus('Searching all wikis for relevant pages...');
        systemMessage += buildTieredContextAllWikis(lastUserMsg.content);
      }
    }
  }

  const chatMessages = [{ role: 'system', content: systemMessage }, ...messages];

  const fsTools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file at any path on the computer.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or relative file path to read'
            }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List files and directories at a given path on the computer.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or relative directory path to list'
            }
          },
          required: ['path']
        }
      }
    }
  ];

  const editTools = enableEditing && currentPage ? [
    {
      type: 'function',
      function: {
        name: 'edit_page',
        description: 'Edit the current wiki page. Provide the full updated markdown content of the page.',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The full updated markdown content for the page'
            },
            summary: {
              type: 'string',
              description: 'A brief summary of what was changed'
            }
          },
          required: ['content', 'summary']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_nav_entry',
        description: 'Rename a navigation menu entry in the wiki\'s mkdocs.yml. Use this when the user asks to translate or rename a menu/nav item.',
        parameters: {
          type: 'object',
          properties: {
            old_title: {
              type: 'string',
              description: 'The current title of the nav entry to rename'
            },
            new_title: {
              type: 'string',
              description: 'The new title for the nav entry'
            },
            summary: {
              type: 'string',
              description: 'A brief summary of the change'
            }
          },
          required: ['old_title', 'new_title', 'summary']
        }
      }
    }
  ] : [];

  const createTools = enableEditing && wiki ? [
    {
      type: 'function',
      function: {
        name: 'create_page',
        description: 'Create a new wiki page. Creates the markdown file and adds a navigation entry in mkdocs.yml.',
        parameters: {
          type: 'object',
          properties: {
            page_path: {
              type: 'string',
              description: 'The file path for the new page relative to the docs directory (e.g. "howto/my-new-page.md")'
            },
            title: {
              type: 'string',
              description: 'The navigation title for the new page'
            },
            content: {
              type: 'string',
              description: 'The full markdown content for the new page'
            },
            summary: {
              type: 'string',
              description: 'A brief summary of what the new page is about'
            }
          },
          required: ['page_path', 'title', 'content', 'summary']
        }
      }
    }
  ] : [];

  const tools = [...fsTools, ...editTools, ...createTools];

  onStatus(`Sending request to ${model}...`);
  const requestBody = { model, messages: chatMessages, tools };

  const chatRes = await fetchWithRetry('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ghToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!chatRes.ok) {
    const err = await chatRes.text();
    throw new Error(`GitHub Models API error: ${err}`);
  }

  const chatData = await chatRes.json();
  const choice = chatData.choices?.[0];

  if (!choice) { onDone({ reply: 'No response.' }); return; }

  // No tool calls — emit the text token by token
  if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
    const text = choice.message?.content || 'No response.';
    onStatus('Generating response...');
    const words = text.split(/(\s+)/);
    for (const word of words) { onToken(word); }
    onDone({ reply: '__streamed__', edited: false });
    return;
  }

  // Handle tool calls
  const toolResults = [];
  let editSummary = '';
  let anyEdited = false;

  for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === 'read_file') {
        onStatus(`Reading file: ${args.path}`);
        try {
          const filePath = path.resolve(args.path);
          const content = fs.readFileSync(filePath, 'utf8');
          const trimmed = content.length > 20000 ? content.slice(0, 20000) + '\n\n[...truncated at 20000 chars...]' : content;
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: trimmed
          });
        } catch (err) {
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: err.message })
          });
        }
      } else if (toolCall.function.name === 'list_directory') {
        onStatus(`Listing directory: ${args.path}`);
        try {
          const dirPath = path.resolve(args.path);
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          const listing = entries.map(e => (e.isDirectory() ? `[dir]  ${e.name}` : `[file] ${e.name}`)).join('\n');
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: listing || '(empty directory)'
          });
        } catch (err) {
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: err.message })
          });
        }
      } else if (toolCall.function.name === 'edit_page') {
        onStatus(`Editing page: ${currentPage}`);
        const { startSession, savePage, loadSession } = require('./editing');
        if (!loadSession()) {
          startSession();
        }
        savePage(wiki, currentPage, args.content);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true, summary: args.summary })
        });
        editSummary = args.summary;
        anyEdited = true;
      } else if (toolCall.function.name === 'edit_nav_entry') {
        onStatus(`Renaming nav entry: "${args.old_title}" → "${args.new_title}"`);
        const { editNavEntry, startSession, loadSession } = require('./editing');
        if (!loadSession()) {
          startSession();
        }
        editNavEntry(wiki, args.old_title, args.new_title);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true, summary: args.summary })
        });
        editSummary = args.summary;
        anyEdited = true;
      } else if (toolCall.function.name === 'create_page') {
        onStatus(`Creating page: ${args.page_path}`);
        const { createPage, startSession, loadSession } = require('./editing');
        if (!loadSession()) {
          startSession();
        }
        createPage(wiki, args.page_path, args.title, args.content);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true, path: args.page_path, title: args.title, summary: args.summary })
        });
        editSummary = args.summary;
      anyEdited = true;
    }
  }

  if (toolResults.length > 0) {
    // Get a follow-up response from the AI after tool execution
    let followUpMessages = [
      ...chatMessages,
      choice.message,
      ...toolResults
    ];

    // Allow up to 5 follow-up tool rounds (for multi-step file exploration)
    for (let round = 0; round < 5; round++) {
      onStatus(`Calling ${model} (follow-up round ${round + 1})...`);
      const followUpRes = await fetchWithRetry('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages: followUpMessages, tools })
      });

      if (!followUpRes.ok) break;

      const followUpData = await followUpRes.json();
      const followUpChoice = followUpData.choices?.[0];
      if (!followUpChoice) break;

      // If the follow-up also wants to call tools, execute them
      if (followUpChoice.finish_reason === 'tool_calls' && followUpChoice.message.tool_calls) {
        const moreResults = [];
        followUpMessages.push(followUpChoice.message);

        for (const toolCall of followUpChoice.message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          if (toolCall.function.name === 'read_file') {
            onStatus(`Reading file: ${args.path}`);
            try {
              const filePath = path.resolve(args.path);
              const content = fs.readFileSync(filePath, 'utf8');
              const trimmed = content.length > 20000 ? content.slice(0, 20000) + '\n\n[...truncated at 20000 chars...]' : content;
              moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: trimmed });
            } catch (err) {
              moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: err.message }) });
            }
          } else if (toolCall.function.name === 'list_directory') {
            onStatus(`Listing directory: ${args.path}`);
            try {
              const dirPath = path.resolve(args.path);
              const entries = fs.readdirSync(dirPath, { withFileTypes: true });
              const listing = entries.map(e => (e.isDirectory() ? `[dir]  ${e.name}` : `[file] ${e.name}`)).join('\n');
              moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: listing || '(empty directory)' });
            } catch (err) {
              moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: err.message }) });
            }
          } else if (toolCall.function.name === 'edit_page') {
            onStatus(`Editing page: ${currentPage}`);
            const { startSession, savePage, loadSession } = require('./editing');
            if (!loadSession()) startSession();
            savePage(wiki, currentPage, args.content);
            moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: true, summary: args.summary }) });
            editSummary = args.summary;
            anyEdited = true;
          } else if (toolCall.function.name === 'edit_nav_entry') {
            onStatus(`Renaming nav entry: "${args.old_title}" → "${args.new_title}"`);
            const { editNavEntry, startSession, loadSession } = require('./editing');
            if (!loadSession()) startSession();
            editNavEntry(wiki, args.old_title, args.new_title);
            moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: true, summary: args.summary }) });
            editSummary = args.summary;
            anyEdited = true;
          } else if (toolCall.function.name === 'create_page') {
            onStatus(`Creating page: ${args.page_path}`);
            const { createPage, startSession, loadSession } = require('./editing');
            if (!loadSession()) startSession();
            createPage(wiki, args.page_path, args.title, args.content);
            moreResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: true, path: args.page_path, title: args.title, summary: args.summary }) });
            editSummary = args.summary;
            anyEdited = true;
          }
        }

        followUpMessages.push(...moreResults);
        continue;
      }

      // Final text response — emit token by token
      const followUpContent = followUpChoice.message?.content;
      if (followUpContent) {
        onStatus('Generating response...');
        const words = followUpContent.split(/(\s+)/);
        for (const word of words) {
          onToken(word);
        }
        onDone({ reply: '__streamed__', edited: anyEdited, summary: editSummary });
        return;
      }
      let reply = anyEdited ? `✅ ${editSummary}` : 'No response.';
      onDone({ reply, edited: anyEdited, summary: editSummary });
      return;
    }

    // If we exhausted rounds, return what we have
    const reply = anyEdited ? `✅ ${editSummary}` : 'I explored the files but could not produce a final answer.';
    onDone({ reply, edited: anyEdited, summary: editSummary });
  }
}

module.exports = { listWikis, getWikiNav, getWikiPage, searchWiki, chat, chatStream, getDocsRoot, syncRepo };
