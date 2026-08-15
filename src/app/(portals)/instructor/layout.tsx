import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { InstructorShell } from "@/modules/instructor-portal";

/**
 * /instructor/* — instructor portal v2 (REDESIGN-P5 W6, flag portal_instructor_v2).
 *
 * Guards, in order:
 *   1. authenticated (middleware already bounced anonymous visitors)
 *   2. instructor role (org admins who review are admitted too) — other
 *      staff get sent back to their own shell
 *   3. flag ON (org override → global → default off) — otherwise the
 *      legacy /app shell keeps serving the instructor experience
 */
export default async function InstructorPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "instructor" && user.role !== "org_admin") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("instructor", membership?.orgId);
  // homeForRole("instructor") is /instructor itself — redirecting there
  // would loop. The legacy /learn catalog is the safe flag-off fallback.
  if (!enabled) redirect("/learn");

  return <InstructorShell userName={user.name}>{children}</InstructorShell>;
}
