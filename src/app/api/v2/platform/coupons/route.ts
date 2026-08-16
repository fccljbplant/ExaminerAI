/**
 * GET/POST /api/v2/platform/coupons — coupon management (2026-08-17)
 * Platform-admin only. Codes are validated at checkout; usage counts
 * increment in the Stripe webhook.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const CreateBody = z.object({
  code: z.string().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Letters, digits, dashes only"),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOff: z.number().positive().optional(),
  courseId: z.string().optional().nullable(),
  orgId: z.string().optional().nullable(),
  maxUses: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
}).refine((b) => b.percentOff !== undefined || b.amountOff !== undefined, {
  message: "percentOff or amountOff is required",
});

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

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { course: { select: { name: true } } },
    take: 100,
  });
  return apiSuccess({
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      percentOff: c.percentOff,
      amountOff: c.amountOff,
      courseId: c.courseId,
      courseName: c.course?.name ?? null,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      active: c.active,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid coupon", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }
  const code = parsed.data.code.toUpperCase();
  const existing = await db.coupon.findUnique({ where: { code } });
  if (existing) return apiError("Code already exists", "ALREADY_EXISTS", 409);

  const coupon = await db.coupon.create({
    data: {
      code,
      percentOff: parsed.data.percentOff ?? null,
      amountOff: parsed.data.amountOff ?? null,
      courseId: parsed.data.courseId ?? null,
      orgId: parsed.data.orgId ?? null,
      maxUses: parsed.data.maxUses ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "coupon_created",
    target: { type: "coupon", id: coupon.id },
    after: { code, percentOff: parsed.data.percentOff, amountOff: parsed.data.amountOff, courseId: parsed.data.courseId ?? null },
    metadata: { source: "platform_coupons" },
    req,
  }).catch(() => {});

  return apiSuccess({ coupon }, 201);
}
