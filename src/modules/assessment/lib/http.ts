/**
 * modules/assessment/lib/http.ts — ExamError → typed HTTP response
 *
 * Single mapping point so every W5 exam route returns the stable v2
 * error envelope ({ ok: false, error, code }) with the service-chosen
 * status. Codes flow from exam-session-db.ts (P4 §1 stable-code surface).
 */

import { NextResponse } from "next/server";
import { apiError, type ErrorCode } from "@/lib/api-response";
import { ExamError } from "./exam-session-db";

/** Map an ExamError (or any unexpected error) to a typed response. */
export function examErrorResponse(err: unknown): NextResponse {
  if (err instanceof ExamError) {
    return apiError(err.message, err.code as ErrorCode, err.status);
  }
  return apiError(
    err instanceof Error ? err.message : "Unexpected error",
    "INTERNAL_ERROR",
    500,
  );
}
