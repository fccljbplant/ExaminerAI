import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled } from "@/lib/feature-flags";
import { V3Shell } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

/**
 * /instructor/* — instructor portal.
 *
 * The v3 interface (dark sidebar + indigo primary, matching the
 * uploaded test.html reference design) is the default and only shell.
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
    { id: "settings", label: "Settings", icon: "⚙", href: "/instructor/settings" },
  ]},
];

export default async function InstructorPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "instructor" && user.role !== "org_admin") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("instructor", membership?.orgId);
  if (!enabled) redirect("/learn");

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <V3Shell navGroups={V3_NAV} userName={user.name} userInitials={initials}>
      {children}
    </V3Shell>
  );
}
