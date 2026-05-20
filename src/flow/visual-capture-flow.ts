import type { LocalOverlayAgent } from "../overlay/local-overlay-agent.js";
import type { OverlaySession } from "../overlay/types.js";
import { CaptureSessionService } from "../session/capture-session-service.js";
import type { CaptureCommand } from "../types/capture.js";
import type { CaptureSession } from "../types/session.js";
import type {
  AwaitVisualCaptureResult,
  BeginVisualCaptureResult,
  VisualCaptureClientHints,
  VisualCaptureGuidance,
  VisualCaptureStage,
  VisualCaptureStatusResult
} from "./types.js";

const guidanceForStage = (
  stage: VisualCaptureStage,
  command: CaptureCommand,
  overlaySession?: OverlaySession
): VisualCaptureGuidance => {
  switch (stage) {
    case "armed":
      return {
        title: `${command} armed`,
        message: "Capture mode is active. Switch to the target app, then start your selection.",
        nextActions: ["switch_to_target", "select_region", "cancel"],
        primaryAction: "switch_to_target",
        footerHint: "The overlay stays armed until you select a region or cancel."
      };
    case "selecting":
      return {
        title: "Select the target area",
        message: "Drag a region around the part of the screen you want the model to inspect.",
        nextActions: ["select_region", "cancel"],
        primaryAction: "select_region",
        highlightedShortcut: overlaySession?.shortcuts.select,
        footerHint: "A tighter crop gives better context and lower payload size."
      };
    case "annotating":
      return {
        title: command === "see" ? "Add guidance for the model" : "Optional markup",
        message:
          command === "see"
            ? "Use boxes, arrows, text, or redaction to show the model exactly what matters."
            : "You can send now, or add quick annotations if a highlight would help.",
        nextActions: ["annotate", "send", "cancel"],
        primaryAction: command === "see" ? "annotate" : "send",
        highlightedShortcut: overlaySession?.shortcuts[overlaySession?.activeTool ?? "select"],
        footerHint: "Press the tool shortcut once to switch tools quickly."
      };
    case "ready_to_send":
      return {
        title: "Ready to send",
        message: "The selection is ready. Send it back to the LLM when you are satisfied with the preview.",
        nextActions: ["send", "cancel"],
        primaryAction: "send",
        footerHint: "If needed, you can still reposition the selection before sending."
      };
    case "completed":
      return {
        title: "Capture delivered",
        message: "The visual bundle is complete and ready to attach to the current LLM interaction.",
        nextActions: ["done"],
        primaryAction: "done",
        footerHint: "The image remained in memory only and was not persisted by default."
      };
    case "cancelled":
      return {
        title: "Capture cancelled",
        message: "The visual capture flow was cancelled before send.",
        nextActions: ["retry", "done"],
        primaryAction: "retry"
      };
    case "failed":
      return {
        title: "Capture failed",
        message: "The capture flow failed. Review the session error details and retry if needed.",
        nextActions: ["retry", "done"],
        primaryAction: "retry"
      };
    case "expired":
      return {
        title: "Capture expired",
        message: "The capture session expired before completion. Start a new one to continue.",
        nextActions: ["retry", "done"],
        primaryAction: "retry"
      };
    case "timed_out":
      return {
        title: "Still waiting",
        message: "The client-side wait timed out, but the capture session may still be active.",
        nextActions: ["wait", "cancel", "done"],
        primaryAction: "wait",
        footerHint: "Use getVisualCaptureStatus to refresh the UI without losing progress."
      };
  }
};

const clientHintsForStage = (stage: VisualCaptureStage): VisualCaptureClientHints => {
  switch (stage) {
    case "completed":
      return { statusTone: "success", showToolbar: false, showPreview: true, allowInlineTips: false };
    case "failed":
      return { statusTone: "error", showToolbar: false, showPreview: false, allowInlineTips: true };
    case "cancelled":
    case "expired":
      return { statusTone: "warning", showToolbar: false, showPreview: false, allowInlineTips: true };
    case "timed_out":
      return { statusTone: "warning", showToolbar: true, showPreview: true, allowInlineTips: true };
    case "armed":
    case "selecting":
      return { statusTone: "info", showToolbar: true, showPreview: false, allowInlineTips: true };
    case "annotating":
    case "ready_to_send":
      return { statusTone: "info", showToolbar: true, showPreview: true, allowInlineTips: true };
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
    const hasAnnotations = overlaySession.annotationSummary.total > 0;
    return hasAnnotations || command === "see" ? "annotating" : "ready_to_send";
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
  if (overlaySession.status === "expired") {
    return "expired";
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
      guidance: guidanceForStage(stage, command, overlaySession),
      clientHints: clientHintsForStage(stage)
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
      guidance: guidanceForStage(stage, captureSession.command, overlaySession),
      clientHints: clientHintsForStage(stage),
      captureSession,
      overlaySession,
      result: captureSession.result
    };
  }

  async awaitResult(sessionId: string, timeoutMs?: number): Promise<AwaitVisualCaptureResult> {
    const waitResult = await this.captureSessions.awaitSession({ sessionId, timeoutMs });
    const command = waitResult.session.command;
    const overlaySession = this.safeGetOverlaySession(sessionId);
    const stage: VisualCaptureStage =
      waitResult.outcome === "timed_out"
        ? "timed_out"
        : deriveStage(command, waitResult.session, overlaySession);

    return {
      sessionId,
      stage,
      guidance: guidanceForStage(stage, command, overlaySession),
      clientHints: clientHintsForStage(stage),
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
