/**
 * GET /api/v2/org/home — O1 Command Center aggregate (REDESIGN-P4 §2 O1, W7)
 *
 * One request feeds the org home: member KPIs, seats used, pending
 * invites, and the recent org-scoped audit feed.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getOrgContext, listMembers, listOrgAudit, OrgError } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const Query = z.object({
  action: z.string().optional(),
  cursor: z.string().optional(),
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
    const { org, members, seatsUsed } = await listMembers(ctx.orgId);
    const audit = await listOrgAudit(ctx.orgId, {
      action: parsed.data.action,
      cursor: parsed.data.cursor,
      limit: 10,
    });

    return apiSuccess({
      org: { id: org.id, name: org.name, plan: org.plan, seats: org.seats },
      kpis: {
        members: members.length,
        seatsUsed,
        seatsTotal: org.seats,
        pendingInvites: 0,
      },
      members: members.slice(0, 5),
      audit: audit.items,
      auditCursor: audit.nextCursor,
    });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
