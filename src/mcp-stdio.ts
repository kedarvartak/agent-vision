#!/usr/bin/env node

import { ConsoleLogger } from "./logging/logger.js";
import { McpStdioServer } from "./mcp/stdio-server.js";
import { VisualContextServer } from "./server.js";

const main = async () => {
  const app = new VisualContextServer();
  const logger = new ConsoleLogger("agent-vision-mcp");

  app.start();
  await new McpStdioServer(app, logger).start();
};

void main().catch((error) => {
  const logger = new ConsoleLogger("agent-vision-mcp");
  logger.error("Failed to start MCP stdio server", {
    errorMessage: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
