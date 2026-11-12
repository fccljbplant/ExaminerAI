import type { NextRequest } from "next/server";
import { isCronAuthorizationValid } from "./auth-policy";

/**
 * Shared authorization for Vercel cron invocations.
 * Production requests are denied when CRON_SECRET is missing; non-production
 * local/test environments may run without a configured secret.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  return isCronAuthorizationValid(req.headers.get("authorization"), process.env);
}
