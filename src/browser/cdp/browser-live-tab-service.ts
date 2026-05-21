import type { Logger } from "../../logging/logger.js";
import { BrowserCdpDiscoveryService } from "./browser-cdp-discovery-service.js";
import { LiveBrowserTabRegistry } from "./live-browser-tab-registry.js";
import { toDiscoveryResult, type LiveBrowserTabDiscoveryResult, type LiveBrowserTab } from "./tab-model.js";

export class BrowserLiveTabService {
  constructor(
    private readonly discovery: BrowserCdpDiscoveryService,
    private readonly registry: LiveBrowserTabRegistry,
    private readonly logger: Logger
  ) {}

  async refresh(endpointOverride?: string): Promise<LiveBrowserTabDiscoveryResult> {
    const discoveryResult = await this.discovery.discoverTabs(endpointOverride);
    const tabs = this.registry.upsertDiscovery({
      endpoint: discoveryResult.endpoint,
      discoveredAt: discoveryResult.discoveredAt,
      tabs: discoveryResult.tabs
    });

    this.logger.info("Refreshed live browser tab model", {
      endpoint: discoveryResult.endpoint,
      tabCount: tabs.length,
      browser: discoveryResult.browser
    });

    return toDiscoveryResult(discoveryResult, tabs);
  }

  pruneStale(maxAgeMs?: number): { removed: LiveBrowserTab[]; remaining: LiveBrowserTabDiscoveryResult } {
    const removed = this.registry.pruneStale(maxAgeMs);
    return {
      removed,
      remaining: this.list()
    };
  }

  list(): LiveBrowserTabDiscoveryResult {
    const tabs = this.registry.list();
    const discoveredAt = tabs[0]?.lastSeenAt ?? new Date().toISOString();
    const endpoint = tabs[0]?.lastDiscoveryEndpoint ?? "unknown";

    return {
      endpoint,
      discoveredAt,
      tabs
    };
  }
}
