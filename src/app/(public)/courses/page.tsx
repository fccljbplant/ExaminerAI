import Link from "next/link";
import type { Metadata } from "next";
import { Star, Users, Clock, TrendingUp, Award, BookOpen, Sparkles, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchMarketplaceCourses,
  fetchMarketplacePaths,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_LEVELS,
} from "@/lib/marketplace";
import { MarketplaceFilters } from "./MarketplaceFilters";

export const metadata: Metadata = {
  title: "Course Marketplace — TraineesAI",
  description:
    "Browse professional, project-based courses. AI-driven curriculum, capstone projects, and verified digital credentials.",
};

/** /courses — public marketplace listing. */
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

  const courses = await fetchMarketplaceCourses({ category, level, search, featured, free });

  const featuredCourses = courses.filter(c => c.featured);
  const freeCourses = courses.filter(c => c.price === 0);
  const paidCourses = courses.filter(c => c.price > 0);

  // If filters are active, show a single flat list (no sections). Otherwise,
  // show the curated homepage-style sections.
  const isFiltered = Boolean(category || level || search || featured || free);

  // Learning paths render only on the unfiltered homepage view — they are
  // curated bundles, not individual courses, so the course-level filters
  // don't apply to them.
  const paths = isFiltered ? [] : await fetchMarketplacePaths();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>TraineesAI</span>
            <span className="text-muted-foreground">/ Marketplace</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/app">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3">
              <Sparkles className="h-3 w-3 mr-1" /> AI-driven curriculum
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Build the skills employers actually verify.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Project-based courses with AI tutors, capstone deliverables, and
              skill-verified digital credentials. Every certificate links to a
              public verification page.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <MarketplaceFilters
            categories={MARKETPLACE_CATEGORIES}
            levels={MARKETPLACE_LEVELS}
            current={{ category, level, search, featured, free }}
          />
        </div>
      </section>

      {/* Course grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-12">
        {/* Learning Paths — only shown on the unfiltered homepage view, and
            only if at least one path is published. */}
        {paths.length > 0 && (
          <section>
            <SectionHeading
              icon={<RouteIcon className="h-5 w-5 text-primary" />}
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
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">No courses match your filters</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
                  icon={<TrendingUp className="h-5 w-5 text-primary" />}
                  title="Featured courses"
                  subtitle="Hand-picked programs recommended by our training team."
                />
                <CourseGrid courses={featuredCourses} highlightFeatured />
              </section>
            )}

            {paidCourses.length > 0 && (
              <section>
                <SectionHeading
                  icon={<Award className="h-5 w-5 text-primary" />}
                  title="All courses"
                  subtitle="Browse the full catalogue of professional programs."
                />
                <CourseGrid courses={paidCourses} highlightFeatured />
              </section>
            )}

            {freeCourses.length > 0 && (
              <section>
                <SectionHeading
                  icon={<Sparkles className="h-5 w-5 text-primary" />}
                  title="Free courses"
                  subtitle="Start learning today — no cost, full curriculum."
                />
                <CourseGrid courses={freeCourses} highlightFeatured />
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
        <CourseCard key={course.id} course={course} highlightFeatured={highlightFeatured} />
      ))}
    </div>
  );
}

function CourseCard({
  course,
  highlightFeatured,
}: {
  course: Awaited<ReturnType<typeof fetchMarketplaceCourses>>[number];
  highlightFeatured?: boolean;
}) {
  const isFree = course.price === 0;
  const showFeaturedBorder = highlightFeatured && course.featured;

  return (
    <Card
      className={`overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md ${
        showFeaturedBorder ? "border-primary/60 ring-1 ring-primary/30" : ""
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt={course.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen className="h-10 w-10 text-muted-foreground/50" />
        )}
        {course.featured && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3 mr-1" /> Featured
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2 capitalize">
          {course.category.replace("-", " ")}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title + level */}
        <div>
          <h3 className="font-semibold text-base line-clamp-2 leading-snug">{course.name}</h3>
          {course.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{course.subtitle}</p>
          )}
        </div>

        {/* Instructor */}
        {course.instructorName && (
          <p className="text-xs text-muted-foreground">By {course.instructorName}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="capitalize">{course.level}</Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {course.durationWeeks}w
          </span>
          {course.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {course.rating.toFixed(1)} ({course.reviewCount})
            </span>
          )}
          {course.enrollmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {course.enrollmentCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            {isFree ? (
              <span className="text-base font-semibold text-emerald-500">Free</span>
            ) : (
              <span className="text-base font-semibold">
                {course.currency} {course.price.toFixed(2)}
              </span>
            )}
          </div>
          <Button asChild size="sm">
            <Link href={`/courses/${course.id}`}>Enroll</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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
      <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 py-5 flex items-center gap-3 border-b border-border">
        <span className="text-3xl leading-none" aria-hidden>
          {path.icon || "🎓"}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-base leading-tight line-clamp-2">
            {path.title}
          </h3>
          {path.subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {path.subtitle}
            </p>
          )}
        </div>
        {path.featured && (
          <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3 mr-1" /> Featured
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {path.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="capitalize">{path.level}</Badge>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {path.courseCount} course{path.courseCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {path.durationWeeks}w
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
          <div>
            {isFree ? (
              <span className="text-base font-semibold text-emerald-500">Free</span>
            ) : (
              <span className="text-base font-semibold">
                {path.currency} {path.price.toFixed(2)}
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
