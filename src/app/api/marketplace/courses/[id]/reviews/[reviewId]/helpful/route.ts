import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/marketplace/courses/[id]/reviews/[reviewId]/helpful — auth required.
 *
 * Upvotes a review (increments `helpful`). One vote per user — enforced by
 * the @@unique([reviewId, userId]) on CourseReviewHelpfulVote. If the user
 * has already voted, the vote is REMOVED (toggle behaviour) so the UI can
 * offer a "Mark as helpful / Unmark" toggle without a separate endpoint.
 *
 * Auth: any logged-in user (students, instructors, admins) — they don't need
 * to be enrolled to find a review useful.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, reviewId } = await params;

  // Verify the review exists + belongs to this course.
  const review = await db.courseReview.findUnique({
    where: { id: reviewId },
    select: { id: true, courseId: true, helpful: true },
  });
  if (!review || review.courseId !== courseId) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Look for an existing vote from this user.
  const existingVote = await db.courseReviewHelpfulVote.findUnique({
    where: {
      reviewId_userId: { reviewId, userId: payload.sub },
    },
    select: { id: true },
  });

  try {
    if (existingVote) {
      // Toggle off — remove the vote + decrement helpful.
      await db.$transaction(async (tx) => {
        await tx.courseReviewHelpfulVote.delete({ where: { id: existingVote.id } });
        await tx.courseReview.update({
          where: { id: reviewId },
          data: { helpful: { decrement: 1 } },
        });
      });
      return NextResponse.json({ helpful: review.helpful - 1, voted: false });
    }

    // Toggle on — create the vote + increment helpful.
    await db.$transaction(async (tx) => {
      await tx.courseReviewHelpfulVote.create({
        data: { reviewId, userId: payload.sub },
      });
      await tx.courseReview.update({
        where: { id: reviewId },
        data: { helpful: { increment: 1 } },
      });
    });
    return NextResponse.json({ helpful: review.helpful + 1, voted: true });
  } catch (err) {
    // P2002 = the user already voted between our check + insert (race).
    // Treat as success — return current count.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const fresh = await db.courseReview.findUnique({
        where: { id: reviewId },
        select: { helpful: true },
      });
      return NextResponse.json({ helpful: fresh?.helpful ?? review.helpful, voted: true });
    }
    throw err;
  }
}
