import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Sparkles, Home, ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/modules/ui/button";

export const metadata: Metadata = {
  title: "Page Not Found — TraineesAI",
  description: "The page you were looking for doesn't exist or has moved.",
};

/**
 * Public 404 page — shown when a route inside the (public) route group
 * is not found (e.g. /courses/missing-id, /paths/missing, /unknown-path).
 *
 * Dark theme, centered, marketplace-consistent.
 */
export default function PublicNotFound() {
  return (
    <div className="flex flex-col">

      {/* Body — centered 404 */}
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md mx-auto space-y-6">
          {/* Big icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-brand/20 rounded-full" aria-hidden />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-subtle border border-brand/20">
                <BookOpen className="h-10 w-10 text-brand" />
              </div>
            </div>
          </div>

          {/* 404 mark + heading */}
          <div className="space-y-2">
            <p className="text-7xl font-black tracking-tighter text-fg/10 leading-none">
              404
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-fg-muted">
              The page you&apos;re looking for doesn&apos;t exist, may have been
              moved, or the link is no longer valid.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild>
              <Link href="/learn">
                <GraduationCap className="h-4 w-4" />
                Go to my learning
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/courses">
                Browse Courses
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-fg-muted text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}
