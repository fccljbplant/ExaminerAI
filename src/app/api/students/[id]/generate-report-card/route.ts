import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { scoreToGrade } from "@/lib/constants";
import { getCourseDurationWeeks } from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

/** POST /api/students/[id]/generate-report-card — instructor/admin auto-generates
 *  a report card for a student based on their accumulated data (weekly tests,
 *  practice questions, tasks, check-ins).
 *
 *  Body: { week: number } — which week the report card is for.
 *
 *  The report card is generated from real data — no AI call needed. It pulls:
 *    - Weekly test score for the week (if completed)
 *    - Practice question average for the week
 *    - Task completion rate for the week
 *    - Check-in count for the week
 *
 *  The generated card is upserted (replaces any existing card for that week).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("generating report cards"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // IDOR protection: verify the caller can access this student's data
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const body = await req.json().catch(() => ({}));
  const week = Number(body.week);

  // Look up the student's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(id);
  if (!week || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `Valid week (1-${totalWeeks}) required` }, { status: 400 });
  }

  // Fetch all data needed for the report card
  const [tasks, dailyLogs, interactions, weeklyTests, comments] = await Promise.all([
    db.projectTask.findMany({ where: { userId: id, week }, select: { status: true, description: true } }),
    db.dailyLog.findMany({ where: { userId: id, week }, select: { date: true, whatDidYouDo: true, confidence: true, anyErrors: true } }),
    db.interaction.findMany({ where: { userId: id, week }, select: { correctness: true, topic: true, pillar: true, feedback: true } }),
    db.weeklyTest.findUnique({ where: { userId_week: { userId: id, week } }, select: { score: true, status: true } }),
    db.comment.findMany({ where: { studentId: id }, select: { body: true, marksOverride: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  // ---- Compute metrics ----
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const totalTasks = tasks.length;
  const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const practiceAvg = interactions.length > 0
    ? Math.round(interactions.reduce((a, i) => a + i.correctness, 0) / interactions.length)
    : null;

  const weeklyTestScore = weeklyTests?.score ?? null;

  // Overall score: weighted average of weekly test (50%) + practice (50%)
  let overallScore = 0;
  if (weeklyTestScore !== null && practiceAvg !== null) {
    overallScore = Math.round(weeklyTestScore * 0.5 + practiceAvg * 0.5);
  } else if (weeklyTestScore !== null) {
    overallScore = weeklyTestScore;
  } else if (practiceAvg !== null) {
    overallScore = practiceAvg;
  } else if (taskRate > 0) {
    overallScore = Math.max(50, taskRate); // floor 50 for beginners
  } else {
    overallScore = 50; // default floor
  }

  const grade = scoreToGrade(overallScore);

  // ---- Build strengths + weaknesses ----
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (taskRate >= 75) strengths.push(`Strong task completion (${completedTasks}/${totalTasks} done — ${taskRate}%)`);
  else if (taskRate < 50 && totalTasks > 0) weaknesses.push(`Low task completion (${completedTasks}/${totalTasks} done — ${taskRate}%)`);

  if (practiceAvg !== null && practiceAvg >= 75) strengths.push(`Good practice question performance (${practiceAvg}% average)`);
  else if (practiceAvg !== null && practiceAvg < 60) weaknesses.push(`Practice questions need work (${practiceAvg}% average — review concepts)`);

  if (weeklyTestScore !== null && weeklyTestScore >= 75) strengths.push(`Solid weekly test score (${weeklyTestScore}%)`);
  else if (weeklyTestScore !== null && weeklyTestScore < 60) weaknesses.push(`Weekly test score needs improvement (${weeklyTestScore}%)`);

  if (dailyLogs.length >= 3) strengths.push(`Consistent daily check-ins (${dailyLogs.length} this week)`);
  else if (dailyLogs.length === 0) weaknesses.push("No daily check-ins this week — encourage daily logging");

  // Default if nothing
  if (strengths.length === 0) strengths.push("Showing up and participating — keep building from here");
  if (weaknesses.length === 0) weaknesses.push("Continue practicing consistently to deepen understanding");

  // ---- Build narrative sections ----
  const progress = `Tasks: ${completedTasks}/${totalTasks} (${taskRate}%). Practice: ${practiceAvg !== null ? practiceAvg + "%" : "none"}. Weekly test: ${weeklyTestScore !== null ? weeklyTestScore + "%" : "not taken"}. Overall: ${overallScore}% (${grade}).`;

  const nextSteps: string[] = [];
  if (weaknesses.includes("No daily check-ins this week — encourage daily logging")) nextSteps.push("Start daily check-ins to build a learning habit");
  if (practiceAvg !== null && practiceAvg < 70) nextSteps.push("Answer more practice questions to reinforce concepts");
  if (weeklyTestScore === null) nextSteps.push(`Take the Week ${week} weekly test`);
  if (taskRate < 100) nextSteps.push("Complete remaining project tasks");
  if (nextSteps.length === 0) nextSteps.push("Continue at this pace — great progress!");

  // ---- Upsert the report card ----
  const card = await db.reportCard.upsert({
    where: { userId_week: { userId: id, week } },
    create: {
      userId: id,
      week,
      grade,
      score: overallScore,
      strengths: JSON.stringify(strengths),
      weaknesses: JSON.stringify(weaknesses),
      progress,
      nextSteps: JSON.stringify(nextSteps),
    },
    update: {
      grade,
      score: overallScore,
      strengths: JSON.stringify(strengths),
      weaknesses: JSON.stringify(weaknesses),
      progress,
      nextSteps: JSON.stringify(nextSteps),
    },
  });

  // LO-5 fix: audit log for AI-driven report card generation
  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: AuditAction.REPORT_CARD_GENERATED,
    target: { type: "user", id },
    after: { week, score: overallScore, grade },
    req,
  }).catch((err) => { logger.warn("Operation failed", { err }); });

  return NextResponse.json({
    ok: true,
    reportCard: card,
    message: `Report card generated for Week ${week} — Score: ${overallScore}% (${grade})`,
  });
}
