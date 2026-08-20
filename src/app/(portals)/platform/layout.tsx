import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isV3UIEnabled } from "@/lib/feature-flags";
import { PlatformShell } from "@/modules/platform-portal";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { V3Shell, UIToggle } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

/**
 * /platform/* — platform admin portal v2 (REDESIGN-P5 W7, flag portal_platform_v2).
 *
 * Guards: authenticated → platform_admin (legacy "admin" admitted) →
 * flag ON.
 *
 * When the v3 UI flag is ON, render the dark sidebar V3Shell instead of v2.
 * The UIToggle floats (fixed bottom-right) in both modes.
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
  if (user.role !== "platform_admin" && user.role !== "admin") redirect(homeForRole(user.role));

  if (!(await isPlatformPortalEnabled())) redirect("/learn");

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const v3 = await isV3UIEnabled(membership?.orgId);
  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const toggle = <UIToggle />;

  if (v3) {
    return (
      <>
        <V3Shell navGroups={V3_NAV} userName={user.name} userInitials={initials}>
          {children}
        </V3Shell>
        {toggle}
      </>
    );
  }

  return (
    <>
      <PlatformShell userName={user.name}>{children}</PlatformShell>
      {toggle}
    </>
  );
}
