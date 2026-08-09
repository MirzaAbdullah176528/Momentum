import type { AppContext, ApiResponse } from "../types.js";

export function ok<T>(c: AppContext, data: T, status: 200 | 201 = 200) {
  return c.json<ApiResponse<T>>({ ok: true, data }, status);
}

export function notFound(c: AppContext, message: string) {
  return c.json<ApiResponse<never>>(
    { ok: false, error: { code: "not_found", message } },
    404
  );
}

export function forbidden(c: AppContext, message: string) {
  return c.json<ApiResponse<never>>(
    { ok: false, error: { code: "forbidden", message } },
    403
  );
}

export function validationError(
  c: AppContext,
  message: string,
  details: unknown
) {
  return c.json<ApiResponse<never>>(
    { ok: false, error: { code: "validation_error", message, details } },
    400
  );
}

export function internalError(c: AppContext, message: string) {
  return c.json<ApiResponse<never>>(
    { ok: false, error: { code: "internal_error", message } },
    500
  );
}

export function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "Unknown error";
}
