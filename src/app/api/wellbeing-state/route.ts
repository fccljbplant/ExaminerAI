import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, normalizeTier } from "@/lib/rbac";
import { assertCanAccessStudent } from "@/lib/auth";

/** GET /api/wellbeing-state?userId=X — current Green/Amber/Red tier for a student.
 *  IDOR protected: caller must have batch access to the student. */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.TEACHING_ASSISTANT, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO,
  ]);
  if (!auth.ok) return auth.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // IDOR protection
  try { await assertCanAccessStudent(auth.ctx.payload, userId); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const state = await db.wellbeingState.findUnique({
    where: { userId },
    select: { id: true, tier: true, reasonsJson: true, updatedAt: true },
  });
  // Normalize legacy "amber" → "warning" for backward compat
  if (state) {
    state.tier = normalizeTier(state.tier) as any;
  }
  return NextResponse.json({ state });
}
