/**
 * GET /api/v2/org/analytics — O7 Study Analytics (REDESIGN-P4 §2 O7, W7)
 *
 * Org engagement aggregate: event mix + active learners + exam sessions
 * over the last 14 days, scoped to the org's members.
 */

import { getAuthUser } from "@/lib/auth";
import { hasRole, UserRole } from "@/lib/rbac";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getOrgAnalytics, getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";



export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!hasRole(user.role, [UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN])) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  try {
    const data = await getOrgAnalytics(ctx.orgId);
    return apiSuccess(data);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
