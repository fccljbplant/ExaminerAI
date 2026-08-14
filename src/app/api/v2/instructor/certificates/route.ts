/**
 * GET/POST /api/v2/instructor/certificates — certificate management
 * (V1 CertificateApprovals re-homed, W10 audit)
 *
 * GET: certificates of the students the instructor teaches + the
 *      course/student pickers for the issue form.
 * POST: issue a certificate (grade + score) — creates the Certificate
 *       row with the instructor as signer + a random verify token,
 *       notifies the student. Demo-guarded, audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

const IssueSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  grade: z.string().min(1).max(5),
  score: z.number().int().min(0).max(100),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const teaching = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = teaching.map((t) => t.courseId);

  const [students, courses, certificates] = await Promise.all([
    db.courseEnrollment.findMany({
      where: { courseId: { in: courseIds }, role: "student" },
      select: { userId: true, courseId: true },
      distinct: ["userId"],
    }),
    db.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } }),
    db.certificate.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: { issuedAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const studentIds = [...new Set(students.map((s) => s.userId))];
  const users = await db.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, name: true },
  });

  return apiSuccess({
    students: users,
    courses,
    certificates: certificates.map((c) => ({
      id: c.id,
      studentName: c.user.name,
      courseName: c.courseName,
      grade: c.grade,
      score: c.score,
      signedBy: c.signedBy,
      issuedAt: c.issuedAt.toISOString(),
      verifyUrl: `/verify/${c.verifyToken}`,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("issuing a certificate");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = IssueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid certificate body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  // IDOR: must teach the course AND the student must be enrolled in it.
  const teaching = await db.courseEnrollment.findFirst({
    where: { userId: user.sub, role: "instructor", courseId: parsed.data.courseId },
    select: { id: true },
  });
  if (!teaching) return apiError("You do not teach this course", "FORBIDDEN", 403);
  const enrolled = await db.courseEnrollment.findFirst({
    where: { userId: parsed.data.studentId, role: "student", courseId: parsed.data.courseId },
    select: { id: true },
  });
  if (!enrolled) return apiError("Student is not enrolled in this course", "FORBIDDEN", 403);

  const [student, course] = await Promise.all([
    db.user.findUnique({ where: { id: parsed.data.studentId }, select: { id: true, name: true } }),
    db.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true, name: true } }),
  ]);
  if (!student || !course) return apiError("Student or course not found", "NOT_FOUND", 404);

  const certificate = await db.certificate.create({
    data: {
      userId: student.id,
      courseId: course.id,
      courseName: course.name,
      studentName: student.name,
      grade: parsed.data.grade,
      score: parsed.data.score,
      signedBy: user.name,
      verifyToken: `cert-${randomUUID().slice(0, 12)}`,
    },
  });

  await db.notification.create({
    data: {
      userId: student.id,
      type: "credential_earned",
      title: "You earned a certificate",
      body: `${user.name} certified you in ${course.name} (${parsed.data.grade}).`,
      link: `/verify/${certificate.verifyToken}`,
    },
  });

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "certificate_issued",
    target: { type: "user", id: student.id },
    after: { courseId: course.id, grade: parsed.data.grade, score: parsed.data.score },
  });

  return apiSuccess(
    { certificate: { id: certificate.id, verifyUrl: `/verify/${certificate.verifyToken}` } },
    201,
  );
}
