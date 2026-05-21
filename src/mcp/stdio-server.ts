import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";

import { AppError, isAppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";
import type { VisualContextServer } from "../server.js";

const SERVER_NAME = "agent-vision-mcp";
const SERVER_VERSION = "0.1.1";

const isImagePayload = (value: unknown): value is { mimeType: string; bytesBase64: string } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.mimeType === "string" && typeof candidate.bytesBase64 === "string";
};

const collectImagePayloads = (value: unknown, seen = new Set<unknown>()): Array<{ mimeType: string; bytesBase64: string }> => {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  if (isImagePayload(value)) {
    return [{ mimeType: value.mimeType, bytesBase64: value.bytesBase64 }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImagePayloads(item, seen));
  }

  return Object.values(value as Record<string, unknown>).flatMap((item) => collectImagePayloads(item, seen));
};

const redactImageBytes = (value: unknown, seen = new Set<unknown>()): unknown => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactImageBytes(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "bytesBase64" && typeof item === "string") {
      output[key] = `[base64 omitted: ${item.length} chars]`;
      continue;
    }

    output[key] = redactImageBytes(item, seen);
  }

  return output;
};

const toToolResult = (result: unknown): CallToolResult => {
  const content: CallToolResult["content"] = [
    {
      type: "text",
      text: JSON.stringify(redactImageBytes(result), null, 2)
    }
  ];

  for (const image of collectImagePayloads(result)) {
    content.push({
      type: "image",
      mimeType: image.mimeType,
      data: image.bytesBase64
    });
  }

  return { content };
};

const toToolErrorResult = (error: unknown): CallToolResult => {
  const message =
    isAppError(error)
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);

  const details = isAppError(error) ? error.details : undefined;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: message,
            ...(details ? { details } : {})
          },
          null,
          2
        )
      }
    ],
    isError: true
  };
};

const toMcpError = (error: unknown): McpError => {
  if (isAppError(error)) {
    return new McpError(ErrorCode.InternalError, error.message, error.details);
  }

  if (error instanceof McpError) {
    return error;
  }

  return new McpError(
    ErrorCode.InternalError,
    error instanceof Error ? error.message : String(error)
  );
};

export class McpStdioServer {
  constructor(
    private readonly app: VisualContextServer,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    const server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => ({
      tools: this.app.listTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: (tool.inputSchema ?? {
          type: "object",
          properties: {},
          additionalProperties: false
        }) as {
          type: "object";
          properties?: Record<string, object>;
          required?: string[];
          [key: string]: unknown;
        },
        ...(tool.annotations ? { annotations: tool.annotations } : {})
      }))
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const toolName = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;

      try {
        const result = await this.app.callTool(toolName, args);
        return toToolResult(result);
      } catch (error) {
        this.logger.error("MCP tool call failed", {
          toolName,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        return toToolErrorResult(error);
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    this.logger.info("Official MCP stdio server listening", {
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION
    });
  }
}
