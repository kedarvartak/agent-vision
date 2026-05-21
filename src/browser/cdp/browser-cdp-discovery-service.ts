import type { Logger } from "../../logging/logger.js";
import { ChromeCdpClient } from "./chrome-cdp-client.js";
import type { CdpConnectionStatus, CdpTabDiscoveryResult } from "./types.js";

export class BrowserCdpDiscoveryService {
  constructor(
    private readonly client: ChromeCdpClient,
    private readonly logger: Logger
  ) {}

  async getConnectionStatus(endpointOverride?: string): Promise<CdpConnectionStatus> {
    const status = await this.client.getConnectionStatus(endpointOverride);
    if (status.connected) {
      this.logger.info("CDP connection ready", {
        endpoint: status.endpoint,
        browser: status.browser,
        protocolVersion: status.protocolVersion
      });
    }

    return status;
  }

  async discoverTabs(endpointOverride?: string): Promise<CdpTabDiscoveryResult> {
    const result = await this.client.discoverTabs(endpointOverride);
    this.logger.info("CDP tab discovery completed", {
      endpoint: result.endpoint,
      tabCount: result.tabs.length,
      browser: result.browser
    });

    return result;
  }
}
