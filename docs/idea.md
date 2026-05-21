# CDP-First Browser Idea

The project is now intentionally scoped to browser-only visual context, with Chrome DevTools Protocol as the primary integration path.

## Goal

Allow an IDE or MCP client to run:

```text
/see "tab name"
```

and have the MCP connect directly to Chrome, resolve the matching tab, and return visual plus structured browser context without:

- desktop overlays
- global hotkeys
- OS-specific screenshot plumbing
- persistent screenshot storage by default

## Core model

1. Chrome runs with a remote debugging endpoint enabled.
2. The MCP connects to Chrome through CDP.
3. The MCP discovers live tabs and keeps lightweight metadata in memory.
4. The IDE client calls `/see "tab name"`.
5. The MCP resolves the best matching tab.
6. The MCP captures a screenshot on demand and may also fetch structured browser context such as DOM or visible text.
7. The MCP returns an ephemeral capture bundle.

## Why CDP

CDP gives the project the exact primitives needed for a browser-first visual context workflow:

- list open tabs
- inspect titles and URLs
- capture screenshots
- inspect DOM state
- fetch visible text or runtime data
- later add console and network context

This is a cleaner fit than desktop screenshot plumbing and more capable than a screenshot-only browser bridge.

## Product direction

The primary UX becomes:

```text
/see "OpenAI API docs"
```

The MCP should:
- find the best matching Chrome tab
- capture that tab immediately
- return screenshot bytes plus browser metadata
- optionally include DOM/text context in later iterations

## Scope boundaries

For now, the project should focus on:
- Chrome-compatible CDP connection
- browser tab title and URL resolution
- screenshot capture for matching tabs
- in-memory only handling by default

Later, the project may add:
- DOM snapshots
- visible text extraction
- console and network diagnostics
- support for other Chromium-based browsers
