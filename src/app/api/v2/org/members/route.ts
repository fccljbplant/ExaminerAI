/**
 * GET/POST /api/v2/org/members — O2 People & Roles (REDESIGN-P4 §2 O2, W7)
 *
 * GET: member roster (v2 envelope over the same query the v1 route
 * serves). POST: invite by email (role admin|mentor|member, seat flag)
 * — audited, 409 on duplicates, 404 when the email has no account.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getOrgContext, inviteMember, listMembers } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "mentor", "member"]).default("member"),
  seat: z.boolean().optional(),
});

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
    const { org, members, seatsUsed } = await listMembers(ctx.orgId);
    return apiSuccess({
      org: { id: org.id, name: org.name, plan: org.plan, seats: org.seats },
      seatsUsed,
      members,
    });
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("inviting a member");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = InviteBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid invite body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const member = await inviteMember(ctx.orgId, { id: user.sub, name: user.name, role: user.role }, parsed.data);
    return apiSuccess({ member }, 201);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
