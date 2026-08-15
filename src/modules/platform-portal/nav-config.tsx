"use client";

import { Activity, AlertTriangle } from "lucide-react";
import { LEARNER_NAV } from "@/modules/learner-portal/nav";
import { INSTRUCTOR_NAV } from "@/modules/instructor-portal/nav";
import { ORG_NAV } from "@/modules/org-portal/nav";
import { PLATFORM_NAV } from "@/modules/platform-portal/nav";

/**
 * modules/platform-portal — NavConfig (W16: V1 RoleNavConfigPanel tab)
 *
 * The per-role navigation is static in v2 (portal nav constants), so
 * this tab shows the current assignment per role — a read-only mirror
 * of what the old Nav Config panel edited. Editing nav is a later
 * workstream; the tab exists so the V1 section is not missing.
 */

const ROLES = [
  { name: "Learner", items: LEARNER_NAV },
  { name: "Instructor", items: INSTRUCTOR_NAV },
  { name: "Org admin", items: ORG_NAV },
  { name: "Platform admin", items: PLATFORM_NAV },
] as const;

export function PlatformNavConfig() {
  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Nav config</h1>

      <div className="flex items-start gap-3 rounded-xl border border-line bg-warning-subtle p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-on" aria-hidden />
        <p className="text-xs leading-relaxed text-fg">
          Navigation is defined per role in code (portal nav constants) so each portal shell stays
          deterministic. This tab shows the current assignment; drag-and-drop editing arrives with
          the roles &amp; permissions workstream.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {ROLES.map((r) => (
          <section key={r.name} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Activity className="h-4 w-4 text-fg-muted" aria-hidden />
              {r.name}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {r.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm text-fg-secondary">
                  {item.icon && <item.icon className="h-3.5 w-3.5 text-fg-muted" aria-hidden />}
                  <span className="font-medium text-fg">{item.label}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-fg-muted">
                    {item.href}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
