import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";

/**
 * POST /api/marketplace/enroll — direct self-enrollment for students.
 *
 * A student browsing the public marketplace can enroll themselves into a
 * published course without waiting for an admin to assign them. The flow is:
 *
 *   1. Auth required (student only — staff should manage via /api/enrollments).
 *   2. Demo accounts (@demo.ai) are blocked — they keep the demo data stable.
 *   3. The course must be published.
 *   4. If already enrolled as a student → 409 "Already enrolled".
 *   5. Otherwise — create CourseEnrollment(role="student") + bump the
 *      course's enrollmentCount. Returns 201 with the enrollment row.
 *
 * Body: { courseId: string }
 */
export async function POST(req: NextRequest) {
  // 1) Demo write guard — @demo.ai accounts cannot mutate state.
  const _demoBlock = await demoWriteBlock("self-enrolling in courses");
  if (_demoBlock) return _demoBlock;

  // 2) Auth + role check — only students self-enroll via the marketplace.
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = normalizeRole(payload.role);
  if (role !== UserRole.STUDENT) {
    return NextResponse.json(
      { error: "Only student accounts can self-enroll. Instructors/admins should assign courses via the admin panel." },
      { status: 403 }
    );
  }

  // 3) Parse + validate body.
  const body = await req.json().catch(() => ({}));
  const { courseId } = body as { courseId?: string };
  if (!courseId || typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  // 4) Fetch the course — must exist AND be published.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, published: true, enrollmentCount: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!course.published) {
    return NextResponse.json({ error: "Course not available" }, { status: 403 });
  }

  // 5) Already-enrolled check — unique on [userId, courseId, role="student"].
  const existing = await db.courseEnrollment.findUnique({
    where: {
      userId_courseId_role: {
        userId: payload.sub,
        courseId,
        role: "student",
      },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Already enrolled", enrollment: existing }, { status: 409 });
  }

  // 6) Create enrollment + bump enrollmentCount in a transaction so the
  //    counter can never drift out of sync if anything fails mid-flight.
  const enrollment = await db.$transaction(async (tx) => {
    const created = await tx.courseEnrollment.create({
      data: { userId: payload.sub, courseId, role: "student" },
    });
    await tx.course.update({
      where: { id: courseId },
      data: { enrollmentCount: { increment: 1 } },
    });
    return created;
  });

  // 7) Best-effort audit log — never blocks the response.
  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "enrollment_created",
    target: { type: "course", id: courseId },
    after: { courseId, courseName: course.name, role: "student", source: "marketplace" },
    metadata: { source: "marketplace_self_enroll" },
    req,
  }).catch(() => {});

  return NextResponse.json({ enrollment }, { status: 201 });
}
