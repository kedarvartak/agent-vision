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
