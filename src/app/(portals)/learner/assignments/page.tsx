import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { LearnerAssignments } from "@/modules/learner-portal";

/**
 * /learner/assignments — L5 Assignments list (REDESIGN-P3 §L5, W4).
 *
 * Route-group layout guards auth/role/portal-flag; this page adds the
 * W4 `submissions` flag check (org override → global → default off)
 * and bounces to Home when the workstream is not live yet.
 */

export const metadata: Metadata = {
  title: "Assignments — TraineesAI",
};

export default async function LearnerAssignmentsPage() {
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

  return <LearnerAssignments />;
}
