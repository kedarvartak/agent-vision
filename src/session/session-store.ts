import type { CaptureSession } from "../types/session.js";

export class SessionStore {
  private readonly sessions = new Map<string, CaptureSession>();

  get(sessionId: string): CaptureSession | undefined {
    return this.sessions.get(sessionId);
  }

  set(session: CaptureSession): void {
    this.sessions.set(session.id, session);
  }

  list(): CaptureSession[] {
    return Array.from(this.sessions.values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
