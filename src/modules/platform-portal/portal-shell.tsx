"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { PLATFORM_NAV, PLATFORM_MORE } from "./nav";

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

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
