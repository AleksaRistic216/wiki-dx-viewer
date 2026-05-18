# AI Chat Behavior

## Does the AI chat work without selecting a wiki?

**Yes**, the chat works without picking a wiki and will search across **all** wikis for relevant content.

### Without a wiki selected

The chat searches across all available wikis to find pages matching the user's query. Results are labeled with the wiki they came from (e.g. `[winformswiki]`). This enables cross-wiki discovery without needing to know which wiki contains the answer.

### What's missing without a wiki

| Feature | Requires Wiki? |
|---------|---------------|
| Wiki navigation structure in context | ✅ Yes |
| Tiered context from relevant wiki pages (search) | ❌ No (searches all wikis) |
| Current page content awareness | Requires a page open |
| Page editing tools (`edit_page`, `edit_nav_entry`) | Requires both wiki and page |

### Summary

Without a wiki selected, the chat searches across all wikis and provides relevant context from any matching pages. Once a wiki is selected and a page is open, the AI gains focused access to that wiki's navigation structure, page content, and editing capabilities.
