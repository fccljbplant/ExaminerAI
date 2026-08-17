/**
 * PATCH/DELETE /api/v2/org/departments/[id] — department editing (B2B ops)
 *
 * PATCH  { name }          → rename (409 on duplicate name).
 * PATCH  { memberUserId }  → assign the member to this department.
 *                            { memberUserId, remove: true } removes the
 *                            member from their department (route [id] is
 *                            the member's CURRENT department).
 * PATCH  { courseIds }     → replace the department's course rules.
 * DELETE                    → remove the department (members are unassigned
 *                            first, course rules cascade-delete). Audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import {
  assignMemberToDepartment,
  deleteDepartment,
  getOrgContext,
  renameDepartment,
  setDepartmentCourses,
} from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  memberUserId: z.string().min(1).nullable().optional(),
  remove: z.boolean().optional(),
  courseIds: z.array(z.string()).max(100).optional(),
});

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

  const demoBlock = await demoWriteBlock("editing a department");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid department body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const actor = { id: user.sub, name: user.name, role: user.role };
  try {
    if (parsed.data.name !== undefined) {
      const department = await renameDepartment(id, ctx.orgId, parsed.data.name);
      await logAudit({
        actor,
        action: "org_department_renamed",
        target: { type: "department", id },
        after: { name: department.name },
        req,
      }).catch(() => {});
      return apiSuccess({ department });
    }

    if (parsed.data.memberUserId !== undefined) {
      const remove = parsed.data.remove === true || parsed.data.memberUserId === null;
      if (parsed.data.memberUserId === null) {
        // A removal needs the member's id — send { memberUserId, remove: true }.
        return apiError("Pass memberUserId with remove:true to remove a member", "VALIDATION_ERROR", 400);
      }
      const member = await assignMemberToDepartment(
        ctx.orgId,
        parsed.data.memberUserId,
        remove ? null : id,
      );
      await logAudit({
        actor,
        action: remove ? "org_department_member_removed" : "org_department_member_assigned",
        target: { type: "user", id: member.userId },
        after: { departmentId: member.departmentId },
        req,
      }).catch(() => {});
      return apiSuccess({ member });
    }

    if (parsed.data.courseIds !== undefined) {
      const courseIds = await setDepartmentCourses(id, ctx.orgId, parsed.data.courseIds);
      await logAudit({
        actor,
        action: "org_department_courses_set",
        target: { type: "department", id },
        after: { courseIds },
        req,
      }).catch(() => {});
      return apiSuccess({ courseIds });
    }

    return apiError("Nothing to update", "VALIDATION_ERROR", 400);
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function DELETE(
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

  const demoBlock = await demoWriteBlock("deleting a department");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const { id } = await params;
  try {
    await deleteDepartment(id, ctx.orgId);
    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "org_department_deleted",
      target: { type: "department", id },
      req,
    }).catch(() => {});
    return apiSuccess({ deleted: true });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
