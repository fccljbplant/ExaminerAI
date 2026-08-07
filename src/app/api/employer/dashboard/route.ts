import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";

/**
 * GET /api/employer/dashboard
 *
 * B2B dashboard for company managers / sponsors to track their
 * institution's sponsored trainees.
 *
 * Auth: org_admin | platform_admin only (B2B roles).
 *
 * Returns:
 *   - Aggregate ROI/investment metrics
 *   - Per-trainee progress table (status, score, last active)
 *   - Skill-gap analysis (topics with avg mastery < 60, plus a
 *     recommended course name pulled from the marketplace)
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // B2B roles: org_admin (org-level admin), platform_admin (platform-level).
  // Legacy aliases (coordinator, principal, institution_admin, administrator, admin)
  // normalize to org_admin / platform_admin.
  const normalized = normalizeRole(payload.role);
  const isOrgAdmin = normalized === "org_admin";
  const isPlatformAdmin = normalized === "platform_admin";
  if (!isOrgAdmin && !isPlatformAdmin) {
    return NextResponse.json(
      { error: "Forbidden — org_admin / platform_admin only" },
      { status: 403 },
    );
  }

  // Look up the caller's institution. Platform admins (no institution) see
  // the entire platform — but we still need to scope this somewhere
  // reasonable. For platform admins without an institution, we'll roll up
  // ALL trainees across all institutions.
  const me = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, institutionId: true, role: true },
  });

  // Find all courses the institution sponsors. For platform admin without
  // an institution, pull all courses.
  const courseWhere = me?.institutionId
    ? { institutionId: me.institutionId }
    : isPlatformAdmin
      ? {} // all
      : {}; // safe fallback

  const courses = await db.course.findMany({
    where: courseWhere,
    select: {
      id: true,
      name: true,
      price: true,
      currency: true,
      durationWeeks: true,
      institutionId: true,
    },
  });
  const courseIds = courses.map((c) => c.id);

  // If the caller has no courses, return an empty payload.
  if (courseIds.length === 0) {
    return NextResponse.json({
      totalTrainees: 0,
      activeTrainees: 0,
      avgCompletionRate: 0,
      avgScore: 0,
      totalInvestment: 0,
      estimatedProductivityGain: 0,
      roiMultiplier: 0,
      timeSavedHours: 0,
      trainees: [],
      skillGaps: [],
    });
  }

  // All student enrollments across these courses.
  const enrollments = await db.courseEnrollment.findMany({
    where: { courseId: { in: courseIds }, role: "student" },
    select: { userId: true, courseId: true, enrolledAt: true },
  });

  // Deduplicate by userId (a trainee may be in multiple courses) — but
  // for the per-trainee row, we show one row per (user, course) enrollment.
  const userIds = [...new Set(enrollments.map((e) => e.userId))];

  const [users, weeklyTests, dailyTests, projectTasks, interactions] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, currentWeek: true, lastLogin: true, blocked: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds } },
      select: { userId: true, courseId: true, week: true, status: true, score: true, completedAt: true },
    }),
    db.dailyTest.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds } },
      select: { userId: true, courseId: true, date: true, score: true, status: true },
    }),
    db.projectTask.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds } },
      select: { userId: true, courseId: true, status: true },
    }),
    db.interaction.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds } },
      select: { userId: true, courseId: true, topic: true, correctness: true, date: true },
    }),
  ]);

  const now = new Date();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const userById = new Map(users.map((u) => [u.id, u]));

  // ---- Per-trainee rows (one per enrollment) ----
  // We carry an extra internal field `courseDurationWeeks` for the time-saved
  // calc; it's stripped before returning.
  type TraineeRow = {
    userId: string;
    name: string;
    courseName: string;
    progress: number;
    avgScore: number;
    lastActive: string | null;
    status: "on_track" | "needs_attention" | "at_risk" | "completed";
    courseDurationWeeks: number;
  };
  const trainees: TraineeRow[] = [];

  for (const enr of enrollments) {
    const user = userById.get(enr.userId);
    const course = courseById.get(enr.courseId);
    if (!user || !course) continue;

    const userWeekly = weeklyTests.filter(
      (t) => t.userId === enr.userId && t.courseId === enr.courseId,
    );
    const userTasks = projectTasks.filter(
      (t) => t.userId === enr.userId && t.courseId === enr.courseId,
    );
    const userInteractions = interactions.filter(
      (i) => i.userId === enr.userId && i.courseId === enr.courseId,
    );
    const userDaily = dailyTests.filter(
      (t) => t.userId === enr.userId && t.courseId === enr.courseId,
    );

    // Progress = completed weekly tests / course duration. If weekly tests
    // are sparse, fall back to project-task completion (completed/total).
    const durationWeeks = Math.max(course.durationWeeks || 1, 1);
    const completedWeeksSet = new Set(
      userWeekly.filter((t) => t.status === "completed").map((t) => t.week),
    );
    let progress = Math.min(100, Math.round((completedWeeksSet.size / durationWeeks) * 100));
    if (progress === 0 && userTasks.length > 0) {
      const doneTasks = userTasks.filter((t) => t.status === "completed").length;
      progress = Math.min(100, Math.round((doneTasks / userTasks.length) * 100));
    }

    // Avg score = avg of all weekly tests with a score
    const scoredWeekly = userWeekly.filter((t) => t.score !== null);
    const avgScore =
      scoredWeekly.length === 0
        ? 0
        : Math.round(scoredWeekly.reduce((s, t) => s + (t.score ?? 0), 0) / scoredWeekly.length);

    // Last active = most recent date across weekly tests, daily tests, interactions
    const allDates: number[] = [];
    userWeekly.forEach((t) => t.completedAt && allDates.push(new Date(t.completedAt).getTime()));
    userDaily.forEach((t) => allDates.push(new Date(t.date).getTime()));
    userInteractions.forEach((i) => allDates.push(new Date(i.date).getTime()));
    if (user.lastLogin) allDates.push(new Date(user.lastLogin).getTime());
    const lastActiveMs = allDates.length > 0 ? Math.max(...allDates) : 0;
    const lastActive = lastActiveMs > 0 ? new Date(lastActiveMs).toISOString() : null;

    // Determine status
    let status: TraineeRow["status"];
    const allWeeksDone = completedWeeksSet.size >= durationWeeks;
    if (allWeeksDone) {
      status = "completed";
    } else if (avgScore < 50 || (lastActiveMs > 0 && now.getTime() - lastActiveMs > FIVE_DAYS_MS) || lastActiveMs === 0) {
      status = "at_risk";
    } else if (avgScore < 70 || (lastActiveMs > 0 && now.getTime() - lastActiveMs > THREE_DAYS_MS)) {
      status = "needs_attention";
    } else {
      status = "on_track";
    }

    trainees.push({
      userId: user.id,
      name: user.name,
      courseName: course.name,
      progress,
      avgScore,
      lastActive,
      status,
      courseDurationWeeks: durationWeeks,
    });
  }

  // Sort: at_risk first, then needs_attention, on_track, completed
  const statusOrder: Record<TraineeRow["status"], number> = {
    at_risk: 0,
    needs_attention: 1,
    on_track: 2,
    completed: 3,
  };
  trainees.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));

  // ---- Aggregate metrics ----
  const totalTrainees = trainees.length;
  const activeTrainees = trainees.filter((t) => {
    if (!t.lastActive) return false;
    return now.getTime() - new Date(t.lastActive).getTime() < THREE_DAYS_MS;
  }).length;

  const avgCompletionRate =
    totalTrainees === 0
      ? 0
      : Math.round(trainees.reduce((s, t) => s + t.progress, 0) / totalTrainees);
  const scoredTrainees = trainees.filter((t) => t.avgScore > 0);
  const avgScore =
    scoredTrainees.length === 0
      ? 0
      : Math.round(scoredTrainees.reduce((s, t) => s + t.avgScore, 0) / scoredTrainees.length);

  // Investment = sum of course price * enrollment count for each trainee.
  // Use the course's price (default 0).
  let totalInvestment = 0;
  for (const enr of enrollments) {
    const c = courseById.get(enr.courseId);
    if (c) totalInvestment += c.price ?? 0;
  }

  // Estimated productivity gain — heuristic: each percentage point of avg
  // score above 50 is worth $500 per trainee, plus $300 baseline per trainee.
  const productivityPerTrainee = (avgScore: number) => {
    const baseline = 300;
    const skillBonus = Math.max(0, avgScore - 50) * 50; // $50 per point above 50
    return baseline + skillBonus;
  };
  const estimatedProductivityGain = trainees.reduce((s, t) => s + productivityPerTrainee(t.avgScore), 0);
  const roiMultiplier = totalInvestment > 0
    ? Math.round((estimatedProductivityGain / totalInvestment) * 10) / 10
    : 0;

  // Time saved — heuristic: 10 hours per completed week per trainee
  // (senior engineer hours saved on onboarding/mentoring).
  const timeSavedHours = trainees.reduce((s, t) => {
    const completedWeeks = Math.round((t.progress / 100) * t.courseDurationWeeks);
    return s + completedWeeks * 10;
  }, 0);

  // ---- Skill gaps: aggregate interactions by topic across all trainees,
  // find topics with avg correctness < 60. ----
  const topicAgg = new Map<string, { sum: number; count: number }>();
  for (const i of interactions) {
    const topic = (i.topic || "General").trim() || "General";
    const cur = topicAgg.get(topic) ?? { sum: 0, count: 0 };
    cur.sum += i.correctness ?? 0;
    cur.count += 1;
    topicAgg.set(topic, cur);
  }

  // Pull available marketplace courses so we can recommend one for each gap.
  const marketplaceCourses = await db.course.findMany({
    where: { published: true },
    select: { id: true, name: true, skillsVerified: true },
  });

  const skillGaps = Array.from(topicAgg.entries())
    .map(([topic, { sum, count }]) => {
      const avgMastery = count > 0 ? Math.round(sum / count) : 0;
      // Recommend a course that mentions this topic in skillsVerified (JSON string).
      const rec = marketplaceCourses.find((c) => {
        try {
          const skills = JSON.parse(c.skillsVerified || "[]") as string[];
          return skills.some((s) => s.toLowerCase().includes(topic.toLowerCase()));
        } catch {
          return false;
        }
      });
      return {
        skill: topic,
        avgMastery,
        recommendCourse: rec?.name ?? `${topic} Fundamentals`,
      };
    })
    .filter((g) => g.avgMastery < 60)
    .sort((a, b) => a.avgMastery - b.avgMastery)
    .slice(0, 8);

  return NextResponse.json({
    totalTrainees,
    activeTrainees,
    avgCompletionRate,
    avgScore,
    totalInvestment: Math.round(totalInvestment),
    estimatedProductivityGain: Math.round(estimatedProductivityGain),
    roiMultiplier,
    timeSavedHours,
    trainees: trainees.map(({ courseDurationWeeks: _cdw, ...rest }) => rest),
    skillGaps,
  });
}
