/**
 * GET /api/v2/platform/home — P1 Platform home (REDESIGN-P4 §2 P1, W7)
 *
 * Aggregate: platform KPIs (orgs, active members, users, audit
 * actions), orgs table with seat usage, and the recent global audit
 * feed.
 */

import { getAuthUser } from "@/lib/auth";
import { hasRole, PLATFORM_ADMIN_ROLES } from "@/lib/rbac";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getPlatformHome, getUserOverview } from "@/modules/platform-portal/lib/platform-db";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!hasRole(user.role, PLATFORM_ADMIN_ROLES)) {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  try {
    const [data, overview] = await Promise.all([getPlatformHome(), getUserOverview()]);
    return apiSuccess({ ...data, overview });
  } catch (err) {
    console.error("Platform home aggregation failed:", err);
    return apiError(
      "Platform data is temporarily unavailable. Please try again.",
      "INTERNAL_ERROR",
      500,
    );
  }
}
