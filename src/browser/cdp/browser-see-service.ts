import type { Logger } from "../../logging/logger.js";
import { BrowserTabScreenshotService } from "./browser-tab-screenshot-service.js";
import type { CaptureResolvedLiveBrowserTabScreenshotResult } from "./browser-tab-screenshot-service.js";
import type { BrowserTabScreenshot } from "./types.js";
import type { LiveBrowserTabCandidate, LiveBrowserTabResolution } from "./tab-resolution.js";

export type BrowserSeeResult =
  | {
      status: "completed";
      query?: string;
      stage: "completed";
      matchedCandidate: LiveBrowserTabCandidate;
      candidateCount: number;
      screenshot: BrowserTabScreenshot;
      message: string;
    }
  | {
      status: "ambiguous" | "not_found";
      query?: string;
      stage: "needs_disambiguation" | "not_found";
      candidates: LiveBrowserTabCandidate[];
      message: string;
    };

const toSeeResult = (
  result: CaptureResolvedLiveBrowserTabScreenshotResult
): BrowserSeeResult => {
  if (result.status === "completed") {
    return {
      status: "completed",
      query: result.query,
      stage: "completed",
      matchedCandidate: result.resolution.matchedCandidate,
      candidateCount: result.resolution.candidateCount,
      screenshot: result.screenshot,
      message: `Captured browser tab \"${result.screenshot.title}\" through CDP.`
    };
  }

  return {
    status: result.status,
    query: result.query,
    stage: result.status === "ambiguous" ? "needs_disambiguation" : "not_found",
    candidates: result.candidates,
    message: result.message
  };
};

export class BrowserSeeService {
  constructor(
    private readonly screenshots: BrowserTabScreenshotService,
    private readonly logger: Logger
  ) {}

  async see(query?: string): Promise<BrowserSeeResult> {
    const result = await this.screenshots.captureResolved(query);
    const mapped = toSeeResult(result);

    if (mapped.status === "completed") {
      this.logger.info("Completed browser-first /see flow", {
        query,
        title: mapped.screenshot.title,
        targetId: mapped.screenshot.targetId,
        width: mapped.screenshot.width,
        height: mapped.screenshot.height
      });
    } else {
      this.logger.info("Browser-first /see did not complete immediately", {
        query,
        status: mapped.status,
        candidateCount: mapped.candidates.length
      });
    }

    return mapped;
  }
}
