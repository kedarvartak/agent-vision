# CDP-First Browser Integration

This project now uses a CDP-first browser architecture.

## Goal

Allow an IDE client to run `/see` against a live Chrome tab by connecting directly to Chrome DevTools Protocol.

Examples:

```text
/see
/see "OpenAI API docs"
```

## Current MCP tool surface

### `getBrowserCdpStatus`

Checks whether the MCP can connect to a Chrome DevTools Protocol endpoint.
When the connection fails, the result now includes a best-effort `errorHint` for common cases such as:
- Chrome not running with remote debugging enabled
- wrong CDP endpoint
- timeout to the debug endpoint

### `discoverBrowserTabsViaCdp`

Lists raw live browser tabs from the Chrome debugging endpoint.

### `refreshLiveBrowserTabs`

Refreshes the normalized live browser-tab model from CDP.
This also removes tabs that disappeared from the latest discovery pass.

### `listLiveBrowserTabs`

Returns the cached normalized live browser-tab model.

### `pruneStaleLiveBrowserTabs`

Removes stale cached tabs that have not been refreshed recently.

Input:

```json
{
  "maxAgeMs": 300000
}
```

### `resolveLiveBrowserTab`

Resolves the active or best matching tab for a `/see`-style query.

### `captureResolvedBrowserTabScreenshot`

Captures a real PNG screenshot from the resolved tab through CDP.

### `getResolvedBrowserTabContext`

Collects structured page metadata and visible text from the resolved tab through CDP.

Returned context currently includes:
- page title
- page URL
- document language
- content type
- visible text
- viewport size and device pixel ratio

### `seeBrowserTabViaCdp`

High-level browser-first `/see` flow.

Input:

```json
{
  "query": "OpenAI API docs"
}
```

Outcomes:
- `completed`: a tab was resolved, captured, and enriched with structured browser context
- `ambiguous`: multiple tabs matched similarly
- `not_found`: no tab matched

Hardening behavior:
- if `/see` initially returns `not_found`, it refreshes live tab discovery once and retries
- if screenshot/context collection fails because the tab moved or disappeared, it refreshes once and retries
- successful recovery is surfaced through `recoveredAfterRefresh: true`

## Notes

- The older pushed-screenshot model has been removed.
- Desktop overlays, OS hotkeys, and manual screenshot plumbing are out of scope.
- Chrome should be started with a remote debugging endpoint for the CDP flow to work.
