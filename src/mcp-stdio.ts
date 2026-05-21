#!/usr/bin/env node

import { ConsoleLogger } from "./logging/logger.js";
import { McpStdioServer } from "./mcp/stdio-server.js";
import { VisualContextServer } from "./server.js";

const app = new VisualContextServer();
const logger = new ConsoleLogger("agent-vision-mcp");

app.start();
new McpStdioServer(app, logger).start();
