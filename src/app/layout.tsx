import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExaminerAI — AI-Powered Assessment & Mentorship Platform",
  description: "Comprehensive AI-driven evaluation, mentoring and institution management platform. GROW coaching, psychological & educational mentorship, real-time alerts, and analytics dashboards for every role.",
  keywords: ["ExaminerAI", "assessment", "mentor", "GROW", "education", "LMS", "AI"],
  authors: [{ name: "FCCL JB Plant IT" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ExaminerAI",
    description: "AI-Powered Assessment & Mentorship Platform",
    siteName: "ExaminerAI",
    type: "website",
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
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
