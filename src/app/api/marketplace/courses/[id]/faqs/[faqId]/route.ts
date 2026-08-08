import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/marketplace/courses/[id]/faqs/[faqId] — auth required (instructor/admin).
 *
 * Updates a FAQ's question and/or answer.
 *
 * Body: { question?: string, answer?: string, order?: number }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; faqId: string }> }
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

  const { id: courseId, faqId } = await params;

  // Verify the course + FAQ exist.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorName: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (role === UserRole.INSTRUCTOR && course.instructorName !== payload.name) {
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

  const existing = await db.courseFAQ.findUnique({
    where: { id: faqId },
    select: { id: true, courseId: true },
  });
  if (!existing || existing.courseId !== courseId) {
    return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { question, answer, order } = body as {
    question?: string;
    answer?: string;
    order?: number;
  };

  const data: Record<string, unknown> = {};
  if (typeof question === "string") {
    if (question.trim().length === 0 || question.trim().length > 500) {
      return NextResponse.json({ error: "Question max 500 chars." }, { status: 400 });
    }
    data.question = question.trim();
  }
  if (typeof answer === "string") {
    if (answer.trim().length === 0 || answer.trim().length > 5000) {
      return NextResponse.json({ error: "Answer max 5000 chars." }, { status: 400 });
    }
    data.answer = answer.trim();
  }
  if (typeof order === "number" && Number.isInteger(order)) {
    data.order = order;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db.courseFAQ.update({
    where: { id: faqId },
    data,
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "course_faq_updated",
    target: { type: "course", id: courseId },
    after: { faqId, fields: Object.keys(data) },
    metadata: { source: "marketplace" },
    req,
  }).catch((err) => { logger.warn("Operation failed", { err }); });

  return NextResponse.json({
    faq: {
      id: updated.id,
      question: updated.question,
      answer: updated.answer,
      order: updated.order,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

/**
 * DELETE /api/marketplace/courses/[id]/faqs/[faqId] — auth required (instructor/admin).
 *
 * Permanently deletes a FAQ.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; faqId: string }> }
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

  const { id: courseId, faqId } = await params;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorName: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (role === UserRole.INSTRUCTOR && course.instructorName !== payload.name) {
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

  const existing = await db.courseFAQ.findUnique({
    where: { id: faqId },
    select: { id: true, courseId: true },
  });
  if (!existing || existing.courseId !== courseId) {
    return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  }

  await db.courseFAQ.delete({ where: { id: faqId } });

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "course_faq_deleted",
    target: { type: "course", id: courseId },
    after: { faqId },
    metadata: { source: "marketplace" },
    req,
  }).catch((err) => { logger.warn("Operation failed", { err }); });

  return NextResponse.json({ ok: true });
}
