import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Star, Users, Clock, TrendingUp, Award, BookOpen, Sparkles, Route as RouteIcon } from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Card, CardContent } from "@/modules/ui/card";
import { Skeleton } from "@/modules/ui/skeleton";
import { db } from "@/lib/db";
import {
  fetchMarketplaceCourses,
  fetchMarketplacePaths,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_LEVELS,
} from "@/lib/marketplace";

// Force dynamic rendering — this page queries Prisma at request time.
// Without this, Next.js tries to statically prerender the page during
// the build, which exhausts the DB connection pool on Vercel.
export const dynamic = "force-dynamic";
import { formatPrice } from "@/lib/format";
import { MarketplaceFilters } from "./MarketplaceFilters";
import { VisitedCoursesTracker } from "./VisitedCoursesTracker";
import MarketplaceCourseCard from "./MarketplaceCourseCard";

export const metadata: Metadata = {
  title: "Course Marketplace — TraineesAI",
  description:
    "Browse professional, project-based courses. AI-driven curriculum, capstone projects, and verified digital credentials.",
  alternates: { canonical: "/courses" },
  openGraph: {
    title: "Course Marketplace — TraineesAI",
    description:
      "Browse professional, project-based courses. AI-driven curriculum, capstone projects, and verified digital credentials.",
    url: "/courses",
    type: "website",
    siteName: "TraineesAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Course Marketplace — TraineesAI",
    description:
      "Browse professional, project-based courses. AI-driven curriculum, capstone projects, and verified digital credentials.",
  },
};

