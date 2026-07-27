import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBootcampDayNumber, getBootcampDayLabel, isRestDay, getRestDayLabel } from "@/lib/course-topics";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseProjectConfig } from "@/lib/course-db";

/** GET /api/daily-tasks — today's pending daily tasks for the student.
 *
 *  COURSE-PLAN-CENTRIC OVERHAUL:
 *  Tasks are now driven by the Course Plan, not the Project Plan. Project
 *  tasks are ADDITIONAL, not primary. The response returns a `pendingTasks`
 *  array sorted by priority:
 *
 *    1. Curriculum Alert — today's CourseDay topic not yet engaged with
 *    2. Assignment — if teacher assigned a task (only if exists)
 *    3. Project Task — if hasProject=true and task due today
 *    4. Daily Check-in — if not completed today
 *    5. Daily Test — if not completed today (canCompleteFromList = false)
 *    6. Daily Practice — informational only, no alert badge
 *    7. Weekly Test — if pending (not completed this week) (canCompleteFromList = false)
 *
 *  Task completion rules:
 *    - Curriculum, Assignment, Project Task, Daily Check-in: can be marked
 *      done from the pending list (navigates to the right view).
 *    - Daily Test + Weekly Test: MUST navigate to the test view to complete
 *      (they require the full Socratic pipeline). canCompleteFromList = false.
 *    - Daily Practice: NO alert badge. Informational only.
 *
 *  Alert badge count = number of incomplete items from sources 1–5 + 7.
 *  Daily Practice never contributes to the alert count.
 *
 *  Backward compat: the response ALSO returns the legacy `projectTasks`
 *  array + `hasCheckedInToday`, `hasPracticedToday`, `curriculumCompleted`,
 *  `hasCompletedDailyTestToday` flags so the existing DailyTaskReminder UI
 *  keeps working while we migrate to the new `pendingTasks` shape.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentWeek = user.currentWeek;
  // Self-paced: use the user's currentDay (which advances when they complete tasks)
  // instead of the calendar day. Falls back to calendar day if currentDay is 0 or
  // self-paced is disabled.
  const todayDay = (user.selfPacedEnabled && user.currentDay >= 1 && user.currentDay <= 5)
    ? user.currentDay
    : getBootcampDayNumber(new Date());

  // Fetch project config in parallel with everything else — drives whether the
  // project section of the response is populated at all.
  const projectConfigPromise = getCourseProjectConfig(user.id);

  // Pull this week's project tasks + recent daily logs + today's interactions + curriculum progress + today's daily test + this week's weekly test in parallel
  const [weekTasks, dailyLogs, todayInteractions, curriculumProgress, todaysDailyTest, thisWeeksWeeklyTest, projectConfig] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: user.id, week: currentWeek },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyLog.findMany({
      // FIX: query today's logs by date range (not just by week) so the
      // "hasCheckedInToday" check works even if the week number is wrong.
      where: {
        userId: user.id,
        OR: [
          { week: currentWeek },
          { date: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
        ],
      },
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
    // Course-plan-centric: this week's weekly test status (any test for the
    // current week). Used to determine if the weekly test is pending.
    db.weeklyTest.findFirst({
      where: {
        userId: user.id,
        week: currentWeek,
        status: "completed",
      },
      select: { id: true, status: true, score: true, week: true },
    }),
    projectConfigPromise,
  ]);

  // Project tasks for today: those with day === todayDay, OR those with day === null
  // (unscheduled tasks show up every day so the student doesn't lose track of them).
  // Exclude completed tasks from the "pending" list.
  // When the course has projects DISABLED (or no course assigned), we still return
  // any existing project tasks so the student can finish them — but the UI hides
  // the project section entirely.
  const todayProjectTasks = weekTasks.filter(t => t.day === todayDay || t.day === null);
  const pendingProjectTasks = todayProjectTasks.filter(t => t.status !== "completed");
  const completedToday = todayProjectTasks.filter(t => t.status === "completed").length;

  // Has the student checked in today?
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(todayStr + "T00:00:00.000Z");
  const todayEnd = new Date(todayStr + "T23:59:59.999Z");
  const hasCheckedInToday = dailyLogs.some(l => {
    const logDate = new Date(l.date);
    return logDate >= todayStart && logDate <= todayEnd;
  });

  // Has the student practiced (answered ≥1 practice question) today?
  const hasPracticedToday = todayInteractions.length > 0;

  // Phase Three-Tab Redesign: has the student completed today's daily test?
  const hasCompletedDailyTestToday = todaysDailyTest?.status === "completed";

  // Course-plan-centric: has the student completed this week's weekly test?
  const hasCompletedWeeklyTestThisWeek = !!thisWeeksWeeklyTest;

  // Today's curriculum topic (from the DB course or fallback to hardcoded)
  const weekTopics = await getCourseWeekTopicTitles(user.id, currentWeek);
  const todayTopic = weekTopics[todayDay - 1] || weekTopics[0] || "";

  // Has the student completed today's curriculum day?
  const curriculumCompleted = curriculumProgress.some(p => p.day === todayDay);

  // Has the student completed all 5 curriculum days this week?
  const curriculumCompletedCount = curriculumProgress.length;

  const weeklyTasksTotal = weekTasks.length;
  const weeklyTasksCompleted = weekTasks.filter(t => t.status === "completed").length;

  // ============================================================
  // COURSE-PLAN-CENTRIC: build the priority-ordered pendingTasks array.
  // Each item has: id, type, title, description, completed, canCompleteFromList, action
  // ============================================================
  type PendingTaskType =
    | "curriculum"
    | "assignment"
    | "project"
    | "checkin"
    | "daily-test"
    | "practice"
    | "weekly-test";
  interface PendingTask {
    id: string;
    type: PendingTaskType;
    title: string;
    description: string;
    completed: boolean;
    /** true = can mark done from the pending list (navigates to view).
     *  false = must navigate to the test view to complete (Daily/Weekly Test). */
    canCompleteFromList: boolean;
    /** UI hint: where to navigate when the user clicks "Start" or "Mark done". */
    action: "checkin" | "question" | "gantt" | "daily-test" | "weekly-test" | "course-outline";
    /** Optional link to the course topic (project tasks store this). */
    courseTopicLink?: string | null;
    /** Whether this task contributes to the alert badge count.
     *  Daily Practice is deliberately excluded — it's low-stakes. */
    countsTowardAlert: boolean;
  }
  const pendingTasks: PendingTask[] = [];

  // 1. Curriculum Alert — today's CourseDay topic not yet engaged with
  if (todayTopic && !curriculumCompleted) {
    pendingTasks.push({
      id: `curriculum-${currentWeek}-${todayDay}`,
      type: "curriculum",
      title: todayTopic,
      description: "Today's curriculum topic. Engage with it via AI Tutor or mark complete after studying.",
      completed: false,
      canCompleteFromList: true,
      action: "course-outline",
      countsTowardAlert: true,
    });
  }

  // 2. Assignment — if teacher assigned a task (Phase future — not yet implemented
  //    as a separate model. Skipped for now, but the slot is reserved.)

  // 3. Project Task — if hasProject=true and task due today
  const projectActive = projectConfig.courseAssigned && projectConfig.projectEnabled;
  if (projectActive) {
    for (const t of pendingProjectTasks) {
      pendingTasks.push({
        id: `project-${t.id}`,
        type: "project",
        title: t.description,
        description: t.isMilestone ? "Milestone project task" : "Project task for today",
        completed: false,
        canCompleteFromList: true,
        action: "gantt",
        courseTopicLink: t.taskNotes || null,
        countsTowardAlert: true,
      });
    }
  }

  // 4. Daily Check-in — if not completed today
  if (!hasCheckedInToday) {
    pendingTasks.push({
      id: "checkin-today",
      type: "checkin",
      title: "Daily Check-in",
      description: "Log what you did today to keep your streak alive.",
      completed: false,
      canCompleteFromList: true,
      action: "checkin",
      countsTowardAlert: true,
    });
  }

  // 5. Daily Test — if not completed today (must navigate to test view)
  if (!hasCompletedDailyTestToday) {
    pendingTasks.push({
      id: "daily-test-today",
      type: "daily-test",
      title: "Daily Test",
      description: "3-question check-in to lock in today's concept. Open the test to begin.",
      completed: false,
      canCompleteFromList: false, // must navigate to the test view
      action: "daily-test",
      countsTowardAlert: true,
    });
  }

  // 6. Daily Practice — informational only, NO alert badge
  pendingTasks.push({
    id: "practice-today",
    type: "practice",
    title: "Daily Practice",
    description: hasPracticedToday
      ? `Done — ${todayInteractions.length} question${todayInteractions.length === 1 ? "" : "s"} answered today.`
      : "Optional low-stakes practice. Answer one question to build confidence.",
    completed: hasPracticedToday,
    canCompleteFromList: false, // informational only — no check-off
    action: "question",
    countsTowardAlert: false, // NEVER contributes to alert count
  });

  // 7. Weekly Test — if pending (not completed this week)
  if (!hasCompletedWeeklyTestThisWeek) {
    pendingTasks.push({
      id: `weekly-test-${currentWeek}`,
      type: "weekly-test",
      title: "Weekly Test",
      description: `Week ${currentWeek} exam. Open the test to begin.`,
      completed: false,
      canCompleteFromList: false, // must navigate to the test view
      action: "weekly-test",
      countsTowardAlert: true,
    });
  }

  // Pending count (alert badge) — excludes Daily Practice.
  // When project is disabled, don't count project tasks toward the pending total.
  const pendingCount = pendingTasks
    .filter(t => t.countsTowardAlert && !t.completed)
    .filter(t => t.type !== "project" || projectActive)
    .length;

  // allDone: student has done everything possible today.
  // Daily Practice + Weekly Test don't block "all done" (practice is optional,
  // weekly test is a week-level task not a daily one).
  const allDone = (!projectActive || pendingProjectTasks.length === 0)
    && hasCheckedInToday
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
    hasCompletedWeeklyTestThisWeek,
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
    // Each task includes the courseTopicLink note (from the AI generator) so the UI
    // can show how the task connects to today's course topic.
    projectTasks: pendingProjectTasks.map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      isMilestone: t.isMilestone,
      estimatedMinutes: t.estimatedMinutes,
      courseTopicLink: t.taskNotes || null,
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
    // Course + project config — drives whether the UI renders the project section
    projectConfig,
    // COURSE-PLAN-CENTRIC: priority-ordered pending tasks array.
    // The DailyTaskReminder UI uses this to render the new task list with
    // proper priority (Curriculum → Project → Check-in → Daily Test → Practice → Weekly Test).
    pendingTasks,
  });
}
