import { AppError } from "./errors/app-error.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry } from "./mcp/tool-registry.js";
import { SessionManager, createMockCaptureBundle } from "./session/session-manager.js";
import { SessionStore } from "./session/session-store.js";
import type { CaptureCommand } from "./types/capture.js";

const isCaptureCommand = (value: unknown): value is CaptureCommand =>
  value === "see" || value === "clip";

export class VisualContextServer {
  public readonly logger = new ConsoleLogger("visual-context-server");
  private readonly sessionStore = new SessionStore();
  private readonly sessionManager = new SessionManager(this.sessionStore, this.logger);
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
    this.logger.info("Phase 1 MCP skeleton ready", {
      tools: this.listTools().map((tool) => tool.name)
    });
  }

  private registerTools(): void {
    this.tools.register({
      name: "startCaptureSession",
      description: "Create a new in-memory capture session.",
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
      name: "getCaptureSession",
      description: "Fetch the latest state for a capture session.",
      handler: (args) => {
        const sessionId = args.sessionId;
        if (typeof sessionId !== "string") {
          throw new AppError("INVALID_ARGUMENT", "sessionId must be a string");
        }

        return this.sessionManager.getSession(sessionId);
      }
    });

    this.tools.register({
      name: "listCaptureSessions",
      description: "List all in-memory capture sessions.",
      handler: () => this.sessionManager.listSessions()
    });

    this.tools.register({
      name: "completeMockCaptureSession",
      description: "Complete a session with a mock capture bundle for Phase 1 testing.",
      handler: (args) => {
        const sessionId = args.sessionId;
        if (typeof sessionId !== "string") {
          throw new AppError("INVALID_ARGUMENT", "sessionId must be a string");
        }

        const session = this.sessionManager.getSession(sessionId);
        const bundle = createMockCaptureBundle(session.id, session.command);
        return this.sessionManager.completeSession({
          sessionId: session.id,
          bundle
        });
      }
    });

    this.tools.register({
      name: "cancelCaptureSession",
      description: "Cancel an active or created capture session.",
      handler: (args) => {
        const sessionId = args.sessionId;
        if (typeof sessionId !== "string") {
          throw new AppError("INVALID_ARGUMENT", "sessionId must be a string");
        }

        return this.sessionManager.cancelSession(sessionId);
      }
    });
  }
}
