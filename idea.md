# Ephemeral Visual Context MCP

## Problem

Today, when a user wants an LLM to understand something visual on their screen, they usually have to:

1. take a screenshot or start a screen recording
2. save it somewhere
3. attach it manually to the chat or IDE
4. explain what part of the image or video matters

This is slow, interruptive, and produces storage garbage. Most screenshots and recordings are one-time context artifacts that do not need to exist after the model has seen them.

## Goal

Build a TypeScript MCP that lets a user invoke a command from the IDE, enter a system-wide capture mode, switch to any app or screen, annotate the relevant area, and send that visual context back to the LLM without saving screenshots or recordings by default.

The MCP should feel like a native screenshot tool combined with an LLM handoff.

## Core Product Idea

The command should not capture immediately. It should start a capture session.

High-level flow:

1. user runs `/see` or `/clip` from the IDE or chat surface
2. MCP enters global capture mode
3. a transparent overlay and annotation HUD become available system-wide
4. user switches to the target app, browser, or screen
5. user selects a region and optionally annotates it
6. user presses `Send`
7. the capture bundle is returned to the IDE/chat and passed to the LLM
8. raw capture data is discarded by default

This avoids the core failure mode where an immediate screenshot would only capture the IDE where the slash command was executed.

## Product Principles

### 1. Ephemeral by Default

- no screenshot storage by default
- no video storage by default
- no artifact library
- no long-lived capture history unless explicitly enabled later

The system should compute visual context, send it, and discard it.

### 2. Command Starts Intent, Not Capture

The slash command should arm a capture session, not instantly freeze the current screen.

This is essential because the user often invokes the command from an IDE, but wants to capture a different app.

### 3. Annotation Is First-Class

Annotations are not an optional extra. They are part of the prompt.

The user should be able to:

- draw boxes
- draw arrows
- add short labels
- highlight regions
- blur or redact sensitive information

The LLM should receive both:

- the final composited image
- structured annotation metadata

### 4. Region Selection Before Send

The default unit of context should be a selected region, not the full screen.

Benefits:

- lower visual noise
- lower token cost
- lower privacy risk
- clearer model focus

### 5. Explicit Send

The user should always confirm what is sent.

The system should never silently capture and submit the full screen after a command.

## Primary Commands

These commands may share the same underlying capture system with different defaults.

### `/see`

Purpose:
- rich visual handoff for explanation, debugging, and discussion

Behavior:
- starts global capture mode
- allows switching across apps
- supports region selection
- supports full annotation workflow
- returns capture to the IDE/chat on send

Best for:
- "What is wrong with this UI?"
- "Why is this button disabled?"
- "Explain this error message"

### `/clip`

Purpose:
- faster screenshot-like capture for quick sharing

Behavior:
- starts global capture mode
- optimized for fast rectangular region selection
- lightweight annotation support
- returns capture to the IDE/chat on send

Best for:
- quick snippets
- precise cropped regions
- simpler flows with minimal markup

## Suggested UX Flow

### `/see`

1. user runs `/see`
2. IDE/chat shows "Capture mode active"
3. global overlay appears
4. user switches to target screen or app
5. user drags to select a region
6. annotation toolbar appears or remains accessible
7. user adds boxes, arrows, text, or blur masks
8. user reviews preview
9. user clicks `Send`
10. MCP returns visual bundle to the calling environment

### `/clip`

1. user runs `/clip`
2. global overlay appears
3. user switches to target app
4. user drags region
5. optional quick markup
6. user clicks `Send`

## Overlay and Annotation Model

The system should provide a global lightweight overlay with:

- region select
- move/resize selection
- rectangle tool
- arrow tool
- text label tool
- blur/redact tool
- cancel
- send

Keyboard affordances:

- `Esc` cancel
- `Enter` send
- `B` box
- `A` arrow
- `T` text
- `R` redact

The exact shortcuts can change, but the experience should feel fast and tool-like.

## Why Structured Annotations Matter

The model should not only see painted pixels. It should also receive structured intent.

Example annotation objects:

```ts
type Annotation =
  | { type: "rect"; x: number; y: number; width: number; height: number; label?: string }
  | { type: "arrow"; from: { x: number; y: number }; to: { x: number; y: number }; label?: string }
  | { type: "text"; x: number; y: number; text: string }
  | { type: "redact"; x: number; y: number; width: number; height: number };
```

Why this matters:

- the overlay visible in the image guides the model visually
- structured metadata lets prompts reference exact regions
- later we can support richer reasoning like comparing multiple highlights

## MCP Responsibilities

The MCP should act as the orchestration layer between the IDE/chat and the local capture system.

Responsibilities:

- start and manage capture sessions
- open or signal the system-wide overlay
- collect selected region and annotation output
- package the final payload for the LLM
- ensure raw capture data is ephemeral unless explicitly exported

The MCP is not just a screenshot service. It is a visual context handoff layer.

## Proposed Architecture

### 1. IDE Integration Layer

This layer handles slash commands or command palette actions such as:

- `/see`
- `/clip`

It starts a capture session through the MCP and waits for the response bundle.

### 2. Local Capture Overlay Agent

This is a local TypeScript process or desktop helper responsible for:

- global capture mode
- screen selection
- annotation UI
- preview and send/cancel flow

This should be separate from the IDE window so it can survive app switching.

### 3. MCP Server

The MCP server exposes tools/resources that:

- create capture sessions
- await session completion
- return capture bundles
- optionally support future replay/history modes

### 4. Vision Handoff Layer

Once send is confirmed, the returned payload is attached to the current LLM interaction with:

- image payload
- annotation metadata
- optional OCR/context metadata

## Capture Bundle

Example output shape:

```ts
type CaptureBundle = {
  sessionId: string;
  command: "see" | "clip";
  image: {
    mimeType: "image/png";
    bytesBase64: string;
    width: number;
    height: number;
  };
  selection: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  annotations: Annotation[];
  context?: {
    activeAppName?: string;
    activeWindowTitle?: string;
    capturedAt: string;
    displayId?: string;
  };
};
```

This keeps the contract explicit and portable.

## Privacy and Safety

This product only works if trust is high.

Required behaviors:

- capture starts only after user command
- user explicitly selects what to send
- user can redact before sending
- send is explicit
- no raw media persisted by default
- any temporary buffers should live in memory only

Privacy should be a product feature, not a policy footnote.

## Why This Is Better Than Traditional Attachments

Compared to manual screenshot upload:

- faster
- fewer steps
- clearer intent through annotations
- no file management
- no screenshot clutter

Compared to traditional screen recording:

- lower storage cost
- lower privacy risk
- better focus
- easier for the LLM to interpret

## V1 Scope Recommendation

The best first version is a static visual handoff flow, not video.

V1 should include:

- `/see`
- `/clip`
- global capture mode
- region selection
- box, arrow, text, and redact annotations
- explicit send/cancel
- ephemeral in-memory payload return

V1 should not include:

- stored screenshot history
- stored recordings
- passive background capture
- autonomous monitoring
- multi-region comparison flows

## Future Directions

Once the static capture flow works, possible next steps:

- RAM-only recent replay mode
- browser-aware capture with DOM/context metadata
- OCR extraction
- accessibility tree extraction
- compare two highlighted regions
- annotate then ask targeted questions against regions

## One-Sentence Vision

An ephemeral visual context MCP that lets users start capture mode from the IDE, switch anywhere, annotate exactly what matters, and send that context directly to the LLM without creating screenshot or video garbage.
