import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBootcampDayNumber, getBootcampDayLabel, isRestDay, getRestDayLabel } from "@/lib/course-topics";
import { getCourseWeekTopicTitles, getCourseWeekPhase } from "@/lib/course-db";

/** GET /api/daily-tasks — today's pending daily tasks for the student.
 *
 *  Returns BOTH curriculum and project tasks SEPARATELY (clear distinction):
 *  - curriculumTopic: { title, objective, resources } for today's curriculum day
 *  - curriculumCompleted: whether the student marked today's curriculum day done
 *  - projectTasks: this week's project tasks for today's day number (via the `day`
 *    column, NOT regex) that are NOT completed. Also includes any tasks for the
 *    current week where day is null (unscheduled) so the student still sees them.
 *  - hasCheckedInToday, hasPracticedToday: booleans
 *
 *  The "Today's day" is determined by the day of week via getBootcampDayNumber.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentWeek = user.currentWeek;
  const todayDay = getBootcampDayNumber(new Date());

  // Pull this week's project tasks + recent daily logs + today's interactions + curriculum progress + today's daily test in parallel
  const [weekTasks, dailyLogs, todayInteractions, curriculumProgress, todaysDailyTest] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: user.id, week: currentWeek },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyLog.findMany({
      where: { userId: user.id, week: currentWeek },
      orderBy: { date: "desc" },
    }),
    db.interaction.findMany({
      where: {
        userId: user.id,
        // Interactions from "today" — compare ISO date strings (YYYY-MM-DD)
        // so timezone doesn't matter.
        date: { gte: new Date(new Date().toISOString().slice(0, 10)) },
      },
      select: { id: true, topic: true, correctness: true, pillar: true },
    }),
    db.curriculumProgress.findMany({
      where: { userId: user.id, week: currentWeek },
      select: { week: true, day: true, completedAt: true },
    }),
    // Phase Three-Tab Redesign: include today's daily test status
    db.dailyTest.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: new Date(new Date().toISOString().slice(0, 10)),
          lt: new Date(new Date(new Date().toISOString().slice(0, 10)).getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, status: true, score: true, topic: true },
    }),
  ]);

  // Project tasks for today: those with day === todayDay, OR those with day === null
  // (unscheduled tasks show up every day so the student doesn't lose track of them).
  // Exclude completed tasks from the "pending" list.
  const todayProjectTasks = weekTasks.filter(t => t.day === todayDay || t.day === null);
  const pendingProjectTasks = todayProjectTasks.filter(t => t.status !== "completed");
  const completedToday = todayProjectTasks.filter(t => t.status === "completed").length;

  // Has the student checked in today?
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasCheckedInToday = dailyLogs.some(l => new Date(l.date).toISOString().slice(0, 10) === todayStr);

  // Has the student practiced (answered ≥1 practice question) today?
  const hasPracticedToday = todayInteractions.length > 0;

  // Phase Three-Tab Redesign: has the student completed today's daily test?
  const hasCompletedDailyTestToday = todaysDailyTest?.status === "completed";

  // Today's curriculum topic (from the DB course or fallback to hardcoded)
  const weekTopics = await getCourseWeekTopicTitles(user.id, currentWeek);
  const todayTopic = weekTopics[todayDay - 1] || weekTopics[0] || "";

  // Has the student completed today's curriculum day?
  const curriculumCompleted = curriculumProgress.some(p => p.day === todayDay);

  // Has the student completed all 5 curriculum days this week?
  const curriculumCompletedCount = curriculumProgress.length;

  const weeklyTasksTotal = weekTasks.length;
  const weeklyTasksCompleted = weekTasks.filter(t => t.status === "completed").length;

  // Pending count: project tasks for today + check-in + practice + curriculum day + daily test
  const pendingCount = pendingProjectTasks.length
    + (hasCheckedInToday ? 0 : 1)
    + (hasPracticedToday ? 0 : 1)
    + (curriculumCompleted ? 0 : 1)
    + (hasCompletedDailyTestToday ? 0 : 1);

  // allDone: student has done everything possible today.
  const allDone = pendingProjectTasks.length === 0
    && hasCheckedInToday
    && hasPracticedToday
    && curriculumCompleted
    && hasCompletedDailyTestToday;

  return NextResponse.json({
    currentWeek,
    todayDay,
    todayDayLabel: getBootcampDayLabel(todayDay),
    todayTopic,
    weekPhase: await getCourseWeekPhase(user.id, currentWeek),
    hasCheckedInToday,
    hasPracticedToday,
    hasCompletedDailyTestToday,
    todaysDailyTest: todaysDailyTest ? {
      id: todaysDailyTest.id,
      status: todaysDailyTest.status,
      score: todaysDailyTest.score,
      topic: todaysDailyTest.topic,
    } : null,
    curriculumCompleted,
    curriculumCompletedCount,
    todayPracticeCount: todayInteractions.length,
    // PROJECT tasks (student's custom tasks for today — using the `day` column, not regex)
    projectTasks: pendingProjectTasks.map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      isMilestone: t.isMilestone,
      estimatedMinutes: t.estimatedMinutes,
    })),
    todayProjectTasksTotal: todayProjectTasks.length,
    todayProjectTasksCompleted: completedToday,
    weeklyTasksTotal,
    weeklyTasksCompleted,
    pendingCount,
    allDone,
    // Phase 1.5: rest-day flag. When true, the UI shows a "rest day" message
    // instead of pending tasks. Rest days don't count against the streak.
    isRestDay: isRestDay(),
    restDayLabel: getRestDayLabel(),
  });
}
