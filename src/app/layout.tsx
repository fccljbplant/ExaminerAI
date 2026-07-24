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
  title: "ExaminerAI — Socratic Assessment & Mentorship Platform",
  description: "AI-powered assessment, GROW mentorship, and 7-dimension psychology for institutions. 9 role dashboards, Socratic testing, AI tutor, and real-time alerts.",
  keywords: ["ExaminerAI", "Socratic", "Assessment", "Mentorship", "AI Tutor", "LMS"],
  authors: [{ name: "FCCL JB Plant IT" }],
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
