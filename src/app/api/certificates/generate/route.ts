import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { scoreToGrade } from "@/lib/constants";
import { getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import crypto from "crypto";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/certificates/generate — auto-generate a certificate for the
 *  student when they complete their course.
 *
 *  Phase 4.1 + 4.2.
 *
 *  Completion criteria:
 *  - Student's currentWeek >= course duration (they've reached the final week)
 *  - All weekly tests completed (one per week)
 *
 *  The certificate is idempotent — if one already exists for this student,
 *  it returns the existing one instead of creating a duplicate.
 *
 *  Auth: the student themselves can trigger this (auto-called when they view
 *  their dashboard post-completion), or a teacher/admin can trigger it with
 *  ?userId=studentId.
 *
 *  Returns: { certificate: { id, courseName, studentName, grade, score, issuedAt, signedBy, verifyToken, verifyUrl } }
 */
export async function POST(req: Request) {
  const _demoBlock = await demoWriteBlock("generating certificates"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const targetUserId = (isStaffRole(payload.role)) && userIdParam
    ? userIdParam
    : payload.sub;
  // IDOR protection: verify the caller can access this student's data
  if (targetUserId !== payload.sub) {
    try {
      await assertCanAccessStudent(payload, targetUserId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }

  // Fetch the student + their completed tests + course metadata
  const [user, totalWeeks, courseMeta] = await Promise.all([
    db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, currentWeek: true, role: true },
    }),
    getCourseDurationWeeks(targetUserId),
    getCourseMetadata(targetUserId),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role !== "student") return NextResponse.json({ error: "Only students get certificates" }, { status: 400 });

  // Check if a certificate already exists (idempotent)
  const existing = await db.certificate.findFirst({
    where: { userId: targetUserId },
    orderBy: { issuedAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({
      certificate: existing,
      verifyUrl: `/verify/${existing.verifyToken}`,
      alreadyExisted: true,
    });
  }

  // Fetch completed weekly tests
  const completedTests = await db.weeklyTest.findMany({
    where: { userId: targetUserId, status: "completed", score: { not: null } },
    select: { week: true, score: true },
    orderBy: { week: "asc" },
  });

  // ---- Completion check ----
  // Student must have reached the final week AND completed all weekly tests.
  const reachedFinalWeek = user.currentWeek >= totalWeeks;
  const allTestsCompleted = completedTests.length >= totalWeeks;

  if (!reachedFinalWeek || !allTestsCompleted) {
    return NextResponse.json({
      error: "Course not yet complete",
      details: {
        currentWeek: user.currentWeek,
        totalWeeks,
        reachedFinalWeek,
        completedTests: completedTests.length,
        allTestsCompleted,
      },
    }, { status: 400 });
  }

  // ---- Compute final score ----
  // Average of all weekly test scores. Same logic as final-result/route.ts
  // but we recompute here to keep the certificate endpoint self-contained.
  const scores = completedTests.map(t => t.score).filter((s): s is number => s !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const grade = scoreToGrade(avgScore);

  // ---- Create the certificate ----
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const courseName = courseMeta?.name ?? "Modern Web Dev & AI Bootcamp";
  const signedBy = "AI Examiner"; // auto-signed; teacher can re-sign manually later

  const certificate = await db.certificate.create({
    data: {
      userId: targetUserId,
      courseId: courseMeta?.name ?? null, // we don't have the course ID here; courseMeta doesn't return it
      courseName,
      studentName: user.name,
      grade,
      score: avgScore,
      signedBy,
      verifyToken,
    },
  });

  return NextResponse.json({
    certificate,
    verifyUrl: `/verify/${verifyToken}`,
    justIssued: true,
  });
}
