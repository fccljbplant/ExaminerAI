import { NextResponse } from "next/server";

/**
 * Standardized API response helpers.
 *
 * Phase 5.5: Provides a consistent envelope for all API routes.
 * Instead of each route deciding its own response shape, use these
 * helpers for predictable error handling on the client side.
 *
 * Usage:
 *   import { apiSuccess, apiError } from "@/lib/api-response";
 *
 *   return apiSuccess({ user });
 *   return apiError("Not found", 404);
 *   return apiError("Validation failed", 400, { field: "email" });
 *
 * Success envelope:  { ok: true, data: T }
 * Error envelope:    { ok: false, error: string, details?: unknown }
 *
 * The frontend api-client.ts already unwraps the response — it just
 * needs to check for `ok: false` on errors. The ApiError class in
 * api-client.ts already carries the full body for structured errors.
 */

/** Return a success response with the standard envelope. */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Return an error response with the standard envelope. */
export function apiError(
  message: string,
  status: number = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}

/** Return a 401 Unauthorized error. */
export function apiUnauthorized(message: string = "Unauthorized"): NextResponse {
  return apiError(message, 401);
}

/** Return a 403 Forbidden error. */
export function apiForbidden(message: string = "Forbidden"): NextResponse {
  return apiError(message, 403);
}

/** Return a 404 Not Found error. */
export function apiNotFound(message: string = "Not found"): NextResponse {
  return apiError(message, 404);
}

/** Return a 500 Internal Server Error. */
export function apiServerError(message: string = "Internal server error", details?: unknown): NextResponse {
  return apiError(message, 500, details);
}
