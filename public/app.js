// Wiki Viewer - Frontend Application
(function () {
  let currentWiki = null;
  let currentPagePath = null;
  let currentPageMarkdown = null;
  let chatMessages = [];

  const navPanel = document.getElementById('nav-panel');
  const chatPanel = document.getElementById('chat-panel');
  const wikiSelect = document.getElementById('wiki-select');
  const navTree = document.getElementById('nav-tree');
  const pageContent = document.getElementById('page-content');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  // Toggle buttons
  document.getElementById('nav-toggle').addEventListener('click', () => navPanel.classList.toggle('collapsed'));
  document.getElementById('chat-toggle').addEventListener('click', () => chatPanel.classList.toggle('collapsed'));

  // Load wikis
  async function loadWikis() {
    const res = await fetch('/api/wikis');
    const wikis = await res.json();
    wikiSelect.innerHTML = '<option value="">— Select Wiki —</option>';
    wikis.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name;
      wikiSelect.appendChild(opt);
    });
  }

  wikiSelect.addEventListener('change', () => {
    const wiki = wikiSelect.value;
    if (wiki) {
      currentWiki = wiki;
      loadNav(wiki);
    }
  });

  // Load navigation
  async function loadNav(wiki) {
    const res = await fetch(`/api/wikis/${wiki}/nav`);
    const data = await res.json();
    navTree.innerHTML = renderNav(data.nav);
    navTree.querySelectorAll('a[data-page]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(wiki, a.dataset.page);
        navTree.querySelectorAll('a.active').forEach(el => el.classList.remove('active'));
        a.classList.add('active');
      });
    });
  }

  function renderNav(nav, depth = 0) {
    if (!nav || !Array.isArray(nav)) return '';
    let html = '<ul>';
    for (const item of nav) {
      if (typeof item === 'string') {
        html += `<li><a href="#" data-page="${item}">${formatNavTitle(item)}</a></li>`;
      } else if (typeof item === 'object') {
        for (const [title, value] of Object.entries(item)) {
          if (typeof value === 'string') {
            html += `<li><a href="#" data-page="${value}">${title}</a></li>`;
          } else if (Array.isArray(value)) {
            html += `<li><span class="section-title">${title}</span>${renderNav(value, depth + 1)}</li>`;
          }
        }
      }
    }
    html += '</ul>';
    return html;
  }

  function formatNavTitle(path) {
    return path.replace(/\.md$/, '').replace(/\//g, ' / ').replace(/-/g, ' ');
  }

  // Load page
  async function loadPage(wiki, pagePath) {
    pageContent.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const res = await fetch(`/api/wikis/${wiki}/page/${pagePath}`);
      if (!res.ok) {
        pageContent.innerHTML = `<div class="welcome"><h2>Page not found</h2><p>${pagePath}</p></div>`;
        return;
      }
      const data = await res.json();
      pageContent.innerHTML = data.html;
      currentPagePath = pagePath;
      currentPageMarkdown = data.markdown;
      window.scrollTo(0, 0);
    } catch (err) {
      pageContent.innerHTML = `<div class="welcome"><h2>Error loading page</h2><p>${err.message}</p></div>`;
    }
  }

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (!q || !currentWiki) {
      searchResults.classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(async () => {
      const res = await fetch(`/api/wikis/${currentWiki}/search?q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-item"><span class="title">No results found</span></div>';
      } else {
        searchResults.innerHTML = results.map(r => `
          <div class="search-item" data-page="${r.path}">
            <div class="title">${r.title}</div>
            <div class="snippet">${escapeHtml(r.snippet)}</div>
          </div>
        `).join('');
        searchResults.querySelectorAll('.search-item[data-page]').forEach(el => {
          el.addEventListener('click', () => {
            loadPage(currentWiki, el.dataset.page);
            searchResults.classList.add('hidden');
            searchInput.value = '';
          });
        });
      }
      searchResults.classList.remove('hidden');
    }, 300);
  });

  searchInput.addEventListener('blur', () => setTimeout(() => searchResults.classList.add('hidden'), 200));

  // Chat
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  async function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    chatMessages.push({ role: 'user', content: msg });
    appendChatMessage('user', msg);
    chatInput.value = '';
    chatSend.disabled = true;

    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg assistant typing-indicator';
    typingEl.textContent = 'Thinking...';
    chatMessagesEl.appendChild(typingEl);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          wiki: currentWiki,
          currentPage: currentPagePath,
          pageContent: currentPageMarkdown
        })
      });
      const data = await res.json();
      typingEl.remove();

      if (data.error) {
        appendChatMessage('assistant', `⚠️ Error: ${data.error}`);
      } else {
        chatMessages.push({ role: 'assistant', content: data.reply });
        appendChatMessage('assistant', data.reply);
      }
    } catch (err) {
      typingEl.remove();
      appendChatMessage('assistant', `⚠️ Error: ${err.message}`);
    }
    chatSend.disabled = false;
  }

  function appendChatMessage(role, content) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = renderChatMarkdown(content);
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function renderChatMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Init
  loadWikis();
})();
