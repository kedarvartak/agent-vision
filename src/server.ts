import { AppError } from "./errors/app-error.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry } from "./mcp/tool-registry.js";
import { SessionManager, createMockCaptureBundle } from "./session/session-manager.js";
import { SessionStore } from "./session/session-store.js";
import { SessionWaiter } from "./session/session-waiter.js";
import type { CaptureBundle, CaptureCommand } from "./types/capture.js";

const isCaptureCommand = (value: unknown): value is CaptureCommand =>
  value === "see" || value === "clip";

const readSessionId = (args: Record<string, unknown>): string => {
  const sessionId = args.sessionId;
  if (typeof sessionId !== "string") {
    throw new AppError("INVALID_ARGUMENT", "sessionId must be a string");
  }

  return sessionId;
};

const readCaptureBundle = (args: Record<string, unknown>): CaptureBundle => {
  const bundle = args.bundle;
  if (!bundle || typeof bundle !== "object") {
    throw new AppError("INVALID_ARGUMENT", "bundle must be an object");
  }

  return bundle as CaptureBundle;
};

const readErrorMessage = (args: Record<string, unknown>): string => {
  const errorMessage = args.errorMessage;
  if (typeof errorMessage !== "string" || errorMessage.trim() === "") {
    throw new AppError("INVALID_ARGUMENT", "errorMessage must be a non-empty string");
  }

  return errorMessage;
};

export class VisualContextServer {
  public readonly logger = new ConsoleLogger("visual-context-server");
  private readonly sessionStore = new SessionStore();
  private readonly sessionManager = new SessionManager(this.sessionStore, this.logger);
  private readonly sessionWaiter = new SessionWaiter(this.sessionManager, this.logger);
  private readonly tools = new ToolRegistry(this.logger);

  constructor() {
    this.registerTools();
  }

  listTools(): ReturnType<ToolRegistry["list"]> {
    return this.tools.list();
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.tools.call(name, args);
  }

  start(): void {
    this.logger.info("Phase 2 MCP session flow ready", {
      tools: this.listTools().map((tool) => tool.name)
    });
  }

  private registerTools(): void {
    this.tools.register({
      name: "startCaptureSession",
      description: "Create a new in-memory capture session and mark it active.",
      handler: (args) => {
        const command = args.command;
        if (!isCaptureCommand(command)) {
          throw new AppError("INVALID_ARGUMENT", "command must be 'see' or 'clip'");
        }

        const ttlMs = typeof args.ttlMs === "number" ? args.ttlMs : undefined;
        const session = this.sessionManager.startSession({ command, ttlMs });
        return this.sessionManager.activateSession(session.id);
      }
    });

    this.tools.register({
      name: "awaitCaptureSession",
      description: "Wait for a session to complete, cancel, fail, expire, or time out.",
      handler: (args) => {
        const sessionId = readSessionId(args);
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
        return this.sessionWaiter.awaitSession({ sessionId, timeoutMs });
      }
    });

    this.tools.register({
      name: "getCaptureSession",
      description: "Fetch the latest state for a capture session.",
      handler: (args) => this.sessionManager.getSession(readSessionId(args))
    });

    this.tools.register({
      name: "listCaptureSessions",
      description: "List all in-memory capture sessions.",
      handler: () => this.sessionManager.listSessions()
    });

    this.tools.register({
      name: "completeCaptureSession",
      description: "Complete a session with a provided capture bundle.",
      handler: (args) => {
        const completed = this.sessionManager.completeSession({
          sessionId: readSessionId(args),
          bundle: readCaptureBundle(args)
        });
        this.sessionWaiter.notify(completed);
        return completed;
      }
    });

    this.tools.register({
      name: "completeMockCaptureSession",
      description: "Complete a session with a mock capture bundle for Phase 2 testing.",
      handler: (args) => {
        const session = this.sessionManager.getSession(readSessionId(args));
        const completed = this.sessionManager.completeSession({
          sessionId: session.id,
          bundle: createMockCaptureBundle(session.id, session.command)
        });
        this.sessionWaiter.notify(completed);
        return completed;
      }
    });

    this.tools.register({
      name: "cancelCaptureSession",
      description: "Cancel an active or created capture session.",
      handler: (args) => {
        const cancelled = this.sessionManager.cancelSession(readSessionId(args));
        this.sessionWaiter.notify(cancelled);
        return cancelled;
      }
    });

    this.tools.register({
      name: "failCaptureSession",
      description: "Mark a session as failed with an error message.",
      handler: (args) => {
        const failed = this.sessionManager.failSession(readSessionId(args), readErrorMessage(args));
        this.sessionWaiter.notify(failed);
        return failed;
      }
    });
  }
}
