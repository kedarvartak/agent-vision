import { VisualContextServer } from "./server.js";

const main = async () => {
  const server = new VisualContextServer();
  server.start();

  const status = await server.callTool("getBrowserCdpStatus");
  const tabs = await server.callTool("discoverBrowserTabsViaCdp");

  console.log("cdp-status", JSON.stringify(status, null, 2));
  console.log("cdp-tabs", JSON.stringify(tabs, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
