import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";
import { isPortalEnabled } from "@/lib/feature-flags";

/**
 * GET /api/instructor/student-briefing?studentId=...
 *
 * Returns a 3-sentence heuristic briefing + suggested talking point
 * for an instructor about to message a student.
 *
 * The briefing text is generated HEURISTICALLY (no AI call — fast + free).
 *
 * Auth: instructor or organisation admin with a shared course scope.
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const normalized = normalizeRole(payload.role);
  if (normalized !== UserRole.INSTRUCTOR && normalized !== UserRole.ORG_ADMIN) {
    return NextResponse.json({ error: "Forbidden — instructor or organisation admin access required" }, { status: 403 });
  }
  if (!(await isPortalEnabled("instructor"))) {
    return NextResponse.json({ error: "Instructor portal is not enabled yet" }, { status: 403 });
  }

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId query param" }, { status: 400 });
  }

  // Authorise the exact course set before reading any learner data.
  let authorisedCourseIds: string[] = [];
  if (normalized === UserRole.INSTRUCTOR) {
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    authorisedCourseIds = instructorCourses.map((course) => course.courseId);
  } else {
    const memberships = await db.orgMember.findMany({
      where: { userId: payload.sub, role: "admin", status: "active" },
      select: { orgId: true },
    });
    const orgIds = memberships.map((membership) => membership.orgId);
    const orgCourses = orgIds.length
      ? await db.orgCourse.findMany({
          where: { orgId: { in: orgIds } },
          select: { courseId: true },
        })
      : [];
    authorisedCourseIds = orgCourses.map((course) => course.courseId);
  }

  if (authorisedCourseIds.length === 0) {
    return NextResponse.json({ error: "You do not have access to this learner" }, { status: 403 });
  }

  const learnerCourses = await db.courseEnrollment.findMany({
    where: { userId: studentId, role: "student", courseId: { in: authorisedCourseIds } },
    select: { courseId: true },
  });
  const sharedCourseIds = [...new Set(learnerCourses.map((course) => course.courseId))];
  if (sharedCourseIds.length === 0) {
    return NextResponse.json({ error: "You do not have access to this learner in your courses" }, { status: 403 });
  }

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true },
  });
  if (!student || normalizeRole(student.role) !== UserRole.LEARNER) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const courseScope = { courseId: { in: sharedCourseIds } };
  const [dailyTests, weeklyTests, projectTasks, dailyLogs, interactions] = await Promise.all([
    db.dailyTest.findMany({
      where: { userId: studentId, ...courseScope },
      orderBy: { date: "desc" },
      take: 10,
      select: { date: true, score: true, status: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: studentId, ...courseScope },
      orderBy: { week: "asc" },
      select: { week: true, status: true, score: true, completedAt: true },
    }),
    db.projectTask.findMany({
      where: { userId: studentId, ...courseScope },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, createdAt: true, week: true, day: true },
    }),
    db.dailyLog.findMany({
      where: { userId: studentId, ...courseScope },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, date: true },
    }),
    db.interaction.findMany({
      where: { userId: studentId, ...courseScope },
      orderBy: { date: "desc" },
      take: 100,
      select: { topic: true, correctness: true, date: true },
    }),
  ]);

  // ---- Compute signals ----
  // Last 3 daily tests with a score (oldest → newest of the last 3).
  const scoredDaily = dailyTests.filter((t) => t.score !== null).slice(0, 3).reverse();
  const minScore = scoredDaily.length > 0 ? Math.min(...scoredDaily.map((t) => t.score!)) : null;
  const maxScore = scoredDaily.length > 0 ? Math.max(...scoredDaily.map((t) => t.score!)) : null;
  const avgDailyScore = scoredDaily.length > 0
    ? Math.round(scoredDaily.reduce((s, t) => s + t.score!, 0) / scoredDaily.length)
    : null;

  // Avg score across all weekly tests
  const scoredWeekly = weeklyTests.filter((t) => t.score !== null);
  const avgWeeklyScore = scoredWeekly.length > 0
    ? Math.round(scoredWeekly.reduce((s, t) => s + t.score!, 0) / scoredWeekly.length)
    : null;
  const avgScore = avgWeeklyScore ?? avgDailyScore;

  // Weak topics: aggregate interactions by topic, find topics with avg
  // correctness < 60. Sort by lowest score first.
  const topicAgg = new Map<string, { sum: number; count: number }>();
  for (const i of interactions) {
    if (i.correctness === null || !Number.isFinite(i.correctness)) continue;
    const topic = (i.topic || "General").trim() || "General";
    const cur = topicAgg.get(topic) ?? { sum: 0, count: 0 };
    cur.sum += i.correctness;
    cur.count += 1;
    topicAgg.set(topic, cur);
  }
  const weakTopics = Array.from(topicAgg.entries())
    .map(([topic, { sum, count }]) => ({
      topic,
      avg: count > 0 ? Math.round(sum / count) : 0,
    }))
    .filter((t) => t.avg < 60)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((t) => t.topic.toLowerCase());

  // Today's check-in
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const completedCheckInToday = dailyLogs.some((l) => {
    const d = new Date(l.date);
    const dUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return dUTC.getTime() === todayUTC.getTime();
  });

  // Project task started?
  const hasProjectTask = projectTasks.length > 0;

  // Last active = max of: lastLogin, last daily test, last interaction, last daily log.
  const lastActiveMs = Math.max(
    ...dailyTests.map((t) => new Date(t.date).getTime()),
    ...dailyLogs.map((l) => new Date(l.date).getTime()),
    ...interactions.map((i) => new Date(i.date).getTime()),
    0,
  );
  const lastActive = lastActiveMs > 0 ? new Date(lastActiveMs).toISOString() : null;
  const lastActiveDays = lastActiveMs > 0
    ? Math.floor((Date.now() - lastActiveMs) / (24 * 60 * 60 * 1000))
    : null;

  let status: "on_track" | "needs_attention" | "at_risk" | "unavailable";
  if (avgScore === null && lastActiveDays === null) {
    status = "unavailable";
  } else if ((avgScore !== null && avgScore < 50) || (lastActiveDays !== null && lastActiveDays > 5)) {
    status = "at_risk";
  } else if ((avgScore !== null && avgScore < 70) || (lastActiveDays !== null && lastActiveDays > 3)) {
    status = "needs_attention";
  } else {
    status = avgScore === null ? "unavailable" : "on_track";
  }

  // ---- Build the briefing (3 sentences) ----
  // Sentence 1: "{name} is in Week {week}, Day {day}."
  const s1 = "Course activity is summarised from records in your authorised courses.";

  // Sentence 2: "They've scored {min}-{max} on the last {n} daily tests,
  // {struggling/exceling/consistent} with {weakTopic}."
  let s2: string;
  if (scoredDaily.length === 0 && avgWeeklyScore !== null) {
    s2 = "Their average weekly test score is " + avgWeeklyScore + "%.";
  } else if (scoredDaily.length === 0) {
    s2 = "There are no scored assessments available for these courses yet.";
  } else {
    const trendWord = (() => {
      // excel: all scores >= 80 OR avg >= 80
      // struggle: avg < 60 OR any score < 50
      // consistent: small range (max - min <= 10) and avg 60-80
      if (avgDailyScore !== null && avgDailyScore >= 80) return "exceling";
      if (avgDailyScore !== null && (avgDailyScore < 60 || (minScore !== null && minScore < 50))) return "struggling";
      if (minScore !== null && maxScore !== null && maxScore - minScore <= 10 && avgDailyScore !== null && avgDailyScore <= 80) return "consistent";
      return "working on";
    })();
    const weakPhrase = weakTopics.length > 0 ? ` with ${weakTopics[0]}` : "";
    if (scoredDaily.length === 1) {
      s2 = `They scored ${scoredDaily[0].score}% on their latest daily test, ${trendWord}${weakPhrase}.`;
    } else {
      s2 = `They've scored ${minScore}-${maxScore}% on the last ${scoredDaily.length} daily tests, ${trendWord}${weakPhrase}.`;
    }
  }

  // Sentence 3: "They {have/haven't} completed today's check-in and
  // {have/haven't} started the project task."
  const checkInPhrase = completedCheckInToday ? "has a check-in recorded today" : "has no check-in recorded today";
  const projectPhrase = hasProjectTask ? "has project-task activity recorded" : "has no project-task records in these courses yet";
  const s3 = `They ${checkInPhrase} and ${projectPhrase}.`;

  const briefing = `${s1} ${s2} ${s3}`;

  // ---- Suggested talking point ----
  let suggestedTalkingPoint: string;
  if (avgScore !== null && avgScore >= 80 && weakTopics.length === 0) {
    suggestedTalkingPoint = "Praise their consistency and suggest stretch goals.";
  } else if (weakTopics.length > 0) {
    suggestedTalkingPoint = `Ask them to explain ${weakTopics[0]} in their own words.`;
  } else if (avgScore === null && weakTopics.length === 0) {
    suggestedTalkingPoint = "Agree a clear next learning goal and confirm the available assessment evidence.";
  } else if (!hasProjectTask) {
    suggestedTalkingPoint = "Confirm whether a project task has been assigned in these courses.";
  } else {
    suggestedTalkingPoint = "Ask what would help them make progress on the next learning task.";
  }

  return NextResponse.json({
    briefing,
    suggestedTalkingPoint,
    avgScore,
    lastActive,
    status,
    weakTopics,
    hasProjectTask,
    completedCheckInToday,
  });
}
