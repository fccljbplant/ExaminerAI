import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { ClassroomShell } from "@/modules/learn/components/classroom/ClassroomShell";
import { V3Shell } from "@/modules/ui-v3";
import type { V3NavGroup } from "@/modules/ui-v3";

export const dynamic = "force-dynamic";

/**
 * /learn/[courseId] — full-screen learning session ("Modern Class").
 *
 * P5 merge: hosts ClassroomShell inside V3Shell (fullBleed) instead of
 * the legacy ClassroomChrome. This unifies the shell — same sidebar,
 * same topbar, same UserMenu/UnifiedThemeToggle as /learner/*.
 *
 * ClassroomShell owns its own PageHeader (course crumbs + XP/streak
 * chips + Topics/Focus/Exit actions) — this renders inside V3Shell's
 * full-bleed content area (no padding/max-width).
 *
 * ClassroomShell's state machine (postStage, stageMode, PostFlowStepper,
 * CheckinStage, ProjectStage) is UNTOUCHED. Only the top-level wrapper
 * div's className was adjusted (removed h-dvh + padding offsets that
 * V3Shell now provides). See Study Phase §4 for the full transition table.
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

export default async function LearnSessionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getAuthUser();

  if (!user) redirect("/login");

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, isActive: true },
  });
  if (!course || !course.isActive) notFound();

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
      fullBleed
    >
      <ClassroomShell courseId={course.id} courseName={course.name} />
    </V3Shell>
  );
}
