import type { Logger } from "../../logging/logger.js";
import type { CdpBrowserVersion, CdpConnectionStatus, CdpDiscoveredTarget, CdpTabDiscoveryResult } from "./types.js";

const DEFAULT_CDP_ENDPOINT = "http://127.0.0.1:9222";
const DEFAULT_TIMEOUT_MS = 5_000;

const nowIso = (): string => new Date().toISOString();

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeEndpoint = (endpoint?: string): string => {
  const candidate = (endpoint ?? process.env.CHROME_CDP_ENDPOINT ?? DEFAULT_CDP_ENDPOINT).trim();
  if (candidate === "") {
    return DEFAULT_CDP_ENDPOINT;
  }

  return trimTrailingSlash(candidate);
};

const readBrowserName = (browser?: string): string | undefined => {
  if (!browser) {
    return undefined;
  }

  const [name] = browser.split("/");
  return name || browser;
};

type RawTarget = {
  id?: string;
  type?: string;
  title?: string;
  url?: string;
  attached?: boolean;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
};

export class ChromeCdpClient {
  constructor(
    private readonly logger: Logger,
    private readonly defaultEndpoint = normalizeEndpoint(),
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  resolveEndpoint(override?: string): string {
    return normalizeEndpoint(override ?? this.defaultEndpoint);
  }

  async getConnectionStatus(endpointOverride?: string): Promise<CdpConnectionStatus> {
    const endpoint = this.resolveEndpoint(endpointOverride);
    const checkedAt = nowIso();

    try {
      const version = await this.fetchJson<CdpBrowserVersion>(`${endpoint}/json/version`);
      return {
        endpoint,
        connected: true,
        checkedAt,
        browser: version.Browser,
        browserName: readBrowserName(version.Browser),
        protocolVersion: version.ProtocolVersion,
        userAgent: version.UserAgent,
        webSocketDebuggerUrl: version.webSocketDebuggerUrl
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed CDP connection check", { endpoint, errorMessage: message });
      return {
        endpoint,
        connected: false,
        checkedAt,
        errorMessage: message
      };
    }
  }

  async discoverTabs(endpointOverride?: string): Promise<CdpTabDiscoveryResult> {
    const endpoint = this.resolveEndpoint(endpointOverride);
    const discoveredAt = nowIso();
    const version = await this.fetchJson<CdpBrowserVersion>(`${endpoint}/json/version`);
    const rawTargets = await this.fetchJson<RawTarget[]>(`${endpoint}/json/list`);
    const browserName = readBrowserName(version.Browser);

    const tabs: CdpDiscoveredTarget[] = rawTargets
      .filter((target) => target.type === "page" || target.type === "tab")
      .map((target) => ({
        id: target.id ?? "unknown-target",
        type: target.type ?? "page",
        title: target.title ?? target.url ?? "Untitled tab",
        url: target.url,
        attached: target.attached ?? false,
        browserName,
        discoveredAt,
        webSocketDebuggerUrl: target.webSocketDebuggerUrl,
        devtoolsFrontendUrl: target.devtoolsFrontendUrl
      }));

    this.logger.debug("Discovered browser tabs over CDP", {
      endpoint,
      tabCount: tabs.length,
      browser: version.Browser
    });

    return {
      endpoint,
      discoveredAt,
      browser: version.Browser,
      browserName,
      protocolVersion: version.ProtocolVersion,
      tabs
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Timed out fetching CDP endpoint ${url}`)), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`CDP request failed for ${url} with status ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
