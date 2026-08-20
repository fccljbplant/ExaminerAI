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
 * /learner/* — learner portal.
 *
 * The v3 interface (dark sidebar + indigo primary, matching the
 * uploaded test.html reference design) is the default and only shell.
 * Auth / role / portal-flag guards live here.
 *
 * Role check goes through normalizeRole() so legacy aliases
 * ("student", "pending", "counselor", "guardian") all map to "learner"
 * instead of bouncing the user (audit finding §1.5.2).
 */

const V3_NAV: V3NavGroup[] = [
  { label: "LEARN", items: [
    { id: "overview", label: "Overview", icon: "⌂", href: "/learner" },
    { id: "classroom", label: "Classroom", icon: "◉", href: "/learn" },
    { id: "courses", label: "Courses", icon: "▣", href: "/learner/learn" },
    { id: "assignments", label: "Assignments", icon: "📋", href: "/learner/assignments" },
    { id: "practice", label: "Practice", icon: "✦", href: "/learner/practice" },
    { id: "exams", label: "Assessments", icon: "✓", href: "/learner/exams" },
  ]},
  { label: "PERSONAL", items: [
    { id: "messages", label: "Messages", icon: "✉", href: "/learner/messages" },
    { id: "projects", label: "Projects", icon: "📁", href: "/learner/projects" },
    { id: "ai-tutor", label: "AI Tutor", icon: "✦", href: "/learner/help" },
    { id: "progress", label: "Progress", icon: "↗", href: "/learner/progress" },
    { id: "profile", label: "Profile", icon: "↗", href: "/learner/profile" },
  ]},
];

export default async function LearnerPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (normalizeRole(user.role) !== "learner") redirect(homeForRole(user.role));

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { orgId: true },
  });
  const enabled = await isPortalEnabled("learner", membership?.orgId);
  if (!enabled) redirect("/learn");

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <V3Shell
      navGroups={V3_NAV}
      userName={user.name}
      userInitials={initials}
      profileHref="/learner/profile"
      profileLabel="Profile"
      helpHref="/learner/help"
      settingsHref="/learner/profile"
    >
      {children}
    </V3Shell>
  );
}
