# CDP-First Browser Roadmap

## Current status

The old pushed-screenshot browser path has been removed.
The codebase is now centered on a CDP-first browser architecture.

Current implementation:
- Chrome CDP connection status check
- live browser tab discovery from `/json/version` and `/json/list`
- normalized live browser-tab model with ordering heuristics
- active-tab fallback and fuzzy tab resolution
- real PNG screenshot capture from resolved tabs through CDP
- high-level browser-first `/see` flow
- structured browser context with visible text and page metadata

## Phase 1: CDP connection layer

Completed:
- connect to a Chrome remote debugging endpoint
- fetch browser metadata
- discover live page/tab targets
- expose Phase 1 MCP tools

## Phase 2: live browser tab model

Completed:
- normalize CDP targets into a stable browser-tab model
- add attached/first-tab ordering heuristics
- preserve first-seen and last-seen timestamps
- expose refresh and cached-list MCP tools

## Phase 3: tab resolution

Completed:
- resolve `/see` with active-tab fallback
- resolve `/see "tab name"` by title and URL matching heuristics
- return candidate lists for ambiguous or not-found queries
- expose Phase 3 resolution MCP tool

## Phase 4: CDP screenshot capture

Completed:
- attach to the selected tab through its CDP websocket
- capture PNG screenshot bytes on demand
- return browser-first screenshot payloads with width, height, and byte length
- expose Phase 4 screenshot capture MCP tool

## Phase 5: browser-first `/see`

Completed:
- complete `/see` directly from live CDP state
- avoid extension push and avoid desktop capture flows entirely
- return a single high-level browser-first result instead of separate resolution and screenshot steps
- expose the Phase 5 `seeBrowserTabViaCdp` MCP tool

## Phase 6: structured browser context

Completed:
- add visible text extraction through `Runtime.evaluate`
- add page metadata helpers such as page title, URL, language, content type, and viewport
- expose a direct structured-context MCP tool
- enrich the high-level `/see` result with structured page context alongside the screenshot

## Phase 7: hardening

Goals:
- reconnect logic
- clearer connection errors
- stale target cleanup
- stable IDE-facing behavior
- optional console and network diagnostics when they materially improve debugging
