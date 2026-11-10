import { isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { getTestConfig } from "@/modules/course/lib/course-config";
import { buildCourseReportCard, parseCourseReportCardPolicy } from "@/modules/course/lib/report-card";
import { saveCourseReportCard } from "@/modules/course/lib/report-card-records";

/**
 * POST /api/students/[id]/generate-report-card
 *
 * Body: { courseId, week, reason? }
 * Generates a course-only report card. Missing assessment evidence remains
 * unavailable; the course's own grading policy is required for a grade.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const demoBlock = await demoWriteBlock("generating report cards");
  if (demoBlock) return demoBlock;

  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await assertCanAccessStudent(payload, id, "content_only");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Access denied" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const week = Number(body.week);
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }
  if (!Number.isInteger(week) || week < 1 || week > 52) {
    return NextResponse.json({ error: "A valid course week is required" }, { status: 400 });
  }

  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, id);
  if (!authorisedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot generate a report card for this course" }, { status: 403 });
  }

  const [learner, course] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, role: true } }),
    db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        reportCardTemplateJson: true,
        weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } },
      },
    }),
  ]);

  if (!learner || !["learner", "student"].includes(learner.role)) {
    return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  }
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (!course.weeks.some((courseWeek) => courseWeek.weekNumber === week)) {
    return NextResponse.json({ error: "Week is not part of the selected course outline" }, { status: 400 });
  }

  const [tasks, dailyLogs, interactions, weeklyTests, testConfig] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: id, courseId, week },
      select: { status: true },
    }),
    // Count only; do not load reflections, confidence, confusion or support signals.
    db.dailyLog.findMany({
      where: { userId: id, courseId, week },
      select: { id: true },
    }),
    db.interaction.findMany({
      where: { userId: id, courseId, week },
      select: { correctness: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: id, courseId, week },
      orderBy: { attempt: "asc" },
      select: { attempt: true, status: true, score: true },
    }),
    getTestConfig(id, courseId),
  ]);

  const result = buildCourseReportCard(
    {
      tasks,
      dailyCheckinCount: dailyLogs.length,
      practiceScores: interactions.map((interaction) => interaction.correctness),
      weeklyTests,
    },
    parseCourseReportCardPolicy(course.reportCardTemplateJson),
    testConfig.retakePolicy,
  );

  if (!result.hasEvidence) {
    return NextResponse.json(
      { error: "No evidence is available for this learner in the selected course week; no report card was created." },
      { status: 409 },
    );
  }

  let reportCard;
  try {
    reportCard = await saveCourseReportCard({
      fields: {
        userId: id,
        courseId,
        week,
        grade: result.grade,
        score: result.score,
        strengths: JSON.stringify(result.strengths),
        weaknesses: JSON.stringify(result.weaknesses),
        progress: result.progress,
        nextSteps: JSON.stringify(result.nextSteps),
      },
      actorId: payload.sub,
      actorRole: payload.role,
      reason: typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : "Regenerated from selected-course evidence",
    });
  } catch (err) {
    logger.error("Course report-card persistence failed", {
      learnerId: id,
      courseId,
      week,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not save the course report card. Please retry." }, { status: 409 });
  }

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.REPORT_CARD_GENERATED,
    target: { type: "report_card", id: reportCard?.id ?? id },
    after: {
      courseId,
      week,
      version: reportCard?.version ?? null,
      score: reportCard?.score ?? null,
      grade: reportCard?.grade ?? null,
    },
    req,
  });

  return NextResponse.json({
    ok: true,
    reportCard,
    message: reportCard?.score === null
      ? `Report card saved for ${course.name}, Week ${week}. Overall grade unavailable until a valid course grading policy and weighted assessment evidence are available.`
      : `Report card generated for ${course.name}, Week ${week} — ${reportCard?.score}% (${reportCard?.grade ?? "grade unavailable"}).`,
  });
}
