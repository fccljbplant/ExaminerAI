/**
 * GET /api/v2/exams — L8 Exams schedule (REDESIGN-P3 §L8)
 *
 * One timeline of assessments for the learner:
 *  - today's daily check-ins (LearnDailyTest, uncompleted)
 *  - past & in-progress weekly tests (LearnWeeklyTest)
 *  - synthesized "ready to take" weekly test for the current week of
 *    every enrolled course that has no test row yet.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const todayKey = new Date();
  todayKey.setHours(0, 0, 0, 0);

  const [dailyTests, weeklyTests, profiles] = await Promise.all([
    db.learnDailyTest.findMany({
      where: { userId: user.sub, date: todayKey, status: { not: "completed" } },
      include: { course: { select: { id: true, name: true } } },
    }),
    db.learnWeeklyTest.findMany({
      where: { userId: user.sub },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
    }),
    db.learnProfile.findMany({
      where: { userId: user.sub },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  /* ---- due today ---- */
  const dueToday = dailyTests.map((t) => ({
    id: t.id,
    kind: "daily-test" as const,
    status: t.status,
    week: null as number | null,
    courseName: t.course.name,
    score: t.score,
    href: `/learn/${t.courseId}`,
  }));

  /* ---- history + in-progress weekly tests ---- */
  const taken = weeklyTests.map((t) => ({
    id: t.id,
    kind: "weekly-test" as const,
    status: t.status,
    week: t.week,
    courseName: t.course.name,
    score: t.score,
    completedAt: t.completedAt,
    href: `/learn/${t.courseId}`,
  }));

  /* ---- synthesized: current week of each enrolled course with no row ---- */
  const ready: {
    id: string;
    kind: "weekly-test";
    status: "ready";
    week: number;
    courseName: string;
    score: number | null;
    href: string;
  }[] = [];
  for (const p of profiles) {
    const current = readPosition(p.masteryMap);
    if (!current) continue;
    const exists = weeklyTests.some((t) => t.courseId === p.courseId && t.week === current.week);
    if (exists) continue;
    ready.push({
      id: `ready-${p.courseId}-w${current.week}`,
      kind: "weekly-test" as const,
      status: "ready" as const,
      week: current.week,
      courseName: p.course.name,
      score: null as number | null,
      href: `/learn/${p.courseId}`,
    });
  }

  return apiSuccess({ dueToday, ready, taken });
}

function readPosition(masteryMap: unknown): { week: number; day: number } | null {
  if (!masteryMap) return null;
  const m = masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } };
  const cur = m.topicProgress?.current;
  return cur?.week ? { week: cur.week, day: cur.day ?? 1 } : null;
}
