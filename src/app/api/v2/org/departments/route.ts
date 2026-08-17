/**
 * GET/POST /api/v2/org/departments — People & Departments (B2B ops, 2026-08-17)
 *
 * GET:  the org's departments with member counts + course rule counts.
 * POST: { name } creates a department (409 on duplicate name). Audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import {
  createDepartment,
  getOrgContext,
  listDepartments,
} from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const CreateBody = z.object({ name: z.string().min(1).max(80) });

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
    const departments = await listDepartments(ctx.orgId);
    return apiSuccess({ departments });
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

  const demoBlock = await demoWriteBlock("creating a department");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid department body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const department = await createDepartment(ctx.orgId, parsed.data.name);
    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "org_department_created",
      target: { type: "department", id: department.id },
      after: { name: department.name },
      req,
    }).catch(() => {});
    return apiSuccess({ department }, 201);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
