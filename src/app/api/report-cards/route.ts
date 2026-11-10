import { isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { ReportCardWriteError, saveCourseReportCard } from "@/modules/course/lib/report-card-records";
import { parseCourseReportCardPolicy } from "@/modules/course/lib/report-card";

function serialiseList(value: unknown): string | null {
  if (value === undefined || value === null) return JSON.stringify([]);
  if (!Array.isArray(value) && typeof value !== "string") return null;
  const serialised = JSON.stringify(value);
  return serialised.length <= 10_000 ? serialised : null;
}

/** GET /api/report-cards?userId=...&courseId=... */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userIdParam = req.nextUrl.searchParams.get("userId");
  const targetUserId = userIdParam && isStaffRole(payload.role) ? userIdParam : payload.sub;
  const courseId = req.nextUrl.searchParams.get("courseId");
  const isSelf = targetUserId === payload.sub;

  if (!isSelf) {
    if (!isStaffRole(payload.role) || !courseId) {
      return NextResponse.json({ error: "A selected course is required for staff report-card views" }, { status: 400 });
    }
    try {
      await assertCanAccessStudent(payload, targetUserId, "content_only");
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
    }
    const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, targetUserId);
    if (!authorisedCourseIds.includes(courseId)) {
      return NextResponse.json({ error: "You cannot access report cards for this course" }, { status: 403 });
    }
  } else if (courseId) {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: targetUserId, courseId, role: "student" },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
    }
  }

  const reportCards = await db.reportCard.findMany({
    where: { userId: targetUserId, ...(courseId ? { courseId } : {}) },
    include: { versions: { orderBy: { version: "asc" } } },
    orderBy: [{ courseId: "asc" }, { week: "asc" }],
  });
  return NextResponse.json({ reportCards });
}

/** POST /api/report-cards — create or correct a report card within one authorised course. */
export async function POST(req: NextRequest) {
  const demoBlock = await demoWriteBlock("generating report cards");
  if (demoBlock) return demoBlock;

  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const week = Number(body.week);
  if (!userId || !courseId || !Number.isInteger(week) || week < 1 || week > 52) {
    return NextResponse.json({ error: "userId, courseId and a valid week are required" }, { status: 400 });
  }

  try {
    await assertCanAccessStudent(payload, userId, "content_only");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }

  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, userId);
  if (!authorisedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot write report cards for this course" }, { status: 403 });
  }

  const [learner, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        reportCardTemplateJson: true,
        weeks: { select: { weekNumber: true } },
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

  const score = body.score === null || body.score === undefined
    ? null
    : typeof body.score === "number" ? body.score : Number.NaN;
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    return NextResponse.json({ error: "score must be null or a number from 0 to 100" }, { status: 400 });
  }
  const requestedGrade = typeof body.grade === "string" && body.grade.trim() ? body.grade.trim().slice(0, 20) : null;
  const gradingPolicy = parseCourseReportCardPolicy(course.reportCardTemplateJson);
  let grade: string | null = null;
  if (score === null && requestedGrade !== null) {
    return NextResponse.json({ error: "A grade cannot be assigned when the score is unavailable" }, { status: 400 });
  }
  if (score !== null) {
    if (!gradingPolicy) {
      return NextResponse.json({ error: "The selected course has no valid grading policy; a graded result cannot be saved" }, { status: 409 });
    }
    const matchingGrade = gradingPolicy.gradingScale.find((entry) => score >= entry.min && score <= entry.max)?.grade ?? null;
    if (!matchingGrade) {
      return NextResponse.json({ error: "The score is outside the selected course grading scale" }, { status: 400 });
    }
    if (requestedGrade && requestedGrade !== matchingGrade) {
      return NextResponse.json({ error: "The supplied grade does not match the selected course grading scale" }, { status: 400 });
    }
    grade = matchingGrade;
  }

  const strengths = serialiseList(body.strengths);
  const weaknesses = serialiseList(body.weaknesses);
  const nextSteps = serialiseList(body.nextSteps);
  const progress = typeof body.progress === "string" ? body.progress : "";
  if (strengths === null || weaknesses === null || nextSteps === null ||
      progress.length > 10_000) {
    return NextResponse.json({ error: "Report-card text fields must be valid and no longer than 10,000 characters" }, { status: 400 });
  }

  let reportCard;
  try {
    reportCard = await saveCourseReportCard({
      fields: {
        userId,
        courseId,
        week,
        grade,
        score,
        strengths,
        weaknesses,
        progress,
        nextSteps,
      },
      actorId: payload.sub,
      actorRole: payload.role,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined,
      expectedVersion: Number.isInteger(body.expectedVersion) ? body.expectedVersion : undefined,
      requireExpectedVersion: true,
    });
  } catch (err) {
    if (err instanceof ReportCardWriteError) {
      const status = err.code === "REPORT_CARD_REASON_REQUIRED" ? 400 : 409;
      return NextResponse.json({ error: err.code }, { status });
    }
    logger.error("Manual course report-card write failed", {
      learnerId: userId,
      courseId,
      week,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not save the report card. Please retry." }, { status: 500 });
  }

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.REPORT_CARD_UPDATED,
    target: { type: "report_card", id: reportCard?.id ?? userId },
    after: {
      courseId,
      week,
      version: reportCard?.version ?? null,
      score: reportCard?.score ?? null,
      grade: reportCard?.grade ?? null,
    },
    metadata: { reasonProvided: Boolean(typeof body.reason === "string" && body.reason.trim()) },
    req,
  });

  return NextResponse.json({ reportCard });
}
