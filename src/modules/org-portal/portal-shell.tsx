"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { ORG_NAV, ORG_MORE } from "./nav";

/**
 * modules/org-portal — OrgShell (REDESIGN-P3 §3, W7)
 *
 * Org admin chrome on the adaptive shell: Home / People / Control /
 * Reports / More (5 slots). More hosts Billing (landing later) and the
 * remaining O3/O6/O7 surfaces.
 */

const NAV: NavItem[] = ORG_NAV;

export { ORG_MORE };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function OrgShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  return (
    <>
      <AppShellV2
        nav={NAV}
        brand={{ name: "TraineesAI" }}
        trailing={
          <>
            <ModeToggle />
            <span
              title={userName}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg"
            >
              {initials(userName) || "?"}
            </span>
          </>
        }
      >
        {children}
      </AppShellV2>
    </>
  );
}
