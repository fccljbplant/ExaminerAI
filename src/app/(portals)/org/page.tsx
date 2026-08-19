import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { OrgHome } from "@/modules/org-portal";
import { V3OrgHomeContent } from "@/modules/ui-v3";

/**
 * /org — O1 Command Center (REDESIGN-P3 §O1, W7).
 */

export const metadata: Metadata = {
  title: "Org home — TraineesAI",
};

export default async function OrgHomePage() {
  const user = await getCurrentUser();
  const membership = user
    ? await db.orgMember.findFirst({
        where: { userId: user.id, status: "active" },
        select: { orgId: true },
      })
    : null;
  const v3 = await isV3UIEnabled(membership?.orgId);

  return v3 ? <V3OrgHomeContent /> : <OrgHome />;
}
