import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import {
  Sparkles, Star, Flame, Trophy, ArrowRight, BookOpen, GraduationCap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn — TraineesAI",
  description:
    "Your AI-guided learning home. Continue where you left off, or browse available courses and start a new one.",
};

/**
 * /learn — learner entry point.
 *
 * P5 merge: retires the V3Classroom mock. Authenticated users are
 * redirected to /learn/[courseId] via their continue-card resolution
 * (the learner's most recently active course, from /api/v2/learner/home).
 * Unauthenticated users see the marketplace catalog (unchanged).
 */

export default async function LearnHomePage() {
  const user = await getAuthUser();

  // Unauthenticated: marketplace catalog (sign-in prompt + course grid)
  if (!user) {
    const courses = await db.course.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true, name: true, description: true, domain: true, level: true,
        durationWeeks: true, isDefault: true, thumbnailUrl: true,
      },
    });
    return (
      <div className="min-h-screen flex flex-col bg-bg text-fg">
        <header className="border-b">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-5 w-5 text-brand" />
              TraineesAI <span className="text-fg-muted">/ Learn</span>
            </Link>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Link href="/login" className="px-3 py-1.5 rounded-md bg-brand text-on-brand hover:bg-brand-hover">
                Sign in
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <section className="rounded-2xl border bg-surface p-6 sm:p-8 mb-8">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">
              <Sparkles className="h-3 w-3" /> AI-guided learning
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
              Learn with an AI tutor by your side
            </h2>
            <p className="text-fg-muted mt-2 max-w-xl">
              Every course is taught by an AI avatar that explains each topic, asks check questions, and adapts to your level. Sign in to start.
            </p>
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
              >
                Sign in to start <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold">Browse courses</h2>
              <p className="text-xs text-fg-muted">{courses.length} total</p>
            </div>
            <CourseGrid courses={courses} enrolledIds={new Set()} />
          </section>
        </main>
        <footer className="border-t mt-auto">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-fg-muted flex items-center justify-between">
            <span>© TraineesAI — AI-guided learning.</span>
            <Link href="/" className="hover:text-fg">Back to home</Link>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated: redirect to the real classroom via continue-card.
  // Query the learner's most recently active course (same logic as
  // /api/v2/learner/home's continueCard — LearnProfile orderBy updatedAt
  // desc, take 1). If they have one, send them straight to /learn/[courseId]
  // (the real ClassroomShell). If not, send to the catalog.
  const profile = await db.learnProfile.findFirst({
    where: { userId: user.sub },
    orderBy: { updatedAt: "desc" },
    select: { courseId: true },
  });

  if (profile?.courseId) {
    redirect(`/learn/${profile.courseId}`);
  }

  // No enrollments → catalog
  redirect("/learner/learn");
}

function CourseGrid({
  courses,
  enrolledIds,
}: {
  courses: {
    id: string; name: string; description: string; domain: string;
    level: string; durationWeeks: number; isDefault: boolean; thumbnailUrl: string | null;
  }[];
  enrolledIds: Set<string>;
}) {
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-10 text-center text-sm text-fg-muted">
        No courses are available yet. Check back soon.
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const enrolled = enrolledIds.has(c.id);
        return (
          <article
            key={c.id}
            className="rounded-lg border bg-surface p-5 flex flex-col hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                {c.domain}
              </span>
              {c.isDefault && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Recommended
                </span>
              )}
            </div>
            <h3 className="font-semibold leading-snug">{c.name}</h3>
            <p className="text-sm text-fg-muted mt-1 line-clamp-2 flex-1">
              {c.description || "A project-based course with AI-guided slides, daily tests, and a capstone."}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-muted">
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {c.durationWeeks} weeks
              </span>
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> {c.level}
              </span>
            </div>
            <Link
              href={`/learn/${c.id}`}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand-subtle px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-subtle"
            >
              {enrolled ? "Continue" : "Start"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
