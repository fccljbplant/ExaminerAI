/**
 * GET /api/users/lookup?email= — staff user lookup (2026-08-17 SaaS support)
 *
 * Returns a compact user card for the platform Support screen. Staff-only;
 * demo accounts are excluded from acting. No sensitive fields beyond what
 * the support UI renders.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return apiUnauthorized();
  if (!isStaffRole(payload.role) || payload.role === "demo") {
    return apiError("Staff access only", "FORBIDDEN", 403);
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return apiError("email is required", "MISSING_FIELD", 400);

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      blocked: true,
      banReason: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  return apiSuccess({
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          blocked: user.blocked,
          banReason: user.banReason,
          lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
          createdAt: user.createdAt.toISOString(),
        }
      : null,
  });
}
