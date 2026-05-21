import { AppError, isAppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";
import type { VisualContextServer } from "../server.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type McpTextContent = {
  type: "text";
  text: string;
};

type McpImageContent = {
  type: "image";
  mimeType: string;
  data: string;
};

type McpToolResult = {
  content: Array<McpTextContent | McpImageContent>;
  isError?: boolean;
};

const MCP_PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "llm-vision-mcp";
const SERVER_VERSION = "0.1.0";
const JSON_RPC_VERSION = "2.0";
const JSON_PARSE_ERROR = -32700;
const JSON_INVALID_REQUEST = -32600;
const JSON_METHOD_NOT_FOUND = -32601;
const JSON_INVALID_PARAMS = -32602;
const JSON_INTERNAL_ERROR = -32603;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

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

const toToolResult = (result: unknown): McpToolResult => {
  const content: Array<McpTextContent | McpImageContent> = [
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

const toToolErrorResult = (error: unknown): McpToolResult => {
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

const toJsonRpcError = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcFailure => ({
  jsonrpc: JSON_RPC_VERSION,
  id,
  error: {
    code,
    message,
    ...(data !== undefined ? { data } : {})
  }
});

const encodeMessage = (message: JsonRpcSuccess | JsonRpcFailure): Buffer => {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
};

export class McpStdioServer {
  private buffer = Buffer.alloc(0);
  private initialized = false;

  constructor(
    private readonly app: VisualContextServer,
    private readonly logger: Logger,
    private readonly input = process.stdin,
    private readonly output = process.stdout
  ) {}

  start(): void {
    this.input.on("data", (chunk: Buffer | string) => {
      this.buffer = Buffer.concat([
        this.buffer,
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk
      ]);
      this.processBuffer();
    });

    this.input.on("error", (error) => {
      this.logger.error("MCP stdio input error", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    });

    this.output.on("error", (error) => {
      this.logger.error("MCP stdio output error", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    });

    this.logger.info("MCP stdio server listening", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION
    });
  }

  private processBuffer(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.buffer.subarray(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = Buffer.alloc(0);
        this.writeMessage(toJsonRpcError(null, JSON_INVALID_REQUEST, "Missing Content-Length header"));
        return;
      }

      const contentLength = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (this.buffer.byteLength < bodyEnd) {
        return;
      }

      const bodyBuffer = this.buffer.subarray(bodyStart, bodyEnd);
      this.buffer = this.buffer.subarray(bodyEnd);

      let parsed: JsonRpcRequest;
      try {
        parsed = JSON.parse(bodyBuffer.toString("utf8")) as JsonRpcRequest;
      } catch {
        this.writeMessage(toJsonRpcError(null, JSON_PARSE_ERROR, "Invalid JSON payload"));
        continue;
      }

      void this.handleMessage(parsed);
    }
  }

  private async handleMessage(message: JsonRpcRequest): Promise<void> {
    if (message.jsonrpc !== JSON_RPC_VERSION || typeof message.method !== "string") {
      if (message.id !== undefined) {
        this.writeMessage(toJsonRpcError(message.id ?? null, JSON_INVALID_REQUEST, "Invalid JSON-RPC request"));
      }
      return;
    }

    const id = message.id ?? null;

    try {
      switch (message.method) {
        case "initialize": {
          this.initialized = true;
          this.writeMessage({
            jsonrpc: JSON_RPC_VERSION,
            id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: {
                tools: {
                  listChanged: false
                }
              },
              serverInfo: {
                name: SERVER_NAME,
                version: SERVER_VERSION
              }
            }
          });
          return;
        }
        case "notifications/initialized": {
          return;
        }
        case "ping": {
          this.writeMessage({
            jsonrpc: JSON_RPC_VERSION,
            id,
            result: {}
          });
          return;
        }
        case "tools/list": {
          this.writeMessage({
            jsonrpc: JSON_RPC_VERSION,
            id,
            result: {
              tools: this.app.listTools().map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema ?? { type: "object", properties: {}, additionalProperties: false },
                ...(tool.annotations ? { annotations: tool.annotations } : {})
              }))
            }
          });
          return;
        }
        case "tools/call": {
          const params = toRecord(message.params);
          const toolName = params.name;
          if (typeof toolName !== "string") {
            this.writeMessage(toJsonRpcError(id, JSON_INVALID_PARAMS, "tools/call requires a string name"));
            return;
          }

          try {
            const result = await this.app.callTool(toolName, toRecord(params.arguments));
            this.writeMessage({
              jsonrpc: JSON_RPC_VERSION,
              id,
              result: toToolResult(result)
            });
          } catch (error) {
            this.writeMessage({
              jsonrpc: JSON_RPC_VERSION,
              id,
              result: toToolErrorResult(error)
            });
          }
          return;
        }
        default: {
          this.writeMessage(toJsonRpcError(id, JSON_METHOD_NOT_FOUND, `Method not found: ${message.method}`));
        }
      }
    } catch (error) {
      this.writeMessage(
        toJsonRpcError(
          id,
          JSON_INTERNAL_ERROR,
          "Internal MCP server error",
          error instanceof Error ? { message: error.message } : { message: String(error) }
        )
      );
    }
  }

  private writeMessage(message: JsonRpcSuccess | JsonRpcFailure): void {
    this.output.write(encodeMessage(message));
  }
}
