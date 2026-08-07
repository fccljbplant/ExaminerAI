import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES, normalizeRole } from "@/lib/rbac";

/**
 * GET /api/instructor/student-briefing?studentId=...
 *
 * Returns a 3-sentence heuristic briefing + suggested talking point
 * for an instructor about to message a student.
 *
 * The briefing text is generated HEURISTICALLY (no AI call — fast + free).
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
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId query param" }, { status: 400 });
  }

  // Verify the student exists. For instructors, verify they teach a course
  // the student is enrolled in (IDOR protection).
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      currentWeek: true,
      currentDay: true,
      role: true,
      lastLogin: true,
    },
  });
  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (normalized === "instructor" || payload.role === "instructor") {
    const [instructorCourses, studentCourses] = await Promise.all([
      db.courseEnrollment.findMany({
        where: { userId: payload.sub, role: "instructor" },
        select: { courseId: true },
      }),
      db.courseEnrollment.findMany({
        where: { userId: studentId, role: "student" },
        select: { courseId: true },
      }),
    ]);
    const shared = instructorCourses
      .map((e) => e.courseId)
      .filter((cid) => studentCourses.some((sc) => sc.courseId === cid));
    if (shared.length === 0) {
      return NextResponse.json(
        { error: "You can only view briefings for students in your courses" },
        { status: 403 },
      );
    }
  }

  // Pull the latest signals: daily tests (last 3 with scores), weekly tests,
  // project tasks (today's), and daily logs (today's check-in). Also the
  // student's weak topics from interaction correctness.
  const [dailyTests, weeklyTests, projectTasks, dailyLogs, interactions] = await Promise.all([
    db.dailyTest.findMany({
      where: { userId: studentId },
      orderBy: { date: "desc" },
      take: 10,
      select: { date: true, score: true, status: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: studentId },
      orderBy: { week: "asc" },
      select: { week: true, status: true, score: true, completedAt: true },
    }),
    db.projectTask.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, createdAt: true, week: true, day: true },
    }),
    db.dailyLog.findMany({
      where: { userId: studentId },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, date: true },
    }),
    db.interaction.findMany({
      where: { userId: studentId },
      orderBy: { date: "desc" },
      take: 100,
      select: { topic: true, correctness: true, date: true },
    }),
  ]);

  // ---- Compute signals ----
  const week = student.currentWeek || 1;
  const day = student.currentDay || 1;

  // Last 3 daily tests with a score (oldest → newest of the last 3).
  const scoredDaily = dailyTests.filter((t) => t.score !== null).slice(0, 3).reverse();
  const minScore = scoredDaily.length > 0 ? Math.min(...scoredDaily.map((t) => t.score ?? 0)) : 0;
  const maxScore = scoredDaily.length > 0 ? Math.max(...scoredDaily.map((t) => t.score ?? 0)) : 0;
  const avgDailyScore = scoredDaily.length > 0
    ? Math.round(scoredDaily.reduce((s, t) => s + (t.score ?? 0), 0) / scoredDaily.length)
    : 0;

  // Avg score across all weekly tests
  const scoredWeekly = weeklyTests.filter((t) => t.score !== null);
  const avgScore = scoredWeekly.length === 0
    ? 0
    : Math.round(scoredWeekly.reduce((s, t) => s + (t.score ?? 0), 0) / scoredWeekly.length);

  // Weak topics: aggregate interactions by topic, find topics with avg
  // correctness < 60. Sort by lowest score first.
  const topicAgg = new Map<string, { sum: number; count: number }>();
  for (const i of interactions) {
    const topic = (i.topic || "General").trim() || "General";
    const cur = topicAgg.get(topic) ?? { sum: 0, count: 0 };
    cur.sum += i.correctness ?? 0;
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
    student.lastLogin ? new Date(student.lastLogin).getTime() : 0,
    ...dailyTests.map((t) => new Date(t.date).getTime()),
    ...dailyLogs.map((l) => new Date(l.date).getTime()),
    ...interactions.map((i) => new Date(i.date).getTime()),
    0,
  );
  const lastActive = lastActiveMs > 0 ? new Date(lastActiveMs).toISOString() : null;
  const lastActiveDays = lastActiveMs === 0
    ? 999
    : Math.floor((Date.now() - lastActiveMs) / (24 * 60 * 60 * 1000));

  // ---- Status ----
  let status: "on_track" | "needs_attention" | "at_risk";
  if (avgScore < 50 || lastActiveDays > 5) {
    status = "at_risk";
  } else if (avgScore < 70 || lastActiveDays > 3) {
    status = "needs_attention";
  } else {
    status = "on_track";
  }

  // ---- Build the briefing (3 sentences) ----
  // Sentence 1: "{name} is in Week {week}, Day {day}."
  const s1 = `${student.name} is in Week ${week}, Day ${day}.`;

  // Sentence 2: "They've scored {min}-{max} on the last {n} daily tests,
  // {struggling/exceling/consistent} with {weakTopic}."
  let s2: string;
  if (scoredDaily.length === 0) {
    s2 = `They haven't taken any daily tests yet.`;
  } else {
    const trendWord = (() => {
      // excel: all scores >= 80 OR avg >= 80
      // struggle: avg < 60 OR any score < 50
      // consistent: small range (max - min <= 10) and avg 60-80
      if (avgDailyScore >= 80) return "exceling";
      if (avgDailyScore < 60 || minScore < 50) return "struggling";
      if (maxScore - minScore <= 10) return "consistent";
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
  const checkInPhrase = completedCheckInToday ? "completed today's check-in" : "haven't completed today's check-in";
  const projectPhrase = hasProjectTask ? "started the project task" : "haven't started the project task";
  const s3 = `They ${checkInPhrase} and ${projectPhrase}.`;

  const briefing = `${s1} ${s2} ${s3}`;

  // ---- Suggested talking point ----
  let suggestedTalkingPoint: string;
  if (avgScore >= 80 && weakTopics.length === 0) {
    suggestedTalkingPoint = "Praise their consistency and suggest stretch goals.";
  } else if (weakTopics.length > 0) {
    suggestedTalkingPoint = `Ask them to explain ${weakTopics[0]} in their own words.`;
  } else if (!hasProjectTask) {
    suggestedTalkingPoint = "Check if they need help starting the project task.";
  } else {
    suggestedTalkingPoint = "Ask how they're feeling about the course pacing.";
  }

  return NextResponse.json({
    briefing,
    suggestedTalkingPoint,
    week,
    day,
    avgScore,
    lastActive,
    status,
    weakTopics,
    hasProjectTask,
    completedCheckInToday,
  });
}
