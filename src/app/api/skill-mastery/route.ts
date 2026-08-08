import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { assertCanAccessStudent } from "@/lib/auth";

/** GET /api/skill-mastery?userId=X — per-topic mastery for a student.
 *
 *  Phase Three-Tab Redesign (Educational tab).
 *
 *  Returns persisted SkillMastery rows if they exist. Otherwise, computes
 *  mastery on-the-fly from existing Interaction data — aggregates correctness
 *  per topic over time. This is what turns "week 3: 68%" into "database
 *  queries: developing, custom post types: proficient" — actionable
 *  specificity a teacher can act on.
 *
 *  Mastery thresholds:
 *    avg >= 90 → "mastered"
 *    avg >= 75 → "proficient"
 *    avg >= 50 → "developing"
 *    else      → "not-started"
 *
 *  Trend:
 *    last - first > 10  → "improving"
 *    last - first < -10 → "declining"
 *    else               → "stable"
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO,
  ]);
  if (!auth.ok) return auth.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // IDOR protection
  try { await assertCanAccessStudent(auth.ctx.payload, userId); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
  }

  try {
    // 1. Try persisted SkillMastery rows first
    let mastery = await db.skillMastery.findMany({
      where: { userId },
      select: { id: true, topic: true, pillar: true, masteryLevel: true, evidenceCount: true, lastAssessedWeek: true, trend: true },
    });

    // 2. If none, compute on-the-fly from interactions
    if (mastery.length === 0) {
      const interactions = await db.interaction.findMany({
        where: { userId },
        select: { topic: true, pillar: true, correctness: true, week: true, date: true },
        orderBy: { date: "asc" },
      });

      // Group by topic
      const byTopic = new Map<string, typeof interactions>();
      for (const i of interactions) {
        const arr = byTopic.get(i.topic) || [];
        arr.push(i);
        byTopic.set(i.topic, arr);
      }

      mastery = Array.from(byTopic.entries()).map(([topic, items]) => {
        const avg = items.reduce((a, i) => a + i.correctness, 0) / items.length;
        const masteryLevel = avg >= 90 ? "mastered" : avg >= 75 ? "proficient" : avg >= 50 ? "developing" : "not-started";
        const first = items[0]?.correctness ?? 0;
        const last = items[items.length - 1]?.correctness ?? 0;
        const trend = last - first > 10 ? "improving" : last - first < -10 ? "declining" : "stable";
        return {
          id: `computed-${topic}`,
          topic,
          pillar: items[0]?.pillar || "Uncategorized",
          masteryLevel,
          evidenceCount: items.length,
          lastAssessedWeek: items[items.length - 1]?.week ?? null,
          trend,
        };
      });
    }

    return NextResponse.json({ mastery });
  } catch (err) {
    logger.error("Skill mastery query failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch skill mastery" }, { status: 500 });
  }
}
