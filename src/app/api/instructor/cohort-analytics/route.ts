import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES, normalizeRole } from "@/lib/rbac";

/**
 * GET /api/instructor/cohort-analytics
 *
 * Instructor-facing analytics for a course cohort — academic signals only.
 *
 * Query:
 *   ?courseId=<id>  (optional) — scopes to one course. If omitted, uses the
 *                  instructor's first active course.
 *
 * Returns:
 *   - totalStudents, activeThisWeek, avgScore (+ trend), completionRate
 *   - studentsNeedingAttention count
 *   - topicDifficulty (Interaction topics, hardest first)
 *   - weeklyProgress (per-week completion rate + avg score)
 *   - topPerformers / studentsAtRisk lists
 *
 * Auth: instructor / org_admin / platform_admin / demo only.
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const normalized = normalizeRole(payload.role);
  const isInstructor = normalized === "instructor";
  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  if (!isInstructor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden — staff access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  let courseId = url.searchParams.get("courseId");

  // If no courseId provided, use the instructor's first assigned course.
  if (!courseId) {
    if (normalized === "instructor") {
      const enr = await db.courseEnrollment.findFirst({
        where: { userId: payload.sub, role: "instructor" },
        orderBy: { enrolledAt: "asc" },
        select: { courseId: true },
      });
      if (!enr) {
        return NextResponse.json({
          totalStudents: 0,
          activeThisWeek: 0,
          avgScore: 0,
          avgScoreTrend: "steady",
          completionRate: 0,
          studentsNeedingAttention: 0,
          topicDifficulty: [],
          weeklyProgress: [],
          topPerformers: [],
          studentsAtRisk: [],
        });
      }
      courseId = enr.courseId;
    } else {
      // Org admin / platform admin without explicit courseId — pick any active course.
      const c = await db.course.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!c) {
        return NextResponse.json({
          totalStudents: 0,
          activeThisWeek: 0,
          avgScore: 0,
          avgScoreTrend: "steady",
          completionRate: 0,
          studentsNeedingAttention: 0,
          topicDifficulty: [],
          weeklyProgress: [],
          topPerformers: [],
          studentsAtRisk: [],
        });
      }
      courseId = c.id;
    }
  } else {
    // If an instructor provided a courseId, verify they teach it.
    if (normalized === "instructor" || payload.role === "instructor") {
      const enr = await db.courseEnrollment.findFirst({
        where: { userId: payload.sub, courseId, role: "instructor" },
        select: { id: true },
      });
      if (!enr) {
        return NextResponse.json({ error: "You are not assigned to this course" }, { status: 403 });
      }
    }
  }

  // Verify the course exists.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, durationWeeks: true, projectDefaultDurationWeeks: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Pull all students enrolled in the course.
  const enrollments = await db.courseEnrollment.findMany({
    where: { courseId, role: "student" },
    select: { userId: true },
  });
  const studentIds = [...new Set(enrollments.map((e) => e.userId))];
  const totalStudents = studentIds.length;

  if (totalStudents === 0) {
    return NextResponse.json({
      totalStudents: 0,
      activeThisWeek: 0,
      avgScore: 0,
      avgScoreTrend: "steady",
      completionRate: 0,
      studentsNeedingAttention: 0,
      topicDifficulty: [],
      weeklyProgress: [],
      topPerformers: [],
      studentsAtRisk: [],
    });
  }

  // Fetch all the academic signals in parallel.
  const [weeklyTests, dailyTests, interactions, dailyLogs, projectTasks, users] = await Promise.all([
    db.weeklyTest.findMany({
      where: { userId: { in: studentIds }, courseId },
      select: { userId: true, week: true, status: true, score: true, completedAt: true },
    }),
    db.dailyTest.findMany({
      where: { userId: { in: studentIds }, courseId },
      select: { userId: true, week: true, date: true, score: true, status: true },
    }),
    db.interaction.findMany({
      where: { userId: { in: studentIds }, courseId },
      select: { userId: true, week: true, topic: true, correctness: true, date: true },
    }),
    db.dailyLog.findMany({
      where: { userId: { in: studentIds }, courseId },
      select: { userId: true, date: true, week: true },
    }),
    db.projectTask.findMany({
      where: { userId: { in: studentIds }, courseId },
      select: { userId: true, status: true, week: true },
    }),
    db.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, currentWeek: true, currentDay: true },
    }),
  ]);

  // ---- Time window helpers ----
  const now = new Date();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const startOfThisWeek = new Date(now.getTime() - WEEK_MS);
  const startOfLastWeek = new Date(now.getTime() - 2 * WEEK_MS);

  // ---- activeThisWeek: any daily log since startOfThisWeek ----
  const activeThisWeekSet = new Set<string>();
  for (const log of dailyLogs) {
    if (new Date(log.date).getTime() >= startOfThisWeek.getTime()) {
      activeThisWeekSet.add(log.userId);
    }
  }
  const activeThisWeek = activeThisWeekSet.size;

  // ---- avgScore (this week's tests) + trend (vs last week) ----
  const thisWeekTests = weeklyTests.filter(
    (t) => t.completedAt && new Date(t.completedAt).getTime() >= startOfThisWeek.getTime() && t.score !== null,
  );
  const lastWeekTests = weeklyTests.filter(
    (t) =>
      t.completedAt &&
      new Date(t.completedAt).getTime() >= startOfLastWeek.getTime() &&
      new Date(t.completedAt).getTime() < startOfThisWeek.getTime() &&
      t.score !== null,
  );
  const avg = (arr: { score: number | null }[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, t) => s + (t.score ?? 0), 0) / arr.length);
  const avgScore = avg(thisWeekTests);
  const lastWeekAvg = avg(lastWeekTests);
  let avgScoreTrend: "up" | "steady" | "down" = "steady";
  if (thisWeekTests.length > 0 && lastWeekTests.length > 0) {
    if (avgScore > lastWeekAvg + 2) avgScoreTrend = "up";
    else if (avgScore < lastWeekAvg - 2) avgScoreTrend = "down";
  }

  // ---- completionRate: % of students who completed this week's test ----
  // Use the max week present in weekly tests as "current week".
  const maxWeek = weeklyTests.reduce((m, t) => Math.max(m, t.week), 0);
  const thisWeeksTestRecords = maxWeek > 0 ? weeklyTests.filter((t) => t.week === maxWeek) : [];
  const completedThisWeekSet = new Set(
    thisWeeksTestRecords.filter((t) => t.status === "completed").map((t) => t.userId),
  );
  const completionRate = totalStudents === 0 ? 0 : Math.round((completedThisWeekSet.size / totalStudents) * 100);

  // ---- topicDifficulty: group interactions by topic, compute avg correctness ----
  const topicAgg = new Map<string, { sum: number; count: number }>();
  for (const i of interactions) {
    const topic = (i.topic || "General").trim() || "General";
    const cur = topicAgg.get(topic) ?? { sum: 0, count: 0 };
    cur.sum += i.correctness ?? 0;
    cur.count += 1;
    topicAgg.set(topic, cur);
  }
  const topicDifficulty = Array.from(topicAgg.entries())
    .map(([topic, { sum, count }]) => ({
      topic,
      avgScore: count > 0 ? Math.round(sum / count) : 0,
      attemptCount: count,
    }))
    .sort((a, b) => a.avgScore - b.avgScore) // hardest first
    .slice(0, 10);

  // ---- weeklyProgress: per-week completion + avg score ----
  const weeksToReport = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const weeklyProgress = weeksToReport.map((week) => {
    const weekTests = weeklyTests.filter((t) => t.week === week);
    const completedSet = new Set(weekTests.filter((t) => t.status === "completed").map((t) => t.userId));
    const completionRateW =
      totalStudents === 0 ? 0 : Math.round((completedSet.size / totalStudents) * 100);
    const scored = weekTests.filter((t) => t.score !== null);
    const avgScoreW =
      scored.length === 0 ? 0 : Math.round(scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length);
    return { week, completionRate: completionRateW, avgScore: avgScoreW };
  });

  // ---- Per-student aggregates for top performers + at-risk ----
  type StudentAgg = {
    userId: string;
    name: string;
    avgScore: number;
    completionRate: number;
    lastActiveMs: number;
    lastActiveDays: number;
    missedTests: number;
  };
  const studentAgg: StudentAgg[] = users.map((u) => {
    const studentWeekly = weeklyTests.filter((t) => t.userId === u.id);
    const completed = studentWeekly.filter((t) => t.status === "completed");
    const scored = completed.filter((t) => t.score !== null);
    const avgS =
      scored.length === 0 ? 0 : Math.round(scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length);
    // completionRate per student = completed weekly tests / max week reached
    const maxStudentWeek = studentWeekly.reduce((m, t) => Math.max(m, t.week), 0);
    const completionRateS = maxStudentWeek === 0 ? 0 : Math.round((completed.length / maxStudentWeek) * 100);

    const studentLogs = dailyLogs.filter((l) => l.userId === u.id);
    const lastActiveMs = studentLogs.reduce((m, l) => Math.max(m, new Date(l.date).getTime()), 0);
    const lastActiveDays = lastActiveMs === 0 ? 999 : Math.floor((now.getTime() - lastActiveMs) / (24 * 60 * 60 * 1000));

    // missedTests: weeks that should have been completed by now but weren't.
    // Use min(course duration, maxWeek reached across cohort) as expected weeks.
    const expectedWeeks = Math.max(maxWeek, 1);
    const completedWeeksSet = new Set(completed.map((t) => t.week));
    const missedTests = expectedWeeks - completedWeeksSet.size;

    return {
      userId: u.id,
      name: u.name,
      avgScore: avgS,
      completionRate: completionRateS,
      lastActiveMs,
      lastActiveDays,
      missedTests: Math.max(0, missedTests),
    };
  });

  // ---- topPerformers: avgScore >= 75, sorted desc, top 5 ----
  const topPerformers = studentAgg
    .filter((s) => s.avgScore >= 75)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5)
    .map(({ userId, name, avgScore, completionRate }) => ({ userId, name, avgScore, completionRate }));

  // ---- studentsAtRisk: avgScore < 50 OR lastActiveDays > 3 OR missedTests >= 2 ----
  const studentsAtRisk = studentAgg
    .filter((s) => s.avgScore < 50 || s.lastActiveDays > 3 || s.missedTests >= 2)
    .sort((a, b) => b.missedTests - a.missedTests || a.avgScore - b.avgScore)
    .slice(0, 10)
    .map(({ userId, name, avgScore, lastActiveDays, missedTests }) => ({
      userId,
      name,
      avgScore,
      lastActiveDays,
      missedTests,
    }));

  // ---- studentsNeedingAttention count (same criteria as at-risk) ----
  const studentsNeedingAttention = studentAgg.filter(
    (s) => s.avgScore < 50 || s.lastActiveDays > 3 || s.missedTests >= 2,
  ).length;

  return NextResponse.json({
    totalStudents,
    activeThisWeek,
    avgScore,
    avgScoreTrend,
    completionRate,
    studentsNeedingAttention,
    topicDifficulty,
    weeklyProgress,
    topPerformers,
    studentsAtRisk,
  });
}
