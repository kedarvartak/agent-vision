import { VisualContextServer } from "./server.js";

const main = async () => {
  const server = new VisualContextServer();
  server.start();

  const status = await server.callTool("getBrowserCdpStatus");
  const rawTabs = await server.callTool("discoverBrowserTabsViaCdp");
  const liveTabs = await server.callTool("refreshLiveBrowserTabs");
  const cachedLiveTabs = await server.callTool("listLiveBrowserTabs");
  const resolvedActive = await server.callTool("resolveLiveBrowserTab");
  const resolvedQuery = await server.callTool("resolveLiveBrowserTab", {
    query: "docs"
  });

  console.log("cdp-status", JSON.stringify(status, null, 2));
  console.log("cdp-tabs", JSON.stringify(rawTabs, null, 2));
  console.log("live-browser-tabs", JSON.stringify(liveTabs, null, 2));
  console.log("cached-live-browser-tabs", JSON.stringify(cachedLiveTabs, null, 2));
  console.log("resolved-active", JSON.stringify(resolvedActive, null, 2));
  console.log("resolved-query", JSON.stringify(resolvedQuery, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
