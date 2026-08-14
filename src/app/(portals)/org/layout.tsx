import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrgShell } from "@/modules/org-portal";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";

/**
 * /org/* — org admin portal v2 (REDESIGN-P5 W7, flag portal_org_v2).
 *
 * Guards: authenticated → org_admin role (platform admins admitted) →
 * flag ON → the caller must be an active member of an organization.
 */

export default async function OrgPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/app");
  if (user.role !== "org_admin" && user.role !== "platform_admin") redirect("/app");

  if (!(await isOrgPortalEnabled())) redirect("/app");

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  if (!membership) redirect("/app");

  return <OrgShell userName={user.name}>{children}</OrgShell>;
}
