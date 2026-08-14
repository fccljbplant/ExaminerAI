import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { InstructorShell } from "@/modules/instructor-portal";

/**
<<<<<<< HEAD
 * /instructor/* — instructor portal v2 (REDESIGN-P5 W6, flag portal_instructor_v2).
=======
 * /instructor/* — instructor portal v2 (REDESIGN-P5 W4 review side).
>>>>>>> 7083773 (feat: enable portal v2 flags — learner + instructor dashboards accessible)
 *
 * Guards, in order:
 *   1. authenticated (middleware already bounced anonymous visitors)
 *   2. instructor role (org admins who review are admitted too) — other
 *      staff get sent back to their own shell
<<<<<<< HEAD
 *   3. flag ON (org override → global → default off) — otherwise the
 *      legacy /app shell keeps serving the instructor experience
=======
 *   3. flag ON (org override → global → default off) — the review side
 *      ships under the W4 `submissions` flag until W6 flips the portal
 *      flag and grows the tab set
>>>>>>> 7083773 (feat: enable portal v2 flags — learner + instructor dashboards accessible)
 */
export default async function InstructorPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/app");
  if (user.role !== "instructor" && user.role !== "org_admin") redirect("/app");

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
<<<<<<< HEAD
  const enabled = await isPortalEnabled("instructor", membership?.orgId);
=======
  const enabled = await isPortalEnabled("submissions", membership?.orgId);
>>>>>>> 7083773 (feat: enable portal v2 flags — learner + instructor dashboards accessible)
  if (!enabled) redirect("/app");

  return <InstructorShell userName={user.name}>{children}</InstructorShell>;
}
