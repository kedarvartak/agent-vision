import { InMemoryCapturePipeline } from "./capture/in-memory-capture-pipeline.js";
import { InMemoryImageCompositor } from "./capture/in-memory-image-compositor.js";
import { MockScreenCaptureProvider } from "./capture/mock-screen-capture-provider.js";
import { AppError } from "./errors/app-error.js";
import { VisualCaptureFlow } from "./flow/visual-capture-flow.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry } from "./mcp/tool-registry.js";
import { LocalOverlayAgent } from "./overlay/local-overlay-agent.js";
import type { OverlayTool } from "./overlay/types.js";
import { CaptureSessionService } from "./session/capture-session-service.js";
import { SessionManager, createMockCaptureBundle } from "./session/session-manager.js";
import { SessionStore } from "./session/session-store.js";
import { SessionWaiter } from "./session/session-waiter.js";
import type { Annotation } from "./types/annotation.js";
import type { CaptureBundle, CaptureCommand, SelectionBounds } from "./types/capture.js";

const isCaptureCommand = (value: unknown): value is CaptureCommand =>
  value === "see" || value === "clip";

const isOverlayTool = (value: unknown): value is OverlayTool =>
  value === "select" || value === "rect" || value === "arrow" || value === "text" || value === "redact";

const readSessionId = (args: Record<string, unknown>): string => {
  const sessionId = args.sessionId;
  if (typeof sessionId !== "string") {
    throw new AppError("INVALID_ARGUMENT", "sessionId must be a string");
  }

  return sessionId;
};

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

