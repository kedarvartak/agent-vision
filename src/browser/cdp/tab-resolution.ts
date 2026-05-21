import type { LiveBrowserTab } from "./tab-model.js";

export type LiveBrowserTabCandidate = {
  targetId: string;
  title: string;
  url?: string;
  browserName?: string;
  attached: boolean;
  activeHeuristic: boolean;
  recencyRank: number;
  matchScore: number;
  matchReason: string;
};

export type LiveBrowserTabResolution =
  | {
      status: "resolved";
      query?: string;
      tab: LiveBrowserTab;
      matchedCandidate: LiveBrowserTabCandidate;
      candidateCount: number;
    }
  | {
      status: "ambiguous" | "not_found";
      query?: string;
      candidates: LiveBrowserTabCandidate[];
      message: string;
    };

const normalize = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

export const toCandidate = (
  tab: LiveBrowserTab,
  matchScore: number,
  matchReason: string
): LiveBrowserTabCandidate => ({
  targetId: tab.targetId,
  title: tab.title,
  url: tab.url,
  browserName: tab.browserName,
  attached: tab.attached,
  activeHeuristic: tab.activeHeuristic,
  recencyRank: tab.recencyRank,
  matchScore,
  matchReason
});

export const scoreLiveTab = (tab: LiveBrowserTab, query?: string): LiveBrowserTabCandidate | undefined => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === "") {
    if (tab.activeHeuristic) {
      return toCandidate(tab, tab.attached ? 130 : 120, tab.attached ? "attached-tab" : "active-tab");
    }

    return toCandidate(tab, Math.max(1, 20 - tab.recencyRank), "recent-tab");
  }

  const title = normalize(tab.title);
  const url = normalize(tab.url);

  if (title === normalizedQuery) {
    return toCandidate(tab, tab.activeHeuristic ? 140 : 130, "exact-title");
  }

  if (url !== "" && url === normalizedQuery) {
    return toCandidate(tab, tab.activeHeuristic ? 138 : 128, "exact-url");
  }

  if (title.startsWith(normalizedQuery)) {
    return toCandidate(tab, tab.activeHeuristic ? 115 : 105, "title-prefix");
  }

  if (title.includes(normalizedQuery)) {
    return toCandidate(tab, tab.activeHeuristic ? 95 : 85, "title-substring");
  }

  if (url !== "" && url.includes(normalizedQuery)) {
    return toCandidate(tab, tab.activeHeuristic ? 90 : 80, "url-substring");
  }

  return undefined;
};

export const sortCandidates = (left: LiveBrowserTabCandidate, right: LiveBrowserTabCandidate): number => {
  if (left.matchScore !== right.matchScore) {
    return right.matchScore - left.matchScore;
  }

  if (left.activeHeuristic !== right.activeHeuristic) {
    return left.activeHeuristic ? -1 : 1;
  }

  return left.recencyRank - right.recencyRank;
};
