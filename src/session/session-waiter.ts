import type { Logger } from "../logging/logger.js";
import type {
  AwaitCaptureSessionInput,
  AwaitCaptureSessionResult,
  CaptureSession
} from "../types/session.js";
import { SessionManager } from "./session-manager.js";

type PendingWait = {
  resolve: (result: AwaitCaptureSessionResult) => void;
  timer: NodeJS.Timeout;
};

export class SessionWaiter {
  private readonly pendingWaits = new Map<string, Set<PendingWait>>();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly logger: Logger
  ) {}

  awaitSession(input: AwaitCaptureSessionInput): Promise<AwaitCaptureSessionResult> {
    const session = this.sessionManager.getSession(input.sessionId);
    const timeoutMs = input.timeoutMs ?? 30_000;

    if (this.sessionManager.isTerminalStatus(session.status)) {
      return Promise.resolve(this.toTerminalOutcome(session));
    }

    const expiresInMs = Math.max(0, Date.parse(session.expiresAt) - Date.now());
    const waitMs = Math.min(timeoutMs, expiresInMs || timeoutMs);

    return new Promise<AwaitCaptureSessionResult>((resolve) => {
      const pendingWait: PendingWait = {
        resolve,
        timer: setTimeout(() => {
          this.removeWait(session.id, pendingWait);
          const currentSession = this.sessionManager.getSession(session.id);

          if (this.sessionManager.isTerminalStatus(currentSession.status)) {
            resolve(this.toTerminalOutcome(currentSession));
            return;
          }

          resolve({
            outcome: "timed_out",
            session: currentSession,
            waitedMs: timeoutMs
          });
        }, waitMs)
      };

      const pending = this.pendingWaits.get(session.id) ?? new Set<PendingWait>();
      pending.add(pendingWait);
      this.pendingWaits.set(session.id, pending);

      this.logger.debug("Registered capture session wait", {
        sessionId: session.id,
        timeoutMs,
        waitMs
      });
    });
  }

  notify(session: CaptureSession): void {
    if (!this.sessionManager.isTerminalStatus(session.status)) {
      return;
    }

    const pending = this.pendingWaits.get(session.id);
    if (!pending || pending.size === 0) {
      return;
    }

    const outcome = this.toTerminalOutcome(session);
    for (const wait of pending) {
      clearTimeout(wait.timer);
      wait.resolve(outcome);
    }

    this.pendingWaits.delete(session.id);
    this.logger.debug("Resolved capture session waits", {
      sessionId: session.id,
      outcome: outcome.outcome
    });
  }

  clearSession(sessionId: string): void {
    const pending = this.pendingWaits.get(sessionId);
    if (!pending) {
      return;
    }

    for (const wait of pending) {
      clearTimeout(wait.timer);
    }

    this.pendingWaits.delete(sessionId);
    this.logger.debug("Cleared capture session waits", {
      sessionId
    });
  }

  private toTerminalOutcome(session: CaptureSession): AwaitCaptureSessionResult {
    if (session.status === "completed" && session.result) {
      return {
        outcome: "completed",
        session,
        result: session.result
      };
    }

    return {
      outcome: session.status,
      session
    };
  }

  private removeWait(sessionId: string, pendingWait: PendingWait): void {
    const pending = this.pendingWaits.get(sessionId);
    if (!pending) {
      return;
    }

    pending.delete(pendingWait);
    if (pending.size === 0) {
      this.pendingWaits.delete(sessionId);
    }
  }
}
