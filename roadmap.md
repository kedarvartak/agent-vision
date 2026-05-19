# Roadmap

## Phase 0: Definition and Constraints

Goal:
- lock the product contract before implementation

Deliverables:
- command semantics for `/see` and `/clip`
- session lifecycle definition
- capture bundle TypeScript types
- privacy guarantees and non-goals
- target platforms for v1

Key decisions:
- Linux-only first or cross-platform abstraction from day one
- region-only selection or optional window selection in v1
- annotation tool set for first release
- transport format for image payloads

Exit criteria:
- stable idea doc
- stable MCP tool contract draft

## Phase 1: TypeScript MCP Skeleton

Goal:
- stand up the TypeScript MCP server and session orchestration primitives

Deliverables:
- project scaffolding
- MCP server entrypoint
- session manager
- in-memory session state
- logging and error model

Suggested modules:
- `src/server.ts`
- `src/session/session-manager.ts`
- `src/types/capture.ts`
- `src/types/annotation.ts`

Exit criteria:
- MCP server can create, track, and complete mock capture sessions

## Phase 2: Command-to-Session Flow

Goal:
- allow IDE/client commands to start capture mode and wait for result

Deliverables:
- MCP tools such as `startCaptureSession` and `awaitCaptureSession`
- session identifiers and status transitions
- cancel flow
- timeout handling

Suggested session states:
- `created`
- `active`
- `completed`
- `cancelled`
- `expired`
- `failed`

Exit criteria:
- a caller can start a session, simulate completion, and receive a typed bundle

## Phase 3: Local Overlay Agent Prototype

Goal:
- build the system-wide capture mode UI outside the IDE window

Deliverables:
- transparent overlay window
- region selection
- selection move/resize
- send/cancel actions

Likely implementation notes:
- keep this as a separate local process from the MCP server if needed
- use in-memory communication between overlay agent and session manager

Exit criteria:
- user can run a session, switch windows, select a region, and confirm or cancel

## Phase 4: Annotation Tools

Goal:
- make the capture usable as an LLM-first context handoff

Deliverables:
- rectangle annotations
- arrow annotations
- text labels
- redact or blur regions
- keyboard shortcuts
- annotation serialization

Exit criteria:
- final payload contains both rendered overlay image and structured annotations

## Phase 5: Screen Capture Pipeline

Goal:
- produce the actual image payload without default persistence

Deliverables:
- screen or region capture
- crop handling
- composited preview image
- in-memory image packaging
- temporary buffer cleanup

Constraints:
- no disk persistence by default
- explicit export only in future phases if needed

Exit criteria:
- selected region and annotations are returned as a valid image bundle in memory

## Phase 6: MCP Integration End-to-End

Goal:
- connect capture results to the LLM workflow cleanly

Deliverables:
- end-to-end command flow
- payload handoff from overlay agent to MCP server
- client-friendly success and error messages
- example usage docs

Exit criteria:
- running `/see` or `/clip` produces a bundle consumable by the calling LLM client

## Phase 7: Hardening

Goal:
- make the tool reliable enough for real use

Deliverables:
- robust cleanup on crash or cancel
- focus and z-order handling
- multi-monitor sanity
- performance profiling
- test coverage on session logic and serialization

Edge cases:
- user changes resolution mid-session
- active display changes
- overlay loses focus
- partial session completion

Exit criteria:
- stable behavior across typical workstation usage

## Phase 8: UX Refinement

Goal:
- make the interaction feel polished and fast

Deliverables:
- HUD refinement
- cursor and tool-state clarity
- better preview affordances
- shortcut tuning
- clearer onboarding copy

Exit criteria:
- first-time user can successfully use capture mode without explanation

## Phase 9: Optional Enhancements

Goal:
- extend value without breaking the ephemeral model

Potential additions:
- RAM-only recent replay mode
- OCR extraction
- active app and window metadata
- browser-aware capture context
- accessibility tree extraction
- multi-region compare mode

Guardrails:
- preserve explicit-send behavior
- preserve no-storage-by-default principle

## Proposed Initial Milestone

The first meaningful milestone should be:

- TypeScript MCP server
- `/see` and `/clip` command contract
- global overlay prototype
- region selection
- box and arrow annotations
- send/cancel flow
- in-memory image bundle return

This is enough to validate the core product idea before investing in replay, OCR, or platform-specific optimizations.
