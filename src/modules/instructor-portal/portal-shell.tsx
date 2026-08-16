"use client";

import type { ReactNode } from "react";
import { AppShellV2, UnifiedThemeToggle, UserMenu } from "@/modules/shell";
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
            <UnifiedThemeToggle />
            <UserMenu userName={userName} profileHref="/instructor" profileLabel="Dashboard" settingsHref="/instructor/settings" helpHref="/instructor/help" />
          </>
        }
      >
        {children}
      </AppShellV2>
    </>
  );
}
