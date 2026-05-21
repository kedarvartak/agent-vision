import type { Logger } from "../../logging/logger.js";
import { BrowserTabResolutionService } from "./browser-tab-resolution-service.js";
import { withCdpTabSession } from "./cdp-websocket-session.js";
import { readPngDimensions } from "./png-metadata.js";
import type { LiveBrowserTabResolution } from "./tab-resolution.js";
import type { BrowserTabScreenshot } from "./types.js";

export type CaptureResolvedLiveBrowserTabScreenshotResult =
  | {
      status: "completed";
      query?: string;
      resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>;
      screenshot: BrowserTabScreenshot;
    }
  | Extract<LiveBrowserTabResolution, { status: "ambiguous" | "not_found" }>;

const nowIso = (): string => new Date().toISOString();

const captureTabScreenshot = async (
  resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>
): Promise<BrowserTabScreenshot> =>
  await withCdpTabSession(resolution.tab, async (session) => {
    await session.sendCommand("Page.enable");
    const captureResult = await session.sendCommand("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true
    });

    const data = captureResult.data;
    if (typeof data !== "string" || data.trim() === "") {
      throw new Error("CDP screenshot response did not include PNG data");
    }

    const buffer = Buffer.from(data, "base64");
    const dimensions = readPngDimensions(buffer);

    return {
      targetId: resolution.tab.targetId,
      title: resolution.tab.title,
      url: resolution.tab.url,
      browserName: resolution.tab.browserName,
      mimeType: "image/png",
      bytesBase64: data,
      width: dimensions.width,
      height: dimensions.height,
      byteLength: buffer.byteLength,
      capturedAt: nowIso(),
      backend: "cdp-page-capture"
    };
  });

export class BrowserTabScreenshotService {
  constructor(
    private readonly resolver: BrowserTabResolutionService,
    private readonly logger: Logger
  ) {}

  async captureResolved(query?: string): Promise<CaptureResolvedLiveBrowserTabScreenshotResult> {
    const resolution = this.resolver.resolve(query);
    if (resolution.status !== "resolved") {
      return resolution;
    }

    const screenshot = await captureTabScreenshot(resolution);
    this.logger.info("Captured browser tab screenshot via CDP", {
      query,
      targetId: resolution.tab.targetId,
      title: resolution.tab.title,
      width: screenshot.width,
      height: screenshot.height,
      byteLength: screenshot.byteLength
    });

    return {
      status: "completed",
      query,
      resolution,
      screenshot
    };
  }
}
