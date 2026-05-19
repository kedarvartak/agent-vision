import type { Annotation } from "./annotation.js";

export type CaptureCommand = "see" | "clip";

export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptureImage = {
  mimeType: "image/png";
  bytesBase64: string;
  width: number;
  height: number;
};

export type CaptureContext = {
  activeAppName?: string;
  activeWindowTitle?: string;
  capturedAt: string;
  displayId?: string;
};

export type CaptureBundle = {
  sessionId: string;
  command: CaptureCommand;
  image: CaptureImage;
  selection: SelectionBounds;
  annotations: Annotation[];
  context?: CaptureContext;
};
