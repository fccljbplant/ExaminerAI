import type { Metadata } from "next";
import { V3ReviewDetail } from "@/modules/ui-v3";

/**
 * /instructor/review/[submissionId] — I4 Review detail
 * (REDESIGN-P3 §I4, W4 review side). P4.19b: full v3 restyle.
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
  return <V3ReviewDetail submissionId={submissionId} />;
}
