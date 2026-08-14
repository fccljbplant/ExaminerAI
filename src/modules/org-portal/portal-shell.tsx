"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle, UserMenu } from "@/modules/shell";
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
            <UserMenu userName={userName} profileHref="/org" profileLabel="Dashboard" />
          </>
        }
      >
        {children}
      </AppShellV2>
    </>
  );
}
