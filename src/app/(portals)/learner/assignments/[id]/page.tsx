import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { SubmissionFlow } from "@/modules/learner-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /learner/assignments/[id] — L6 Submission flow (REDESIGN-P3 §L6, W4).
 *
 * Same flag chain as the list page. The flow component hydrates from
 * GET /api/v2/assignments/[id] and owns the stepper + draft autosave.
 *
 * P1c.14: v3 wrapper around v2 SubmissionFlow (948 lines — too complex
 * to fully restyle in P1c).
 */

export const metadata: Metadata = {
  title: "Assignment — TraineesAI",
};

export default async function LearnerAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const membership = await db.orgMember.findFirst({
      where: { userId: user.id, status: "active" },
      select: { orgId: true },
    });
    if (!(await isSubmissionsEnabled(membership?.orgId))) {
      redirect("/learner");
    }
  }

  const { id } = await params;
  return (
    <V3Wrapper
      title="Submit assignment"
      subtitle="Work through each part, save drafts as you go, and submit when ready."
    >
      <SubmissionFlow assignmentId={id} />
    </V3Wrapper>
  );
}
