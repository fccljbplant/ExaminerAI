/**
 * GET /api/v2/instructor/analytics — I8 Analytics (REDESIGN-P4 §2 I8, W6)
 *
 * Thin v2 envelope wrapper over the kept v1 cohort-analytics handler
 * (P1 §2.4: keep sound endpoints). The v1 route returns a bare JSON
 * body; the v2 client contract is { ok, data }.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";
import { GET as GET_CohortAnalytics } from "../../../instructor/cohort-analytics/route";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const v1Res = await GET_CohortAnalytics(req);
  const body = await v1Res.json().catch(() => null);
  if (!v1Res.ok) {
    return apiError(body?.error ?? "Analytics unavailable", "INTERNAL_ERROR", v1Res.status);
  }
  return apiSuccess(body ?? {});
}
