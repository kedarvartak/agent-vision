import { randomUUID } from "node:crypto";

import { AppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";
import type { CaptureBundle } from "../types/capture.js";
import type {
  CaptureSession,
  CaptureSessionStatus,
  CompleteCaptureSessionInput,
  StartCaptureSessionInput
} from "../types/session.js";
import { SessionStore } from "./session-store.js";

const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;

export class SessionManager {
  constructor(
    private readonly store: SessionStore,
    private readonly logger: Logger
  ) {}

  startSession(input: StartCaptureSessionInput): CaptureSession {
    const now = new Date();
    const ttlMs = input.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    const session: CaptureSession = {
      id: randomUUID(),
      command: input.command,
      status: "created",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString()
    };

    this.store.set(session);
    this.logger.info("Started capture session", {
      sessionId: session.id,
      command: session.command,
      expiresAt: session.expiresAt
    });

    return session;
  }

  activateSession(sessionId: string): CaptureSession {
    return this.updateStatus(sessionId, "active");
  }

  completeSession(input: CompleteCaptureSessionInput): CaptureSession {
    const session = this.requireSession(input.sessionId);
    this.assertNotExpired(session);

    if (session.status === "cancelled" || session.status === "completed" || session.status === "failed") {
      throw new AppError("SESSION_CONFLICT", "Session cannot be completed from its current state", {
        sessionId: session.id,
        status: session.status
      });
    }

    const updated = this.persist({
      ...session,
      status: "completed",
      result: input.bundle
    });

    this.logger.info("Completed capture session", {
      sessionId: updated.id
    });

    return updated;
  }

  cancelSession(sessionId: string): CaptureSession {
    const session = this.requireSession(sessionId);

    if (session.status === "completed") {
      throw new AppError("SESSION_CONFLICT", "Completed sessions cannot be cancelled", {
        sessionId: session.id
      });
    }

    const updated = this.persist({
      ...session,
      status: "cancelled"
    });

    this.logger.info("Cancelled capture session", {
      sessionId: updated.id
    });

    return updated;
  }

  failSession(sessionId: string, errorMessage: string): CaptureSession {
    const session = this.requireSession(sessionId);

    const updated = this.persist({
      ...session,
      status: "failed",
      errorMessage
    });

    this.logger.error("Failed capture session", {
      sessionId: updated.id,
      errorMessage
    });

    return updated;
  }

  getSession(sessionId: string): CaptureSession {
    const session = this.requireSession(sessionId);
    return this.assertFresh(session);
  }

  listSessions(): CaptureSession[] {
    return this.store.list().map((session) => this.assertFresh(session));
  }

  private updateStatus(sessionId: string, status: CaptureSessionStatus): CaptureSession {
    const session = this.requireSession(sessionId);
    this.assertNotExpired(session);

    const updated = this.persist({
      ...session,
      status
    });

    this.logger.debug("Updated session status", {
      sessionId: updated.id,
      status: updated.status
    });

    return updated;
  }

  private assertFresh(session: CaptureSession): CaptureSession {
    return this.isExpired(session) ? this.expireSession(session) : session;
  }

  private assertNotExpired(session: CaptureSession): void {
    if (this.isExpired(session)) {
      this.expireSession(session);
      throw new AppError("SESSION_EXPIRED", "Session has expired", {
        sessionId: session.id
      });
    }
  }

  private isExpired(session: CaptureSession): boolean {
    return Date.now() > Date.parse(session.expiresAt);
  }

  private expireSession(session: CaptureSession): CaptureSession {
    if (session.status === "expired") {
      return session;
    }

    const updated = this.persist({
      ...session,
      status: "expired"
    });

    this.logger.warn("Expired capture session", {
      sessionId: updated.id
    });

    return updated;
  }

  private persist(session: CaptureSession): CaptureSession {
    const now = new Date().toISOString();
    const updated: CaptureSession = {
      ...session,
      updatedAt: now
    };

    this.store.set(updated);
    return updated;
  }

  private requireSession(sessionId: string): CaptureSession {
    const session = this.store.get(sessionId);

    if (!session) {
      throw new AppError("NOT_FOUND", "Capture session not found", {
        sessionId
      });
    }

    return session;
  }
}

export const createMockCaptureBundle = (
  sessionId: string,
  command: CaptureBundle["command"]
): CaptureBundle => ({
  sessionId,
  command,
  image: {
    mimeType: "image/png",
    bytesBase64: "cGhhc2UxLW1vY2staW1hZ2U=",
    width: 1280,
    height: 720
  },
  selection: {
    x: 120,
    y: 96,
    width: 640,
    height: 360
  },
  annotations: [
    {
      type: "rect",
      x: 150,
      y: 120,
      width: 280,
      height: 96,
      label: "Mock highlighted region"
    }
  ],
  context: {
    activeAppName: "Mock Browser",
    activeWindowTitle: "Phase 1 Prototype",
    capturedAt: new Date().toISOString(),
    displayId: "display-1"
  }
});
