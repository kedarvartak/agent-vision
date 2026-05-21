export type CdpBrowserVersion = {
  Browser?: string;
  ProtocolVersion?: string;
  UserAgent?: string;
  V8Version?: string;
  WebKitVersion?: string;
  webSocketDebuggerUrl?: string;
};

export type CdpConnectionStatus = {
  endpoint: string;
  connected: boolean;
  checkedAt: string;
  browser?: string;
  browserName?: string;
  protocolVersion?: string;
  userAgent?: string;
  webSocketDebuggerUrl?: string;
  errorMessage?: string;
  errorHint?: string;
};

export type CdpDiscoveredTarget = {
  id: string;
  type: string;
  title: string;
  url?: string;
  attached: boolean;
  browserName?: string;
  discoveredAt: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
};

export type CdpTabDiscoveryResult = {
  endpoint: string;
  discoveredAt: string;
  browser?: string;
  browserName?: string;
  protocolVersion?: string;
  tabs: CdpDiscoveredTarget[];
};

export type BrowserTabScreenshot = {
  targetId: string;
  title: string;
  url?: string;
  browserName?: string;
  mimeType: "image/png";
  bytesBase64: string;
  width: number;
  height: number;
  byteLength: number;
  capturedAt: string;
  backend: "cdp-page-capture";
};

export type BrowserTabStructuredContext = {
  targetId: string;
  title: string;
  url?: string;
  browserName?: string;
  pageTitle?: string;
  pageUrl?: string;
  documentLanguage?: string;
  contentType?: string;
  visibleText: string;
  visibleTextLength: number;
  viewport?: {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
  };
  collectedAt: string;
  backend: "cdp-runtime-evaluate";
};
