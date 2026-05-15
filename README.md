# Wiki DX Viewer

A web app for browsing DevExpress internal wikis with AI-powered chat.

## Prerequisites

- **Node.js** (v20+) — [https://nodejs.org](https://nodejs.org)
- **Git** — [https://git-scm.com](https://git-scm.com)
- **GitHub CLI** (`gh`) — [https://cli.github.com](https://cli.github.com)
  - Must be authenticated: run `gh auth login` before first launch

## Running

```bash
cd src
npm install
npm run dev
```

Then open [http://localhost:4000](http://localhost:4000).

## First Launch

On first launch the app automatically clones the [wiki-dx](https://github.com/DevExpress/wiki-dx) repository to `~/.wiki-dx-viewer/wiki-dx/`. On subsequent launches it pulls the latest changes.

## Features

- **Wiki selector** — browse all team wikis
- **Navigation tree** — parsed from each wiki's `mkdocs.yml`
- **Markdown rendering** — with syntax highlighting
- **Full-text search** — search within the selected wiki
- **AI Chat** — context-aware chat that knows your current page and wiki structure
- **Dark/Light mode** — follows system preference
- **Auto-update** — pulls latest wiki content on each launch

## AI Chat

The chat sidebar uses the **GitHub Models API**, authenticated via your `gh` CLI token. It automatically includes the current page content and wiki navigation, so the AI knows exactly what you're reading.

## Data Storage

All data is stored in `~/.wiki-dx-viewer/`:
- `wiki-dx/` — the cloned wiki repository
- `config.json` — configuration
