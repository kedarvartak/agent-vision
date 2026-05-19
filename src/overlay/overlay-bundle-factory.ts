import type { CaptureBundle } from "../types/capture.js";
import type { CaptureSession } from "../types/session.js";
import type { OverlaySession } from "./types.js";

export const createOverlayCaptureBundle = (
  session: CaptureSession,
  overlaySession: OverlaySession
): CaptureBundle => {
  if (!overlaySession.selection) {
    throw new Error("Cannot build capture bundle without a selection");
  }

  const selection = overlaySession.selection;

  return {
    sessionId: session.id,
    command: session.command,
    image: {
      mimeType: "image/png",
      bytesBase64: "cGg0LW92ZXJsYXktYW5ub3RhdGVkLWltYWdl",
      width: Math.max(selection.width, 1),
      height: Math.max(selection.height, 1)
    },
    selection,
    annotations: overlaySession.annotations.map((entry) => entry.annotation),
    context: {
      activeAppName: overlaySession.context?.activeAppName ?? "Prototype App",
      activeWindowTitle: overlaySession.context?.activeWindowTitle ?? "Overlay Prototype Window",
      capturedAt: new Date().toISOString(),
      displayId: overlaySession.context?.displayId ?? "display-1"
    }
  };
};
