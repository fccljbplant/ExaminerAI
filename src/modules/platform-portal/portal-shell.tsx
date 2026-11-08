"use client";

import type { ReactNode } from "react";
import { AppShellV2, UnifiedThemeToggle, UserMenu } from "@/modules/shell";
import { PLATFORM_NAV } from "./nav";
export { PLATFORM_MORE } from "./nav";

/**
 * Platform admin shell.
 *
 * Every destination is declared once in PLATFORM_NAV and rendered by the
 * responsive shell; duplicated secondary tabs previously competed with the
 * primary nav and could show two active states for the same destination.
 */

export function PlatformShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  return (
    <AppShellV2
      nav={PLATFORM_NAV}
      brand={{ name: "TraineesAI" }}
      trailing={
        <>
          <UnifiedThemeToggle />
          <UserMenu
            userName={userName}
            profileHref="/platform"
            profileLabel="Dashboard"
            settingsHref="/platform/settings"
            helpHref="/platform/help"
          />
        </>
      }
    >
      {children}
    </AppShellV2>
  );
}
