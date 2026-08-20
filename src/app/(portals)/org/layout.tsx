import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { OrgShell } from "@/modules/org-portal";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { V3Shell, UIToggle } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

/**
 * /org/* — org admin portal v2 (REDESIGN-P5 W7, flag portal_org_v2).
 *
 * Guards: authenticated → org_admin role (platform admins admitted) →
 * flag ON → the caller must be an active member of an organization.
 *
 * When the v3 UI flag is ON, render the dark sidebar V3Shell instead of v2.
 * The UIToggle floats (fixed bottom-right) in both modes.
 */
const V3_NAV: V3NavGroup[] = [
  { label: "ORGANIZATION", items: [
    { id: "overview", label: "Overview", icon: "⌂", href: "/org" },
    { id: "people", label: "Users", icon: "♙", href: "/org/people" },
    { id: "courses", label: "Courses", icon: "▣", href: "/org/registries" },
    { id: "analytics", label: "Analytics", icon: "↗", href: "/org/analytics" },
  ]},
  { label: "MANAGEMENT", items: [
    { id: "billing", label: "Billing", icon: "$", href: "/org/billing" },
    { id: "compliance", label: "Compliance", icon: "⚠", href: "/org/compliance" },
    { id: "audit", label: "Audit Log", icon: "📋", href: "/org/audit" },
    { id: "settings", label: "Settings", icon: "⚙", href: "/org/settings" },
  ]},
];

export default async function OrgPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "org_admin" && user.role !== "platform_admin") redirect(homeForRole(user.role));

  if (!(await isOrgPortalEnabled())) {
    redirect(user.role === "platform_admin" ? "/platform" : "/learn");
  }

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });

  const v3 = await isV3UIEnabled(membership?.orgId);
  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const toggle = <UIToggle />;

  if (v3) {
    if (!membership) {
      return (
        <>
          <V3Shell navGroups={V3_NAV} userName={user.name} userInitials={initials}>
            <div className="v3-empty" style={{ marginTop: 32 }}>
              <h3>No organization yet</h3>
              <p>
                Your account has org-admin access, but it hasn&apos;t been added to an organization.
                Ask your platform administrator to add you to one, then refresh this page.
              </p>
              <a href="/api/auth/logout" className="v3-btn" style={{ marginTop: 16 }}>Sign out</a>
            </div>
          </V3Shell>
          {toggle}
        </>
      );
    }
    return (
      <>
        <V3Shell navGroups={V3_NAV} userName={user.name} userInitials={initials}>
          {children}
        </V3Shell>
        {toggle}
      </>
    );
  }

  if (!membership) {
    if (user.role === "platform_admin") redirect("/platform");
    return (
      <>
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
        {toggle}
      </>
    );
  }

  return (
    <>
      <OrgShell userName={user.name}>{children}</OrgShell>
      {toggle}
    </>
  );
}
