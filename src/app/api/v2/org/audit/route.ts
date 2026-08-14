/**
 * GET /api/v2/org/audit — O5 Monitoring & Audit (REDESIGN-P4 §2 O5, W7)
 *
 * Org-scoped audit feed (actors = the org's members) with action
 * filter + cursor pagination. CSV export is generated client-side
 * from this same data (csv-export lib).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getOrgContext, listOrgAudit } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const Query = z.object({
  action: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: NextRequest) {
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

  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError("Invalid query parameters", "VALIDATION_ERROR", 400);
  }

  try {
    const result = await listOrgAudit(ctx.orgId, parsed.data);
    return apiSuccess(result);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
