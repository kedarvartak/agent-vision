import type { LocalOverlayAgent } from "../overlay/local-overlay-agent.js";
import type { OverlaySession } from "../overlay/types.js";
import { CaptureSessionService } from "../session/capture-session-service.js";
import type { CaptureCommand } from "../types/capture.js";
import type { AwaitCaptureSessionResult, CaptureSession } from "../types/session.js";
import type {
  AwaitVisualCaptureResult,
  BeginVisualCaptureResult,
  VisualCaptureGuidance,
  VisualCaptureStage,
  VisualCaptureStatusResult
} from "./types.js";

const guidanceForStage = (stage: VisualCaptureStage, command: CaptureCommand): VisualCaptureGuidance => {
  switch (stage) {
    case "armed":
      return {
        title: `${command} armed`,
        message: "Capture mode is active. Switch to the target app or screen to continue.",
        nextActions: ["switch_to_target", "select_region", "cancel"]
      };
    case "selecting":
      return {
        title: "Selection in progress",
        message: "Select the region you want the model to see.",
        nextActions: ["select_region", "cancel"]
      };
    case "annotating":
      return {
        title: "Add context",
        message: "Your region is selected. Add annotations if needed, then send when ready.",
        nextActions: ["annotate", "send", "cancel"]
      };
    case "ready_to_send":
      return {
        title: "Ready to send",
        message: "The visual payload is prepared. Send it back to the LLM when you are ready.",
        nextActions: ["send", "cancel"]
      };
    case "completed":
      return {
        title: "Capture delivered",
        message: "The capture bundle is ready for the LLM client to attach to the current interaction.",
        nextActions: ["done"]
      };
    case "cancelled":
      return {
        title: "Capture cancelled",
        message: "The visual capture flow was cancelled before send.",
        nextActions: ["retry", "done"]
      };
    case "failed":
      return {
        title: "Capture failed",
        message: "The capture flow failed. Inspect the session error and retry if needed.",
        nextActions: ["retry", "done"]
      };
    case "expired":
      return {
        title: "Capture expired",
        message: "The capture session expired before completion. Start a new one to continue.",
        nextActions: ["retry", "done"]
      };
    case "timed_out":
      return {
        title: "Waiting timed out",
        message: "The client wait timed out, but the capture session may still be active.",
        nextActions: ["wait", "cancel", "done"]
      };
  }
};

const deriveStage = (
  command: CaptureCommand,
  captureSession: CaptureSession,
  overlaySession?: OverlaySession
): VisualCaptureStage => {
  if (captureSession.status === "completed") {
    return "completed";
  }
  if (captureSession.status === "cancelled") {
    return "cancelled";
  }
  if (captureSession.status === "failed") {
    return "failed";
  }
  if (captureSession.status === "expired") {
    return "expired";
  }

  if (!overlaySession) {
    return "armed";
  }

  if (overlaySession.status === "armed") {
    return "selecting";
  }

  if (overlaySession.status === "selected") {
    return overlaySession.annotations.length > 0 || command === "see" ? "annotating" : "ready_to_send";
  }

  if (overlaySession.status === "sent") {
    return "completed";
  }

  if (overlaySession.status === "cancelled") {
    return "cancelled";
  }

  if (overlaySession.status === "failed") {
    return "failed";
  }

  return "armed";
};

export class VisualCaptureFlow {
  constructor(
    private readonly captureSessions: CaptureSessionService,
    private readonly overlayAgent: LocalOverlayAgent
  ) {}

  begin(command: CaptureCommand, ttlMs?: number): BeginVisualCaptureResult {
    const captureSession = this.captureSessions.startSession({ command, ttlMs });
    const overlaySession = this.overlayAgent.launch(captureSession.id);
    const stage = deriveStage(command, captureSession, overlaySession);

    return {
      sessionId: captureSession.id,
      command,
      captureSession,
      overlaySession,
      stage,
      guidance: guidanceForStage(stage, command)
    };
  }

  getStatus(sessionId: string): VisualCaptureStatusResult {
    const captureSession = this.captureSessions.getSession(sessionId);
    const overlaySession = this.safeGetOverlaySession(sessionId);
    const stage = deriveStage(captureSession.command, captureSession, overlaySession);

    return {
      sessionId,
      command: captureSession.command,
      captureStatus: captureSession.status,
      overlayStatus: overlaySession?.status,
      stage,
      guidance: guidanceForStage(stage, captureSession.command),
      captureSession,
      overlaySession,
      result: captureSession.result
    };
  }

  async awaitResult(sessionId: string, timeoutMs?: number): Promise<AwaitVisualCaptureResult> {
    const waitResult = await this.captureSessions.awaitSession({ sessionId, timeoutMs });
    const command = waitResult.session.command;
    const stage: VisualCaptureStage = waitResult.outcome === "timed_out" ? "timed_out" : deriveStage(command, waitResult.session);

    return {
      sessionId,
      stage,
      guidance: guidanceForStage(stage, command),
      waitResult,
      result: waitResult.outcome === "completed" ? waitResult.result : undefined
    };
  }

  private safeGetOverlaySession(sessionId: string): OverlaySession | undefined {
    try {
      return this.overlayAgent.get(sessionId);
    } catch {
      return undefined;
    }
  }
}
