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

const toErrorMessage = (error: unknown, endpoint: string): { errorMessage: string; errorHint?: string } => {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("timed out")) {
    return {
      errorMessage: message,
      errorHint: `Chrome did not respond in time. Check that a debug-enabled browser is running at ${endpoint}.`
    };
  }

  if (
    lowered.includes("econnrefused") ||
    lowered.includes("fetch failed") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror")
  ) {
    return {
      errorMessage: message,
      errorHint: `Could not reach the CDP endpoint at ${endpoint}. Start Chrome with --remote-debugging-port=9222 or set CHROME_CDP_ENDPOINT.`
    };
  }

  if (lowered.includes("404") || lowered.includes("status 404")) {
    return {
      errorMessage: message,
      errorHint: `The endpoint ${endpoint} responded, but it does not look like a Chrome DevTools Protocol server.`
    };
  }

  return { errorMessage: message };
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
      const diagnostic = toErrorMessage(error, endpoint);
      this.logger.error("Failed CDP connection check", {
        endpoint,
        errorMessage: diagnostic.errorMessage,
        errorHint: diagnostic.errorHint
      });
      return {
        endpoint,
        connected: false,
        checkedAt,
        errorMessage: diagnostic.errorMessage,
        errorHint: diagnostic.errorHint
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
