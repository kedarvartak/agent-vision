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

export type OverlayToolDescriptor = {
  tool: OverlayTool;
  label: string;
  shortcut: string;
  description: string;
};

export type OverlaySelectionSummary = {
  label: string;
  areaPx: number;
  bounds?: SelectionBounds;
};

export type OverlayAnnotationSummary = {
  total: number;
  byType: Partial<Record<Annotation["type"], number>>;
  latestAnnotationId?: string;
};

export type OverlayPreviewState = {
  canSend: boolean;
  showSelectionOutline: boolean;
  showAnnotationLayer: boolean;
  emptyStateMessage?: string;
};

export type OverlayHudState = {
  title: string;
  subtitle: string;
  statusBadge: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  activeToolLabel: string;
  onboardingHint: string;
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
  toolDescriptors: OverlayToolDescriptor[];
  selectionSummary: OverlaySelectionSummary;
  annotationSummary: OverlayAnnotationSummary;
  preview: OverlayPreviewState;
  hud: OverlayHudState;
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
