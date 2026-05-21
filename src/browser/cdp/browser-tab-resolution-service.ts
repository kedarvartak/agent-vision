import type { Logger } from "../../logging/logger.js";
import { BrowserLiveTabService } from "./browser-live-tab-service.js";
import { scoreLiveTab, sortCandidates, type LiveBrowserTabResolution } from "./tab-resolution.js";

export class BrowserTabResolutionService {
  constructor(
    private readonly liveTabs: BrowserLiveTabService,
    private readonly logger: Logger
  ) {}

  resolve(query?: string): LiveBrowserTabResolution {
    const live = this.liveTabs.list();
    const tabs = live.tabs;

    if (tabs.length === 0) {
      return {
        status: "not_found",
        query,
        candidates: [],
        message: "No live browser tabs are available. Refresh CDP discovery first."
      };
    }

    const candidates = tabs
      .map((tab) => scoreLiveTab(tab, query))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined)
      .sort(sortCandidates);

    if (candidates.length === 0) {
      return {
        status: "not_found",
        query,
        candidates: tabs.slice(0, 5).map((tab) => scoreLiveTab(tab)!).sort(sortCandidates),
        message: "No live browser tab matched the query."
      };
    }

    if (candidates.length > 1 && candidates[0].matchScore === candidates[1].matchScore) {
      return {
        status: "ambiguous",
        query,
        candidates: candidates.slice(0, 5),
        message: "Multiple live browser tabs matched the query. Provide a more specific title or URL."
      };
    }

    const matched = tabs.find((tab) => tab.targetId === candidates[0].targetId);
    if (!matched) {
      return {
        status: "not_found",
        query,
        candidates: candidates.slice(0, 5),
        message: "The best matching browser tab disappeared before it could be resolved."
      };
    }

    this.logger.info("Resolved live browser tab", {
      query,
      targetId: matched.targetId,
      title: matched.title,
      url: matched.url,
      matchReason: candidates[0].matchReason,
      matchScore: candidates[0].matchScore
    });

    return {
      status: "resolved",
      query,
      tab: matched,
      matchedCandidate: candidates[0],
      candidateCount: candidates.length
    };
  }
}
