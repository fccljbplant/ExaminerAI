import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { PortalShell } from "@/modules/learner-portal";

/**
 * /learner/* — learner portal v2 (REDESIGN-P5 W1, flag portal_learner_v2).
 *
 * Guards, in order:
 *   1. authenticated (middleware already bounced anonymous visitors)
 *   2. learner role — staff get sent back to their own shell
 *   3. flag ON (org override → global → default off) — otherwise the
 *      legacy /app shell keeps serving the learner experience
 */
export default async function LearnerPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "learner" && user.role !== "student") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("learner", membership?.orgId);
  // homeForRole("learner") is /learner itself — redirecting there would
  // loop. The legacy /learn catalog is the safe flag-off fallback.
  if (!enabled) redirect("/learn");

  return <PortalShell userName={user.name}>{children}</PortalShell>;
}
