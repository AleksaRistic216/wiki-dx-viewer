# Wiki DX Viewer

A local web app that serves DevExpress wiki content with an integrated AI chat sidebar powered by GitHub Copilot.

## Prerequisites

- **Node.js** (LTS recommended) — [https://nodejs.org](https://nodejs.org)
- **GitHub CLI** (`gh`) — [https://cli.github.com](https://cli.github.com)
  - Must be authenticated: run `gh auth login` before starting
  - Your account must have GitHub Copilot access (for AI chat)
- **wiki-dx repository** cloned locally — [DevExpress/wiki-dx](https://github.com/DevExpress/wiki-dx)

## Quick Start

```bash
cd wiki-dx-viewer
npm install
npm start
```

On **first run**, you'll be prompted to enter the path to your local `wiki-dx` repository. This is saved to `~/.wiki-dx-viewer/config.json` and reused on subsequent starts.

Then open [http://localhost:4000](http://localhost:4000) in your browser.

## Configuration

The wiki-dx repo path can be provided in three ways (checked in this order):

1. **CLI argument**: `npm start -- --wiki-path /path/to/wiki-dx`
2. **Environment variable**: `WIKI_DX_PATH=/path/to/wiki-dx npm start`
3. **Persisted config**: Saved in `~/.wiki-dx-viewer/config.json` after first-run prompt

To change the saved path, either edit `~/.wiki-dx-viewer/config.json` or run with `--wiki-path`.

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `4000` | Port to serve on |
| `WIKI_DX_PATH` | — | Path to wiki-dx repository |

## Features

- **Wiki selector** — browse all team wikis from the repository
- **Navigation tree** — parsed from each wiki's `mkdocs.yml`
- **Markdown rendering** — with syntax highlighting and GitHub-style formatting
- **Full-text search** — search within the currently selected wiki
- **AI Chat** — context-aware chat that knows your current page and wiki structure
- **Dark/Light mode** — follows your system preference

## How AI Chat Works

The chat sidebar connects to the GitHub Models API using your `gh` authentication token. It sends:
- The current wiki's navigation structure
- The content of the page you're currently viewing

This means the AI knows exactly what you're looking at and can help navigate, explain, or find related content.

## Cross-Platform

Works on Windows, macOS, and Linux — anywhere Node.js and the GitHub CLI are available.
