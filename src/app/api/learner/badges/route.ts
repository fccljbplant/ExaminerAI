import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerBadges, getBadgeStats } from "@/lib/learner-badges";
import { BADGES } from "@/lib/learner-badges";

/**
 * GET /api/learner/badges — the learner's earned badges + all available badges.
 *
 * Returns:
 *   - earned: badges the learner has earned (newest first)
 *   - available: all badge definitions (so the UI can show "not yet earned" badges)
 *   - stats: total earned, by tier, latest badge
 *
 * Only accessible by learners.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only learners have badges" }, { status: 403 });
  }

  const [earned, stats] = await Promise.all([
    getLearnerBadges(user.id),
    getBadgeStats(user.id),
  ]);

  return NextResponse.json({
    earned,
    available: BADGES,
    stats,
  });
}
