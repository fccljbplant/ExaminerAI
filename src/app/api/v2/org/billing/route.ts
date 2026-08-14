/**
 * GET /api/v2/org/billing — O6 Billing & seats (REDESIGN-P4 §2 O6, W7)
 *
 * Plan card data + seat usage + recent member payments (seats are the
 * org's core billing surface; upgrade CTA connects to the existing
 * Stripe checkout in a later pass).
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getOrgBilling, getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  try {
    const data = await getOrgBilling(ctx.orgId);
    return apiSuccess(data);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
