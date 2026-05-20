# Browser-First Roadmap

## Current scope

The project now targets browser tab capture only.

Implemented pieces:
- in-memory browser tab registry
- browser tab snapshot registration MCP tool
- browser tab listing MCP tool
- `/see`-style capture by tab title via `seeBrowserTab`
- in-memory capture session completion for browser results

## Next likely steps

1. Build a real browser extension or local browser bridge.
2. Push active-tab snapshots into `registerBrowserTabSnapshot`.
3. Add richer tab matching and disambiguation UX.
4. Optionally add DOM/text metadata alongside screenshot bytes.
5. Optionally add support for multiple browsers.
