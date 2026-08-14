"use client";

import Link from "next/link";
// Direct import (not the client barrel) — plain-TS module, safe for SSR.
import { INSTRUCTOR_MORE } from "@/modules/instructor-portal/nav";

/**
 * /instructor/more — More hub (REDESIGN-P3 §2): the 5th bottom tab.
 * Secondary destinations live here (Analytics, Earnings; Announcements
 * and Settings land with their workstreams). Client component: the
 * entries come from the instructor-portal nav constants.
 */

export default function InstructorMorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg md:text-xl">More</h1>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {INSTRUCTOR_MORE.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              href={m.href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              {Icon && <Icon className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden />}
              <span className="text-sm font-medium text-fg">{m.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
