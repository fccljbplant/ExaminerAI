"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Home,
  LineChart,
  User,
} from "lucide-react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { FloatingTutor } from "@/modules/tutor";

/**
 * modules/learner-portal — PortalShell (REDESIGN-P3 §1)
 *
 * Learner portal chrome on the adaptive shell. Exactly five bottom
 * tabs on xs: Home / Learn / Exams / Progress / Profile. Help (L14)
 * hangs off Profile; the floating tutor FAB (W2) rides along on
 * every screen.
 */

const NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/learner", icon: Home, match: "/learner" },
  { id: "learn", label: "Learn", href: "/learner/learn", icon: BookOpen },
  { id: "exams", label: "Exams", href: "/learner/exams", icon: ClipboardCheck },
  { id: "progress", label: "Progress", href: "/learner/progress", icon: LineChart },
  { id: "profile", label: "Profile", href: "/learner/profile", icon: User },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function PortalShell({ userName, children }: { userName: string; children: ReactNode }) {
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
