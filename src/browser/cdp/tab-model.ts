import type { CdpDiscoveredTarget, CdpTabDiscoveryResult } from "./types.js";

export type LiveBrowserTab = {
  targetId: string;
  type: string;
  title: string;
  url?: string;
  browserName?: string;
  attached: boolean;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastDiscoveryEndpoint: string;
  activeHeuristic: boolean;
  recencyRank: number;
  orderHint: number;
};

export type LiveBrowserTabDiscoveryResult = {
  endpoint: string;
  discoveredAt: string;
  browser?: string;
  browserName?: string;
  protocolVersion?: string;
  tabs: LiveBrowserTab[];
};

export type UpsertLiveBrowserTabsInput = {
  endpoint: string;
  discoveredAt: string;
  tabs: CdpDiscoveredTarget[];
};

export const toActiveHeuristic = (target: CdpDiscoveredTarget, index: number): boolean =>
  target.attached || index === 0;

export const toOrderHint = (target: CdpDiscoveredTarget, index: number): number => {
  if (target.attached) {
    return index;
  }

  return index + 100;
};

export const toDiscoveryResult = (
  source: CdpTabDiscoveryResult,
  tabs: LiveBrowserTab[]
): LiveBrowserTabDiscoveryResult => ({
  endpoint: source.endpoint,
  discoveredAt: source.discoveredAt,
  browser: source.browser,
  browserName: source.browserName,
  protocolVersion: source.protocolVersion,
  tabs
});
