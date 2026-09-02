"use client";

import type { ReactNode } from "react";
import { AppShellV2, UnifiedThemeToggle, UserMenu } from "@/modules/shell";
import { LEARNER_NAV } from "@/modules/learner-portal/nav";

/**
 * (classroom)/learn/learn-chrome.tsx — shell chrome for the /learn catalog
 *
 * Puts /learn inside the main UI container so it stops feeling like a
 * separate site: same adaptive shell as the learner portal (TopNav on
 * desktop, AppBar + TabRow on tablet, AppBar + BottomNav on phones).
 *
 * Mobile reading is preserved exactly as the classroom page does it:
 *   - the BottomNav tucks away on sustained scroll-down and returns on
 *     scroll-up (useNavVisibility), so the full screen stays available
 *     while reading
 *   - the shell reserves pb-24 clearance so the fixed nav never covers
 *     cards, and honours safe-area insets on notch devices
 *   - the LEARNER_NAV "learn" tab matches "/learn" (see nav.ts), so the
 *     correct tab lights up both here and inside /learn/[courseId]
 *
 * Client component because LEARNER_NAV carries lucide icon components,
 * which cannot cross the RSC boundary as props — the nav import must
 * stay on the client side (same pattern as PortalShell).
 */
export function LearnChrome({ userName, children }: { userName: string; children: ReactNode }) {
  return (
    <AppShellV2
      nav={LEARNER_NAV}
      brand={{ name: "TraineesAI" }}
      trailing={
        <>
          <UnifiedThemeToggle />
          <UserMenu
            userName={userName}
            profileHref="/learner/profile"
            profileLabel="Profile"
            settingsHref="/learner/profile"
            helpHref="/learner/help"
          />
        </>
      }
    >
      {children}
    </AppShellV2>
  );
}
