# Assistant

The AI chat sidebar provides a context-aware assistant powered by the [GitHub Models API](https://docs.github.com/en/github-models). It authenticates automatically using your `gh` CLI token.

## Available Models

| Model | ID |
|-------|----|
| GPT-4o (default) | `gpt-4o` |
| GPT-4o Mini | `gpt-4o-mini` |
| o4-mini | `o4-mini` |
| GPT-4.1 | `gpt-4.1` |
| GPT-4.1 Mini | `gpt-4.1-mini` |
| GPT-4.1 Nano | `gpt-4.1-nano` |
| Claude Sonnet 4 | `claude-sonnet-4` |
| Claude Opus 4 | `claude-opus-4` |
| Claude Haiku 3.5 | `claude-haiku-3.5` |

The selected model is persisted in `localStorage` and defaults to GPT-4o.

## Context Awareness

The AI automatically receives context based on what you are viewing:

| Context | When Provided |
|---------|---------------|
| Wiki navigation structure (from `mkdocs.yml`) | A wiki is selected |
| Current page path | A page is open |
| Current page content (markdown) | A page is open |
| Tiered search results from related pages | Always (see below) |

### Tiered Context (Cross-Page Search)

When you send a message, the system searches wiki pages for relevant content and injects it into the conversation using a three-tier approach:

1. **Tier 1 — Titles**: Up to 15 matching page paths and titles (cheap, always included).
2. **Tier 2 — Headers**: Section headers from the top 5 matching pages.
3. **Tier 3 — Full content**: The complete text of the single best-matching page (budget permitting).

This means the AI can answer questions that span multiple wiki pages, not just the one you're reading.

### Cross-Wiki Search (No Wiki Selected)

When no specific wiki is selected, the AI searches across **all available wikis** for relevant content. Results are labeled with their source wiki (e.g. `[winformswiki]`) so you know where the information came from.

This is useful when you don't know which wiki contains the answer — the AI will find it regardless and tell you where it lives. Links in the response use the `wikiId:path` format to enable navigation to the correct wiki and page.

## Tools (Editing Capabilities)

When editing mode is enabled and a page is open, the AI gains access to two tools:

### `edit_page`

Replaces the current page's markdown content.

- **Parameters**: `content` (full updated markdown), `summary` (description of the change)
- **Behavior**: Writes the new content to the wiki file on disk within the active editing branch.

### `edit_nav_entry`

Renames a navigation menu entry in the wiki's `mkdocs.yml`.

- **Parameters**: `old_title` (exact current title), `new_title` (replacement title), `summary`
- **Behavior**: Finds the matching nav entry (quoted or unquoted) and replaces its title, preserving YAML formatting.

### `create_page`

Creates a new wiki page (file and navigation entry).

- **Parameters**: `page_path` (relative path e.g. `howto/my-page.md`), `title` (nav menu title), `content` (full markdown), `summary`
- **Behavior**: Creates the markdown file in the docs directory (including any missing parent directories), then adds a navigation entry to `mkdocs.yml` in the appropriate section based on the file path. Available whenever editing is enabled and a wiki is selected (does not require a current page to be open).

All tools require an active editing session (see [Editing Workflow](#editing-workflow)).

## Tools (File System Access)

The AI always has access to these tools, regardless of editing mode:

### `read_file`

Reads the contents of any file on the computer.

- **Parameters**: `path` (absolute or relative file path)
- **Behavior**: Returns the file contents (truncated at 20,000 characters for very large files).

### `list_directory`

Lists files and directories at any path on the computer.

- **Parameters**: `path` (absolute or relative directory path)
- **Behavior**: Returns a listing of entries with `[dir]` or `[file]` prefixes.

These tools allow the AI to explore the file system when asked — for example, to look at source code, configuration files, or any other content on the machine. The AI can perform up to 5 consecutive tool-call rounds to navigate through directories and read files.

## Editing Workflow

Edits made by the AI follow the same branch-based workflow as manual edits:

1. **Start session** — creates a new branch (`edit/<user>-<date>-<time>`) off the default branch.
2. **Make edits** — the AI writes changes to files on the editing branch.
3. **Complete session** — commits all changes, pushes the branch, and opens a pull request via `gh pr create`.
4. **Discard session** — reverts all changes and deletes the editing branch.

Session state is stored in `~/.wiki-dx-viewer/edit-session.json`.

## Rate Limiting

API calls use automatic retry with backoff. If the GitHub Models API returns HTTP 429 (rate limited), the client waits up to 60 seconds before retrying (up to 2 retries).

## Chat Persistence

Each chat conversation is stored in `localStorage` keyed by `chat:<wiki>:<page>`, so switching between pages preserves separate conversation histories.
