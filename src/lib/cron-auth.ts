import type { NextRequest } from "next/server";

/**
 * src/lib/cron-auth.ts — shared auth for Vercel cron invocations.
 *
 * When `CRON_SECRET` is set, Vercel automatically attaches
 * `Authorization: Bearer <secret>` to every cron call; we just verify it.
 * Without a configured secret (local dev / self-hosted) the request is
 * allowed — there is nothing to impersonate.
 */

export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}
