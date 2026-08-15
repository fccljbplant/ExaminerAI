"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/modules/shell";
import { LEARNER_NAV } from "@/modules/learner-portal/nav";

/**
 * /learn/[courseId] — classroom portal chrome (W1 L4 integration pass)
 *
 * Wraps the full-screen ClassroomShell in the app chrome so the
 * learning platform feels like part of the learner portal:
 *   - a fixed top app bar (back to the dashboard + course name)
 *   - the learner BottomNav on xs (5 tabs), hidden md+
 *   - safe-area insets on both bars
 *
 * The ClassroomShell root is padded to fit between the bars (pt-14 /
 * pb-[3.5rem] on xs). The classroom has its own on-stage avatar, so
 * the FloatingTutor FAB is intentionally absent here.
 */

export function ClassroomChrome({
  courseName,
  children,
}: {
  courseName: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* top app bar — back to the dashboard, course identity */}
      <header className="fixed inset-x-0 top-0 z-[var(--p-z-sticky)] flex h-14 items-center gap-2 border-b border-line bg-surface pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/learner"
          aria-label="Back to dashboard"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-fg">
          {courseName}
        </div>
        <span className="w-16 shrink-0" aria-hidden />
      </header>

      {children}

      {/* learner bottom nav on xs — the classroom is part of the app */}
      <BottomNav nav={LEARNER_NAV} />
    </div>
  );
}
