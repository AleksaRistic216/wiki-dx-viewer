# Wiki DX Viewer

A local web app that serves DevExpress wiki content with an integrated AI chat sidebar powered by GitHub Models API.

## Prerequisites

- **Node.js** (LTS recommended) — [https://nodejs.org](https://nodejs.org)
- **Git** — for cloning/updating the wiki repository
- **GitHub CLI** (`gh`) — [https://cli.github.com](https://cli.github.com)
  - Must be installed and authenticated: run `gh auth login` before starting
  - The app uses your local `gh` installation to obtain an auth token for the GitHub Models API (AI chat) and for cloning the private wiki repository

## Quick Start

```bash
cd wiki-dx-viewer/src
npm install
npm run dev
```

On **first run**, the app automatically clones the [wiki-dx](https://github.com/DevExpress/wiki-dx) repository to `~/.wiki-dx-viewer/wiki-dx/`. On subsequent starts, it pulls the latest changes.

Then open [http://localhost:4000](http://localhost:4000) in your browser.

## CLI Options

| Flag | Description |
|------|-------------|
| `--wiki-path <path>` | Use a local wiki-dx repo instead of auto-cloning |
| `--offline` | Skip `git pull` on startup (use cached content) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Port to serve on |
| `WIKI_DX_PATH` | — | Override: path to a local wiki-dx repository |

## Features

- **Wiki selector** — browse all team wikis
- **Navigation tree** — parsed from each wiki's `mkdocs.yml`
- **Markdown rendering** — with syntax highlighting
- **Full-text search** — search within the selected wiki
- **AI Chat** — context-aware chat that knows your current page and wiki structure
- **Dark/Light mode** — follows system preference
- **Auto-update** — pulls latest wiki content on each startup

## How AI Chat Works

The chat sidebar (labeled "Copilot Chat" in the UI) uses the **GitHub Models API** — not the GitHub Copilot API — authenticated via your `gh` CLI token (`gh auth token`). It automatically includes:
- The current wiki's navigation structure
- The full content of the page you're viewing

This means the AI knows exactly what you're reading and can help navigate, explain, or answer questions.

## Desktop App (Tauri)

The app can be packaged as a native desktop application using Tauri v2. Users get a standalone installer — no need to install Node.js or run npm commands.

### End-User Prerequisites

- **Git** — for cloning/updating the wiki repository
- **GitHub CLI** (`gh`) — authenticated via `gh auth login`

### Building the Desktop App

**Developer prerequisites**: Node.js, Rust toolchain, `cargo-tauri` CLI.

```bash
# Install tauri-cli (one time)
cargo install tauri-cli --version "^2"

# Build the installer
# On Windows:
.\build.ps1

# On macOS/Linux:
./build.sh
```

The installer will be in `src-tauri/target/release/bundle/`.

**Output formats:**
- Windows: `.msi` and `.exe` (NSIS) installer
- macOS: `.dmg` and `.app` bundle
- Linux: `.deb` and `.AppImage`

### CI Builds (GitHub Actions)

For automated cross-platform builds, add a workflow using `tauri-apps/tauri-action@v0`. See the [Tauri GitHub Action docs](https://v2.tauri.app/distribute/github-actions/).

## Data Storage

All data is stored in `~/.wiki-dx-viewer/`:
- `wiki-dx/` — the cloned repository (shallow clone)
- `config.json` — configuration
