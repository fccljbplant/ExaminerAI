import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { hasRole, ADMIN_ROLES, normalizeRole } from "@/lib/rbac";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";

/**
 * GET /api/instructor/student-briefing?studentId=...&courseId=...
 *
 * Heuristic mentoring brief from one explicitly selected, server-authorised
 * course. Missing scores/activity remain unavailable, not zero or at-risk.
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const normalized = normalizeRole(payload.role);
  const isInstructor = normalized === "instructor";
  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  if (!isInstructor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden — staff access required" }, { status: 403 });
  }

  const studentId = req.nextUrl.searchParams.get("studentId");
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!studentId) return NextResponse.json({ error: "Missing studentId query param" }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: "courseId is required for a course-specific briefing" }, { status: 400 });

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true },
  });
  if (!student || normalizeRole(student.role) !== "learner") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    await assertCanAccessStudent(payload, studentId);
  } catch {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const authorizedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, studentId);
  if (!authorizedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot view this learner's selected course" }, { status: 403 });
  }

  const [dailyTests, weeklyTests, projectTasks, dailyLogs, interactions] = await Promise.all([
    db.dailyTest.findMany({
      where: { userId: studentId, courseId },
      orderBy: { date: "desc" },
      take: 10,
      select: { date: true, week: true, score: true, status: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: studentId, courseId },
      orderBy: { week: "asc" },
      select: { week: true, status: true, score: true, completedAt: true },
    }),
    db.projectTask.findMany({
      where: { userId: studentId, courseId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, createdAt: true, week: true, day: true },
    }),
    db.dailyLog.findMany({
      where: { userId: studentId, courseId },
      orderBy: { date: "desc" },
      take: 30,
      select: { id: true, date: true, week: true, day: true },
    }),
    db.interaction.findMany({
      where: { userId: studentId, courseId },
      orderBy: { date: "desc" },
      take: 100,
      select: { topic: true, correctness: true, date: true, week: true },
    }),
  ]);

  const scoredDaily = dailyTests.filter((test) => test.score !== null).slice(0, 3).reverse();
  const dailyScores = scoredDaily.map((test) => test.score as number);
  const minScore = dailyScores.length ? Math.min(...dailyScores) : null;
  const maxScore = dailyScores.length ? Math.max(...dailyScores) : null;
  const avgDailyScore = dailyScores.length
    ? Math.round(dailyScores.reduce((sum, score) => sum + score, 0) / dailyScores.length)
    : null;
  const scoredWeekly = weeklyTests.filter((test) => test.status === "completed" && test.score !== null);
  const avgWeeklyScore = scoredWeekly.length
    ? Math.round(scoredWeekly.reduce((sum, test) => sum + (test.score as number), 0) / scoredWeekly.length)
    : null;
  const avgScore = avgWeeklyScore ?? avgDailyScore;

  const topicAgg = new Map<string, { sum: number; count: number }>();
  for (const interaction of interactions) {
    const topic = (interaction.topic || "General").trim() || "General";
    const current = topicAgg.get(topic) ?? { sum: 0, count: 0 };
    current.sum += interaction.correctness;
    current.count += 1;
    topicAgg.set(topic, current);
  }
  const weakTopics = Array.from(topicAgg.entries())
    .map(([topic, aggregate]) => ({ topic, avg: Math.round(aggregate.sum / aggregate.count) }))
    .filter((topic) => topic.avg < 60)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((topic) => topic.topic.toLowerCase());

  const activityDates = [
    ...dailyTests.map((test) => test.date),
    ...dailyLogs.map((log) => log.date),
    ...interactions.map((interaction) => interaction.date),
  ];
  const lastActiveMs = activityDates.length
    ? Math.max(...activityDates.map((date) => new Date(date).getTime()))
    : null;
  const lastActive = lastActiveMs !== null ? new Date(lastActiveMs).toISOString() : null;
  const lastActiveDays = lastActiveMs !== null
    ? Math.max(0, Math.floor((Date.now() - lastActiveMs) / (24 * 60 * 60 * 1000)))
    : null;

  const hasEvidence = avgScore !== null || lastActiveMs !== null;
  let status: "on_track" | "needs_attention" | "at_risk" | "insufficient_data";
  if (!hasEvidence) status = "insufficient_data";
  else if ((avgScore !== null && avgScore < 50) || (lastActiveDays !== null && lastActiveDays > 5)) status = "at_risk";
  else if ((avgScore !== null && avgScore < 70) || (lastActiveDays !== null && lastActiveDays > 3)) status = "needs_attention";
  else status = "on_track";

  const observedWeeks = [
    ...dailyTests.filter((test) => test.score !== null).map((test) => test.week),
    ...scoredWeekly.map((test) => test.week),
    ...dailyLogs.map((log) => log.week),
    ...interactions.map((interaction) => interaction.week),
  ].filter((week) => week > 0);
  const week = observedWeeks.length ? Math.max(...observedWeeks) : null;
  const observedDays = dailyLogs.map((log) => log.day).filter((day): day is number => day !== null);
  const day = observedDays.length ? Math.max(...observedDays) : null;

  const s1 = week !== null
    ? `Course activity is recorded through Week ${week}${day !== null ? ", Day " + day : ""}.`
    : "No curriculum activity is recorded for this course yet.";

  let s2: string;
  if (dailyScores.length === 0) {
    s2 = "No scored daily tests are available for this course yet.";
  } else {
    const trendWord = avgDailyScore !== null && avgDailyScore >= 80
      ? "performing strongly"
      : avgDailyScore !== null && (avgDailyScore < 60 || (minScore !== null && minScore < 50))
        ? "may benefit from reinforcement"
        : maxScore !== null && minScore !== null && maxScore - minScore <= 10
          ? "showing a consistent recent pattern"
          : "showing a varied recent pattern";
    const weakPhrase = weakTopics.length ? ` Topic to review: ${weakTopics[0]}.` : "";
    s2 = dailyScores.length === 1
      ? `Latest scored daily test: ${dailyScores[0]}%; ${trendWord}.${weakPhrase}`
      : `The last ${dailyScores.length} scored daily tests range from ${minScore}% to ${maxScore}%; ${trendWord}.${weakPhrase}`;
  }

  const completedTasks = projectTasks.filter((task) => task.status === "completed").length;
  const s3 = `${dailyLogs.length} course check-ins and ${projectTasks.length} project tasks are recorded; ${completedTasks} project tasks are complete.`;
  const briefing = `${s1} ${s2} ${s3}`;

  let suggestedTalkingPoint: string;
  if (avgScore !== null && avgScore >= 80 && weakTopics.length === 0) {
    suggestedTalkingPoint = "Recognise the learner's demonstrated progress and discuss an appropriate next challenge.";
  } else if (weakTopics.length > 0) {
    suggestedTalkingPoint = `Ask the learner to explain ${weakTopics[0]} in their own words and identify where support would help.`;
  } else if (projectTasks.length === 0) {
    suggestedTalkingPoint = "Check whether a course project task is assigned and whether the learner needs help getting started.";
  } else {
    suggestedTalkingPoint = "Ask which part of the selected course would benefit most from instructor guidance.";
  }

  return NextResponse.json({
    courseId, briefing, suggestedTalkingPoint, week, day, avgScore, lastActive, status, weakTopics,
    hasProjectTask: projectTasks.length > 0,
    checkInCount: dailyLogs.length,
    projectTaskCount: projectTasks.length,
    completedProjectTaskCount: completedTasks,
  });
}