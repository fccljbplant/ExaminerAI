/**
 * PATCH/DELETE /api/v2/platform/coupons/[id] — toggle active / delete.
 * Platform-admin only, audited (2026-08-17).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError, apiNotFound } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const PatchBody = z.object({ active: z.boolean() });

async function requirePlatformAdmin() {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized() };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403) };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403) };
  }
  return { user };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return apiError("active boolean required", "VALIDATION_ERROR", 400);

  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return apiNotFound("Coupon not found");

  const coupon = await db.coupon.update({ where: { id }, data: { active: parsed.data.active } });
  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "coupon_updated",
    target: { type: "coupon", id },
    after: { active: parsed.data.active },
    metadata: { source: "platform_coupons" },
    req,
  }).catch(() => {});
  return apiSuccess({ coupon: { id: coupon.id, active: coupon.active } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return apiNotFound("Coupon not found");

  await db.coupon.delete({ where: { id } });
  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "coupon_deleted",
    target: { type: "coupon", id },
    after: { code: existing.code },
    metadata: { source: "platform_coupons" },
    req,
  }).catch(() => {});
  return apiSuccess({ deleted: true });
}
