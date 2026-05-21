import type { Logger } from "../../logging/logger.js";
import { BrowserLiveTabService } from "./browser-live-tab-service.js";
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
      recoveredAfterRefresh?: boolean;
    }
  | {
      status: "ambiguous" | "not_found";
      query?: string;
      stage: "needs_disambiguation" | "not_found";
      candidates: LiveBrowserTabCandidate[];
      message: string;
      recoveredAfterRefresh?: boolean;
    };

export class BrowserSeeService {
  constructor(
    private readonly liveTabs: BrowserLiveTabService,
    private readonly screenshots: BrowserTabScreenshotService,
    private readonly contexts: BrowserTabContextService,
    private readonly logger: Logger
  ) {}

  async see(query?: string): Promise<BrowserSeeResult> {
    try {
      const firstAttempt = await this.seeOnce(query, false);
      if (firstAttempt.status !== "not_found") {
        return firstAttempt;
      }

      this.logger.warn("Browser-first /see returned not_found, retrying after refresh", {
        query,
        candidateCount: firstAttempt.candidates.length
      });
      await this.liveTabs.refresh();
      return await this.seeOnce(query, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("Browser-first /see failed before completion, retrying after refresh", {
        query,
        errorMessage: message
      });
      await this.liveTabs.refresh();
      return await this.seeOnce(query, true);
    }
  }

  private async seeOnce(query: string | undefined, recoveredAfterRefresh: boolean): Promise<BrowserSeeResult> {
    const screenshotResult = await this.screenshots.captureResolved(query);
    if (screenshotResult.status !== "completed") {
      this.logger.info("Browser-first /see did not complete immediately", {
        query,
        status: screenshotResult.status,
        candidateCount: screenshotResult.candidates.length,
        recoveredAfterRefresh
      });

      return {
        status: screenshotResult.status,
        query: screenshotResult.query,
        stage: screenshotResult.status === "ambiguous" ? "needs_disambiguation" : "not_found",
        candidates: screenshotResult.candidates,
        message: screenshotResult.message,
        ...(recoveredAfterRefresh ? { recoveredAfterRefresh: true } : {})
      };
    }

    const context = await this.contexts.getForResolvedTab(screenshotResult.resolution, query);
    const mapped: BrowserSeeResult = {
      status: "completed",
      query: screenshotResult.query,
      stage: "completed",
      matchedCandidate: screenshotResult.resolution.matchedCandidate,
      candidateCount: screenshotResult.resolution.candidateCount,
      screenshot: screenshotResult.screenshot,
      context,
      message: `Captured browser tab \"${screenshotResult.screenshot.title}\" through CDP with structured page context.`,
      ...(recoveredAfterRefresh ? { recoveredAfterRefresh: true } : {})
    };

    this.logger.info("Completed browser-first /see flow", {
      query,
      title: mapped.screenshot.title,
      targetId: mapped.screenshot.targetId,
      width: mapped.screenshot.width,
      height: mapped.screenshot.height,
      visibleTextLength: mapped.context.visibleTextLength,
      recoveredAfterRefresh
    });

    return mapped;
  }
}
