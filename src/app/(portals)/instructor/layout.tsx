import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { InstructorShell } from "@/modules/instructor-portal";

/**
 * /instructor/* — instructor portal v2 (REDESIGN-P5 W4 review side).
 *
 * Guards, in order:
 *   1. authenticated (middleware already bounced anonymous visitors)
 *   2. instructor role (org admins who review are admitted too) — other
 *      staff get sent back to their own shell
 *   3. flag ON (org override → global → default off) — the review side
 *      ships under the W4 `submissions` flag until W6 flips the portal
 *      flag and grows the tab set
 */
export default async function InstructorPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/app");
  if (user.role !== "instructor" && user.role !== "org_admin") redirect("/app");

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("submissions", membership?.orgId);
  if (!enabled) redirect("/app");

  return <InstructorShell userName={user.name}>{children}</InstructorShell>;
}
