/**
 * GET /api/v2/platform/audit/export — server-side CSV export of the
 * global audit feed (2026-08-17). Previously exports were client-side
 * only (browser-triggered download); this endpoint gives operators a
 * scriptable, server-generated export with proper headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { db } from "@/lib/db";

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
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const action = req.nextUrl.searchParams.get("action")?.trim() || undefined;
  const rows = await db.auditLog.findMany({
    where: action ? { action } : undefined,
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
  const csv = "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
