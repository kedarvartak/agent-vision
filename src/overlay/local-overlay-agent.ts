import { AppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";
import { CaptureSessionService } from "../session/capture-session-service.js";
import type { SelectionBounds } from "../types/capture.js";
import type { CaptureSession } from "../types/session.js";
import { createOverlayCaptureBundle } from "./overlay-bundle-factory.js";
import type {
  OverlayMoveInput,
  OverlayRegionInput,
  OverlayResizeInput,
  OverlaySession,
  OverlaySessionStatus
} from "./types.js";

const TERMINAL_STATUSES: ReadonlySet<OverlaySessionStatus> = new Set([
  "sent",
  "cancelled",
  "failed"
]);

export class LocalOverlayAgent {
  private readonly overlaySessions = new Map<string, OverlaySession>();

  constructor(
    private readonly captureSessions: CaptureSessionService,
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
      updatedAt: now
    };

    this.overlaySessions.set(sessionId, overlaySession);
    this.logger.info("Launched overlay capture session", { sessionId });
    return overlaySession;
  }

  get(sessionId: string): OverlaySession {
    return this.requireOverlaySession(sessionId);
  }

  list(): OverlaySession[] {
    return Array.from(this.overlaySessions.values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
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

  send(sessionId: string): CaptureSession {
    const overlaySession = this.requireSelectedOverlaySession(sessionId);
    const captureSession = this.captureSessions.getSession(sessionId);
    const bundle = createOverlayCaptureBundle(captureSession, overlaySession);

    const completed = this.captureSessions.completeSession({
      sessionId,
      bundle
    });

    this.persist({
      ...overlaySession,
      status: "sent"
    });

    this.logger.info("Sent overlay capture session", { sessionId });
    return completed;
  }

  cancel(sessionId: string): CaptureSession {
    const overlaySession = this.requireOverlaySession(sessionId);
    this.persist({
      ...overlaySession,
      status: "cancelled"
    });

    const cancelled = this.captureSessions.cancelSession(sessionId);
    this.logger.info("Cancelled overlay capture session", { sessionId });
    return cancelled;
  }

  fail(sessionId: string, errorMessage: string): CaptureSession {
    const overlaySession = this.requireOverlaySession(sessionId);
    this.persist({
      ...overlaySession,
      status: "failed",
      errorMessage
    });

    const failed = this.captureSessions.failSession(sessionId, errorMessage);
    this.logger.error("Failed overlay capture session", { sessionId, errorMessage });
    return failed;
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
    const session = this.requireOverlaySession(sessionId);
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

  private isTerminal(status: OverlaySessionStatus): boolean {
    return TERMINAL_STATUSES.has(status);
  }
}
