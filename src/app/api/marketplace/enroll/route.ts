import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { sendEnrollmentConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * POST /api/marketplace/enroll — direct self-enrollment for students.
 *
 * A student browsing the public marketplace can enroll themselves into a
 * published course without waiting for an admin to assign them. The flow is:
 *
 *   1. Auth required (student only — staff should manage via /api/enrollments).
 *   2. The course must be published.
 *   3. PAID courses require a completed Payment (from Stripe Checkout) —
 *      the checkout webhook creates the payment, which is proof of purchase.
 *      Free courses enroll directly.
 *   4. If already enrolled as a student → 409 "Already enrolled".
 *   5. Otherwise — create CourseEnrollment(role="student") + bump the
 *      course's enrollmentCount. Returns 201 with the enrollment row.
 *
 * Body: { courseId: string }
 */
export async function POST(req: NextRequest) {
  // demoWriteBlock is a no-op since demo-routing (demo sessions write to
  // the isolated local demo db) — kept for compatibility with the guard
  // contract; @demo.ai enrollments land in the demo db only.
  const _demoBlock = await demoWriteBlock("self-enrolling in courses");
  if (_demoBlock) return _demoBlock;

  // 2) Auth + role check — only students self-enroll via the marketplace.
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = normalizeRole(payload.role);
  if (role !== UserRole.LEARNER) {
    return NextResponse.json(
      { error: "Only learner accounts can self-enroll. Instructors/admins should assign courses via the admin panel." },
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
    select: { id: true, name: true, published: true, enrollmentCount: true, price: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!course.published) {
    return NextResponse.json({ error: "Course not available" }, { status: 403 });
  }

  // 4b) Payment enforcement — a paid course can only be enrolled through
  //     Stripe Checkout. The checkout webhook creates the Payment row, so
  //     its presence is the proof of purchase. (2026-08-17: previously this
  //     endpoint enrolled ANY published course for free — the UI routed
  //     paid buyers to Stripe, but the API itself never checked.)
  if ((course.price ?? 0) > 0) {
    const payment = await db.payment.findFirst({
      where: { userId: payload.sub, courseId, status: "completed" },
      select: { id: true },
    });
    if (!payment) {
      return NextResponse.json(
        { error: "This is a paid course — complete checkout to enroll.", code: "PAYMENT_REQUIRED" },
        { status: 402 },
      );
    }
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
  }).catch((err) => { logger.warn("Operation failed", { err }); });

  // 8) Best-effort enrollment confirmation notification (in-app bell).
  //    Fires after the response is committed to the audit log so a
  //    notification failure can never block the enrollment itself.
  void sendEnrollmentConfirmation(payload.sub, course.name, courseId).catch((err) => { logger.warn("Operation failed", { err }); });

  return NextResponse.json({ enrollment }, { status: 201 });
}
