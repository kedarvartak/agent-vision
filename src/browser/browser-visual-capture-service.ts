import type { Logger } from "../logging/logger.js";
import { CaptureSessionService } from "../session/capture-session-service.js";
import type { CaptureBundle, CaptureCommand } from "../types/capture.js";
import type { BrowserTabCandidate, BrowserTabResolution, BrowserTabSnapshot, SeeBrowserTabResult } from "./types.js";
import { BrowserTabRegistry } from "./browser-tab-registry.js";

const normalize = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

const toCandidate = (
  tab: BrowserTabSnapshot,
  matchScore: number,
  matchReason: string
): BrowserTabCandidate => ({
  tabId: tab.tabId,
  title: tab.title,
  url: tab.url,
  browserName: tab.browserName,
  active: tab.active,
  updatedAt: tab.updatedAt,
  matchScore,
  matchReason
});

const scoreTab = (tab: BrowserTabSnapshot, query: string): BrowserTabCandidate | undefined => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === "") {
    return tab.active ? toCandidate(tab, 100, "active-tab") : toCandidate(tab, 10, "recent-tab");
  }

  const title = normalize(tab.title);
  const url = normalize(tab.url);

  if (title === normalizedQuery) {
    return toCandidate(tab, tab.active ? 120 : 110, "exact-title");
  }

  if (url !== "" && url === normalizedQuery) {
    return toCandidate(tab, tab.active ? 118 : 108, "exact-url");
  }

  if (title.startsWith(normalizedQuery)) {
    return toCandidate(tab, tab.active ? 95 : 90, "title-prefix");
  }

  if (title.includes(normalizedQuery)) {
    return toCandidate(tab, tab.active ? 85 : 80, "title-substring");
  }

  if (url !== "" && url.includes(normalizedQuery)) {
    return toCandidate(tab, tab.active ? 75 : 70, "url-substring");
  }

  return undefined;
};

const buildBundle = (
  sessionId: string,
  command: CaptureCommand,
  tab: BrowserTabSnapshot
): CaptureBundle => ({
  sessionId,
  command,
  image: tab.image,
  selection: {
    x: 0,
    y: 0,
    width: tab.image.width,
    height: tab.image.height
  },
  annotations: [],
  context: {
    activeAppName: tab.browserName,
    activeWindowTitle: tab.title,
    capturedAt: tab.capturedAt,
    browserName: tab.browserName,
    browserTabId: tab.tabId,
    browserTabTitle: tab.title,
    browserTabUrl: tab.url
  }
});

export class BrowserVisualCaptureService {
  constructor(
    private readonly registry: BrowserTabRegistry,
    private readonly captureSessions: CaptureSessionService,
    private readonly logger: Logger
  ) {}

  listTabs(): BrowserTabSnapshot[] {
    return this.registry.list();
  }

  resolve(query?: string): BrowserTabResolution {
    const tabs = this.registry.list();
    if (tabs.length === 0) {
      return {
        status: "not_found",
        query,
        candidates: []
      };
    }

    const normalizedQuery = normalize(query);
    if (normalizedQuery === "") {
      const activeTabs = tabs.filter((tab) => tab.active);
      if (activeTabs.length === 1) {
        return {
          status: "resolved",
          tab: activeTabs[0],
          candidateCount: 1
        };
      }

      const candidates = tabs
        .map((tab) => toCandidate(tab, tab.active ? 100 : 10, tab.active ? "active-tab" : "recent-tab"))
        .slice(0, 5);

      return activeTabs.length > 1
        ? { status: "ambiguous", query, candidates }
        : { status: "not_found", query, candidates };
    }

    const matches = tabs
      .map((tab) => scoreTab(tab, normalizedQuery))
      .filter((candidate): candidate is BrowserTabCandidate => candidate !== undefined)
      .sort((left, right) => right.matchScore - left.matchScore || right.updatedAt.localeCompare(left.updatedAt));

    if (matches.length === 0) {
      return {
        status: "not_found",
        query,
        candidates: tabs
          .slice(0, 5)
          .map((tab) => toCandidate(tab, tab.active ? 10 : 1, tab.active ? "active-tab" : "recent-tab"))
      };
    }

    if (matches.length > 1 && matches[0].matchScore === matches[1].matchScore) {
      return {
        status: "ambiguous",
        query,
        candidates: matches.slice(0, 5)
      };
    }

    const matched = this.registry.get(matches[0].tabId);
    if (!matched) {
      return {
        status: "not_found",
        query,
        candidates: matches.slice(0, 5)
      };
    }

    return {
      status: "resolved",
      tab: matched,
      candidateCount: matches.length
    };
  }

  seeTab(command: CaptureCommand, query?: string): SeeBrowserTabResult {
    const resolution = this.resolve(query);
    if (resolution.status !== "resolved") {
      return {
        status: resolution.status,
        command,
        query,
        candidates: resolution.candidates,
        message:
          resolution.status === "ambiguous"
            ? "Multiple browser tabs matched the query. Provide a more specific title."
            : "No browser tab matched the query."
      };
    }

    const session = this.captureSessions.startSession({ command });
    const bundle = buildBundle(session.id, command, resolution.tab);
    const completed = this.captureSessions.completeSession({ sessionId: session.id, bundle });
    const matchedTab = toCandidate(resolution.tab, 100, resolution.candidateCount > 1 ? "best-match" : "single-match");

    this.logger.info("Completed browser tab capture", {
      sessionId: session.id,
      tabId: resolution.tab.tabId,
      title: resolution.tab.title,
      browserName: resolution.tab.browserName
    });

    return {
      status: "completed",
      sessionId: session.id,
      command,
      matchedTab,
      captureSession: completed,
      result: bundle
    };
  }
}
