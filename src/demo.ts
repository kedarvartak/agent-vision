import type { CaptureSession } from "./types/session.js";
import { VisualContextServer } from "./server.js";

const ensureSession = (value: unknown): CaptureSession => {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") {
    throw new Error("Unexpected session response");
  }

  return value as CaptureSession;
};

const run = async (): Promise<void> => {
  const server = new VisualContextServer();
  server.start();

  const session = ensureSession(await server.callTool("startCaptureSession", { command: "see" }));
  console.log("started", JSON.stringify(session, null, 2));

  const awaiting = server.callTool("awaitCaptureSession", {
    sessionId: session.id,
    timeoutMs: 5_000
  });

  await server.callTool("launchOverlayCaptureSession", { sessionId: session.id });
  await server.callTool("selectOverlayRegion", {
    sessionId: session.id,
    x: 120,
    y: 96,
    width: 640,
    height: 360,
    activeAppName: "Prototype Browser",
    activeWindowTitle: "Overlay Annotation Demo",
    displayId: "display-1"
  });

  await server.callTool("setOverlayActiveTool", {
    sessionId: session.id,
    tool: "rect"
  });

  await server.callTool("addOverlayAnnotation", {
    sessionId: session.id,
    annotationId: "box-1",
    annotation: {
      type: "rect",
      x: 140,
      y: 120,
      width: 300,
      height: 120,
      label: "Primary issue"
    }
  });

  await server.callTool("addOverlayAnnotation", {
    sessionId: session.id,
    annotation: {
      type: "arrow",
      from: { x: 90, y: 90 },
      to: { x: 200, y: 160 },
      label: "Look here"
    }
  });

  await server.callTool("addOverlayAnnotation", {
    sessionId: session.id,
    annotationId: "text-1",
    annotation: {
      type: "text",
      x: 160,
      y: 260,
      text: "This area is failing"
    }
  });

  await server.callTool("updateOverlayAnnotation", {
    sessionId: session.id,
    annotationId: "text-1",
    annotation: {
      type: "text",
      x: 160,
      y: 260,
      text: "This area is failing after submit"
    }
  });

  const completed = await server.callTool("sendOverlayCaptureSession", { sessionId: session.id });
  console.log("completed", JSON.stringify(completed, null, 2));

  const awaited = await awaiting;
  console.log("awaited", JSON.stringify(awaited, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
