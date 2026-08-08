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
    apple: "/icon-192.png",
  },
  // ── PWA manifest — makes the app installable on phones/desktops ──
  // See /public/manifest.webmanifest for the full definition.
  manifest: "/manifest.webmanifest",
  // ── Theme color — used by the OS for the status bar / window chrome
  // when the app is installed. Matches our slate-950 background.
  themeColor: "#0f172a",
  // ── Apple-specific — lets iOS Safari add to home screen with a
  // standalone feel (no browser chrome on launch).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TraineesAI",
  },
  // ── Mobile-friendly viewport — lets the user pinch-zoom (accessibility).
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  // ── App is installable + works offline (PWA).
  applicationName: "TraineesAI",
  formatDetection: {
    telephone: false,
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
