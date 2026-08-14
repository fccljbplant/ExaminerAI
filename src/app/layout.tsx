import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeV2Provider } from "@/modules/theme";
import { CommandRegistryProvider } from "@/modules/ui/command-registry";
import { CommandPalette } from "@/modules/ui/command-palette";
import { KeyboardShortcutsHelp } from "@/modules/ui/keyboard-shortcuts-help";
import { CelebrationOverlay } from "@/modules/gamification";

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
  // Mobile-friendly viewport — lets the user pinch-zoom (accessibility).
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
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
        {/* Theme v2 FOUC guard — sets html[data-mode] before first paint,
            mirroring next-themes' storage keys (REDESIGN-P2 §2.2). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem("theme");var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var bed=localStorage.getItem("tx-theme-bed")==="1";d.dataset.mode=bed?"bed":dark?"dark":"light";}catch(e){document.documentElement.dataset.mode="light";}})();`,
          }}
        />
        <ThemeProvider>
          <ThemeV2Provider>
              <CommandRegistryProvider>
                {children}
                {/* ⌘K command palette — global. Press ⌘K (or Ctrl+K) anywhere.
                    Pages can register their own commands via useRegisterCommands(). */}
                <CommandPalette />
                {/* Press `?` anywhere to see the keyboard shortcut cheat sheet. */}
                <KeyboardShortcutsHelp />
                {/* Celebration overlay — fires on level-up, badge earned, XP gained.
                    Listens for `traineesai:celebration` events dispatched from
                    anywhere in the app. */}
                <CelebrationOverlay />
                <SonnerToaster position="bottom-right" richColors closeButton />
              </CommandRegistryProvider>
          </ThemeV2Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
