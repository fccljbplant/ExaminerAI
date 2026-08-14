import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";
import { StudyFlowCenter } from "@/modules/learn/components/study-flow/StudyFlowCenter";

/**
 * /learner/study — L12 Study-Flow Center (REDESIGN-P3 §L12, W3).
 *
 * Auth / role / portal-flag guards live in the route-group layout; this
 * page adds the W3 `study_flow` flag check (org override → global →
 * default off) and bounces to Progress when the engine is not live.
 *
 * The component is imported via its file path (not the module barrel) so
 * the client bundle never pulls in the DB-backed learn lib.
 */

export const metadata: Metadata = {
  title: "Study Flow — TraineesAI",
};

export default async function LearnerStudyPage() {
  const user = await getCurrentUser();
  if (user) {
    const membership = await db.orgMember.findFirst({
      where: { userId: user.id, status: "active" },
      select: { orgId: true },
    });
    if (!(await isStudyFlowEnabled(membership?.orgId))) {
      redirect("/learner/progress");
    }
  }

  return <StudyFlowCenter />;
}
