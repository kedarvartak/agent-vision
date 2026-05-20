# Browser-First `/see` Integration

This flow removes overlay and hotkey requirements.

## Goal

Allow an IDE client to run `/see` against a browser tab title.

Example:

```text
/see "OpenAI API docs"
```

The local browser integration keeps an in-memory registry of tab screenshots and metadata. The MCP then resolves the best matching tab and immediately completes a capture session.

## MCP tools

### `registerBrowserTabSnapshot`

Used by a browser extension or local browser bridge to publish the latest tab state.

Input shape:

```json
{
  "tabId": "tab-123",
  "title": "OpenAI API docs",
  "url": "https://platform.openai.com/docs/api-reference",
  "browserName": "Chrome",
  "active": true,
  "capturedAt": "2026-05-21T10:00:00.000Z",
  "image": {
    "mimeType": "image/png",
    "bytesBase64": "...",
    "width": 1440,
    "height": 900
  }
}
```

### `listBrowserTabs`

Returns the current in-memory browser tab registry.

### `seeBrowserTab`

Attempts to resolve a tab title query and complete a `see` capture immediately.

Input:

```json
{
  "query": "OpenAI API docs",
  "command": "see"
}
```

Outcomes:

- `completed`: one tab was resolved and captured
- `ambiguous`: multiple tabs matched with similar confidence
- `not_found`: no tab matched

## Recommended IDE flow

1. Browser extension continuously updates the active tab snapshot with `registerBrowserTabSnapshot`.
2. User runs `/see "some tab name"`.
3. IDE client calls `seeBrowserTab` with the title query.
4. MCP returns either:
   - a completed capture bundle
   - a list of candidates to disambiguate

## Notes

- This flow is browser-only by design.
- It avoids overlay UI and avoids OS-level shortcut dependencies.
- The browser extension is still the missing piece for real production usage, but the MCP contract is now in place.
