import { VisualContextServer } from "./server.js";

const main = async () => {
  const server = new VisualContextServer();
  server.start();

  const status = await server.callTool("getBrowserCdpStatus");
  const rawTabs = await server.callTool("discoverBrowserTabsViaCdp");
  const liveTabs = await server.callTool("refreshLiveBrowserTabs");
  const cachedLiveTabs = await server.callTool("listLiveBrowserTabs");
  const pruned = await server.callTool("pruneStaleLiveBrowserTabs", {
    maxAgeMs: 5 * 60 * 1000
  });
  const resolvedActive = await server.callTool("resolveLiveBrowserTab");
  const resolvedQuery = await server.callTool("resolveLiveBrowserTab", {
    query: "docs"
  });
  const screenshot = await server.callTool("captureResolvedBrowserTabScreenshot", {
    query: "docs"
  });
  const context = await server.callTool("getResolvedBrowserTabContext", {
    query: "docs"
  });
  const seeActive = await server.callTool("seeBrowserTabViaCdp");
  const seeQuery = await server.callTool("seeBrowserTabViaCdp", {
    query: "docs"
  });

  console.log("cdp-status", JSON.stringify(status, null, 2));
  console.log("cdp-tabs", JSON.stringify(rawTabs, null, 2));
  console.log("live-browser-tabs", JSON.stringify(liveTabs, null, 2));
  console.log("cached-live-browser-tabs", JSON.stringify(cachedLiveTabs, null, 2));
  console.log("pruned-stale-tabs", JSON.stringify(pruned, null, 2));
  console.log("resolved-active", JSON.stringify(resolvedActive, null, 2));
  console.log("resolved-query", JSON.stringify(resolvedQuery, null, 2));
  console.log("captured-screenshot", JSON.stringify(screenshot, null, 2));
  console.log("resolved-context", JSON.stringify(context, null, 2));
  console.log("see-active", JSON.stringify(seeActive, null, 2));
  console.log("see-query", JSON.stringify(seeQuery, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
