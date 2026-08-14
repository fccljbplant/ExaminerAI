"use client";

import Link from "next/link";
// Direct import (plain-TS module — safe across the RSC boundary).
import { ORG_MORE } from "@/modules/org-portal/nav";

/**
 * /org/more — More hub: Registries (O3), Study Analytics (O7),
 * Billing & seats (O6). RBAC matrix and governance approvals land
 * with their remaining pieces.
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
      </div>
    </div>
  );
}
