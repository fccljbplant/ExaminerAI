/**
 * GET /api/cron/legacy — consolidated legacy maintenance jobs.
 *
 * Vercel cron slots are limited, so the three legacy jobs (SRS due
 * cards, study-plan refresh, absence scan) run sequentially from ONE
 * registered schedule (2026-08-17). Each job keeps its own flag gating
 * and its own individual route for manual triggering.
 */

import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { run as runSrsDue } from "../srs-due/route";
import { run as runStudyPlanRefresh } from "../study-plan-refresh/route";
import { run as runAbsenceScan } from "../absence-scan/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  for (const [name, job] of [
    ["srs-due", runSrsDue],
    ["study-plan-refresh", runStudyPlanRefresh],
    ["absence-scan", runAbsenceScan],
  ] as const) {
    try {
      const res = await job();
      results[name] = res.status === 200 ? await res.json() : { status: res.status };
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return Response.json({ ok: true, data: results });
}
