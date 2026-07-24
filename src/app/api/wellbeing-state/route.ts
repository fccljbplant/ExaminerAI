import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";

/** GET /api/wellbeing-state?userId=X — current Green/Amber/Red tier for a student. */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const state = await db.wellbeingState.findUnique({
    where: { userId },
    select: { id: true, tier: true, reasonsJson: true, updatedAt: true },
  });
  return NextResponse.json({ state });
}
