/**
 * Self-paced learning module.
 *
 * Lets students advance to the next day's tasks when today's tasks are done,
 * and take the weekly test early when all week's tasks are complete.
 *
 * Key functions:
 *   - canAdvanceDay(userId): checks if today's tasks are all completed
 *   - advanceDay(userId): advances currentDay (or currentWeek if day 5 done)
 *   - canTakeWeeklyTestEarly(userId): checks if all week's tasks are done
 *   - getSelfPacedStatus(userId): returns the full advancement status
 *
 * Anti-cheat: when a student advances faster than calendar time, the system
 * flags this for teacher review. The flag includes:
 *   - How many days ahead of schedule they are
 *   - Task completion timestamps (to detect impossibly-fast completion)
 *   - Plagiarism scores from recent tests
 *
 * The flag does NOT block advancement — it just alerts the teacher via the
 * attention-score algorithm + audit log.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Days per week (Mon-Fri = 5). Configurable per course in the future. */
const DAYS_PER_WEEK = 5;

/** Minimum task completion time (minutes) — tasks completed faster than this
 *  are flagged as "impossibly fast" for teacher review. */
const MIN_TASK_COMPLETION_MINUTES = 2;

export interface SelfPacedStatus {
  currentWeek: number;
  currentDay: number;
  selfPacedEnabled: boolean;
  todayTasksTotal: number;
  todayTasksCompleted: number;
  canAdvanceDay: boolean;
  canTakeWeeklyTestEarly: boolean;
  weekTasksTotal: number;
  weekTasksCompleted: number;
  daysAheadOfSchedule: number; // 0 = on schedule, positive = ahead
  antiCheatFlags: string[];
}

/** Get the calendar day number (1-5) for today, or null if weekend. */
function getCalendarDay(): number | null {
  const dow = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (dow === 0 || dow === 6) return null; // weekend
  return dow;
}

/** Get the student's full self-paced status. */
export async function getSelfPacedStatus(userId: string): Promise<SelfPacedStatus | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      currentWeek: true,
      currentDay: true,
      selfPacedEnabled: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const weekTasks = await db.projectTask.findMany({
    where: { userId, week: user.currentWeek },
    select: { id: true, status: true, day: true, completedAt: true, createdAt: true },
  });

  const todayTasks = weekTasks.filter(t => t.day === user.currentDay);
  const todayTasksCompleted = todayTasks.filter(t => t.status === "completed").length;
  const weekTasksCompleted = weekTasks.filter(t => t.status === "completed").length;

  // Can advance day if: self-paced enabled + today's tasks all done (or no tasks for today)
  // Day 5 → next week: allowed if all week's tasks are complete
  const allWeekTasksDone = weekTasks.length > 0 && weekTasksCompleted === weekTasks.length;
  const canAdvanceDay = user.selfPacedEnabled &&
    (todayTasks.length === 0 || todayTasksCompleted === todayTasks.length) &&
    (user.currentDay < DAYS_PER_WEEK || (user.currentDay === DAYS_PER_WEEK && allWeekTasksDone));

  const canTakeWeeklyTestEarly = weekTasks.length > 0 && weekTasksCompleted === weekTasks.length;

  const calendarDay = getCalendarDay();
  let daysAheadOfSchedule = 0;
  if (calendarDay !== null) {
    daysAheadOfSchedule = user.currentDay - calendarDay;
    if (daysAheadOfSchedule < 0) daysAheadOfSchedule = 0;
  }

  const antiCheatFlags: string[] = [];

  const fastCompletions = weekTasks.filter(t => {
    if (t.status !== "completed" || !t.completedAt || !t.createdAt) return false;
    const minutes = (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
    return minutes < MIN_TASK_COMPLETION_MINUTES;
  });
  if (fastCompletions.length > 0) {
    antiCheatFlags.push(`${fastCompletions.length} task(s) completed in under ${MIN_TASK_COMPLETION_MINUTES} minutes — review for authenticity`);
  }

  if (daysAheadOfSchedule >= 3) {
    antiCheatFlags.push(`${daysAheadOfSchedule} days ahead of calendar schedule — verify task quality`);
  }

  if (canTakeWeeklyTestEarly && user.currentDay <= 2) {
    antiCheatFlags.push(`All week ${user.currentWeek} tasks completed by day ${user.currentDay} — review for AI-generated content`);
  }

  const recentTest = await db.weeklyTest.findFirst({
    where: { userId, status: "completed" },
    orderBy: { week: "desc" },
    select: { plagiarismScore: true, week: true },
  });
  if (recentTest && recentTest.plagiarismScore && recentTest.plagiarismScore > 50) {
    antiCheatFlags.push(`Week ${recentTest.week} test had plagiarism score ${recentTest.plagiarismScore}/100 — voice inconsistency detected`);
  }

  return {
    currentWeek: user.currentWeek,
    currentDay: user.currentDay,
    selfPacedEnabled: user.selfPacedEnabled,
    todayTasksTotal: todayTasks.length,
    todayTasksCompleted,
    canAdvanceDay,
    canTakeWeeklyTestEarly,
    weekTasksTotal: weekTasks.length,
    weekTasksCompleted,
    daysAheadOfSchedule,
    antiCheatFlags,
  };
}

/** Advance the student to the next day (or next week if day 5 is done). */
export async function advanceDay(userId: string): Promise<{ week: number; day: number } | null> {
  const status = await getSelfPacedStatus(userId);
  if (!status || !status.canAdvanceDay) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currentWeek: true, currentDay: true },
  });
  if (!user) return null;

  let newWeek = user.currentWeek;
  let newDay = user.currentDay + 1;

  if (newDay > DAYS_PER_WEEK) {
    newWeek = user.currentWeek + 1;
    newDay = 1;
  }

  await db.user.update({
    where: { id: userId },
    data: { currentWeek: newWeek, currentDay: newDay },
  });

  logger.info("Student advanced day (self-paced)", {
    userId, fromWeek: user.currentWeek, fromDay: user.currentDay,
    toWeek: newWeek, toDay: newDay,
    daysAhead: status.daysAheadOfSchedule,
  });

  return { week: newWeek, day: newDay };
}

export async function canAdvanceDay(userId: string): Promise<boolean> {
  const status = await getSelfPacedStatus(userId);
  return status?.canAdvanceDay ?? false;
}

export async function canTakeWeeklyTestEarly(userId: string): Promise<boolean> {
  const status = await getSelfPacedStatus(userId);
  return status?.canTakeWeeklyTestEarly ?? false;
}
