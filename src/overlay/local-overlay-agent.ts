import { randomUUID } from "node:crypto";

import type { CapturePipeline } from "../capture/capture-pipeline.js";
import { AppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";
import { CaptureSessionService } from "../session/capture-session-service.js";
import type {
  Annotation,
  ArrowAnnotation,
  RedactAnnotation,
  RectangleAnnotation,
  TextAnnotation
} from "../types/annotation.js";
import type { SelectionBounds } from "../types/capture.js";
import type { CaptureSession, CaptureSessionStatus } from "../types/session.js";
import type {
  CreateAnnotationInput,
  OverlayAnnotationRecord,
  OverlayMoveInput,
  OverlayRegionInput,
  OverlayResizeInput,
  OverlaySession,
  OverlaySessionStatus,
  OverlayTool,
  UpdateAnnotationInput
} from "./types.js";

const TERMINAL_STATUSES: ReadonlySet<OverlaySessionStatus> = new Set([
  "sent",
  "cancelled",
  "failed",
  "expired"
]);

const OVERLAY_SHORTCUTS: Record<OverlayTool, string> = {
  select: "V",
  rect: "B",
  arrow: "A",
  text: "T",
  redact: "R"
};

const OVERLAY_TERMINAL_BY_CAPTURE_STATUS: Partial<Record<CaptureSessionStatus, OverlaySessionStatus>> = {
  completed: "sent",
  cancelled: "cancelled",
  failed: "failed",
  expired: "expired"
};

export class LocalOverlayAgent {
  private readonly overlaySessions = new Map<string, OverlaySession>();

  constructor(
    private readonly captureSessions: CaptureSessionService,
    private readonly capturePipeline: CapturePipeline,
    private readonly logger: Logger
  ) {}

  launch(sessionId: string): OverlaySession {
    const captureSession = this.captureSessions.getSession(sessionId);

    const existing = this.overlaySessions.get(sessionId);
    if (existing && !this.isTerminal(existing.status)) {
      throw new AppError("SESSION_CONFLICT", "Overlay session is already active", { sessionId });
    }

    const now = new Date().toISOString();
    const overlaySession: OverlaySession = {
      sessionId: captureSession.id,
      command: captureSession.command,
      status: "armed",
      createdAt: now,
      updatedAt: now,
      activeTool: "select",
      annotations: [],
      shortcuts: OVERLAY_SHORTCUTS
    };

    this.overlaySessions.set(sessionId, overlaySession);
    this.logger.info("Launched overlay capture session", { sessionId });
    return overlaySession;
  }

  get(sessionId: string): OverlaySession {
    return this.syncWithCaptureSession(this.requireOverlaySession(sessionId));
  }

  list(): OverlaySession[] {
    return Array.from(this.overlaySessions.values())
      .map((session) => this.syncWithCaptureSession(session))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  setActiveTool(sessionId: string, tool: OverlayTool): OverlaySession {
    const session = this.requireMutableOverlaySession(sessionId);
    const updated = this.persist({
      ...session,
      activeTool: tool
    });

    this.logger.debug("Set overlay active tool", { sessionId, tool });
    return updated;
  }

  selectRegion(sessionId: string, input: OverlayRegionInput): OverlaySession {
    this.assertValidBounds(input);
    const session = this.requireMutableOverlaySession(sessionId);

    const updated = this.persist({
      ...session,
      status: "selected",
      selection: {
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height
      },
      context: {
        displayId: input.displayId,
        activeAppName: input.activeAppName,
        activeWindowTitle: input.activeWindowTitle
      }
    });

    this.logger.debug("Selected overlay region", { sessionId, selection: updated.selection });
    return updated;
  }

  moveSelection(sessionId: string, input: OverlayMoveInput): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    const selection = session.selection as SelectionBounds;

    const updated = this.persist({
      ...session,
      selection: {
        ...selection,
        x: selection.x + input.dx,
        y: selection.y + input.dy
      }
    });

    this.logger.debug("Moved overlay selection", { sessionId, selection: updated.selection });
    return updated;
  }

  resizeSelection(sessionId: string, input: OverlayResizeInput): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    const selection = session.selection as SelectionBounds;

    const nextSelection: SelectionBounds = {
      x: input.x ?? selection.x,
      y: input.y ?? selection.y,
      width: input.width ?? selection.width,
      height: input.height ?? selection.height
    };

    this.assertValidBounds(nextSelection);

    const updated = this.persist({
      ...session,
      selection: nextSelection
    });

    this.logger.debug("Resized overlay selection", { sessionId, selection: updated.selection });
    return updated;
  }

  addAnnotation(sessionId: string, input: CreateAnnotationInput): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    this.assertAnnotation(input.annotation);

    const now = new Date().toISOString();
    const record: OverlayAnnotationRecord = {
      id: input.id ?? randomUUID(),
      annotation: input.annotation,
      createdAt: now,
      updatedAt: now
    };

    const updated = this.persist({
      ...session,
      annotations: [...session.annotations, record]
    });

    this.logger.debug("Added overlay annotation", {
      sessionId,
      annotationId: record.id,
      annotationType: record.annotation.type
    });
    return updated;
  }

  updateAnnotation(sessionId: string, input: UpdateAnnotationInput): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    this.assertAnnotation(input.annotation);

    const existing = session.annotations.find((annotation) => annotation.id === input.annotationId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Overlay annotation not found", {
        sessionId,
        annotationId: input.annotationId
      });
    }

    const updated = this.persist({
      ...session,
      annotations: session.annotations.map((record) =>
        record.id === input.annotationId
          ? {
              ...record,
              annotation: input.annotation,
              updatedAt: new Date().toISOString()
            }
          : record
      )
    });

    this.logger.debug("Updated overlay annotation", {
      sessionId,
      annotationId: input.annotationId,
      annotationType: input.annotation.type
    });
    return updated;
  }

  removeAnnotation(sessionId: string, annotationId: string): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    const annotationExists = session.annotations.some((record) => record.id === annotationId);
    if (!annotationExists) {
      throw new AppError("NOT_FOUND", "Overlay annotation not found", {
        sessionId,
        annotationId
      });
    }

    const updated = this.persist({
      ...session,
      annotations: session.annotations.filter((record) => record.id !== annotationId)
    });

    this.logger.debug("Removed overlay annotation", { sessionId, annotationId });
    return updated;
  }

  clearAnnotations(sessionId: string): OverlaySession {
    const session = this.requireSelectedOverlaySession(sessionId);
    const updated = this.persist({
      ...session,
      annotations: []
    });

    this.logger.debug("Cleared overlay annotations", { sessionId });
    return updated;
  }

  async send(sessionId: string): Promise<CaptureSession> {
    const overlaySession = this.requireSelectedOverlaySession(sessionId);

    try {
      const bundle = await this.capturePipeline.createBundle({
        sessionId,
        command: overlaySession.command,
        selection: overlaySession.selection as SelectionBounds,
        annotations: overlaySession.annotations.map((entry) => entry.annotation),
        context: overlaySession.context
      });

      const completed = this.captureSessions.completeSession({
        sessionId,
        bundle
      });

      this.persist({
        ...overlaySession,
        status: "sent",
        errorMessage: undefined
      });

      this.logger.info("Sent overlay capture session", {
        sessionId,
        annotationCount: overlaySession.annotations.length,
        backend: bundle.image.backend,
        byteLength: bundle.image.byteLength
      });
      return completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = this.fail(sessionId, `Overlay send failed: ${message}`);
      throw new AppError("INTERNAL_ERROR", "Overlay capture send failed", {
        sessionId,
        cause: message,
        resultingStatus: failed.status
      });
    }
  }

  cancel(sessionId: string): CaptureSession {
    const overlaySession = this.syncWithCaptureSession(this.requireOverlaySession(sessionId));
    if (!this.isTerminal(overlaySession.status)) {
      this.persist({
        ...overlaySession,
        status: "cancelled"
      });
    }

    const cancelled = this.captureSessions.cancelSession(sessionId);
    this.logger.info("Cancelled overlay capture session", { sessionId });
    return cancelled;
  }

  fail(sessionId: string, errorMessage: string): CaptureSession {
    const overlaySession = this.syncWithCaptureSession(this.requireOverlaySession(sessionId));
    if (!this.isTerminal(overlaySession.status)) {
      this.persist({
        ...overlaySession,
        status: "failed",
        errorMessage
      });
    }

    const failed = this.captureSessions.failSession(sessionId, errorMessage);
    this.logger.error("Failed overlay capture session", { sessionId, errorMessage });
    return failed;
  }

  reapTerminalSessions(maxAgeMs: number): { removedSessionIds: string[] } {
    const now = Date.now();
    const removedSessionIds: string[] = [];

    for (const session of this.list()) {
      if (!this.isTerminal(session.status)) {
        continue;
      }

      const updatedAtMs = Date.parse(session.updatedAt);
      if (now - updatedAtMs < maxAgeMs) {
        continue;
      }

      this.overlaySessions.delete(session.sessionId);
      removedSessionIds.push(session.sessionId);
    }

    if (removedSessionIds.length > 0) {
      this.logger.info("Reaped terminal overlay sessions", {
        removedSessionIds,
        maxAgeMs
      });
    }

    return { removedSessionIds };
  }

  private requireSelectedOverlaySession(sessionId: string): OverlaySession {
    const session = this.requireMutableOverlaySession(sessionId);
    if (!session.selection) {
      throw new AppError("SESSION_CONFLICT", "Overlay session does not have a selected region", {
        sessionId
      });
    }

    return session;
  }

  private requireMutableOverlaySession(sessionId: string): OverlaySession {
    const session = this.syncWithCaptureSession(this.requireOverlaySession(sessionId));
    if (this.isTerminal(session.status)) {
      throw new AppError("SESSION_CONFLICT", "Overlay session is no longer mutable", {
        sessionId,
        status: session.status
      });
    }

    return session;
  }

  private requireOverlaySession(sessionId: string): OverlaySession {
    const session = this.overlaySessions.get(sessionId);
    if (!session) {
      throw new AppError("NOT_FOUND", "Overlay session not found", { sessionId });
    }

    return session;
  }

  private syncWithCaptureSession(session: OverlaySession): OverlaySession {
    let captureSession: CaptureSession;
    try {
      captureSession = this.captureSessions.getSession(session.sessionId);
    } catch (error) {
      return session;
    }

    const mappedStatus = OVERLAY_TERMINAL_BY_CAPTURE_STATUS[captureSession.status];
    if (!mappedStatus || session.status === mappedStatus) {
      return session;
    }

    const updated = this.persist({
      ...session,
      status: mappedStatus,
      errorMessage: captureSession.errorMessage ?? session.errorMessage
    });

    this.logger.debug("Synchronized overlay session with capture session", {
      sessionId: session.sessionId,
      captureStatus: captureSession.status,
      overlayStatus: updated.status
    });

    return updated;
  }

  private persist(session: OverlaySession): OverlaySession {
    const updated: OverlaySession = {
      ...session,
      updatedAt: new Date().toISOString()
    };

    this.overlaySessions.set(updated.sessionId, updated);
    return updated;
  }

  private assertValidBounds(bounds: SelectionBounds): void {
    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new AppError("INVALID_ARGUMENT", "Selection width and height must be greater than zero", {
        bounds
      });
    }
  }

  private assertAnnotation(annotation: Annotation): void {
    switch (annotation.type) {
      case "rect":
        this.assertBoxAnnotation(annotation);
        return;
      case "redact":
        this.assertRedactAnnotation(annotation);
        return;
      case "arrow":
        this.assertArrowAnnotation(annotation);
        return;
      case "text":
        this.assertTextAnnotation(annotation);
        return;
      default:
        throw new AppError("INVALID_ARGUMENT", "Unsupported annotation type", {
          annotation
        });
    }
  }

  private assertBoxAnnotation(annotation: RectangleAnnotation): void {
    this.assertValidBounds(annotation);
  }

  private assertRedactAnnotation(annotation: RedactAnnotation): void {
    this.assertValidBounds(annotation);
  }

  private assertArrowAnnotation(annotation: ArrowAnnotation): void {
    if (Number.isNaN(annotation.from.x) || Number.isNaN(annotation.from.y)) {
      throw new AppError("INVALID_ARGUMENT", "Arrow annotation start point must be numeric", {
        annotation
      });
    }

    if (Number.isNaN(annotation.to.x) || Number.isNaN(annotation.to.y)) {
      throw new AppError("INVALID_ARGUMENT", "Arrow annotation end point must be numeric", {
        annotation
      });
    }
  }

  private assertTextAnnotation(annotation: TextAnnotation): void {
    if (annotation.text.trim() === "") {
      throw new AppError("INVALID_ARGUMENT", "Text annotation must include non-empty text", {
        annotation
      });
    }
  }

  private isTerminal(status: OverlaySessionStatus): boolean {
    return TERMINAL_STATUSES.has(status);
  }
}
