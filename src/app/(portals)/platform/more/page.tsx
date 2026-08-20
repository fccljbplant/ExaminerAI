"use client";

import Link from "next/link";
// Direct import (plain-TS module — safe across the RSC boundary).
import { PLATFORM_MORE } from "@/modules/platform-portal/nav";

/**
 * /platform/more — More hub for platform admin (P1 item 22 from audit).
 * Secondary destinations live here (Features, Courses, B2C, Access
 * grants, Password resets). Matches the /instructor/more and /org/more
 * pattern already in production.
 */

export default function PlatformMorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg md:text-xl">More</h1>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {PLATFORM_MORE.map((m) => {
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
