/**
 * GET /api/v2/platform/audit — P6 Global audit (REDESIGN-P4 §2 P6, W7)
 *
 * Global AuditLog feed with action filter + cursor pagination — the
 * org audit scoped up to the whole platform.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

export const runtime = "nodejs";

const Query = z.object({
  action: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError("Invalid query parameters", "VALIDATION_ERROR", 400);
  }

  const limit = parsed.data.limit ?? 20;
  const rows = await db.auditLog.findMany({
    where: parsed.data.action ? { action: parsed.data.action } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    take: limit,
    select: {
      id: true,
      actorName: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      createdAt: true,
    },
  });

  return apiSuccess({
    items: rows.map((r) => ({
      id: r.id,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
  });
}
