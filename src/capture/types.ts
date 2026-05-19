import type { Annotation } from "../types/annotation.js";
import type { CaptureCommand, CaptureContext, SelectionBounds } from "../types/capture.js";

export type RawScreenCapture = {
  mimeType: "image/png";
  bytesBase64: string;
  width: number;
  height: number;
  capturedAt: string;
  displayId?: string;
  backend: string;
};

export type ScreenCaptureProviderRequest = {
  sessionId: string;
  command: CaptureCommand;
  displayId?: string;
  activeAppName?: string;
  activeWindowTitle?: string;
};

export type CapturePipelineInput = {
  sessionId: string;
  command: CaptureCommand;
  selection: SelectionBounds;
  annotations: Annotation[];
  context?: Omit<CaptureContext, "capturedAt">;
};

export type CaptureRenderManifest = {
  sessionId: string;
  command: CaptureCommand;
  sourceImage: {
    width: number;
    height: number;
    displayId?: string;
    backend: string;
  };
  crop: SelectionBounds;
  annotations: Annotation[];
  context?: Omit<CaptureContext, "capturedAt">;
};
