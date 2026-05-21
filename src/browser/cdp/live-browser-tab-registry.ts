import type { Logger } from "../../logging/logger.js";
import type { CdpDiscoveredTarget } from "./types.js";
import {
  type LiveBrowserTab,
  type UpsertLiveBrowserTabsInput,
  toActiveHeuristic,
  toOrderHint
} from "./tab-model.js";

const DEFAULT_STALE_TAB_MAX_AGE_MS = 5 * 60 * 1000;

const toMs = (value: string): number => Date.parse(value);

export class LiveBrowserTabRegistry {
  private readonly tabs = new Map<string, LiveBrowserTab>();

  constructor(private readonly logger: Logger) {}

  upsertDiscovery(input: UpsertLiveBrowserTabsInput): LiveBrowserTab[] {
    const seenIds = new Set<string>();

    for (const [index, target] of input.tabs.entries()) {
      seenIds.add(target.id);
      this.tabs.set(target.id, this.toLiveTab(target, index, input));
    }

    const removedTargetIds: string[] = [];
    for (const existing of this.tabs.values()) {
      if (existing.lastDiscoveryEndpoint !== input.endpoint) {
        continue;
      }

      if (seenIds.has(existing.targetId)) {
        continue;
      }

      this.tabs.delete(existing.targetId);
      removedTargetIds.push(existing.targetId);
    }

    const ordered = this.list().map((tab, index) => ({
      ...tab,
      recencyRank: index + 1
    }));

    for (const tab of ordered) {
      this.tabs.set(tab.targetId, tab);
    }

    this.logger.debug("Updated live browser tab registry", {
      endpoint: input.endpoint,
      discoveredAt: input.discoveredAt,
      tabCount: ordered.length,
      seenIds: [...seenIds],
      removedTargetIds
    });

    return ordered;
  }

  pruneStale(maxAgeMs = DEFAULT_STALE_TAB_MAX_AGE_MS, now = new Date()): LiveBrowserTab[] {
    const cutoffMs = now.getTime() - maxAgeMs;
    const removed: LiveBrowserTab[] = [];

    for (const tab of this.tabs.values()) {
      const lastSeenMs = toMs(tab.lastSeenAt);
      if (!Number.isFinite(lastSeenMs) || lastSeenMs >= cutoffMs) {
        continue;
      }

      this.tabs.delete(tab.targetId);
      removed.push(tab);
    }

    if (removed.length > 0) {
      this.logger.info("Pruned stale live browser tabs", {
        maxAgeMs,
        removedTargetIds: removed.map((tab) => tab.targetId),
        removedCount: removed.length
      });
    }

    return removed;
  }

  list(): LiveBrowserTab[] {
    return [...this.tabs.values()].sort((left, right) => {
      if (left.activeHeuristic !== right.activeHeuristic) {
        return left.activeHeuristic ? -1 : 1;
      }

      if (left.orderHint !== right.orderHint) {
        return left.orderHint - right.orderHint;
      }

      return right.lastSeenAt.localeCompare(left.lastSeenAt);
    });
  }

  get(targetId: string): LiveBrowserTab | undefined {
    return this.tabs.get(targetId);
  }

  private toLiveTab(
    target: CdpDiscoveredTarget,
    index: number,
    input: UpsertLiveBrowserTabsInput
  ): LiveBrowserTab {
    const existing = this.tabs.get(target.id);

    return {
      targetId: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
      browserName: target.browserName,
      attached: target.attached,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl,
      devtoolsFrontendUrl: target.devtoolsFrontendUrl,
      firstSeenAt: existing?.firstSeenAt ?? input.discoveredAt,
      lastSeenAt: input.discoveredAt,
      lastDiscoveryEndpoint: input.endpoint,
      activeHeuristic: toActiveHeuristic(target, index),
      recencyRank: existing?.recencyRank ?? index + 1,
      orderHint: toOrderHint(target, index)
    };
  }
}
