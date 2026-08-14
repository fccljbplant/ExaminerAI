import type { Metadata } from "next";
import { ReviewDetail } from "@/modules/instructor-portal";

/**
 * /instructor/review/[submissionId] — I4 Review detail
 * (REDESIGN-P3 §I4, W4 review side). Auth / role / flag in the layout.
 */

export const metadata: Metadata = {
  title: "Review — TraineesAI",
};

export default async function InstructorReviewDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return <ReviewDetail submissionId={submissionId} />;
}
