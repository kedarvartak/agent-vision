import type { Annotation } from "../types/annotation.js";
import type { CaptureCommand, SelectionBounds } from "../types/capture.js";

export type OverlaySessionStatus =
  | "armed"
  | "selected"
  | "sent"
  | "cancelled"
  | "failed"
  | "expired";

export type OverlayTool = "select" | "rect" | "arrow" | "text" | "redact";

export type OverlaySelectionContext = {
  displayId?: string;
  activeAppName?: string;
  activeWindowTitle?: string;
};

export type OverlayAnnotationRecord = {
  id: string;
  annotation: Annotation;
  createdAt: string;
  updatedAt: string;
};

export type OverlaySession = {
  sessionId: string;
  command: CaptureCommand;
  status: OverlaySessionStatus;
  createdAt: string;
  updatedAt: string;
  selection?: SelectionBounds;
  context?: OverlaySelectionContext;
  activeTool: OverlayTool;
  annotations: OverlayAnnotationRecord[];
  shortcuts: Record<OverlayTool, string>;
  errorMessage?: string;
};

export type OverlayRegionInput = SelectionBounds & OverlaySelectionContext;

export type OverlayMoveInput = {
  dx: number;
  dy: number;
};

export type OverlayResizeInput = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type CreateAnnotationInput = {
  id?: string;
  annotation: Annotation;
};

export type UpdateAnnotationInput = {
  annotationId: string;
  annotation: Annotation;
};
