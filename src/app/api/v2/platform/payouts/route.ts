/**
 * GET/POST /api/v2/platform/payouts — creator payout oversight
 * (2026-08-17). GET: pending queue + recent paid/failed. POST
 * { action: "sweep" }: runs the same sweep the monthly cron performs,
 * returning its result.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { listPayoutQueue } from "@/modules/platform-portal/lib/platform-db";
import { run as runPayoutsSweep } from "@/app/api/cron/payouts-sweep/route";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  return apiSuccess({ queue: await listPayoutQueue() });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "sweep") {
    const res = await runPayoutsSweep();
    const payload = await res.json();
    return apiSuccess(payload.data ?? payload);
  }
  return apiError("Unknown action — use { action: 'sweep' }", "VALIDATION_ERROR", 400);
}
