import { VisualContextServer } from "./server.js";

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=";

const main = async () => {
  const server = new VisualContextServer();
  server.start();

  const registered = await server.callTool("registerBrowserTabSnapshot", {
    tabId: "tab-openai-docs",
    title: "OpenAI API docs",
    url: "https://platform.openai.com/docs/api-reference",
    browserName: "Chrome",
    active: true,
    image: {
      mimeType: "image/png",
      bytesBase64: ONE_BY_ONE_PNG_BASE64,
      width: 1,
      height: 1
    }
  });

  const listed = await server.callTool("listBrowserTabs");
  const captured = await server.callTool("seeBrowserTab", {
    query: "OpenAI API docs",
    command: "see"
  });

  console.log("registered", JSON.stringify(registered, null, 2));
  console.log("listed", JSON.stringify(listed, null, 2));
  console.log("captured", JSON.stringify(captured, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
