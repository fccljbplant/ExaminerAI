import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { LearnerHome } from "@/modules/learner-portal";
import { V3LearnerHomeContent } from "@/modules/ui-v3";

/**
 * /learner — L1 Home (REDESIGN-P3 §L1).
 * Auth / role / portal-flag guards live in the route-group layout.
 * When the v3 UI flag is ON, render the v3 dashboard content; else v2.
 */

export const metadata: Metadata = {
  title: "Home — TraineesAI",
};

export default async function LearnerHomePage() {
  const user = await getCurrentUser();
  const membership = user
    ? await db.orgMember.findFirst({
        where: { userId: user.id, status: "active" },
        select: { orgId: true },
      })
    : null;
  const v3 = await isV3UIEnabled(membership?.orgId);

  return v3 ? <V3LearnerHomeContent /> : <LearnerHome />;
}
