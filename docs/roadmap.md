# CDP-First Browser Roadmap

## Current status

The old pushed-screenshot browser path has been removed.
The codebase is now centered on a CDP-first browser architecture.

Current implementation:
- Chrome CDP connection status check
- live browser tab discovery from `/json/version` and `/json/list`
- normalized live browser-tab model with ordering heuristics

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

Goals:
- resolve `/see` with active-tab fallback
- resolve `/see "tab name"` by title and URL matching
- return candidate lists for ambiguous queries

## Phase 4: CDP screenshot capture

Goals:
- attach to the selected tab through CDP
- capture screenshot bytes on demand
- return browser-first visual bundles

## Phase 5: browser-first `/see`

Goals:
- complete `/see` directly from live CDP state
- avoid extension push and avoid desktop capture flows entirely

## Phase 6: structured browser context

Goals:
- add visible text extraction
- add DOM or page metadata helpers
- optionally add console and network diagnostics

## Phase 7: hardening

Goals:
- reconnect logic
- clearer connection errors
- stale target cleanup
- stable IDE-facing behavior
