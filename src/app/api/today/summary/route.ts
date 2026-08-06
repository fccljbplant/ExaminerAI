import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordLearningSignal } from "@/lib/learning-signal";

/** GET /api/today/summary — the trainee's "what do I do next?" data.
 *
 *  Returns everything TodayView needs in one round-trip:
 *  - traineeName, week, day, streakDays
 *  - learningSignal (transparent 0-100 from scores + completion + activity)
 *  - nextAction (the single most important thing to do right now)
 *  - dueDrills (count of DrillCard rows due for spaced repetition)
 *  - mentorMessage (latest unread message from instructor, if any)
 *
 *  Priority for nextAction:
 *  1. Incomplete daily test for today → resume it
 *  2. Due drill cards → practice them
 *  3. Pending project task → work on it
 *  4. Weekly test available (if it's Friday/last day of week) → take it
 *  5. Default: "Continue with today's lesson"
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only trainees have a Today view" }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Run all queries in parallel for speed
  const [todayDailyTest, dueDrills, pendingTasks, weeklyTestAvailable, latestMessage, streakData, learningSignal] = await Promise.all([
    // 1. Today's daily test (if any)
    db.dailyTest.findFirst({
      where: { userId: user.id, date: { gte: startOfToday } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, currentQuestion: true, topic: true },
    }),

    // 2. Due drill cards (spaced repetition)
    db.drillCard.count({
      where: {
        userId: user.id,
        dueAt: { lte: now },
        masteredAt: null,
      },
    }),

    // 3. Pending project tasks (not completed, current week)
    db.projectTask.findFirst({
      where: {
        userId: user.id,
        status: { not: "completed" },
        week: user.currentWeek ?? 1,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, description: true, week: true, day: true },
    }),

    // 4. Weekly test availability (if student hasn't taken this week's test yet)
    db.weeklyTest.findFirst({
      where: { userId: user.id, week: user.currentWeek ?? 1 },
      select: { id: true, status: true },
    }),

    // 5. Latest unread mentor message
    db.message.findFirst({
      where: {
        toId: user.id,
        isRead: false,
        from: { role: { in: ["instructor", "coordinator", "institution_admin", "platform_admin"] } },
      },
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        body: true,
        sentAt: true,
        from: { select: { name: true } },
      },
    }),

    // 6. Streak: daily log dates for last 30 days
    db.dailyLog.findMany({
      where: { userId: user.id, date: { gte: new Date(now.getTime() - 30 * 86400_000) } },
      select: { date: true },
      orderBy: { date: "desc" },
      distinct: ["date"],
    }),

    // 7. Transparent learning signal (non-blocking — if it fails, return null)
    recordLearningSignal(user.id).catch(() => null),
  ]);

  // Compute streak from the daily log dates
  const streakDays = computeStreak(streakData.map((d) => new Date(d.date)));

  // Determine nextAction based on priority
  let nextAction: { kind: "daily-test" | "drill" | "project-task" | "weekly-test" | "lesson"; title: string; meta: string };

  if (todayDailyTest && todayDailyTest.status === "in_progress") {
    nextAction = {
      kind: "daily-test",
      title: `Resume your daily test — ${todayDailyTest.topic || "today's topic"}`,
      meta: `Question ${(todayDailyTest.currentQuestion ?? 0) + 1} of 3`,
    };
  } else if (dueDrills > 0) {
    nextAction = {
      kind: "drill",
      title: `${dueDrills} drill${dueDrills === 1 ? "" : "s"} due for practice`,
      meta: "Wrong answers come back until you own them",
    };
  } else if (pendingTasks) {
    nextAction = {
      kind: "project-task",
      title: "Work on your capstone project",
      meta: pendingTasks.description?.slice(0, 80) || `Week ${pendingTasks.week} task`,
    };
  } else if (weeklyTestAvailable && weeklyTestAvailable.status !== "completed") {
    nextAction = {
      kind: "weekly-test",
      title: "Take your weekly test",
      meta: `Week ${user.currentWeek ?? 1} assessment`,
    };
  } else if (!todayDailyTest) {
    nextAction = {
      kind: "daily-test",
      title: "Start today's daily test",
      meta: "3 quick Socratic questions to check your understanding",
    };
  } else {
    nextAction = {
      kind: "lesson",
      title: "Continue with today's lesson",
      meta: `Week ${user.currentWeek ?? 1}, Day ${user.currentDay ?? 1}`,
    };
  }

  return NextResponse.json({
    traineeName: user.name,
    week: user.currentWeek ?? 1,
    day: user.currentDay ?? 1,
    streakDays,
    learningSignal: learningSignal ?? null,
    nextAction,
    dueDrills,
    mentorMessage: latestMessage
      ? {
          from: latestMessage.from?.name ?? "Instructor",
          preview: (latestMessage.body ?? "").slice(0, 120),
          unread: true,
        }
      : null,
  });
}

/** Compute the current streak: count consecutive days with activity,
 *  ending today or yesterday. If the most recent log is older than yesterday,
 *  the streak is 0. */
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  // Normalize to date-only (midnight UTC) and dedupe
  const daySet = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  const sortedDays = Array.from(daySet).sort().reverse();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400_000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Streak must include today or yesterday to be active
  if (sortedDays[0] !== todayStr && sortedDays[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const curr = new Date(sortedDays[i] + "T00:00:00Z");
    const prev = new Date(sortedDays[i + 1] + "T00:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400_000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
