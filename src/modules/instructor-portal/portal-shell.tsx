"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { INSTRUCTOR_NAV, INSTRUCTOR_MORE } from "./nav";

/**
 * modules/instructor-portal — InstructorShell (REDESIGN-P3 §2, W6)
 *
 * Instructor portal chrome on the adaptive shell. Bottom tabs:
 * Home / Courses / Students / Grading / More (5 slots — the More slot
 * opens the More hub: Analytics, Earnings).
 */

const NAV: NavItem[] = INSTRUCTOR_NAV;

export { INSTRUCTOR_MORE };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function InstructorShell({
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
