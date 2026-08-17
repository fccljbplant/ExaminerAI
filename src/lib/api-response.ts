import { NextResponse } from "next/server";

/**
 * src/lib/api-response.ts — Standardized API response helpers with error codes.
 *
 * EVERY API route should use these helpers instead of raw NextResponse.json().
 * This ensures consistent response shapes across all endpoints.
 *
 * Usage:
 *   import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiValidationError } from "@/lib/api-response";
 *
 *   return apiSuccess({ user });
 *   return apiError("Internal error", "INTERNAL_ERROR", 500);
 *   return apiUnauthorized();
 *   return apiForbidden("Only admins can do this");
 *   return apiNotFound("User not found");
 *   return apiValidationError({ email: "Invalid email" });
 *
 * Success envelope:  { ok: true, data: T }
 * Error envelope:    { ok: false, error: string, code: ErrorCode, details?: unknown }
 */

// ── Standard error codes ───────────────────────────────────────
export const ErrorCode = {
  // Auth errors (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  NO_TOKEN: "NO_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  // Authorization errors (403)
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  IDOR_VIOLATION: "IDOR_VIOLATION",

  // Resource errors (404)
  NOT_FOUND: "NOT_FOUND",

  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_AMOUNT: "INVALID_AMOUNT", // payouts / billing amount validation (2026-08-17)

  // Payment errors (402)
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",

  // Conflict errors (409)
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate limiting (429)
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  AI_ERROR: "AI_ERROR",
  DEGRADED: "DEGRADED",

  // Service unavailable (503)
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ── Response helpers ───────────────────────────────────────────

/** Return a success response with the standard envelope. */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Return an error response with the standard envelope + error code. */
export function apiError(
  message: string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  status: number = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

/** Return a 401 Unauthorized error. */
export function apiUnauthorized(
  message: string = "Unauthorized",
  code: ErrorCode = ErrorCode.UNAUTHORIZED,
): NextResponse {
  return apiError(message, code, 401);
}

/** Return a 403 Forbidden error. */
export function apiForbidden(
  message: string = "Forbidden",
  code: ErrorCode = ErrorCode.FORBIDDEN,
): NextResponse {
  return apiError(message, code, 403);
}

/** Return a 404 Not Found error. */
export function apiNotFound(
  message: string = "Not found",
  code: ErrorCode = ErrorCode.NOT_FOUND,
): NextResponse {
  return apiError(message, code, 404);
}

/** Return a 400 Validation error with field-level details. */
export function apiValidationError(
  details: Record<string, string>,
  message: string = "Validation failed",
): NextResponse {
  return apiError(message, ErrorCode.VALIDATION_ERROR, 400, details);
}

/** Return a 409 Conflict error. */
export function apiConflict(
  message: string = "Resource already exists",
  code: ErrorCode = ErrorCode.ALREADY_EXISTS,
): NextResponse {
  return apiError(message, code, 409);
}

/** Return a 429 Rate Limited error. */
export function apiRateLimited(
  message: string = "Rate limit exceeded",
  retryAfter?: number,
): NextResponse {
  const response = apiError(message, ErrorCode.RATE_LIMITED, 429);
  if (retryAfter) {
    response.headers.set("Retry-After", String(retryAfter));
  }
  return response;
}

/** Return a 500 Internal Server Error. */
export function apiServerError(
  message: string = "Internal server error",
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  details?: unknown,
): NextResponse {
  return apiError(message, code, 500, details);
}

/** Return a 503 Degraded (AI or service unavailable). */
export function apiDegraded(
  message: string = "Service is degraded. Please retry.",
): NextResponse {
  return apiError(message, ErrorCode.DEGRADED, 503);
}
