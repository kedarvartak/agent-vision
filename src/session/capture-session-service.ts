import type { Logger } from "../logging/logger.js";
import type {
  AwaitCaptureSessionInput,
  AwaitCaptureSessionResult,
  CaptureSession,
  CompleteCaptureSessionInput,
  StartCaptureSessionInput
} from "../types/session.js";
import { SessionManager } from "./session-manager.js";
import { SessionWaiter } from "./session-waiter.js";

export class CaptureSessionService {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionWaiter: SessionWaiter,
    private readonly logger: Logger
  ) {}

  startSession(input: StartCaptureSessionInput): CaptureSession {
    const session = this.sessionManager.startSession(input);
    return this.sessionManager.activateSession(session.id);
  }

  awaitSession(input: AwaitCaptureSessionInput): Promise<AwaitCaptureSessionResult> {
    return this.sessionWaiter.awaitSession(input);
  }

  getSession(sessionId: string): CaptureSession {
    return this.sessionManager.getSession(sessionId);
  }

  listSessions(): CaptureSession[] {
    return this.sessionManager.listSessions();
  }

  completeSession(input: CompleteCaptureSessionInput): CaptureSession {
    const completed = this.sessionManager.completeSession(input);
    this.sessionWaiter.notify(completed);
    return completed;
  }

  cancelSession(sessionId: string): CaptureSession {
    const cancelled = this.sessionManager.cancelSession(sessionId);
    this.sessionWaiter.notify(cancelled);
    return cancelled;
  }

  failSession(sessionId: string, errorMessage: string): CaptureSession {
    const failed = this.sessionManager.failSession(sessionId, errorMessage);
    this.sessionWaiter.notify(failed);
    return failed;
  }

  reapTerminalSessions(maxAgeMs: number): { removedSessionIds: string[] } {
    const result = this.sessionManager.reapTerminalSessions(maxAgeMs);
    for (const sessionId of result.removedSessionIds) {
      this.sessionWaiter.clearSession(sessionId);
    }

    return result;
  }

  logStateSummary(): void {
    this.logger.debug("Capture session service state", {
      sessions: this.listSessions().length
    });
  }
}
