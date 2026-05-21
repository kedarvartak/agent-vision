import { BrowserCdpDiscoveryService } from "./browser/cdp/browser-cdp-discovery-service.js";
import { ChromeCdpClient } from "./browser/cdp/chrome-cdp-client.js";
import { AppError } from "./errors/app-error.js";
import { ConsoleLogger } from "./logging/logger.js";
import { ToolRegistry } from "./mcp/tool-registry.js";

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

export class VisualContextServer {
  public readonly logger = new ConsoleLogger("visual-context-server");
  private readonly cdpClient = new ChromeCdpClient(this.logger);
  private readonly cdpDiscovery = new BrowserCdpDiscoveryService(this.cdpClient, this.logger);
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
      description: "Check whether the MCP can connect to a Chrome DevTools Protocol endpoint.",
      handler: (args) => this.cdpDiscovery.getConnectionStatus(readOptionalEndpoint(args))
    });

    this.tools.register({
      name: "discoverBrowserTabsViaCdp",
      description: "List live browser tabs from a Chrome DevTools Protocol endpoint.",
      handler: (args) => this.cdpDiscovery.discoverTabs(readOptionalEndpoint(args))
    });
  }
}
