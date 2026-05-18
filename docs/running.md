# Running the App

## Prerequisites

- **Node.js** v20+ — [https://nodejs.org](https://nodejs.org)
- **Git** — [https://git-scm.com](https://git-scm.com)
- **GitHub CLI** (`gh`) — [https://cli.github.com](https://cli.github.com)
  - Must be authenticated: run `gh auth login` before first launch

## Quick Start

```bash
cd src
npm install
npm run dev
```

Open [http://localhost:4000](http://localhost:4000).

## Run Modes

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode with hot reload (port 4000) |
| `npm run build && npm run start` | Production build then serve (port 4000) |

Alternatively, use the `run.sh` script from the repo root:

```bash
./run.sh         # production (build + start)
./run.sh --dev   # development mode
```

## First Launch

On first launch the app automatically clones the [wiki-dx](https://github.com/DevExpress/wiki-dx) repository to `~/.wiki-dx-viewer/wiki-dx/`. On subsequent launches it pulls the latest changes.

## Data Storage

All runtime data is stored in `~/.wiki-dx-viewer/`:

| Path | Purpose |
|------|---------|
| `wiki-dx/` | Cloned wiki repository |
| `config.json` | App configuration |
| `edit-session.json` | Active editing session state |
