import type { CaptureBundle, CaptureCommand } from "./capture.js";

export type CaptureSessionStatus =
  | "created"
  | "active"
  | "completed"
  | "cancelled"
  | "expired"
  | "failed";

export type CaptureSession = {
  id: string;
  command: CaptureCommand;
  status: CaptureSessionStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  result?: CaptureBundle;
  errorMessage?: string;
};

export type StartCaptureSessionInput = {
  command: CaptureCommand;
  ttlMs?: number;
};

export type CompleteCaptureSessionInput = {
  sessionId: string;
  bundle: CaptureBundle;
};
