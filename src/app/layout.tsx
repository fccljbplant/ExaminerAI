import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemePresetProvider } from "@/modules/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExaminerAI — AI-Powered Bootcamp Management Platform",
  description: "AI-powered bootcamp platform for software training (up to 6 months). Students build real capstone projects. Socratic test chatbots (never MCQs). 7-dimension psychological cycle. AI mentorship at scale.",
  keywords: ["ExaminerAI", "bootcamp", "software training", "Socratic assessment", "AI tutor", "project-based learning", "capstone", "mentorship", "AI mentorship"],
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
            {children}
            <Toaster />
          </ThemePresetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
