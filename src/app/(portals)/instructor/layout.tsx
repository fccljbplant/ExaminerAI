import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled, isV3UIEnabled } from "@/lib/feature-flags";
import { InstructorShell } from "@/modules/instructor-portal";
import { V3Shell, UIToggle } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

/**
 * /instructor/* — instructor portal v2 (REDESIGN-P5 W6, flag portal_instructor_v2).
 *
 * Guards, in order:
 *   1. authenticated (middleware already bounced anonymous visitors)
 *   2. instructor role (org admins who review are admitted too) — other
 *      staff get sent back to their own shell
 *   3. flag ON (org override → global → default off) — otherwise the
 *      legacy /learn shell keeps serving the instructor experience
 *
 * When the v3 UI flag is ON, render the dark sidebar V3Shell instead of v2.
 * The UIToggle floats (fixed bottom-right) in both modes.
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
      <InstructorShell userName={user.name}>{children}</InstructorShell>
      {toggle}
    </>
  );
}
