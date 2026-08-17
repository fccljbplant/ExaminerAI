/**
 * GET /api/v2/platform/revenue — platform P&L rollup (2026-08-17)
 * Platform-admin only. MRR from active seat subscriptions, B2C fees,
 * pending creator payouts, trial health and AI spend.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { getPlatformRevenue } from "@/modules/platform-portal/lib/platform-db";

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

  return apiSuccess({ revenue: await getPlatformRevenue() });
}
