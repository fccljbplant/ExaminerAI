import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPortalEnabled, isV3UIEnabled } from "@/lib/feature-flags";
import { PortalShell } from "@/modules/learner-portal";
import { V3Shell } from "@/modules/ui-v3/v3-shell";
import type { V3NavGroup } from "@/modules/ui-v3/v3-shell";

const V3_NAV: V3NavGroup[] = [
  { label: "LEARN", items: [
    { id: "overview", label: "Overview", icon: "⌂", href: "/learner" },
    { id: "learn", label: "Classroom", icon: "◉", href: "/learner/learn" },
    { id: "my-learning", label: "My Learning", icon: "▣", href: "/learner/courses" },
    { id: "practice", label: "Practice", icon: "✦", href: "/learner/practice" },
    { id: "exams", label: "Assessments", icon: "✓", href: "/learner/exams" },
  ]},
  { label: "PERSONAL", items: [
    { id: "ai-tutor", label: "AI Tutor", icon: "✦", href: "/learner/help" },
    { id: "progress", label: "Progress", icon: "↗", href: "/learner/progress" },
    { id: "profile", label: "Profile", icon: "↗", href: "/learner/profile" },
  ]},
];

export default async function LearnerPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "learner" && user.role !== "student") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("learner", membership?.orgId);
  if (!enabled) redirect("/learn");

  // v3 UI flag — when ON, render the dark sidebar shell instead of v2
  const v3 = await isV3UIEnabled(membership?.orgId);
  if (v3) {
    const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
    return <V3Shell navGroups={V3_NAV} userName={user.name} userInitials={initials}>{children}</V3Shell>;
  }

  return <PortalShell userName={user.name}>{children}</PortalShell>;
}
