# AI Agent Instructions

This is the **wiki-dx-viewer** project — a Next.js web app for browsing DevExpress internal wikis with AI-powered chat.

## Documentation

Read the `docs/` folder for detailed information:

- [docs/running.md](docs/running.md) — How to run the app (prerequisites, commands, ports)
- [docs/assistant.md](docs/assistant.md) — AI chat features, models, tools, and editing workflow
- [docs/ai-chat.md](docs/ai-chat.md) — AI chat behavior with/without a wiki selected

## Project Structure

```
src/             — Next.js application (port 4000)
  app/           — Next.js App Router pages and API routes
  components/    — React components
  lib/           — Shared utilities
docs/            — Project documentation
run.sh           — Convenience script to run the app
```

## Running

```bash
cd src
npm install
npm run dev
```

The app runs on **port 4000**.

## Key Technical Details

- **Framework**: Next.js 14 (App Router)
- **UI**: Chakra UI v2
- **Port**: 4000 (both dev and production)
- **Auth**: GitHub CLI (`gh`) token for GitHub Models API access
- **Data dir**: `~/.wiki-dx-viewer/`
- **Wiki source**: Cloned from `DevExpress/wiki-dx` on first launch

## Git Rules

- Use present tense commit messages ("Add" not "Added")
- Keep commit messages under 50 characters
- Do not add AI/assistant attribution to commits
