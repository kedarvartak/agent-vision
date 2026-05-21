import type { Logger } from "../../logging/logger.js";
import { BrowserTabResolutionService } from "./browser-tab-resolution-service.js";
import { withCdpTabSession } from "./cdp-websocket-session.js";
import type { LiveBrowserTabResolution } from "./tab-resolution.js";
import type { BrowserTabStructuredContext } from "./types.js";

export type GetResolvedBrowserTabContextResult =
  | {
      status: "completed";
      query?: string;
      resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>;
      context: BrowserTabStructuredContext;
    }
  | Extract<LiveBrowserTabResolution, { status: "ambiguous" | "not_found" }>;

const nowIso = (): string => new Date().toISOString();

const CONTEXT_EVALUATION_EXPRESSION = `(() => {
  const bodyText = document.body?.innerText ?? "";
  return {
    pageTitle: document.title ?? "",
    pageUrl: window.location.href ?? "",
    documentLanguage: document.documentElement?.lang ?? "",
    contentType: document.contentType ?? "",
    visibleText: bodyText,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  };
})()`;

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const asVisibleText = (value: unknown): string => (typeof value === "string" ? value : "");

const asViewport = (
  value: unknown
): BrowserTabStructuredContext["viewport"] | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  return {
    width: typeof candidate.width === "number" ? candidate.width : undefined,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
    devicePixelRatio:
      typeof candidate.devicePixelRatio === "number" ? candidate.devicePixelRatio : undefined
  };
};

const collectTabContext = async (
  resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>
): Promise<BrowserTabStructuredContext> =>
  await withCdpTabSession(resolution.tab, async (session) => {
    await session.sendCommand("Page.enable");
    await session.sendCommand("Runtime.enable");

    const evaluation = await session.sendCommand("Runtime.evaluate", {
      expression: CONTEXT_EVALUATION_EXPRESSION,
      returnByValue: true
    });

    const result = evaluation.result;
    const value =
      result && typeof result === "object" && "value" in result
        ? (result as { value?: unknown }).value
        : undefined;
    const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const visibleText = asVisibleText(payload.visibleText);

    return {
      targetId: resolution.tab.targetId,
      title: resolution.tab.title,
      url: resolution.tab.url,
      browserName: resolution.tab.browserName,
      pageTitle: asOptionalString(payload.pageTitle),
      pageUrl: asOptionalString(payload.pageUrl),
      documentLanguage: asOptionalString(payload.documentLanguage),
      contentType: asOptionalString(payload.contentType),
      visibleText,
      visibleTextLength: visibleText.length,
      viewport: asViewport(payload.viewport),
      collectedAt: nowIso(),
      backend: "cdp-runtime-evaluate"
    };
  });

export class BrowserTabContextService {
  constructor(
    private readonly resolver: BrowserTabResolutionService,
    private readonly logger: Logger
  ) {}

  async getForResolvedTab(
    resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>,
    query?: string
  ): Promise<BrowserTabStructuredContext> {
    const context = await collectTabContext(resolution);
    this.logger.info("Collected structured browser tab context via CDP", {
      query,
      targetId: resolution.tab.targetId,
      title: resolution.tab.title,
      visibleTextLength: context.visibleTextLength
    });
    return context;
  }

  async getResolvedContext(query?: string): Promise<GetResolvedBrowserTabContextResult> {
    const resolution = this.resolver.resolve(query);
    if (resolution.status !== "resolved") {
      return resolution;
    }

    const context = await this.getForResolvedTab(resolution, query);
    return {
      status: "completed",
      query,
      resolution,
      context
    };
  }
}
