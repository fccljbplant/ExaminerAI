"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Wraps the app with next-themes so every component can read the current
 * theme ("light" | "dark" | "system") via the `useTheme()` hook and so the
 * correct CSS variables are applied to :root or .dark.
 *
 * The toggle lives in the sidebar header (see AppShell.tsx).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
