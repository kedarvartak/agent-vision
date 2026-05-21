import { AppError, isAppError } from "../errors/app-error.js";
import type { Logger } from "../logging/logger.js";

export type JsonSchemaProperty = {
  type: string;
  description?: string;
  [key: string]: unknown;
};

export type JsonSchema = {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  [key: string]: unknown;
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export type ToolAnnotations = {
  readOnlyHint?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  handler: ToolHandler;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(private readonly logger: Logger) {}

  register(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition);
  }

  list(): Omit<ToolDefinition, "handler">[] {
    return Array.from(this.tools.values()).map(({ handler: _handler, ...tool }) => tool);
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const definition = this.tools.get(name);

    if (!definition) {
      throw new AppError("NOT_FOUND", "Tool not found", { toolName: name });
    }

    try {
      this.logger.debug("Calling tool", { toolName: name });
      return await definition.handler(args);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw new AppError("INTERNAL_ERROR", "Unexpected tool failure", {
        toolName: name,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
