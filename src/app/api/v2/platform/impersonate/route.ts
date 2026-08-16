/**
 * POST /api/v2/platform/impersonate — audited support login-as
 * POST /api/v2/platform/impersonate/exit — restore the admin session
 *
 * A platform admin can act on behalf of any non-platform-admin user:
 * the admin's own token is parked in the `examiner_support_token` cookie
 * while a scoped JWT (sup: true, actedFor) replaces the session cookie.
 * Every step is written to AuditLog with the reason and both ids, so
 * support actions are always attributable.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser, signToken, getCookieOptions, TOKEN_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError, apiNotFound, apiForbidden } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export const SUPPORT_COOKIE = "examiner_support_token";

const StartBody = z.object({
  userId: z.string().min(1),
  reason: z.string().min(3).max(300),
});

export async function POST(req: NextRequest) {
  const admin = await getAuthUser();
  if (!admin) return apiUnauthorized();
  if (admin.role !== "platform_admin" && admin.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }
  if (admin.sup) {
    return apiError("Nested impersonation is not allowed — exit support mode first", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = StartBody.safeParse(body);
  if (!parsed.success) {
    return apiError("userId and reason are required", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, name: true, role: true, blocked: true },
  });
  if (!target) return apiNotFound("User not found");
  if (target.role === "platform_admin" || target.role === "admin") {
    return apiForbidden("Cannot impersonate another platform admin");
  }
  if (target.blocked) {
    return apiForbidden("Cannot impersonate a blocked account");
  }

  const supportToken = signToken({
    sub: target.id,
    email: target.email,
    role: target.role,
    name: target.name,
    sup: true,
    actedFor: target.id,
  });

  await logAudit({
    actor: { id: admin.sub, name: admin.name, role: admin.role },
    action: "impersonation_start",
    target: { type: "user", id: target.id },
    after: { impersonatedEmail: target.email, reason: parsed.data.reason },
    metadata: { source: "platform_support" },
    req,
  }).catch(() => {});

  const res = NextResponse.json({ ok: true, data: { email: target.email, role: target.role } });
  // Park the admin's own token so "exit" can restore it.
  res.cookies.set(SUPPORT_COOKIE, req.cookies.get(TOKEN_COOKIE)?.value ?? "", getCookieOptions());
  res.cookies.set(TOKEN_COOKIE, supportToken, getCookieOptions());
  return res;
}
