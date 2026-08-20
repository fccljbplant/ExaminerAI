import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRole } from "@/lib/rbac";
import { V3Shell } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";

/**
 * /org/* — org admin portal.
 *
 * Role check via normalizeRole() so legacy aliases ("coordinator",
 * "course_coordinator", "principal", "institution_admin") map to
 * "org_admin". Platform admins are also admitted.
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
    { id: "more", label: "More", icon: "⋯", href: "/org/more" },
    { id: "settings", label: "Settings", icon: "⚙", href: "/org/settings" },
  ]},
];

export default async function OrgPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const role = normalizeRole(user.role);
  if (role !== "org_admin" && role !== "platform_admin") redirect(homeForRole(user.role));

  if (!(await isOrgPortalEnabled())) {
    redirect(role === "platform_admin" ? "/platform" : "/learn");
  }

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  if (!membership) {
    if (role === "platform_admin") redirect("/platform");
    return (
      <V3Shell
        navGroups={V3_NAV}
        userName={user.name}
        userInitials={initials}
        profileHref="/org"
        profileLabel="Dashboard"
        helpHref="/org/help"
        settingsHref="/org/settings"
      >
        <div className="v3-empty" style={{ marginTop: 32 }}>
          <h3>No organization yet</h3>
          <p>
            Your account has org-admin access, but it hasn&apos;t been added to an organization.
            Ask your platform administrator to add you to one, then refresh this page.
          </p>
          <a href="/api/auth/logout" className="v3-btn" style={{ marginTop: 16 }}>Sign out</a>
        </div>
      </V3Shell>
    );
  }

  return (
    <V3Shell
      navGroups={V3_NAV}
      userName={user.name}
      userInitials={initials}
      profileHref="/org"
      profileLabel="Dashboard"
      helpHref="/org/help"
      settingsHref="/org/settings"
    >
      {children}
    </V3Shell>
  );
}
