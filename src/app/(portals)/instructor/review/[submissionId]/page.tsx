import type { Metadata } from "next";
import { ReviewDetail } from "@/modules/instructor-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /instructor/review/[submissionId] — I4 Review detail
 * (REDESIGN-P3 §I4, W4 review side). P1c.19: v3 wrapper around v2
 * ReviewDetail (513 lines with RubricGrader, SubmissionRenderer,
 * FeedbackThread, SignOffCard — too complex to fully restyle in P1c).
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
  return (
    <V3Wrapper
      title="Review submission"
      subtitle="Grade each rubric criterion, leave feedback, and approve or request changes."
    >
      <ReviewDetail submissionId={submissionId} />
    </V3Wrapper>
  );
}
