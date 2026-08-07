import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";

/**
 * GET /api/student/streak-calendar — auth required (student).
 *
 * Returns the student's daily study activity for the last 12 weeks (84 days):
 *   - days: [{ date: "YYYY-MM-DD", count: number, level: 0|1|2|3 }]
 *   - totalActiveDays
 *   - currentStreak (consecutive days up to today with ≥1 activity)
 *   - longestStreak (longest run of active days in the window)
 *   - totalActivities (sum of all activity counts)
 *
 * Data sources (each contributes 1 to the day's count):
 *   - DailyLog      — daily check-ins
 *   - DailyTest     — daily tests (any status — taking a test counts as activity)
 *   - WeeklyTest    — weekly tests with completedAt set
 *   - ProjectTask   — project tasks created (planned/in-progress counts as activity)
 *   - Interaction   — practice questions / Socratic interactions
 *
 * `level` is bucketed:
 *   0: count = 0
 *   1: count = 1
 *   2: count = 2-3
 *   3: count = 4+
 */

const DAY_COUNT = 84; // 12 weeks

function toDateString(d: Date): string {
  // YYYY-MM-DD in local time (the student's local day matters for streaks).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateOnly(d: Date): Date {
  // Truncate to local midnight.
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function computeLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Allow any auth'd user — instructors/admins viewing their own streak is fine.
  // (For viewing other students' streaks, the instructor portfolio page would
  // need its own endpoint with proper authorization.)
  const role = normalizeRole(payload.role);
  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 403 });
  }

  const userId = payload.sub;

  // Compute the date window: [today - 83 days, today] inclusive (84 days).
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const startDate = new Date(todayEnd);
  startDate.setDate(startDate.getDate() - (DAY_COUNT - 1));
  startDate.setHours(0, 0, 0, 0);

  // Run all the per-source queries in parallel — each returns a list of dates
  // (as JS Date objects). We group them ourselves to keep the queries simple.
  const [dailyLogs, dailyTests, weeklyTests, projectTasks, interactions] =
    await Promise.all([
      db.dailyLog.findMany({
        where: { userId, date: { gte: startDate, lte: todayEnd } },
        select: { date: true },
      }),
      db.dailyTest.findMany({
        where: { userId, date: { gte: startDate, lte: todayEnd } },
        select: { date: true },
      }),
      db.weeklyTest.findMany({
        where: {
          userId,
          completedAt: { gte: startDate, lte: todayEnd },
        },
        select: { completedAt: true },
      }),
      db.projectTask.findMany({
        where: {
          userId,
          createdAt: { gte: startDate, lte: todayEnd },
        },
        select: { createdAt: true },
      }),
      db.interaction.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: todayEnd },
        },
        select: { date: true },
      }),
    ]);

  // Build a Map<dateString, number> of counts per day.
  const countsByDate = new Map<string, number>();

  const bump = (d: Date | null | undefined) => {
    if (!d) return;
    const key = toDateString(d);
    countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
  };

  for (const r of dailyLogs) bump(r.date);
  for (const r of dailyTests) bump(r.date);
  for (const r of weeklyTests) bump(r.completedAt);
  for (const r of projectTasks) bump(r.createdAt);
  for (const r of interactions) bump(r.date);

  // Build the 84-day array, oldest-first.
  const days: Array<{ date: string; count: number; level: 0 | 1 | 2 | 3 }> = [];
  let totalActiveDays = 0;
  let totalActivities = 0;
  for (let i = DAY_COUNT - 1; i >= 0; i--) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + (DAY_COUNT - 1 - i));
    const key = toDateString(d);
    const count = countsByDate.get(key) ?? 0;
    if (count > 0) {
      totalActiveDays += 1;
      totalActivities += count;
    }
    days.push({ date: key, count, level: computeLevel(count) });
  }

  // Compute current streak: walk back from today (last day in the array)
  // until we find a day with count === 0.
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak += 1;
    else break;
  }

  // Compute longest streak in the window.
  let longestStreak = 0;
  let running = 0;
  for (const d of days) {
    if (d.count > 0) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 0;
    }
  }

  // Note: unused-var lint suppression — dateOnly is intentionally kept for
  // callers that want exact-day comparison helpers later.
  void dateOnly;

  return NextResponse.json({
    days,
    totalActiveDays,
    currentStreak,
    longestStreak,
    totalActivities,
  });
}
