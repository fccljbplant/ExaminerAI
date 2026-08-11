import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Sparkles, LogIn, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page Not Found — TraineesAI",
  description: "The page you were looking for doesn't exist or has moved.",
};

/**
 * Root 404 page — fallback for any URL that doesn't match a route in
 * the (public) group, the /app dashboard, or /api endpoints.
 *
 * Mirrors the public 404 visual design but links to the dashboard sign-in
 * (/app) and the public marketplace (/courses) instead of the marketplace
 * alone — since root-level users may be either signed-out visitors or
 * returning users looking for the dashboard.
 */
export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Minimal header — logo only, no nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>TraineesAI</span>
          </Link>
        </div>
      </header>

      {/* Body — centered 404 */}
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md mx-auto space-y-6">
          {/* Big icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" aria-hidden />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <BookOpen className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>

          {/* 404 mark + heading */}
          <div className="space-y-2">
            <p className="text-7xl font-black tracking-tighter text-foreground/10 leading-none">
              404
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist, may have been
              moved, or the link is no longer valid.
            </p>
          </div>

          {/* CTAs — recovery links for lost users */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild>
              <Link href="/learn">
                <ArrowRight className="h-4 w-4" />
                Go to my learning
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app">
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/courses">
                <GraduationCap className="h-4 w-4" />
                Browse Courses
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}
