/**
 * modules/submission/lib/http.ts — SubmissionError → typed HTTP response
 *
 * Single mapping point so every W4 route returns the stable v2 error
 * envelope ({ ok: false, error, code }) with the status the service
 * layer chose. Codes flow through from lifecycle.ts / submission-db.ts
 * (P4 §1 stable-code surface).
 */

import { NextResponse } from "next/server";
import { apiError, type ErrorCode } from "@/lib/api-response";
import { SubmissionError } from "./submission-db";

/** Map a SubmissionError (or any unexpected error) to a typed response. */
export function submissionErrorResponse(err: unknown): NextResponse {
  if (err instanceof SubmissionError) {
    return apiError(err.message, err.code as ErrorCode, err.status);
  }
  return apiError(
    err instanceof Error ? err.message : "Unexpected error",
    "INTERNAL_ERROR",
    500,
  );
}
