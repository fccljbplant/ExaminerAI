/**
 * GET /api/v2/org/audit/export — server-side CSV export of an org's
 * audit feed (2026-08-17). The org audit page previously exported
 * client-side only; this gives org admins (and platform admins) a
 * scriptable, SOC-2-friendly export scoped to the org.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiUnauthorized, apiError } from "@/lib/api-response";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { getOrgContext } from "@/modules/org-portal/lib/org-db";

export const runtime = "nodejs";

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "org_admin" && user.role !== "platform_admin") {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }
  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const memberIds = await db.orgMember.findMany({
    where: { orgId: ctx.orgId, status: "active" },
    select: { userId: true },
  });
  const ids = memberIds.map((m) => m.userId);

  const rows = await db.auditLog.findMany({
    where: { actorUserId: { in: ids } },
    orderBy: { createdAt: "desc" },
    take: 10_000,
    select: {
      createdAt: true,
      actorName: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      ipAddress: true,
      metadata: true,
    },
  });

  const header = ["createdAt", "actorName", "actorRole", "action", "targetType", "targetId", "ipAddress", "metadata"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((h) => {
          const v = r[h as keyof typeof r];
          return escapeCSV(v instanceof Date ? v.toISOString() : v);
        })
        .join(","),
    ),
  ];
  const csv = "\uFEFF" + lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="org-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
