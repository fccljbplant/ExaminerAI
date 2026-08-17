/**
 * POST /api/v2/org/members/import — bulk member import (B2B ops, 2026-08-17)
 *
 * Body: { csv: string } with a header row of email,role,seat,department
 * (role defaults to "member"; seat accepts true/yes/1; department is
 * matched by name). Each row goes through inviteMember (seat enforcement
 * included) — per-row failures are collected, not fatal. Audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import {
  assignMemberToDepartment,
  getOrgContext,
  inviteMember,
  OrgError,
} from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { CsvParseError, parseMemberRows } from "@/modules/org-portal/lib/csv-parse";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const ImportBody = z.object({ csv: z.string().min(1).max(1_000_000) });

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("importing members");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = ImportBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid import body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  let rows;
  try {
    rows = parseMemberRows(parsed.data.csv);
  } catch (err) {
    if (err instanceof CsvParseError) {
      return apiError(err.message, "VALIDATION_ERROR", 400);
    }
    throw err;
  }
  if (rows.length === 0) {
    return apiError("CSV contains no data rows", "VALIDATION_ERROR", 400);
  }

  const actor = { id: user.sub, name: user.name, role: user.role };
  const orgId = ctx.orgId;
  const created: string[] = [];
  const skipped: Array<{ email: string; reason: string }> = [];

  // Department name → id cache (departments are matched by name).
  const departmentCache = new Map<string, string | null>();
  async function departmentIdByName(name: string): Promise<string | null> {
    if (departmentCache.has(name)) return departmentCache.get(name) ?? null;
    const department = await db.department.findFirst({
      where: { orgId, name },
      select: { id: true },
    });
    departmentCache.set(name, department?.id ?? null);
    return department?.id ?? null;
  }

  for (const row of rows) {
    const reasonFor = (reason: string) => ({ email: row.email || "(missing email)", reason });

    if (!row.email) {
      skipped.push(reasonFor("Missing email"));
      continue;
    }

    let departmentId: string | null = null;
    if (row.department) {
      departmentId = await departmentIdByName(row.department);
      if (!departmentId) {
        skipped.push(reasonFor(`Department not found: ${row.department}`));
        continue;
      }
    }

    try {
      const member = await inviteMember(ctx.orgId, actor, {
        email: row.email,
        role: row.role,
        seat: row.seat,
      });
      if (departmentId) {
        await assignMemberToDepartment(ctx.orgId, member.userId, departmentId);
      }
      created.push(member.user.email);
    } catch (err) {
      skipped.push(
        reasonFor(err instanceof OrgError ? err.message : "Could not import this member"),
      );
    }
  }

  await logAudit({
    actor,
    action: "org_member_import",
    target: { type: "org", id: ctx.orgId },
    metadata: { created: created.length, skipped: skipped.length },
    req,
  }).catch(() => {});

  return apiSuccess({ created: created.length, skipped });
}
