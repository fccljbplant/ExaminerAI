/**
 * modules/org-portal/lib/http.ts — OrgError → typed HTTP response
 */

import { NextResponse } from "next/server";
import { apiError, type ErrorCode } from "@/lib/api-response";
import { OrgError } from "./org-db";

export function orgErrorResponse(err: unknown): NextResponse {
  if (err instanceof OrgError) {
    return apiError(err.message, err.code as ErrorCode, err.status);
  }
  return apiError(
    err instanceof Error ? err.message : "Unexpected error",
    "INTERNAL_ERROR",
    500,
  );
}
