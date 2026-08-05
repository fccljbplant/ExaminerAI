import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";

export type EnrollmentResponse = {
  enrollments: Array<{
    courseId: string;
    courseName: string;
    role: string;
    totalWeeks: number;
    currentWeek: number;
    currentDay: number;
    progress: number;
    avgScore: number | null;
    latestScore: number | null;
    projectEnabled: boolean;
    projectRequired: boolean;
    hasProjectTasks: boolean;
    lastActiveAt: string | null;
  }>;
  totalEnrollments: number;
  overallStreak: number;
};

export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin can query any user's enrollments via ?userId=xxx
  const targetUserId = req.nextUrl.searchParams.get("userId") || payload.sub;
  if (targetUserId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: targetUserId },
    select: {
      role: true,
      courseId: true,
      course: {
        select: {
          name: true,
          projectEnabled: true,
          projectRequired: true,
          weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } },
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return NextResponse.json({
      enrollments: [],
      totalEnrollments: 0,
      overallStreak: 0,
    });
  }

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      currentWeek: true,
      currentDay: true,
      lastLogin: true,
    },
  });

  const courseIds = enrollments.map(e => e.courseId);

  const [weeklyTests, tasks, dailyLogs] = await Promise.all([
    db.weeklyTest.findMany({
      where: { userId: targetUserId, status: "completed", score: { not: null } },
      select: { score: true, week: true },
      orderBy: { week: "desc" },
      take: 50,
    }),
    db.projectTask.findMany({
      where: { userId: targetUserId },
      select: { id: true, status: true },
      take: 200,
    }),
    db.dailyLog.findMany({
      where: { userId: targetUserId },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const avgScore = weeklyTests.length > 0
    ? Math.round(weeklyTests.reduce((s, t) => s + (t.score ?? 0), 0) / weeklyTests.length)
    : null;
  const latestScore = weeklyTests[0]?.score ?? null;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let streak = 0;
  const seenDates = new Set(
    dailyLogs.map(l => {
      const d = new Date(l.date);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
    })
  );
  for (let i = 0; i < 365; i++) {
    const d = new Date(todayUTC);
    d.setUTCDate(todayUTC.getUTCDate() - i);
    if (seenDates.has(d.toISOString())) streak++;
    else break;
  }

  const enriched = enrollments.map(e => {
    const weekCount = e.course.weeks.length;
    const projectEnabled = e.course.projectEnabled && weekCount >= 4;
    return {
      courseId: e.courseId,
      courseName: e.course.name,
      role: e.role,
      totalWeeks: weekCount,
      currentWeek: user?.currentWeek ?? 1,
      currentDay: user?.currentDay ?? 1,
      progress,
      avgScore,
      latestScore,
      projectEnabled,
      projectRequired: e.course.projectRequired && projectEnabled,
      hasProjectTasks: tasks.length > 0,
      lastActiveAt: user?.lastLogin?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    enrollments: enriched,
    totalEnrollments: enriched.length,
    overallStreak: streak,
  });
}
