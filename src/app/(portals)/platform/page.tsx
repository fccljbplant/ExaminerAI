import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { PlatformHome } from "@/modules/platform-portal";
import { V3PlatformHomeContent } from "@/modules/ui-v3";

/**
 * /platform — P1 Platform home (REDESIGN-P3 §P1, W7).
 */

export const metadata: Metadata = {
  title: "Platform — TraineesAI",
};

export default async function PlatformHomePage() {
  const user = await getCurrentUser();
  const membership = user
    ? await db.orgMember.findFirst({
        where: { userId: user.id, status: "active" },
        select: { orgId: true },
      })
    : null;
  const v3 = await isV3UIEnabled(membership?.orgId);

  return v3 ? <V3PlatformHomeContent /> : <PlatformHome />;
}
