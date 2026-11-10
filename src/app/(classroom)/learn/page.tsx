import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import {
  Sparkles, Star, Flame, Trophy, ArrowRight, BookOpen, GraduationCap, Map as MapIcon,
} from "lucide-react";
import { LearnChrome } from "./learn-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn — TraineesAI",
  description:
    "Your AI-guided learning home. Continue where you left off, or browse available courses and start a new one.",
};

/**
 * /learn — learner home.
 *
 * Authenticated users get the page inside the MAIN UI CONTAINER — the
 * adaptive AppShellV2 (learner nav, user menu, in-app footer) — so the
 * catalog no longer reads as a standalone site. Mobile reading is
 * preserved by the shell itself: the bottom nav tucks away while
 * scrolling and the content column keeps pb-24 clearance.
 *
 * Unauthenticated users keep the standalone public catalog (its own
 * slim header with a Sign-in CTA) — /learn is a public route and the
 * flag-off fallback for learners, so anonymous browsing must survive.
 *
 * Authenticated users see:
 *   - "Continue Learning" hero (their last active course + next lesson)
 *   - Stats chips (XP, level, streak)
 *   - Catalog of other available courses
 *
 * Unauthenticated users see:
 *   - The catalog with "Start" buttons (which redirect to /app for login)
 */

export default async function LearnHomePage() {
  const user = await getAuthUser();

  // Parallel data fetch
  const [courses, learnerCourses, profile] = await Promise.all([
    db.course.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true, name: true, description: true, domain: true, level: true,
        durationWeeks: true, isDefault: true, thumbnailUrl: true,
      },
    }),
    user
      ? db.learnProfile.findMany({
          where: { userId: user.sub },
          orderBy: { updatedAt: "desc" },
          include: { course: { select: { id: true, name: true } } },
        })
      : [],
    user
      ? db.learnProfile.aggregate({
          where: { userId: user.sub },
          _sum: { totalXP: true },
        })
      : null,
  ]);

  const totalXP = profile?._sum.totalXP ?? 0;
  const lastCourse = learnerCourses[0]?.course ?? null;

  // ---- Authenticated: render inside the main UI container (no own
  // header/footer — the adaptive shell provides brand, nav, user menu
  // and the in-app footer on every breakpoint).
  if (user) {
    return (
      <LearnChrome userName={user.name}>
        {/* Continue Learning hero */}
        <section className="rounded-2xl border bg-surface p-5 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-subtle blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">
              <Sparkles className="h-3 w-3" /> Continue Learning
            </div>
            {lastCourse ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                  {lastCourse.name}
                </h1>
                <p className="text-fg-muted mt-2 max-w-xl text-sm sm:text-base">
                  Pick up where you left off. Your AI tutor is ready to walk you through the next topic.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/learn/${lastCourse.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand/90"
                  >
                    Resume session <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/learn/${lastCourse.id}`}
                    className="text-sm text-fg-muted hover:text-fg inline-flex items-center gap-1.5"
                  >
                    <MapIcon className="h-3.5 w-3.5" /> View journey map
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                  Ready to start learning
                </h1>
                <p className="text-fg-muted mt-2 max-w-xl text-sm sm:text-base">
                  Pick a course below to begin. Your AI tutor will guide you through every topic with slides, daily tests, and a capstone project.
                </p>
              </>
            )}

            {/* Stats chips — horizontally scrollable on phones so the
                row never wraps into a tall block over the hero copy */}
            <div className="mt-6 flex flex-nowrap overflow-x-auto gap-2 pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip icon={<Star className="h-3 w-3 text-amber-500" />} label={`${totalXP} XP`} />
              <Chip icon={<Trophy className="h-3 w-3 text-brand" />} label="Rookie" />
              <Chip icon={<Flame className="h-3 w-3 text-orange-500" />} label="0-day streak" />
              <Chip icon={<GraduationCap className="h-3 w-3 text-brand" />} label={`${learnerCourses.length} course${learnerCourses.length === 1 ? "" : "s"} enrolled`} />
            </div>
          </div>
        </section>

        {/* Catalog */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold">Available courses</h2>
            <p className="text-xs text-fg-muted">{courses.length} total</p>
          </div>
          <CourseGrid courses={courses} enrolledIds={new Set(learnerCourses.map(p => p.courseId))} />
        </section>
      </LearnChrome>
    );
  }

  // ---- Anonymous: standalone public catalog (unchanged behaviour).
  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      {/* Top bar */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-5 w-5 text-brand" />
            TraineesAI <span className="text-fg-muted">/ Learn</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/login" className="px-3 py-1.5 rounded-md bg-brand text-on-brand hover:bg-brand/90">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Public hero */}
        <section className="rounded-2xl border bg-surface p-5 sm:p-8 mb-8">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">
            <Sparkles className="h-3 w-3" /> AI-guided learning
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Learn with an AI tutor by your side
          </h1>
          <p className="text-fg-muted mt-2 max-w-xl text-sm sm:text-base">
            Every course is taught by an AI avatar that explains each topic, asks check questions, and adapts to your level. Sign in to start.
          </p>
          <div className="mt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand/90"
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

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium">
      {icon} {label}
    </span>
  );
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
