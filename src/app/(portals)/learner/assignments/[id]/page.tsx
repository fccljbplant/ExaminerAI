import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { SubmissionFlow } from "@/modules/learner-portal";

/**
 * /learner/assignments/[id] — L6 Submission flow (REDESIGN-P3 §L6, W4).
 *
 * Same flag chain as the list page. The flow component hydrates from
 * GET /api/v2/assignments/[id] and owns the stepper + draft autosave.
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
  return <SubmissionFlow assignmentId={id} />;
}
