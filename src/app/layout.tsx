import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemePresetProvider } from "@/modules/theme";
import { CommandRegistryProvider } from "@/components/shared/command-registry";
import { CommandPalette } from "@/components/shared/command-palette";
import { KeyboardShortcutsHelp } from "@/components/shared/keyboard-shortcuts-help";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TraineesAI — AI-Driven Training for Engineering Internees",
  description: "AI teaches. AI tests. Human mentors. The training platform that takes the training burden off busy engineers and managers.",
  keywords: ["TraineesAI", "engineering training", "internship", "AI tutor", "Socratic assessment", "project-based learning", "mentorship"],
  authors: [{ name: "Inzet Enterprises" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <ThemePresetProvider>
            <CommandRegistryProvider>
              {children}
              {/* ⌘K command palette — global. Press ⌘K (or Ctrl+K) anywhere.
                  Pages can register their own commands via useRegisterCommands(). */}
              <CommandPalette />
              {/* Press `?` anywhere to see the keyboard shortcut cheat sheet. */}
              <KeyboardShortcutsHelp />
              <SonnerToaster position="bottom-right" richColors closeButton />
            </CommandRegistryProvider>
          </ThemePresetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
