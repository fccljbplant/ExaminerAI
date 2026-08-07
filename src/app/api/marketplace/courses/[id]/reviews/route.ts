import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";

/**
 * GET /api/marketplace/courses/[id]/reviews — PUBLIC.
 * Returns all reviews for a course (newest first), with the reviewer's
 * public name, rating, title, content, helpful count, and date.
 *
 * No auth required — prospective students can read reviews before enrolling.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;

  const reviews = await db.courseReview.findMany({
    where: { courseId },
    orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      rating: true,
      title: true,
      content: true,
      helpful: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true } },
    },
    take: 200,
  });

  const total = reviews.length;
  const avgRating =
    total === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / total;

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      helpful: r.helpful,
      createdAt: r.createdAt.toISOString(),
      userId: r.userId,
      userName: r.user?.name ?? "Anonymous",
    })),
    total,
    avgRating: Math.round(avgRating * 10) / 10,
  });
}

/**
 * POST /api/marketplace/courses/[id]/reviews — auth required (students only).
 *
 * Creates a review for the course. Constraints:
 *  - Student must be enrolled in the course (CourseEnrollment role="student").
 *  - Student must have COMPLETED the course — evidenced by either:
 *    (a) holding a Certificate for this course, OR
 *    (b) having CurriculumProgress rows covering every week of the course
 *        (i.e. reached the final week and completed at least one day in it).
 *  - One review per user per course (enforced by @@unique).
 *
 * Body: { rating: 1-5, title: string, content: string }
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
  if (role !== UserRole.STUDENT) {
    return NextResponse.json(
      { error: "Only students can review courses." },
      { status: 403 }
    );
  }

  const { id: courseId } = await params;

  // Verify the course exists + is published.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      published: true,
      rating: true,
      reviewCount: true,
      weeks: { select: { weekNumber: true, days: { select: { id: true } } } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!course.published) {
    return NextResponse.json({ error: "Course not available" }, { status: 403 });
  }

  // Enrollment check.
  const enrollment = await db.courseEnrollment.findUnique({
    where: {
      userId_courseId_role: {
        userId: payload.sub,
        courseId,
        role: "student",
      },
    },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "You must be enrolled in this course to review it." },
      { status: 403 }
    );
  }

  // Completion check — either has a certificate, or has CurriculumProgress
  // rows covering every week of the course.
  const certificate = await db.certificate.findFirst({
    where: { userId: payload.sub, courseId },
    select: { id: true },
  });

  const totalWeeks = course.weeks.length;
  let completedAllWeeks = totalWeeks === 0; // edge case: no weeks
  if (totalWeeks > 0 && !certificate) {
    const progressRows = await db.curriculumProgress.findMany({
      where: { userId: payload.sub, courseId },
      select: { week: true },
    });
    const weeksCovered = new Set<number>();
    for (const p of progressRows) weeksCovered.add(p.week);
    completedAllWeeks = weeksCovered.size >= totalWeeks;
  }
  if (!certificate && !completedAllWeeks) {
    return NextResponse.json(
      {
        error:
          "You can only review this course after completing it (earn a certificate or finish all weeks).",
      },
      { status: 403 }
    );
  }

  // Parse + validate body.
  const body = await req.json().catch(() => ({}));
  const { rating, title, content } = body as {
    rating?: number;
    title?: string;
    content?: string;
  };
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer 1-5." }, { status: 400 });
  }
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 120) {
    return NextResponse.json({ error: "Title is required (max 120 chars)." }, { status: 400 });
  }
  if (typeof content !== "string" || content.trim().length === 0 || content.trim().length > 5000) {
    return NextResponse.json({ error: "Review content is required (max 5000 chars)." }, { status: 400 });
  }

  // If the user already reviewed, update rather than reject (the unique
  // constraint would otherwise throw). Treats "already reviewed" as an
  // update flow so students can revise their review after completion.
  try {
    const existing = await db.courseReview.findUnique({
      where: { userId_courseId: { userId: payload.sub, courseId } },
      select: { id: true },
    });

    const review = await db.$transaction(async (tx) => {
      if (existing) {
        return tx.courseReview.update({
          where: { id: existing.id },
          data: {
            rating,
            title: title.trim(),
            content: content.trim(),
          },
        });
      }
      return tx.courseReview.create({
        data: {
          userId: payload.sub,
          courseId,
          rating,
          title: title.trim(),
          content: content.trim(),
        },
      });
    });

    // Recompute the course's aggregate rating + reviewCount so they stay
    // consistent even when a review is updated rather than newly created.
    const agg = await db.courseReview.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await db.course.update({
      where: { id: courseId },
      data: {
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
        reviewCount: agg._count._all,
      },
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "course_review_submitted",
      target: { type: "course", id: courseId },
      after: { reviewId: review.id, rating, title: title.trim() },
      metadata: { source: "marketplace", updated: !!existing },
      req,
    }).catch(() => {});

    return NextResponse.json({ review }, { status: existing ? 200 : 201 });
  } catch (err) {
    // Prisma P2002 (unique violation) means a concurrent insert raced ahead.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You've already reviewed this course." },
        { status: 409 }
      );
    }
    throw err;
  }
}
