import { NextRequest, NextResponse } from "next/server";
import { runEscalationEngine } from "@/lib/ai-assistant/escalation";
import { getAuthUser } from "@/lib/auth";
import crypto from "crypto";

/**
 * POST /api/assistant/escalation/run
 *
 * Runs the escalation engine on all open amber flags.
 * Can be called by:
 * - Cron job (with CRON_SECRET)
 * - Admin/principal manually
 *
 * C7 fix (audit 2026-07-26): the vercel.json cron config sends the secret
 * as a `?secret=` query parameter, but the previous version of this route
 * only checked the `Authorization: Bearer <secret>` header. The mismatch
 * meant the cron job 401'd every night. This version accepts BOTH:
 *   - `?secret=<CRON_SECRET>` query parameter (Vercel cron format)
 *   - `Authorization: Bearer <CRON_SECRET>` header (manual/script format)
 * Both use timing-safe comparison to prevent timing attacks.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Try Authorization header first
  const authHeader = req.headers.get("authorization");
  const headerMatch = cronSecret && authHeader?.startsWith("Bearer ")
    ? safeEqual(authHeader.slice(7), cronSecret)
    : false;

  // Then try ?secret= query parameter (Vercel cron format)
  const querySecret = req.nextUrl.searchParams.get("secret");
  const queryMatch = cronSecret && querySecret
    ? safeEqual(querySecret, cronSecret)
    : false;

  const isCronCall = !!cronSecret && (headerMatch || queryMatch);

  if (!isCronCall) {
    const payload = await getAuthUser();
    if (!payload || !["principal", "administrator", "demo", "admin"].includes(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runEscalationEngine();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Escalation engine failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** Timing-safe string comparison to prevent timing attacks on the secret. */
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** GET — alias for POST so Vercel cron (which sends GET) works without a separate handler. */
export async function GET(req: NextRequest) {
  return POST(req);
}
