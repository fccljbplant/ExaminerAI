import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
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
 *
 * No-membership handling (2026-08-15 audit 9.1): redirecting an
 * org_admin to homeForRole redirects back to /org itself — an infinite
 * loop that hammers the server. Platform admins have a real home to
 * fall back to; org admins without an org get an in-shell state page
 * instead of any redirect.
 */

export default async function OrgPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "org_admin" && user.role !== "platform_admin") redirect(homeForRole(user.role));

  if (!(await isOrgPortalEnabled())) {
    // /platform would bounce org admins straight back here (role check);
    // the legacy /learn catalog is the safe flag-off fallback.
    redirect(user.role === "platform_admin" ? "/platform" : "/learn");
  }

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  if (!membership) {
    if (user.role === "platform_admin") redirect("/platform");
    return (
      <OrgShell userName={user.name}>
        <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
          <h1 className="text-lg font-semibold text-fg md:text-xl">No organization yet</h1>
          <p className="text-sm leading-relaxed text-fg-secondary">
            Your account has org-admin access, but it hasn&apos;t been added to an organization.
            Ask your platform administrator to add you to one, then refresh this page.
          </p>
          <a
            href="/api/auth/logout"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            Sign out
          </a>
        </div>
      </OrgShell>
    );
  }

  return <OrgShell userName={user.name}>{children}</OrgShell>;
}
