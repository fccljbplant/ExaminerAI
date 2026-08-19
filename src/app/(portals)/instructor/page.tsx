import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { InstructorHome } from "@/modules/instructor-portal";
import { V3InstructorHomeContent } from "@/modules/ui-v3";

/**
 * /instructor — I1 Instructor home (REDESIGN-P3 §I1, W6).
 * Auth / role / flag guards live in the route-group layout.
 */

export const metadata: Metadata = {
  title: "Instructor home — TraineesAI",
};

export default async function InstructorHomePage() {
  const user = await getCurrentUser();
  const membership = user
    ? await db.orgMember.findFirst({
        where: { userId: user.id, status: "active" },
        select: { orgId: true },
      })
    : null;
  const v3 = await isV3UIEnabled(membership?.orgId);

  return v3 ? <V3InstructorHomeContent /> : <InstructorHome />;
}
