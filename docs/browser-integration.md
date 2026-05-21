# CDP-First Browser Integration

This project now uses a CDP-first browser architecture.

## Goal

Allow an IDE client to run `/see` against a live Chrome tab by connecting directly to Chrome DevTools Protocol.

Examples:

```text
/see
/see "OpenAI API docs"
```

## Current Phase 1 scope

Implemented now:
- CDP connection status check
- live tab discovery from a Chrome remote debugging endpoint

Current MCP tools:
- `getBrowserCdpStatus`
- `discoverBrowserTabsViaCdp`

## Planned next steps

After discovery, the next implementation phases will add:
- tab resolution by title
- screenshot capture through CDP
- browser-first `/see` completion
- optional DOM/text enrichment

## Notes

- The older pushed-screenshot model has been removed.
- Desktop overlays, OS hotkeys, and manual screenshot plumbing are out of scope.
- Chrome should be started with a remote debugging endpoint for the CDP flow to work.
