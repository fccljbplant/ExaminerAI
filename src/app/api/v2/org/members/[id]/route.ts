/**
 * PATCH /api/v2/org/members/[id] — O2 deactivate/restore (REDESIGN-P4 §2 O2, W7)
 *
 * { status: "removed" } deactivates (seat freed), { status: "active" }
 * restores. Audited; the UI offers an UNDO toast for deactivate.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getOrgContext, setMemberStatus, setMemberSeat } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const Body = z.object({ status: z.enum(["active", "removed"]).optional(), seat: z.boolean().optional() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("changing a member");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid status body", "VALIDATION_ERROR", 400);
  }

  try {
    const actor = { id: user.sub, name: user.name, role: user.role };
    const member =
      parsed.data.seat !== undefined
        ? await setMemberSeat(ctx.orgId, id, actor, parsed.data.seat)
        : await setMemberStatus(ctx.orgId, id, actor, parsed.data.status ?? "active");
    return apiSuccess({ member });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
