import { BrowserTabRegistry } from "./browser/browser-tab-registry.js";
import { BrowserVisualCaptureService } from "./browser/browser-visual-capture-service.js";
import type { UpsertBrowserTabSnapshotInput } from "./browser/types.js";
import { AppError } from "./errors/app-error.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry } from "./mcp/tool-registry.js";
import { CaptureSessionService } from "./session/capture-session-service.js";
import { SessionManager } from "./session/session-manager.js";
import { SessionStore } from "./session/session-store.js";
import { SessionWaiter } from "./session/session-waiter.js";
import type { CaptureBundle, CaptureCommand } from "./types/capture.js";

const isCaptureCommand = (value: unknown): value is CaptureCommand =>
  value === "see" || value === "clip";

const readRequiredStringField = (args: Record<string, unknown>, field: string): string => {
  const value = args[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("INVALID_ARGUMENT", `${field} must be a non-empty string`);
  }

  return value;
};

const readOptionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("INVALID_ARGUMENT", `${field} must be a string`);
  }

  return value;
};

const readSessionId = (args: Record<string, unknown>): string => readRequiredStringField(args, "sessionId");

const readCaptureCommand = (args: Record<string, unknown>): CaptureCommand => {
  const command = args.command;
  if (!isCaptureCommand(command)) {
    throw new AppError("INVALID_ARGUMENT", "command must be 'see' or 'clip'");
  }

  return command;
};

const readOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError("INVALID_ARGUMENT", `${field} must be a number`);
  }

  return value;
};

const readCaptureBundle = (args: Record<string, unknown>): CaptureBundle => {
  const bundle = args.bundle;
  if (!bundle || typeof bundle !== "object") {
    throw new AppError("INVALID_ARGUMENT", "bundle must be an object");
  }

  return bundle as CaptureBundle;
};

const readErrorMessage = (args: Record<string, unknown>): string => readRequiredStringField(args, "errorMessage");

const readCleanupAgeMs = (args: Record<string, unknown>): number => {
  const maxAgeMs = readOptionalNumber(args.maxAgeMs, "maxAgeMs");
  if (maxAgeMs === undefined) {
    throw new AppError("INVALID_ARGUMENT", "maxAgeMs is required");
  }

  if (maxAgeMs < 0) {
    throw new AppError("INVALID_ARGUMENT", "maxAgeMs must be greater than or equal to zero");
  }

  return maxAgeMs;
};

const readBrowserTabSnapshotInput = (args: Record<string, unknown>): UpsertBrowserTabSnapshotInput => {
  const image = args.image;
  if (!image || typeof image !== "object") {
    throw new AppError("INVALID_ARGUMENT", "image must be an object");
  }

  const typedImage = image as Record<string, unknown>;
  const bytesBase64 = typedImage.bytesBase64;
  const width = typedImage.width;
  const height = typedImage.height;
  const mimeType = typedImage.mimeType;

  if (typeof bytesBase64 !== "string" || bytesBase64.trim() === "") {
    throw new AppError("INVALID_ARGUMENT", "image.bytesBase64 must be a non-empty string");
  }

  if (typeof width !== "number" || Number.isNaN(width)) {
    throw new AppError("INVALID_ARGUMENT", "image.width must be a number");
  }

  if (typeof height !== "number" || Number.isNaN(height)) {
    throw new AppError("INVALID_ARGUMENT", "image.height must be a number");
  }

  if (mimeType !== undefined && mimeType !== "image/png") {
    throw new AppError("INVALID_ARGUMENT", "image.mimeType must be image/png when provided");
  }

  return {
    tabId: readRequiredStringField(args, "tabId"),
    title: readRequiredStringField(args, "title"),
    url: readOptionalString(args.url, "url"),
    browserName: readOptionalString(args.browserName, "browserName"),
    active: typeof args.active === "boolean" ? args.active : undefined,
    capturedAt: readOptionalString(args.capturedAt, "capturedAt"),
    image: {
      mimeType: mimeType as "image/png" | undefined,
      bytesBase64,
      width,
      height
    }
  };
};

export class VisualContextServer {
  public readonly logger = new ConsoleLogger("visual-context-server");
  private readonly sessionStore = new SessionStore();
  private readonly sessionManager = new SessionManager(this.sessionStore, this.logger);
  private readonly sessionWaiter = new SessionWaiter(this.sessionManager, this.logger);
  private readonly captureSessions = new CaptureSessionService(
    this.sessionManager,
    this.sessionWaiter,
    this.logger
  );
  private readonly browserTabs = new BrowserTabRegistry();
  private readonly browserCapture = new BrowserVisualCaptureService(
    this.browserTabs,
    this.captureSessions,
    this.logger
  );
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
    this.logger.info("Browser-first visual context server ready", {
      tools: this.listTools().map((tool) => tool.name)
    });
  }

  private registerTools(): void {
    this.tools.register({
      name: "registerBrowserTabSnapshot",
      description: "Register or update the latest screenshot snapshot for a browser tab.",
      handler: (args) => this.browserTabs.upsert(readBrowserTabSnapshotInput(args))
    });

    this.tools.register({
      name: "removeBrowserTabSnapshot",
      description: "Remove a browser tab snapshot from the in-memory registry.",
      handler: (args) => ({ removed: this.browserTabs.remove(readRequiredStringField(args, "tabId")) })
    });

    this.tools.register({
      name: "listBrowserTabs",
      description: "List the in-memory browser tab snapshots currently available for /see targeting.",
      handler: () => this.browserCapture.listTabs()
    });

    this.tools.register({
      name: "seeBrowserTab",
      description: "Resolve a browser tab title and immediately complete a /see capture.",
      handler: (args) =>
        this.browserCapture.seeTab(
          args.command === undefined ? "see" : readCaptureCommand(args),
          readOptionalString(args.query, "query")
        )
    });

    this.tools.register({
      name: "getCaptureSession",
      description: "Fetch the latest state for a capture session.",
      handler: (args) => this.captureSessions.getSession(readSessionId(args))
    });

    this.tools.register({
      name: "listCaptureSessions",
      description: "List all in-memory capture sessions.",
      handler: () => this.captureSessions.listSessions()
    });

    this.tools.register({
      name: "awaitCaptureSession",
      description: "Wait for a session to complete, cancel, fail, expire, or time out.",
      handler: (args) =>
        this.captureSessions.awaitSession({
          sessionId: readSessionId(args),
          timeoutMs: readOptionalNumber(args.timeoutMs, "timeoutMs")
        })
    });

    this.tools.register({
      name: "completeCaptureSession",
      description: "Complete a session with a provided capture bundle.",
      handler: (args) =>
        this.captureSessions.completeSession({
          sessionId: readSessionId(args),
          bundle: readCaptureBundle(args)
        })
    });

    this.tools.register({
      name: "cancelCaptureSession",
      description: "Cancel an active capture session.",
      handler: (args) => this.captureSessions.cancelSession(readSessionId(args))
    });

    this.tools.register({
      name: "failCaptureSession",
      description: "Fail an active capture session with an error message.",
      handler: (args) => this.captureSessions.failSession(readSessionId(args), readErrorMessage(args))
    });

    this.tools.register({
      name: "cleanupTerminalSessions",
      description: "Reap terminal capture sessions older than the provided age.",
      handler: (args) => this.captureSessions.reapTerminalSessions(readCleanupAgeMs(args))
    });
  }
}
