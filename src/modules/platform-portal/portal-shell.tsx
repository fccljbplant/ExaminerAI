"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle, UserMenu } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { PLATFORM_NAV, PLATFORM_MORE } from "./nav";
import { PlatformTabs } from "./tabs";

/**
 * modules/platform-portal — PlatformShell (REDESIGN-P3 §4, W7)
 *
 * Platform admin chrome (desktop-dense per spec; the adaptive shell
 * keeps it usable on small screens). P3/P4 surfaces (system, ai,
 * marketplace, maintenance) land as their workstreams ship — the nav
 * grows then; the shell + home + orgs ship here.
 */

const NAV: NavItem[] = PLATFORM_NAV;

export { PLATFORM_MORE };


export function PlatformShell({
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
            <UserMenu userName={userName} profileHref="/platform" profileLabel="Dashboard" />
          </>
        }
      >
        <div className="mb-4 md:mb-6">
          <PlatformTabs />
        </div>
        {children}
      </AppShellV2>
    </>
  );
}
