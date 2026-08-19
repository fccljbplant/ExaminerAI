import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { LearnerCatalog } from "@/modules/learner-portal";
import { V3CoursesCatalog } from "@/modules/ui-v3";

/**
 * /learner/learn — L2 Catalog (REDESIGN-P3 §L2), root of the Learn tab.
 * When the v3 UI flag is ON, render the v3-styled catalog; else v2.
 */

export const metadata: Metadata = {
  title: "Courses — TraineesAI",
};

export default async function LearnerLearnPage() {
  const user = await getCurrentUser();
  const membership = user
    ? await db.orgMember.findFirst({
        where: { userId: user.id, status: "active" },
        select: { orgId: true },
      })
    : null;
  const v3 = await isV3UIEnabled(membership?.orgId);

  return v3 ? <V3CoursesCatalog /> : <LearnerCatalog />;
}
