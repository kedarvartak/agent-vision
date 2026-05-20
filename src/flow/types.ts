import type { CaptureBundle, CaptureCommand } from "../types/capture.js";
import type { OverlaySession } from "../overlay/types.js";
import type {
  AwaitCaptureSessionResult,
  CaptureSession,
  CaptureSessionStatus
} from "../types/session.js";

export type VisualCaptureStage =
  | "armed"
  | "selecting"
  | "annotating"
  | "ready_to_send"
  | "completed"
  | "cancelled"
  | "failed"
  | "expired"
  | "timed_out";

export type VisualCaptureAction =
  | "switch_to_target"
  | "select_region"
  | "annotate"
  | "send"
  | "wait"
  | "done"
  | "cancel"
  | "retry";

export type VisualCaptureGuidance = {
  title: string;
  message: string;
  nextActions: VisualCaptureAction[];
  primaryAction: VisualCaptureAction;
  highlightedShortcut?: string;
  footerHint?: string;
};

export type VisualCaptureClientHints = {
  statusTone: "info" | "success" | "warning" | "error";
  showToolbar: boolean;
  showPreview: boolean;
  allowInlineTips: boolean;
};

export type BeginVisualCaptureResult = {
  sessionId: string;
  command: CaptureCommand;
  captureSession: CaptureSession;
  overlaySession: OverlaySession;
  stage: VisualCaptureStage;
  guidance: VisualCaptureGuidance;
  clientHints: VisualCaptureClientHints;
};

export type VisualCaptureStatusResult = {
  sessionId: string;
  command: CaptureCommand;
  captureStatus: CaptureSessionStatus;
  overlayStatus?: OverlaySession["status"];
  stage: VisualCaptureStage;
  guidance: VisualCaptureGuidance;
  clientHints: VisualCaptureClientHints;
  captureSession: CaptureSession;
  overlaySession?: OverlaySession;
  result?: CaptureBundle;
};

export type AwaitVisualCaptureResult = {
  sessionId: string;
  stage: VisualCaptureStage;
  guidance: VisualCaptureGuidance;
  clientHints: VisualCaptureClientHints;
  waitResult: AwaitCaptureSessionResult;
  result?: CaptureBundle;
};
