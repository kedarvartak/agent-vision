import type { Logger } from "../../logging/logger.js";
import { BrowserTabContextService } from "./browser-tab-context-service.js";
import { BrowserTabScreenshotService } from "./browser-tab-screenshot-service.js";
import type { BrowserTabScreenshot, BrowserTabStructuredContext } from "./types.js";
import type { LiveBrowserTabCandidate } from "./tab-resolution.js";

export type BrowserSeeResult =
  | {
      status: "completed";
      query?: string;
      stage: "completed";
      matchedCandidate: LiveBrowserTabCandidate;
      candidateCount: number;
      screenshot: BrowserTabScreenshot;
      context: BrowserTabStructuredContext;
      message: string;
    }
  | {
      status: "ambiguous" | "not_found";
      query?: string;
      stage: "needs_disambiguation" | "not_found";
      candidates: LiveBrowserTabCandidate[];
      message: string;
    };

export class BrowserSeeService {
  constructor(
    private readonly screenshots: BrowserTabScreenshotService,
    private readonly contexts: BrowserTabContextService,
    private readonly logger: Logger
  ) {}

  async see(query?: string): Promise<BrowserSeeResult> {
    const screenshotResult = await this.screenshots.captureResolved(query);
    if (screenshotResult.status !== "completed") {
      this.logger.info("Browser-first /see did not complete immediately", {
        query,
        status: screenshotResult.status,
        candidateCount: screenshotResult.candidates.length
      });

      return {
        status: screenshotResult.status,
        query: screenshotResult.query,
        stage: screenshotResult.status === "ambiguous" ? "needs_disambiguation" : "not_found",
        candidates: screenshotResult.candidates,
        message: screenshotResult.message
      };
    }

    const contextResult = await this.contexts.getResolvedContext(query);
    if (contextResult.status !== "completed") {
      throw new Error("Structured browser context could not be collected after screenshot capture completed");
    }

    const mapped: BrowserSeeResult = {
      status: "completed",
      query: screenshotResult.query,
      stage: "completed",
      matchedCandidate: screenshotResult.resolution.matchedCandidate,
      candidateCount: screenshotResult.resolution.candidateCount,
      screenshot: screenshotResult.screenshot,
      context: contextResult.context,
      message: `Captured browser tab \"${screenshotResult.screenshot.title}\" through CDP with structured page context.`
    };

    this.logger.info("Completed browser-first /see flow", {
      query,
      title: mapped.screenshot.title,
      targetId: mapped.screenshot.targetId,
      width: mapped.screenshot.width,
      height: mapped.screenshot.height,
      visibleTextLength: mapped.context.visibleTextLength
    });

    return mapped;
  }
}
