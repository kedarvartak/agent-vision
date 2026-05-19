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

  const overlay = await server.callTool("launchOverlayCaptureSession", { sessionId: session.id });
  console.log("overlay-armed", JSON.stringify(overlay, null, 2));

  const selected = await server.callTool("selectOverlayRegion", {
    sessionId: session.id,
    x: 120,
    y: 96,
    width: 640,
    height: 360,
    activeAppName: "Prototype Browser",
    activeWindowTitle: "Overlay Flow Demo",
    displayId: "display-1"
  });
  console.log("selected", JSON.stringify(selected, null, 2));

  const moved = await server.callTool("moveOverlaySelection", {
    sessionId: session.id,
    dx: 24,
    dy: 12
  });
  console.log("moved", JSON.stringify(moved, null, 2));

  const resized = await server.callTool("resizeOverlaySelection", {
    sessionId: session.id,
    width: 700,
    height: 400
  });
  console.log("resized", JSON.stringify(resized, null, 2));

  const completed = await server.callTool("sendOverlayCaptureSession", { sessionId: session.id });
  console.log("completed", JSON.stringify(completed, null, 2));

  const awaited = await awaiting;
  console.log("awaited", JSON.stringify(awaited, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
