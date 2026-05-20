import type { BeginVisualCaptureResult } from "./flow/types.js";
import { VisualContextServer } from "./server.js";

const ensureBeginResult = (value: unknown): BeginVisualCaptureResult => {
  if (!value || typeof value !== "object" || !("sessionId" in value) || typeof value.sessionId !== "string") {
    throw new Error("Unexpected beginVisualCapture response");
  }

  return value as BeginVisualCaptureResult;
};

const run = async (): Promise<void> => {
  const server = new VisualContextServer();
  server.start();

  const started = ensureBeginResult(
    await server.callTool("beginVisualCapture", { command: "see", ttlMs: 5_000 })
  );
  console.log("begin", JSON.stringify(started, null, 2));

  await server.callTool("selectOverlayRegion", {
    sessionId: started.sessionId,
    x: 120,
    y: 96,
    width: 640,
    height: 360,
    activeAppName: "Prototype Browser",
    activeWindowTitle: "Phase 8 Demo",
    displayId: "display-1"
  });

  await server.callTool("setOverlayActiveTool", {
    sessionId: started.sessionId,
    tool: "rect"
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

  const statusBeforeSend = await server.callTool("getVisualCaptureStatus", {
    sessionId: started.sessionId
  });
  console.log("status-before-send", JSON.stringify(statusBeforeSend, null, 2));

  await server.callTool("sendOverlayCaptureSession", {
    sessionId: started.sessionId
  });

  const finalResult = await server.callTool("awaitVisualCaptureResult", {
    sessionId: started.sessionId,
    timeoutMs: 5_000
  });
  console.log("awaited", JSON.stringify(finalResult, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
