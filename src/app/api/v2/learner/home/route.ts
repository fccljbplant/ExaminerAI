/**
 * GET /api/v2/learner/home — L1 Home aggregation (REDESIGN-P3 §L1)
 *
 * One request feeds the whole home fold: continue card, learner
 * totals, due-today list and announcements. Fields-selected, no
 * nested entities the page doesn't render.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getLearnerLevel } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  // Enrolled courses = one LearnProfile per (user, course), most recent first.
  // Fallback to empty array if table doesn't exist yet.
  let profiles: any[] = [];
  try {
    profiles = await db.learnProfile.findMany({
      where: { userId: user.sub },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    // LearnProfile table might not exist yet — continue with empty profiles
    console.warn("Could not fetch learn profiles:", e instanceof Error ? e.message : String(e));
  }

  /* ---- continue card: most recently active course ---- */
  let continueCard: {
    courseId: string;
    courseName: string;
    nextLesson: string;
    kind: "learn" | "review" | "done";
    href: string;
  } | null = null;

  if (profiles.length > 0) {
    const p = profiles[0];
    const today = await getTodayTopic(user.sub, p.courseId);
    if (today) {
      continueCard = {
        courseId: p.courseId,
        courseName: p.course.name,
        nextLesson: `Week ${today.topic.week} · Day ${today.topic.day} — ${today.topic.title}`,
        kind: today.completed ? "review" : "learn",
        href: `/learn/${p.courseId}`,
      };
    } else {
      continueCard = {
        courseId: p.courseId,
        courseName: p.course.name,
        nextLesson: "Course complete — revisit any topic",
        kind: "done",
        href: `/learn/${p.courseId}`,
      };
    }
  }

  /* ---- due today: uncompleted daily tests ---- */
  const todayKey = new Date();
  todayKey.setHours(0, 0, 0, 0);
  const dailyTests = await db.learnDailyTest.findMany({
    where: { userId: user.sub, date: todayKey, status: { not: "completed" } },
    include: { course: { select: { name: true } } },
  });
  const dueToday = dailyTests.map((t) => ({
    id: t.id,
    kind: "daily-test" as const,
    title: "Daily check-in",
    meta: t.course.name,
    href: `/learn/${t.courseId}`,
  }));

  /* ---- announcements ---- */
  const announcements = await db.notification.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, title: true, body: true, link: true, read: true, createdAt: true },
  });

  /* ---- learner totals across courses ---- */
  const totalXP = profiles.reduce((sum, p) => sum + p.totalXP, 0);
  const streakCurrent = profiles.reduce((max, p) => Math.max(max, p.streakCurrent), 0);

  return apiSuccess({
    learner: {
      totalXP,
      level: getLearnerLevel(totalXP).name,
      streakCurrent,
      enrolledCount: profiles.length,
    },
    continue: continueCard,
    dueToday,
    announcements,
  });
}
