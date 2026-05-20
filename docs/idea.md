# Browser-First Idea

The project is now intentionally scoped to browser-only visual context.

## Goal

Allow an IDE or MCP client to run:

```text
/see "tab name"
```

and have the local browser integration immediately provide the matching tab screenshot and metadata without:

- desktop overlays
- global hotkeys
- OS-specific screenshot plumbing
- persistent screenshot storage by default

## Model

1. A browser extension or local browser bridge captures tab screenshots in memory.
2. It registers those snapshots with the MCP using `registerBrowserTabSnapshot`.
3. The IDE client calls `seeBrowserTab` with a title query.
4. The MCP resolves the best matching tab and immediately returns a capture bundle.

## Why this scope

Browser tabs are much easier to target reliably by title than native windows, especially on Wayland.
This keeps the UX simple and makes `/see "tab name"` the primary interaction.
