import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { normalizeRole } from "@/lib/rbac";
import { V3Shell } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

/**
 * /instructor/* — instructor portal.
 *
 * Role check via normalizeRole() so legacy aliases ("teacher",
 * "teaching_assistant") map to "instructor"; "org_admin" is also
 * admitted (review-side access).
 */

const V3_NAV: V3NavGroup[] = [
  { label: "TEACHING", items: [
    { id: "overview", label: "Overview", icon: "⌂", href: "/instructor" },
    { id: "students", label: "Learners", icon: "◉", href: "/instructor/students" },
    { id: "courses", label: "Courses", icon: "▣", href: "/instructor/courses" },
    { id: "studio", label: "Content Studio", icon: "✎", href: "/instructor/studio" },
    { id: "review", label: "Assessments", icon: "✓", href: "/instructor/review" },
  ]},
  { label: "INSIGHTS", items: [
    { id: "analytics", label: "Analytics", icon: "↗", href: "/instructor/analytics" },
    { id: "earnings", label: "Earnings", icon: "$", href: "/instructor/earnings" },
    { id: "more", label: "More", icon: "⋯", href: "/instructor/more" },
    { id: "settings", label: "Settings", icon: "⚙", href: "/instructor/settings" },
  ]},
];

export default async function InstructorPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const role = normalizeRole(user.role);
  if (role !== "instructor" && role !== "org_admin") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("instructor", membership?.orgId);
  if (!enabled) redirect("/learn");

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <V3Shell
      navGroups={V3_NAV}
      userName={user.name}
      userInitials={initials}
      profileHref="/instructor"
      profileLabel="Dashboard"
      helpHref="/instructor/help"
      settingsHref="/instructor/settings"
    >
      {children}
    </V3Shell>
  );
}
