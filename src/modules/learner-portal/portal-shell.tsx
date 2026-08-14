"use client";

import type { ReactNode } from "react";
import { AppShellV2, ModeToggle } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { LEARNER_NAV } from "./nav";

/**
 * modules/learner-portal — PortalShell (REDESIGN-P3 §1)
 *
 * Learner portal chrome on the adaptive shell. Exactly five bottom
 * tabs on xs: Home / Learn / Exams / Progress / Profile. Help (L14)
 * hangs off Profile.
 *
 * The FloatingTutor FAB rides on every portal screen EXCEPT the
 * dashboard itself (user decision 2026-08-15 — the dashboard's
 * continue-card + study widgets are the focus; the classroom has its
 * own on-stage avatar, and the tutor is one tap away on Learn/Exams).
 * Deviation from P3 §0 ("FAB on all portal screens") is deliberate.
 */

const NAV: NavItem[] = LEARNER_NAV;

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
    </>
  );
}
