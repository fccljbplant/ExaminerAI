import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { scoreToGrade } from "@/lib/constants";
import { getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import { logAudit, AuditAction } from "@/lib/audit-log";
import crypto from "crypto";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/**
 * POST /api/certificates/generate — certificate request + approval flow.
 *
 * Flow:
 *   1. Student POSTs (no userId param) → creates a certificate REQUEST
 *      (status: "requested"). Returns { requested: true }.
 *   2. Teacher/admin POSTs with ?userId=studentId → APPROVES the request,
 *      generates the actual certificate with grade + score + verifyToken.
 *      Returns { certificate, verifyUrl }.
 *   3. Teacher/admin can also POST with ?userId=studentId&reject=true to
 *      reject the request with a reason.
 *
 * Completion criteria (checked at request time):
 *   - Student's currentWeek >= course duration
 *   - All weekly tests completed
 *
 * The certificate is idempotent — if one already exists, returns it.
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing certificates"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const reject = url.searchParams.get("reject") === "true";
  const isStaff = isStaffRole(payload.role);

  // Student requesting a certificate
  if (!isStaff && !userIdParam) {
    const targetUserId = payload.sub;

    // Check if a certificate already exists
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

    // Check completion criteria
    const [user, totalWeeks] = await Promise.all([
      db.user.findUnique({ where: { id: targetUserId }, select: { currentWeek: true, role: true, name: true } }),
      getCourseDurationWeeks(targetUserId),
    ]);
    if (!user || user.role !== "student") {
      return NextResponse.json({ error: "Only students can request certificates" }, { status: 400 });
    }

    const completedTests = await db.weeklyTest.count({
      where: { userId: targetUserId, status: "completed", score: { not: null } },
    });

    const reachedFinalWeek = user.currentWeek >= totalWeeks;
    const allTestsCompleted = completedTests >= totalWeeks;

    if (!reachedFinalWeek || !allTestsCompleted) {
      return NextResponse.json({
        error: "Course not yet complete",
        details: {
          currentWeek: user.currentWeek,
          totalWeeks,
          completedTests,
          reachedFinalWeek,
          allTestsCompleted,
        },
      }, { status: 403 });
    }

    // Check if a request already exists (grade = "PENDING" means it's a request, not an issued certificate)
    const existingRequest = await db.certificate.findFirst({
      where: { userId: targetUserId, grade: "PENDING" },
    });
    if (existingRequest) {
      return NextResponse.json({
        requested: true,
        message: "Certificate request already submitted. Waiting for instructor approval.",
        requestId: existingRequest.id,
      });
    }

    // Create a certificate REQUEST (status: "requested", no grade/score yet)
    const courseMeta = await getCourseMetadata(targetUserId);
    const request = await db.certificate.create({
      data: {
        userId: targetUserId,
        courseName: courseMeta?.name ?? "Course",
        studentName: user.name,
        grade: "PENDING",
        score: 0,
        signedBy: "PENDING",
        verifyToken: crypto.randomBytes(32).toString("hex"),
        // Use a convention: issuedAt is the request date; actual issue happens on approval
      },
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "certificate_requested",
      target: { type: "user", id: targetUserId },
      metadata: { requestId: request.id },
      req,
    }).catch((err) => { logger.warn("Operation failed", { err }); });

    return NextResponse.json({
      requested: true,
      message: "Certificate request submitted. Your instructor will review and approve it.",
      requestId: request.id,
    });
  }

  // Staff approving or rejecting a certificate request
  if (isStaff && userIdParam) {
    const targetUserId = userIdParam;

    // IDOR protection
    try { await assertCanAccessStudent(payload, targetUserId); } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }

    // Find the pending request
    const request = await db.certificate.findFirst({
      where: { userId: targetUserId, grade: "PENDING" },
      orderBy: { issuedAt: "desc" },
    });

    if (!request) {
      // No pending request — check if already has a certificate
      const existing = await db.certificate.findFirst({
        where: { userId: targetUserId, grade: { not: "PENDING" } },
        orderBy: { issuedAt: "desc" },
      });
      if (existing) {
        return NextResponse.json({
          certificate: existing,
          verifyUrl: `/verify/${existing.verifyToken}`,
          alreadyExisted: true,
        });
      }
      return NextResponse.json({ error: "No pending certificate request for this student" }, { status: 404 });
    }

    // Reject
    if (reject) {
      const body = await req.json().catch(() => ({}));
      const reason = (body as { reason?: string })?.reason || "Rejected by staff";
      await db.certificate.delete({ where: { id: request.id } });
      await logAudit({
        actor: { id: payload.sub, name: payload.name, role: payload.role },
        action: "certificate_rejected",
        target: { type: "user", id: targetUserId },
        metadata: { reason },
        req,
      }).catch((err) => { logger.warn("Operation failed", { err }); });
      return NextResponse.json({ rejected: true, reason });
    }

    // Approve — generate the actual certificate with grade + score
    const [user, totalWeeks, courseMeta] = await Promise.all([
      db.user.findUnique({ where: { id: targetUserId }, select: { name: true, role: true } }),
      getCourseDurationWeeks(targetUserId),
      getCourseMetadata(targetUserId),
    ]);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const completedTests = await db.weeklyTest.findMany({
      where: { userId: targetUserId, status: "completed", score: { not: null } },
      select: { week: true, score: true },
      orderBy: { week: "asc" },
    });

    const scores = completedTests.map(t => t.score).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const grade = scoreToGrade(avgScore);

    // Fetch actual course ID via enrollment
    let actualCourseId: string | null = null;
    try {
      const enrollment = await db.courseEnrollment.findFirst({
        where: { userId: targetUserId, role: "student" },
        select: { courseId: true },
      });
      actualCourseId = enrollment?.courseId ?? null;
    } catch {}

    const certificate = await db.certificate.update({
      where: { id: request.id },
      data: {
        grade,
        score: avgScore,
        signedBy: payload.name,
        courseId: actualCourseId,
        courseName: courseMeta?.name ?? request.courseName,
        studentName: user.name,
      },
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: AuditAction.CERTIFICATE_GENERATED,
      target: { type: "user", id: targetUserId },
      after: { grade, score: avgScore, certificateId: certificate.id },
      req,
    }).catch((err) => { logger.warn("Operation failed", { err }); });

    return NextResponse.json({
      certificate,
      verifyUrl: `/verify/${certificate.verifyToken}`,
      approved: true,
    });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
