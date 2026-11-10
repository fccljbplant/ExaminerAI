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
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TraineesAI â€” AI-Driven Training for Engineering Internees",
  description: "AI teaches. AI tests. Human mentors. The training platform that takes the training burden off busy engineers and managers.",
  keywords: ["TraineesAI", "engineering training", "internship", "AI tutor", "Socratic assessment", "project-based learning", "mentorship"],
  authors: [{ name: "Inzet Enterprises" }],
  icons: {
    icon: "/logo.svg",
  },
  // Mobile-friendly viewport â€” lets the user pinch-zoom (accessibility).
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  applicationName: "TraineesAI",
  formatDetection: {
    telephone: false,
  }¶»§q«^