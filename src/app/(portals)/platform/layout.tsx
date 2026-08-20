import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import { V3Shell } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

/**
 * /platform/* — platform admin portal.
 *
 * Role check via normalizeRole() so legacy aliases ("administrator",
 * "admin") map to "platform_admin".
 */

const V3_NAV: V3NavGroup[] = [
  { label: "PLATFORM", items: [
    { id: "overview", label: "Overview", icon: "⌂", href: "/platform" },
    { id: "orgs", label: "Organizations", icon: "▣", href: "/platform/orgs" },
    { id: "users", label: "Users", icon: "♙", href: "/platform/users" },
    { id: "access", label: "Roles & Access", icon: "⚿", href: "/platform/access" },
  ]},
  { label: "PLATFORM CONTROL", items: [
    { id: "ai", label: "AI Configuration", icon: "✦", href: "/platform/ai" },
    { id: "features", label: "Feature Flags", icon: "⚡", href: "/platform/features" },
    { id: "revenue", label: "Usage & Limits", icon: "↗", href: "/platform/revenue" },
    { id: "system", label: "System Settings", icon: "⚙", href: "/platform/system" },
  ]},
];

export default async function PlatformPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (normalizeRole(user.role) !== "platform_admin") redirect(homeForRole(user.role));

  if (!(await isPlatformPortalEnabled())) redirect("/learn");

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <V3Shell
      navGroups={V3_NAV}
      userName={user.name}
      userInitials={initials}
      profileHref="/platform"
      profileLabel="Dashboard"
      helpHref="/platform/help"
      settingsHref="/platform/settings"
    >
      {children}
    </V3Shell>
  );
}
