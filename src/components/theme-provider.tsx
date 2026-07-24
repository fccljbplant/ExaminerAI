"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Wraps the app with next-themes so every component can read the current
 * theme ("light" | "dark" | "system") via the `useTheme()` hook and so the
 * correct CSS variables are applied to :root or .dark.
 *
 * Default theme is "light" (the Modern Slate light theme).
 * The toggle lives in the sidebar header (see AppShell.tsx).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
