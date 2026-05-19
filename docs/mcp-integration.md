# MCP Integration Guide

## Goal

This Phase 6 layer gives MCP clients a higher-level end-to-end flow for `/see` and `/clip`.

Instead of orchestrating a dozen low-level calls manually, a client can now:

1. call `beginVisualCapture`
2. react to the returned guidance message
3. drive selection and annotation through overlay tools
4. call `sendOverlayCaptureSession`
5. call `awaitVisualCaptureResult` or `getVisualCaptureStatus`
6. attach the returned `CaptureBundle` to the current LLM interaction

## Recommended Client Flow

### `/see`

1. `beginVisualCapture({ command: "see" })`
2. show returned guidance to the user
3. user switches to target app
4. client or local overlay uses:
   - `selectOverlayRegion`
   - `setOverlayActiveTool`
   - `addOverlayAnnotation`
   - `updateOverlayAnnotation`
   - `removeOverlayAnnotation`
5. `sendOverlayCaptureSession`
6. `awaitVisualCaptureResult`
7. if outcome is `completed`, attach `result` to the LLM turn

### `/clip`

1. `beginVisualCapture({ command: "clip" })`
2. show returned guidance to the user
3. user selects region
4. optionally annotate
5. `sendOverlayCaptureSession`
6. `awaitVisualCaptureResult`

## High-Level MCP Tools

### `beginVisualCapture`

Purpose:
- create a capture session and launch the overlay prototype in one call

Returns:
- `sessionId`
- `captureSession`
- `overlaySession`
- `stage`
- `guidance`

### `getVisualCaptureStatus`

Purpose:
- provide a client-friendly combined status view of both the capture session and overlay session

Returns:
- capture and overlay states
- derived stage
- guidance message
- final result if completed

### `awaitVisualCaptureResult`

Purpose:
- wait for final completion with a user-facing interpretation of the outcome

Returns:
- wait result
- derived stage
- guidance message
- `result` if completed

## Example

```ts
const started = await server.callTool("beginVisualCapture", {
  command: "see"
});

// user interacts with overlay
await server.callTool("selectOverlayRegion", {
  sessionId: started.sessionId,
  x: 120,
  y: 96,
  width: 640,
  height: 360
});

await server.callTool("addOverlayAnnotation", {
  sessionId: started.sessionId,
  annotation: {
    type: "rect",
    x: 140,
    y: 120,
    width: 300,
    height: 120,
    label: "Problem area"
  }
});

await server.callTool("sendOverlayCaptureSession", {
  sessionId: started.sessionId
});

const finished = await server.callTool("awaitVisualCaptureResult", {
  sessionId: started.sessionId,
  timeoutMs: 5000
});
```

## Client Guidance Contract

Each high-level result includes:

- `stage`: simplified client-facing flow state
- `guidance.title`: short UI label
- `guidance.message`: user-facing status text
- `guidance.nextActions`: recommended next client actions

This is meant to help IDE/chat clients show clean UI copy without duplicating server-side flow logic.
