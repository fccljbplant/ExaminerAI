/**
 * GET /api/v2/platform/home — P1 Platform home (REDESIGN-P4 §2 P1, W7)
 *
 * Aggregate: platform KPIs (orgs, active members, users, audit
 * actions), orgs table with seat usage, and the recent global audit
 * feed.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getPlatformHome } from "@/modules/platform-portal/lib/platform-db";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

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

  try {
    const data = await getPlatformHome();
    return apiSuccess(data);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Failed to load platform data",
      "INTERNAL_ERROR",
      500,
    );
  }
}
