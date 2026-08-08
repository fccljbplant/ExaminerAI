import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBootcampDayNumber } from "@/lib/course-topics";
import { getCourseTopics, getCourseDurationWeeks } from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/curriculum/progress — returns the student's curriculum completion.
 *
 *  Returns:
 *  - weeks: array of { week, phase, days: [{ day, topic, objective, resources, isCompleted }] }
 *  - completionByWeek: { 1: { completed, total, percent }, ... }
 *  - overallCompletion: { completed, total, percent }
 *  - currentWeek: number
 *  - todayDay: number (1-5, based on day of week)
 *  - todayTopic: DailyTopic for today
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fullUser, progress] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { currentWeek: true },
    }),
    db.curriculumProgress.findMany({
      where: { userId: user.id },
      select: { week: true, day: true, completedAt: true },
    }),
  ]);

  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Load course outline from DB (or fallback to hardcoded)
  const courseTopics = await getCourseTopics(user.id);

  // Build a set of completed "week:day" keys for fast lookup
  const completedSet = new Set(progress.map(p => `${p.week}:${p.day}`));

  // Map JS day-of-week to bootcamp day number (1-5) via shared helper
  const todayDay = getBootcampDayNumber(new Date());

  // Build the full curriculum with completion flags
  const weeks = courseTopics.map(weekTopic => ({
    week: weekTopic.week,
    phase: weekTopic.phase,
    days: weekTopic.topics.map((topic, idx) => ({
      day: (topic as { day?: number }).day || idx + 1,
      title: topic.title,
      objective: topic.objective,
      resources: topic.resources,
      isCompleted: completedSet.has(`${weekTopic.week}:${idx + 1}`),
    })),
  }));

  // Completion stats per week
  const completionByWeek: Record<number, { completed: number; total: number; percent: number }> = {};
  for (const w of weeks) {
    const completed = w.days.filter(d => d.isCompleted).length;
    const total = w.days.length;
    completionByWeek[w.week] = {
      completed, total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  // Overall completion
  const totalDays = weeks.reduce((acc, w) => acc + w.days.length, 0);
  const validKeys = new Set<string>();
  for (const w of weeks) { for (const d of w.days) { validKeys.add(`${w.week}:${d.day}`); } }
  const validCompleted = progress.filter(p => validKeys.has(`${p.week}:${p.day}`));
  const completedDays = validCompleted.length;
  const overallPercent = totalDays > 0 ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0;

  // Today's topic
  const currentWeekTopics = courseTopics.find(w => w.week === fullUser.currentWeek);
  const todayTopic = currentWeekTopics?.topics[todayDay - 1] || null;

  return NextResponse.json({
    weeks,
    completionByWeek,
    overallCompletion: { completed: completedDays, total: totalDays, percent: overallPercent },
    currentWeek: fullUser.currentWeek,
    todayDay,
    todayTopic,
  });
}

/** POST /api/curriculum/progress — mark a curriculum day as complete.
 *  Body: { week: number (1..courseDuration), day: number (1-5) }
 *  Idempotent — if already marked, returns success. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("updating curriculum progress"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const week = Number(body.week);
  const day = Number(body.day);

  const totalWeeks = await getCourseDurationWeeks(user.id);
  if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `week must be 1-${totalWeeks}` }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    return NextResponse.json({ error: "day must be 1-7" }, { status: 400 });
  }

  // upsert — unique constraint on (userId, week, day)
  await db.curriculumProgress.upsert({
    where: { userId_week_day: { userId: user.id, week, day } },
    create: { userId: user.id, week, day },
    update: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true, week, day, completedAt: new Date().toISOString() });
}

/** DELETE /api/curriculum/progress — unmark a curriculum day.
 *  Body: { week: number, day: number } */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("updating curriculum progress"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const week = Number(body.week);
  const day = Number(body.day);

  const totalWeeks = await getCourseDurationWeeks(user.id);
  if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `week must be 1-${totalWeeks}` }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    return NextResponse.json({ error: "day must be 1-7" }, { status: 400 });
  }

  await db.curriculumProgress.deleteMany({
    where: { userId: user.id, week, day },
  });

  return NextResponse.json({ ok: true });
}