/** /courses — public marketplace listing.
 *  Page shell renders immediately (header, hero, filters, category nav);
 *  the data-fetching is delegated to <MarketplaceContent> and wrapped in
 *  <Suspense> so the user sees a MarketplaceSkeleton while the DB queries
 *  resolve on the first paint. */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const getString = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const category = getString("category");
  const level = getString("level");
  const search = getString("search");
  const featured = getString("featured") === "1" || getString("featured") === "true";
  const free = getString("free") === "1" || getString("free") === "true";

  // Category counts fetch in parallel with the page shell — we want the
  // category nav visible immediately, so we await it at the page level.
  const categoryCounts = await db.course.groupBy({
    by: ["category"],
    where: { published: true },
    _count: { _all: true },
  });
  const countByCategory = new Map<string, number>(
    categoryCounts.map((c) => [c.category, c._count._all])
  );
  const totalPublished = categoryCounts.reduce((sum, c) => sum + c._count._all, 0);

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Mark "visited /courses" in localStorage so the OnboardingGuide
          step 1 lights up for new students. */}
      <VisitedCoursesTracker />

      {/* Header */}
      <header className="border-b border-line bg-surface/50 backdrop-blur supports-[backdrop-filter]:bg-surface/30 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-brand" />
            <span>TraineesAI</span>
            <span className="text-fg-muted">/ Marketplace</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/paths">Learning Paths</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="px-3 sm:px-4">
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3">
              <Sparkles className="h-3 w-3 mr-1" /> AI-driven curriculum
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Build the skills employers actually verify.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-fg-muted">
              Project-based courses with AI tutors, capstone deliverables, and
              skill-verified digital credentials. Every certificate links to a
              public verification page.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-line bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <MarketplaceFilters
            categories={MARKETPLACE_CATEGORIES}
            levels={MARKETPLACE_LEVELS}
            current={{ category, level, search, featured, free }}
          />
        </div>
      </section>

      {/* Category navigation */}
      <section className="border-b border-line bg-surface/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">Browse by category</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/courses"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                !category
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-bg hover:bg-bg-subtle"
              }`}
            >
              All Categories
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                {totalPublished}
              </Badge>
            </Link>
            {MARKETPLACE_CATEGORIES.map((c) => {
              const count = countByCategory.get(c.value) ?? 0;
              if (count === 0) return null; // hide empty categories
              const active = category === c.value;
              return (
                <Link
                  key={c.value}
                  href={`/courses/category/${c.value}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-brand bg-brand text-on-brand"
                      : "border-line bg-bg hover:bg-bg-subtle"
                  }`}
                >
                  {c.label}
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                    {count}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Course grid — wrapped in Suspense so the shell renders immediately. */}
      <Suspense fallback={<MarketplaceSkeleton />}>
        <MarketplaceContent
          category={category}
          level={level}
          search={search}
          featured={featured}
          free={free}
        />
      </Suspense>

      <footer className="border-t border-line py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-fg-muted text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}

/** Async content component — fetches courses + paths and renders the main grid.
 *  Wrapped in <Suspense> by the page so the shell paints immediately. */
async function MarketplaceContent({
  category,
  level,
  search,
  featured,
  free,
}: {
  category?: string;
  level?: string;
  search?: string;
  featured?: boolean;
  free?: boolean;
}) {
  const [courses, paths] = await Promise.all([
    fetchMarketplaceCourses({ category, level, search, featured, free }),
    // Learning paths render only on the unfiltered homepage view — they are
    // curated bundles, not individual courses, so the course-level filters
    // don't apply to them.
    category || level || search || featured || free
      ? Promise.resolve([])
      : fetchMarketplacePaths(),
  ]);

  const featuredCourses = courses.filter(c => c.featured);
  const freeCourses = courses.filter(c => c.price === 0);
  const paidCourses = courses.filter(c => c.price > 0);
  const isFiltered = Boolean(category || level || search || featured || free);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-12">
      {/* Learning Paths — only shown on the unfiltered homepage view, and
          only if at least one path is published. */}
      {paths.length > 0 && (
        <section>
          <SectionHeading
            icon={<RouteIcon className="h-5 w-5 text-brand" />}
            title="Learning Paths"
            subtitle="Bundles of courses that form a complete career trajectory — from fundamentals to capstone."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <LearningPathCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      )}

      {courses.length === 0 && paths.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="h-10 w-10 mx-auto text-fg-muted mb-3" />
          <h2 className="text-lg font-semibold">No courses match your filters</h2>
          <p className="text-sm text-fg-muted mt-1">
            Try clearing some filters or browsing all courses.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/courses">Clear filters</Link>
          </Button>
        </div>
      )}

      {isFiltered ? (
        <CourseGrid courses={courses} />
      ) : (
        <>
          {featuredCourses.length > 0 && (
            <section>
              <SectionHeading
                icon={<TrendingUp className="h-5 w-5 text-brand" />}
                title="Featured courses"
                subtitle="Hand-picked programs recommended by our training team."
              />
              <CourseGrid courses={featuredCourses} highlightFeatured />
            </section>
          )}

          {paidCourses.length > 0 && (
            <section>
              <SectionHeading
                icon={<Award className="h-5 w-5 text-brand" />}
                title="All courses"
                subtitle="Browse the full catalogue of professional programs."
              />
              <CourseGrid courses={paidCourses} highlightFeatured />
            </section>
          )}

          {freeCourses.length > 0 && (
            <section>
              <SectionHeading
                icon={<Sparkles className="h-5 w-5 text-brand" />}
                title="Free courses"
                subtitle="Start learning today — no cost, full curriculum."
              />
              <CourseGrid courses={freeCourses} highlightFeatured />
            </section>
          )}
        </>
      )}
    </main>
  );
}

/** Skeleton placeholder shown while <MarketplaceContent> fetches data.
 *  Six course-card-shaped gray boxes matching the real card layout. */
function MarketplaceSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-12">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden py-0 gap-0">
            <Skeleton className="aspect-video w-full rounded-none" />
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="h-3 w-1/3" />
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function CourseGrid({
  courses,
  highlightFeatured = false,
}: {
  courses: Awaited<ReturnType<typeof fetchMarketplaceCourses>>;
  highlightFeatured?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map(course => (
        <MarketplaceCourseCard
          key={course.id}
          course={course}
          highlightFeatured={highlightFeatured}
        />
      ))}
    </div>
  );
}

function LearningPathCard({
  path,
}: {
  path: Awaited<ReturnType<typeof fetchMarketplacePaths>>[number];
}) {
  const isFree = path.price === 0;
  return (
    <Card className="overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md flex flex-col">
      {/* Header band — icon + category */}
      <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 py-5 flex items-center gap-3 border-b border-line">
        <span className="text-3xl leading-none" aria-hidden>
          {path.icon || "🎓"}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-base leading-tight line-clamp-2">
            {path.title}
          </h3>
          {path.subtitle && (
            <p className="text-xs text-fg-muted line-clamp-1 mt-0.5">
              {path.subtitle}
            </p>
          )}
        </div>
        {path.featured && (
          <Badge className="absolute top-2 right-2 bg-brand text-on-brand">
            <Sparkles className="h-3 w-3 mr-1" /> Featured
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <p className="text-sm text-fg-muted line-clamp-3">
          {path.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
          <Badge variant="outline" className="capitalize">{path.level}</Badge>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {path.courseCount} course{path.courseCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {path.durationWeeks}w
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-line mt-auto">
          <div>
            {isFree ? (
              <span className="text-base font-semibold text-growth-sage">Free</span>
            ) : (
              <span className="text-base font-semibold">
                {formatPrice(path.price, path.currency)}
              </span>
            )}
          </div>
          <Button asChild size="sm">
            <Link href={`/paths/${path.id}`}>View Path</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Category-based gradient placeholder when no thumbnail is available.
 *  Re-exported from MarketplaceCourseCard for backward-compat with any
 *  inline usages in this file. */
export { CategoryGradient } from "./MarketplaceCourseCard";
