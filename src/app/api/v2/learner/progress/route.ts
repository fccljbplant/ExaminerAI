/**
 * GET /api/v2/learner/progress — L11 Progress (REDESIGN-P3 §L11)
 *
 * Per-course progress rings, streaks, a 14-day XP activity strip,
 * badges, credentials and weak topics — one request for the page.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getLearnerLevel } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

const ACTIVITY_DAYS = 14;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const [profiles, ledger, badges, certificates, skills] = await Promise.all([
    db.learnProfile.findMany({
      where: { userId: user.sub },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.xPLedger.findMany({
      where: { userId: user.sub, createdAt: { gte: daysAgo(ACTIVITY_DAYS) } },
      select: { amount: true, createdAt: true },
    }),
    db.userBadge.findMany({
      where: { userId: user.sub },
      include: { badge: { select: { code: true, name: true, description: true, icon: true, rarity: true } } },
      orderBy: { awardedAt: "desc" },
      take: 12,
    }),
    db.certificate.findMany({
      where: { userId: user.sub },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true, courseName: true, grade: true, score: true,
        credentialId: true, distinction: true, issuedAt: true,
      },
    }),
    db.skillMastery.findMany({
      where: { userId: user.sub, masteryLevel: { in: ["developing", "not-started"] } },
      select: { topic: true, pillar: true, masteryLevel: true, trend: true },
      take: 6,
    }),
  ]);

  // Week counts per course for ring denominators.
  const courseIds = profiles.map((p) => p.courseId);
  const weekCounts = await db.courseWeek.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds } },
    _count: { weekNumber: true },
  });
  const weeksByCourse = new Map(weekCounts.map((w) => [w.courseId, w._count.weekNumber]));

  /* ---- per-course rings ---- */
  const courses = profiles.map((p) => {
    const pos = readPosition(p.masteryMap);
    const totalWeeks = weeksByCourse.get(p.courseId) ?? 0;
    const percent = ringPercent(pos, totalWeeks);
    return {
      courseId: p.courseId,
      courseName: p.course.name,
      percent,
      position: pos,
      totalWeeks,
      totalXP: p.totalXP,
      streakCurrent: p.streakCurrent,
    };
  });

  /* ---- learner totals ---- */
  const totalXP = profiles.reduce((sum, p) => sum + p.totalXP, 0);
  const streakCurrent = profiles.reduce((max, p) => Math.max(max, p.streakCurrent), 0);
  const streakLongest = profiles.reduce((max, p) => Math.max(max, p.streakLongest), 0);

  /* ---- 14-day XP strip (zero-filled, oldest first) ---- */
  const activity: { date: string; xp: number }[] = [];
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const day = daysAgo(i);
    const next = daysAgo(i - 1);
    const xp = ledger
      .filter((e) => e.createdAt >= day && e.createdAt < next)
      .reduce((sum, e) => sum + e.amount, 0);
    activity.push({ date: day.toISOString().slice(0, 10), xp });
  }

  return apiSuccess({
    learner: {
      totalXP,
      level: getLearnerLevel(totalXP).name,
      streakCurrent,
      streakLongest,
    },
    courses,
    activity,
    badges: badges.map((b) => ({
      id: b.id,
      awardedAt: b.awardedAt,
      ...b.badge,
    })),
    certificates,
    weakTopics: skills,
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function readPosition(masteryMap: unknown): { week: number; day: number } | null {
  if (!masteryMap) return null;
  const m = masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } };
  const cur = m.topicProgress?.current;
  return cur?.week ? { week: cur.week, day: cur.day ?? 1 } : null;
}

/** Coarse ring: days completed before the current position / total days. */
function ringPercent(pos: { week: number; day: number } | null, totalWeeks: number): number {
  if (!pos || totalWeeks <= 0) return 0;
  const totalDays = totalWeeks * 7;
  const completedDays = (pos.week - 1) * 7 + (pos.day - 1);
  return Math.min(100, Math.round((completedDays / totalDays) * 100));
}
