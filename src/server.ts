import { BrowserCdpDiscoveryService } from "./browser/cdp/browser-cdp-discovery-service.js";
import { BrowserLiveTabService } from "./browser/cdp/browser-live-tab-service.js";
import { BrowserSeeService } from "./browser/cdp/browser-see-service.js";
import { BrowserTabContextService } from "./browser/cdp/browser-tab-context-service.js";
import { BrowserTabResolutionService } from "./browser/cdp/browser-tab-resolution-service.js";
import { BrowserTabScreenshotService } from "./browser/cdp/browser-tab-screenshot-service.js";
import { ChromeCdpClient } from "./browser/cdp/chrome-cdp-client.js";
import { LiveBrowserTabRegistry } from "./browser/cdp/live-browser-tab-registry.js";
import { AppError } from "./errors/app-error.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry, type JsonSchema, type JsonSchemaProperty, type ToolAnnotations } from "./mcp/tool-registry.js";

const STRING_SCHEMA = (description: string): JsonSchemaProperty => ({
  type: "string",
  description
});

const NUMBER_SCHEMA = (description: string): JsonSchemaProperty => ({
  type: "number",
  description
});

const OPTIONAL_QUERY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    query: STRING_SCHEMA("Optional tab title or URL fragment to match against live browser tabs.")
  },
  additionalProperties: false
};

const OPTIONAL_ENDPOINT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    endpoint: STRING_SCHEMA("Optional Chrome DevTools Protocol base URL, for example http://127.0.0.1:9222.")
  },
  additionalProperties: false
};

const OPTIONAL_PRUNE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    maxAgeMs: NUMBER_SCHEMA("Optional stale-tab age threshold in milliseconds.")
  },
  additionalProperties: false
};

const EMPTY_OBJECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true
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

const readOptionalEndpoint = (args: Record<string, unknown>): string | undefined =>
  readOptionalString(args.endpoint, "endpoint");

const readOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new AppError("INVALID_ARGUMENT", `${field} must be a non-negative number`);
  }

  return value;
};

export class VisualContextServer {
  public readonly logger = new ConsoleLogger("visual-context-server");
  private readonly cdpClient = new ChromeCdpClient(this.logger);
  private readonly cdpDiscovery = new BrowserCdpDiscoveryService(this.cdpClient, this.logger);
  private readonly liveTabs = new LiveBrowserTabRegistry(this.logger);
  private readonly browserLiveTabs = new BrowserLiveTabService(
    this.cdpDiscovery,
    this.liveTabs,
    this.logger
  );
  private readonly tabResolution = new BrowserTabResolutionService(
    this.browserLiveTabs,
    this.logger
  );
  private readonly tabScreenshots = new BrowserTabScreenshotService(
    this.tabResolution,
    this.logger
  );
  private readonly tabContext = new BrowserTabContextService(
    this.tabResolution,
    this.logger
  );
  private readonly browserSee = new BrowserSeeService(
    this.browserLiveTabs,
    this.tabScreenshots,
    this.tabContext,
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
    this.logger.info("CDP-first visual context server ready", {
      tools: this.listTools().map((tool) => tool.name)
    });
  }

  private registerTools(): void {
    this.tools.register({
      name: "getBrowserCdpStatus",
      description: "Use this when you need to verify that the MCP can reach a Chrome DevTools Protocol endpoint.",
      inputSchema: OPTIONAL_ENDPOINT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.cdpDiscovery.getConnectionStatus(readOptionalEndpoint(args))
    });

    this.tools.register({
      name: "discoverBrowserTabsViaCdp",
      description: "Use this when you need the raw list of browser tabs currently exposed by Chrome DevTools Protocol.",
      inputSchema: OPTIONAL_ENDPOINT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.cdpDiscovery.discoverTabs(readOptionalEndpoint(args))
    });

    this.tools.register({
      name: "refreshLiveBrowserTabs",
      description: "Use this when you want to refresh the normalized live browser-tab cache from Chrome DevTools Protocol.",
      inputSchema: OPTIONAL_ENDPOINT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.browserLiveTabs.refresh(readOptionalEndpoint(args))
    });

    this.tools.register({
      name: "listLiveBrowserTabs",
      description: "Use this when you want the current cached live browser-tab model without re-querying Chrome.",
      inputSchema: EMPTY_OBJECT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: () => this.browserLiveTabs.list()
    });

    this.tools.register({
      name: "pruneStaleLiveBrowserTabs",
      description: "Use this when you want to remove stale cached browser tabs that have not been refreshed recently.",
      inputSchema: OPTIONAL_PRUNE_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.browserLiveTabs.pruneStale(readOptionalNumber(args.maxAgeMs, "maxAgeMs"))
    });

    this.tools.register({
      name: "resolveLiveBrowserTab",
      description: "Use this when you want to resolve the active or best matching browser tab for a /see-style query.",
      inputSchema: OPTIONAL_QUERY_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.tabResolution.resolve(readOptionalString(args.query, "query"))
    });

    this.tools.register({
      name: "captureResolvedBrowserTabScreenshot",
      description: "Use this when you need a real PNG screenshot from the resolved live browser tab through CDP.",
      inputSchema: OPTIONAL_QUERY_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.tabScreenshots.captureResolved(readOptionalString(args.query, "query"))
    });

    this.tools.register({
      name: "getResolvedBrowserTabContext",
      description: "Use this when you need structured page metadata and visible text from the resolved live browser tab.",
      inputSchema: OPTIONAL_QUERY_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.tabContext.getResolvedContext(readOptionalString(args.query, "query"))
    });

    this.tools.register({
      name: "seeBrowserTabViaCdp",
      description: "Use this for the high-level browser-first /see flow: resolve a live tab, capture it, and return structured page context.",
      inputSchema: OPTIONAL_QUERY_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
      handler: (args) => this.browserSee.see(readOptionalString(args.query, "query"))
    });
  }
}
