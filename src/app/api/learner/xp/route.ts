import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerXP } from "@/lib/learner-xp";

/**
 * GET /api/learner/xp — the learner's current XP, level, and progress.
 *
 * Returns: { total, level, progress, recentAwards }
 *
 * Only accessible by learners (not mentors/admins — XP is a learner-
 * facing trust signal, not a metric for staff to gamify).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only learners have XP" }, { status: 403 });
  }

  const xp = await getLearnerXP(user.id);
  return NextResponse.json(xp);
}
