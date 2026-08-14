"use client";

import Link from "next/link";
// Direct import (plain-TS module — safe across the RSC boundary).
import { ORG_MORE } from "@/modules/org-portal/nav";

/**
 * /org/more — More hub: Billing & seats (O6) and Study Analytics (O7)
 * land with their workstreams — the hub grows as they ship.
 */

export default function OrgMorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg md:text-xl">More</h1>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {ORG_MORE.map((m) => {
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
        <p className="px-4 py-3 text-xs text-fg-muted">
          Billing (O6) and Study Analytics (O7) arrive with their workstreams.
        </p>
      </div>
    </div>
  );
}