const readRequiredNumber = (value: unknown, field: string): number => {
  const parsed = readOptionalNumber(value, field);
  if (parsed === undefined) {
    throw new AppError("INVALID_ARGUMENT", `${field} is required`);
  }

  return parsed;
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

const readSelectionBounds = (args: Record<string, unknown>): SelectionBounds => ({
  x: readRequiredNumber(args.x, "x"),
  y: readRequiredNumber(args.y, "y"),
  width: readRequiredNumber(args.width, "width"),
  height: readRequiredNumber(args.height, "height")
});

const readOverlayTool = (args: Record<string, unknown>): OverlayTool => {
  const tool = args.tool;
  if (!isOverlayTool(tool)) {
    throw new AppError("INVALID_ARGUMENT", "tool must be one of select, rect, arrow, text, redact");
  }

  return tool;
};

const readAnnotation = (args: Record<string, unknown>): Annotation => {
  const annotation = args.annotation;
  if (!annotation || typeof annotation !== "object") {
    throw new AppError("INVALID_ARGUMENT", "annotation must be an object");
  }

  return annotation as Annotation;
};

const readAnnotationId = (args: Record<string, unknown>): string => {
  const annotationId = args.annotationId;
  if (typeof annotationId !== "string" || annotationId.trim() === "") {
    throw new AppError("INVALID_ARGUMENT", "annotationId must be a non-empty string");
  }

  return annotationId;
};

const readOptionalAnnotationId = (args: Record<string, unknown>): string | undefined => {
  const annotationId = args.annotationId;
  if (annotationId === undefined) {
    return undefined;
  }

  if (typeof annotationId !== "string" || annotationId.trim() === "") {
    throw new AppError("INVALID_ARGUMENT", "annotationId must be a non-empty string");
  }

  return annotationId;
};

const readCleanupAgeMs = (args: Record<string, unknown>): number => {
  const maxAgeMs = readRequiredNumber(args.maxAgeMs, "maxAgeMs");
  if (maxAgeMs < 0) {
    throw new AppError("INVALID_ARGUMENT", "maxAgeMs must be greater than or equal to zero");
  }

  return maxAgeMs;
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
  private readonly capturePipeline = new InMemoryCapturePipeline(
    new MockScreenCaptureProvider(),
    new InMemoryImageCompositor(),
    this.logger
  );
  private readonly overlayAgent = new LocalOverlayAgent(
    this.captureSessions,
    this.capturePipeline,
    this.logger
  );
  private readonly visualFlow = new VisualCaptureFlow(this.captureSessions, this.overlayAgent);
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
    this.logger.info("Phase 7 hardening ready", {
      tools: this.listTools().map((tool) => tool.name)
    });
  }

  private registerTools(): void {
    this.tools.register({
      name: "beginVisualCapture",
      description: "High-level entrypoint for /see or /clip that starts the capture and overlay flow.",
      handler: (args) => this.visualFlow.begin(readCaptureCommand(args), readOptionalNumber(args.ttlMs, "ttlMs"))
    });

    this.tools.register({
      name: "getVisualCaptureStatus",
      description: "High-level combined status view for the capture and overlay flow.",
      handler: (args) => this.visualFlow.getStatus(readSessionId(args))
    });

    this.tools.register({
      name: "awaitVisualCaptureResult",
      description: "High-level wait for a final visual capture result with client-friendly guidance.",
      handler: (args) => this.visualFlow.awaitResult(readSessionId(args), readOptionalNumber(args.timeoutMs, "timeoutMs"))
    });

    this.tools.register({
      name: "cleanupTerminalSessions",
      description: "Reap terminal capture and overlay sessions older than the provided age.",
      handler: (args) => {
        const maxAgeMs = readCleanupAgeMs(args);
        return {
          capture: this.captureSessions.reapTerminalSessions(maxAgeMs),
          overlay: this.overlayAgent.reapTerminalSessions(maxAgeMs)
        };
      }
    });

    this.tools.register({
      name: "startCaptureSession",
      description: "Create a new in-memory capture session and mark it active.",
      handler: (args) => this.captureSessions.startSession({ command: readCaptureCommand(args), ttlMs: readOptionalNumber(args.ttlMs, "ttlMs") })
    });

    this.tools.register({
      name: "awaitCaptureSession",
      description: "Wait for a session to complete, cancel, fail, expire, or time out.",
      handler: (args) => this.captureSessions.awaitSession({ sessionId: readSessionId(args), timeoutMs: readOptionalNumber(args.timeoutMs, "timeoutMs") })
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
      name: "completeCaptureSession",
      description: "Complete a session with a provided capture bundle.",
      handler: (args) => this.captureSessions.completeSession({ sessionId: readSessionId(args), bundle: readCaptureBundle(args) })
    });

    this.tools.register({
      name: "completeMockCaptureSession",
      description: "Complete a session with a mock capture bundle for testing.",
      handler: (args) => {
        const session = this.captureSessions.getSession(readSessionId(args));
        return this.captureSessions.completeSession({ sessionId: session.id, bundle: createMockCaptureBundle(session.id, session.command) });
      }
    });

    this.tools.register({
      name: "cancelCaptureSession",
      description: "Cancel an active or created capture session.",
      handler: (args) => this.captureSessions.cancelSession(readSessionId(args))
    });

    this.tools.register({
      name: "failCaptureSession",
      description: "Mark a session as failed with an error message.",
      handler: (args) => this.captureSessions.failSession(readSessionId(args), readErrorMessage(args))
    });

    this.tools.register({
      name: "launchOverlayCaptureSession",
      description: "Launch the local overlay-agent prototype for a capture session.",
      handler: (args) => this.overlayAgent.launch(readSessionId(args))
    });

    this.tools.register({
      name: "getOverlayCaptureSession",
      description: "Fetch the latest overlay-agent session state.",
      handler: (args) => this.overlayAgent.get(readSessionId(args))
    });

    this.tools.register({
      name: "listOverlayCaptureSessions",
      description: "List all overlay-agent prototype sessions.",
      handler: () => this.overlayAgent.list()
    });

    this.tools.register({
      name: "setOverlayActiveTool",
      description: "Set the current overlay annotation tool.",
      handler: (args) => this.overlayAgent.setActiveTool(readSessionId(args), readOverlayTool(args))
    });

    this.tools.register({
      name: "selectOverlayRegion",
      description: "Set the selected region for the overlay-agent prototype.",
      handler: (args) => {
        const bounds = readSelectionBounds(args);
        return this.overlayAgent.selectRegion(readSessionId(args), {
          ...bounds,
          displayId: typeof args.displayId === "string" ? args.displayId : undefined,
          activeAppName: typeof args.activeAppName === "string" ? args.activeAppName : undefined,
          activeWindowTitle: typeof args.activeWindowTitle === "string" ? args.activeWindowTitle : undefined
        });
      }
    });

    this.tools.register({
      name: "moveOverlaySelection",
      description: "Move the current overlay selection by delta values.",
      handler: (args) => this.overlayAgent.moveSelection(readSessionId(args), { dx: readRequiredNumber(args.dx, "dx"), dy: readRequiredNumber(args.dy, "dy") })
    });

    this.tools.register({
      name: "resizeOverlaySelection",
      description: "Resize or reposition the current overlay selection.",
      handler: (args) => this.overlayAgent.resizeSelection(readSessionId(args), {
        x: readOptionalNumber(args.x, "x"),
        y: readOptionalNumber(args.y, "y"),
        width: readOptionalNumber(args.width, "width"),
        height: readOptionalNumber(args.height, "height")
      })
    });

    this.tools.register({
      name: "addOverlayAnnotation",
      description: "Add a rectangle, arrow, text, or redact annotation to the overlay session.",
      handler: (args) => this.overlayAgent.addAnnotation(readSessionId(args), { id: readOptionalAnnotationId(args), annotation: readAnnotation(args) })
    });

    this.tools.register({
      name: "updateOverlayAnnotation",
      description: "Update an existing overlay annotation.",
      handler: (args) => this.overlayAgent.updateAnnotation(readSessionId(args), { annotationId: readAnnotationId(args), annotation: readAnnotation(args) })
    });

    this.tools.register({
      name: "removeOverlayAnnotation",
      description: "Remove an existing overlay annotation.",
      handler: (args) => this.overlayAgent.removeAnnotation(readSessionId(args), readAnnotationId(args))
    });

    this.tools.register({
      name: "clearOverlayAnnotations",
      description: "Clear all overlay annotations for the current session.",
      handler: (args) => this.overlayAgent.clearAnnotations(readSessionId(args))
    });

    this.tools.register({
      name: "sendOverlayCaptureSession",
      description: "Send the current overlay selection back through the capture session flow.",
      handler: async (args) => this.overlayAgent.send(readSessionId(args))
    });

    this.tools.register({
      name: "cancelOverlayCaptureSession",
      description: "Cancel the overlay session and the backing capture session.",
      handler: (args) => this.overlayAgent.cancel(readSessionId(args))
    });

    this.tools.register({
      name: "failOverlayCaptureSession",
      description: "Fail the overlay session and the backing capture session.",
      handler: (args) => this.overlayAgent.fail(readSessionId(args), readErrorMessage(args))
    });
  }
}
