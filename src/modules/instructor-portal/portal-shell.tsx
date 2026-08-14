"use client";

import type { ReactNode } from "react";
import { ClipboardCheck, LayoutDashboard } from "lucide-react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { FloatingTutor } from "@/modules/tutor";

/**
 * modules/instructor-portal — InstructorShell (REDESIGN-P3 §2)
 *
 * Instructor portal chrome on the adaptive shell. W4 ships the Review
 * center (I3/I4); the full tab set (Home / Courses / Students / Grading
 * / More) lands with W6 — the nav grows as those screens do.
 */

const NAV: NavItem[] = [
  { id: "review", label: "Review", href: "/instructor/review", icon: ClipboardCheck },
  { id: "home", label: "Home", href: "/instructor", icon: LayoutDashboard },
];

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
      <FloatingTutor />
    </>
  );
}
