import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";

/**
 * GET /api/marketplace/courses/[id]/faqs — PUBLIC.
 * Returns all FAQs for a course, ordered by `order` then `createdAt`.
 *
 * No auth required — prospective students can read FAQs before enrolling.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;

  // Verify the course exists (don't require published=true so instructors
  // can preview FAQs on draft courses from the marketplace edit screen).
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true, instructorName: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const faqs = await db.courseFAQ.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    faqs: faqs.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      order: f.order,
      createdAt: f.createdAt.toISOString(),
    })),
    total: faqs.length,
  });
}

/**
 * POST /api/marketplace/courses/[id]/faqs — auth required (instructor/admin).
 *
 * Creates a new FAQ. The new FAQ's `order` is auto-set to max+1 so it
 * appears at the end of the list by default.
 *
 * Body: { question: string, answer: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = normalizeRole(payload.role);
  if (!role || !hasRole(payload.role, [...ADMIN_ROLES, UserRole.INSTRUCTOR])) {
    return NextResponse.json(
      { error: "Only instructors and admins can manage FAQs." },
      { status: 403 }
    );
  }

  const { id: courseId } = await params;

  // Verify the course exists.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorName: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Instructors can only manage FAQs for courses they teach. Admins/principals
  // can manage any course's FAQs.
  if (role === UserRole.INSTRUCTOR && course.instructorName !== payload.name) {
    // Also check by user-to-course enrollment (in case the instructorName
    // field doesn't match the user's display name).
    const enrollment = await db.courseEnrollment.findUnique({
      where: {
        userId_courseId_role: {
          userId: payload.sub,
          courseId,
          role: "instructor",
        },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "You can only manage FAQs for courses you teach." },
        { status: 403 }
      );
    }
  }

  // Parse + validate body.
  const body = await req.json().catch(() => ({}));
  const { question, answer } = body as { question?: string; answer?: string };
  if (typeof question !== "string" || question.trim().length === 0 || question.trim().length > 500) {
    return NextResponse.json({ error: "Question is required (max 500 chars)." }, { status: 400 });
  }
  if (typeof answer !== "string" || answer.trim().length === 0 || answer.trim().length > 5000) {
    return NextResponse.json({ error: "Answer is required (max 5000 chars)." }, { status: 400 });
  }

  // Auto-set order to max+1.
  const maxOrderRow = await db.courseFAQ.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (maxOrderRow?.order ?? -1) + 1;

  const faq = await db.courseFAQ.create({
    data: {
      courseId,
      question: question.trim(),
      answer: answer.trim(),
      order: nextOrder,
    },
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "course_faq_created",
    target: { type: "course", id: courseId },
    after: { faqId: faq.id, question: question.trim() },
    metadata: { source: "marketplace" },
    req,
  }).catch(() => {});

  return NextResponse.json(
    {
      faq: {
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        order: faq.order,
        createdAt: faq.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
