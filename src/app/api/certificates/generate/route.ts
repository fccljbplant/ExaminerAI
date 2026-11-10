import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { scoreToGrade } from "@/lib/constants";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { checkEligibility, generateCredentialId } from "@/modules/course/lib/certificate";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * POST /api/certificates/generate
 *
 * Student request body: { courseId }
 * Staff approval/rejection: ?userId=<learner>&courseId=<course>[&reject=true]
 *
 * Every request and decision is bound to one enrolled course. Eligibility is
 * rechecked at approval time from that course's published weeks, topic progress
 * and selected weekly-test attempts.
 */
export async function POST(req: NextRequest) {
  const demoBlock = await demoWriteBlock("managing certificates");
  if (demoBlock) return demoBlock;

  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const requestedCourseId = url.searchParams.get("courseId");
  const reject = url.searchParams.get("reject") === "true";
  const isStaff = isStaffRole(payload.role);

  if (!isStaff && userIdParam) {
    return NextResponse.json({ error: "Only staff can decide another learner's certificate request" }, { status: 403 });
  }

  // Learner submits a request for one of their own enrolled courses.
  if (!isStaff) {
    if (payload.role !== "learner" && payload.role !== "student") {
      return NextResponse.json({ error: "Only learners can request their own certificate" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: payload.sub, courseId, role: "student" },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in the selected course" }, { status: 403 });
    }

    const eligibility = await checkEligibility(payload.sub, courseId);
    if (!eligibility) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const existing = await db.certificate.findFirst({
      where: { userId: payload.sub, courseId, grade: { notIn: ["PENDING", "REJECTED"] } },
      orderBy: { issuedAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        certificate: existing,
        verifyUrl: `/verify/${existing.credentialId ?? existing.verifyToken}`,
        alreadyExisted: true,
      });
    }

    if (!eligibility.eligible) {
      return NextResponse.json({
        error: "Course completion requirements are not yet met",
        details: {
          courseId,
          weeksCompleted: eligibility.weeksCompleted,
          totalWeeks: eligibility.totalWeeks,
          averageScore: eligibility.avgScore,
        },
      }, { status: 403 });
    }

    const existingRequest = await db.certificate.findFirst({
      where: { userId: payload.sub, courseId, grade: "PENDING" },
    });
    if (existingRequest) {
      return NextResponse.json({
        requested: true,
        message: "Certificate request already submitted for this course.",
        requestId: existingRequest.id,
        courseId,
      });
    }

    const [user, course] = await Promise.all([
      db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, name: true } }),
      db.course.findUnique({ where: { id: courseId }, select: { id: true, name: true } }),
    ]);
    if (!user || (user.role !== "learner" && user.role !== "student")) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const request = await db.certificate.create({
      data: {
        userId: payload.sub,
        courseId,
        courseName: course.name,
        studentName: user.name,
        grade: "PENDING",
        score: null,
        signedBy: "PENDING",
        verifyToken: crypto.randomBytes(32).toString("hex"),
      },
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
      action: "certificate_requested",
      target: { type: "user", id: payload.sub },
      metadata: { requestId: request.id, courseId },
      req,
    }).catch((err) => { logger.warn("Certificate request audit failed", { err }); });

    return NextResponse.json({
      requested: true,
      message: "Certificate request submitted for instructor review.",
      requestId: request.id,
      courseId,
    }, { status: 201 });
  }

  // Staff must specify both learner and course; the selected course is
  // intersected with the learner's enrolments and the staff member's scope.
  if (!userIdParam || !requestedCourseId) {
    return NextResponse.json({ error: "userId and courseId are required for staff decisions" }, { status: 400 });
  }
  const targetUserId = userIdParam;
  const courseId = requestedCourseId;

  try {
    await assertCanAccessStudent(payload, targetUserId, "content_only");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }

  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, targetUserId);
  if (!authorisedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot manage certificates for this learner's selected course" }, { status: 403 });
  }

  const request = await db.certificate.findFirst({
    where: { userId: targetUserId, courseId, grade: "PENDING" },
    orderBy: { issuedAt: "desc" },
  });

  if (!request) {
    const existing = await db.certificate.findFirst({
      where: { userId: targetUserId, courseId, grade: { notIn: ["PENDING", "REJECTED"] } },
      orderBy: { issuedAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        certificate: existing,
        verifyUrl: `/verify/${existing.credentialId ?? existing.verifyToken}`,
        alreadyExisted: true,
      });
    }
    return NextResponse.json({ error: "No pending certificate request for this learner and course" }, { status: 404 });
  }

  if (reject) {
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ error: "A rejection reason of 5–500 characters is required" }, { status: 400 });
    }
    await db.certificate.update({
      where: { id: request.id },
      data: {
        grade: "REJECTED",
        score: null,
        signedBy: "REJECTED",
        rejectionReason: reason,
        rejectedById: payload.sub,
        rejectedAt: new Date(),
      },
    });
    await logAudit({
      actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
      action: "certificate_rejected",
      target: { type: "user", id: targetUserId },
      metadata: { courseId, reason },
      req,
    }).catch((err) => { logger.warn("Certificate rejection audit failed", { err }); });
    return NextResponse.json({ rejected: true, reason, courseId });
  }

  // Recheck all eligibility against this course at approval time. Never
  // substitute another course's progress or weekly-test scores.
  const eligibility = await checkEligibility(targetUserId, courseId);
  if (!eligibility) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (eligibility.hasCertificate) {
    const existing = await db.certificate.findFirst({
      where: { userId: targetUserId, courseId, grade: { notIn: ["PENDING", "REJECTED"] } },
      orderBy: { issuedAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        certificate: existing,
        verifyUrl: `/verify/${existing.credentialId ?? existing.verifyToken}`,
        alreadyExisted: true,
      });
    }
  }
  if (!eligibility.eligible || eligibility.avgScore === null) {
    return NextResponse.json({
      error: "The learner no longer meets the selected course certificate criteria",
      details: {
        courseId,
        weeksCompleted: eligibility.weeksCompleted,
        totalWeeks: eligibility.totalWeeks,
        averageScore: eligibility.avgScore,
      },
    }, { status: 409 });
  }

  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: targetUserId }, select: { name: true, role: true } }),
    db.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, skillsVerified: true },
    }),
  ]);
  if (!user || (user.role !== "learner" && user.role !== "student")) {
    return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  }
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  let issuer = payload.name || payload.sub;
  let orgId: string | null = null;
  const membership = await db.orgMember.findFirst({
    where: { userId: targetUserId, status: "active" },
    select: { orgId: true, org: { select: { name: true } } },
  }).catch(() => null);
  if (membership) {
    issuer = membership.org.name;
    orgId = membership.orgId;
  }

  let skillsVerified: string[] = [];
  try {
    const parsed = JSON.parse(course.skillsVerified || "[]");
    if (Array.isArray(parsed)) skillsVerified = parsed.filter((skill): skill is string => typeof skill === "string");
  } catch {
    skillsVerified = [];
  }

  const avgScore = eligibility.avgScore;
  const grade = scoreToGrade(avgScore);
  const credentialIdBase = generateCredentialId(user.name, course.name, avgScore);
  let credentialId = credentialIdBase;
  for (let salt = 1; salt <= 5; salt++) {
    const clash = await db.certificate.findUnique({ where: { credentialId }, select: { id: true } });
    if (!clash || clash.id === request.id) break;
    credentialId = generateCredentialId(user.name, course.name, avgScore, salt);
  }

  const certificate = await db.certificate.update({
    where: { id: request.id },
    data: {
      courseId,
      courseName: course.name,
      studentName: user.name,
      grade,
      score: avgScore,
      signedBy: issuer,
      orgId,
      credentialId,
      capstonePassed: eligibility.capstonePassed,
      skillsVerified: JSON.stringify(skillsVerified),
      distinction: avgScore >= 85,
      completedAt: new Date(),
    },
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.CERTIFICATE_GENERATED,
    target: { type: "user", id: targetUserId },
    after: { courseId, grade, score: avgScore, certificateId: certificate.id },
    req,
  }).catch((err) => { logger.warn("Certificate issuance audit failed", { err }); });

  return NextResponse.json({
    certificate,
    verifyUrl: `/verify/${certificate.credentialId ?? certificate.verifyToken}`,
    approved: true,
    courseId,
  });
}
