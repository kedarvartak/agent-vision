export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "SESSION_EXPIRED"
  | "SESSION_CONFLICT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
