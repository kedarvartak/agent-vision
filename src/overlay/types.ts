import type { CaptureCommand, SelectionBounds } from "../types/capture.js";

export type OverlaySessionStatus =
  | "armed"
  | "selected"
  | "sent"
  | "cancelled"
  | "failed";

export type OverlaySelectionContext = {
  displayId?: string;
  activeAppName?: string;
  activeWindowTitle?: string;
};

export type OverlaySession = {
  sessionId: string;
  command: CaptureCommand;
  status: OverlaySessionStatus;
  createdAt: string;
  updatedAt: string;
  selection?: SelectionBounds;
  context?: OverlaySelectionContext;
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
