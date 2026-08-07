import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, Users, Clock, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  fetchMarketplaceCourses,
  MARKETPLACE_CATEGORIES,
} from "@/lib/marketplace";

/**
 * /courses/category/[category] — server-rendered category landing page.
 *
 * Lists all published courses in the given category using the same card
 * layout as the main marketplace. Includes a Courses > [Category] breadcrumb.
 *
 * Generates metadata dynamically per category for SEO.
 */

function findCategory(slug: string) {
  return MARKETPLACE_CATEGORIES.find((c) => c.value === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: raw } = await params;
  const cat = findCategory(raw);
  if (!cat) {
    return { title: "Category not found — TraineesAI" };
  }
  return {
    title: `${cat.label} Courses — TraineesAI`,
    description: `Browse professional ${cat.label.toLowerCase()} courses. Project-based learning, AI tutors, capstone deliverables, and verified digital credentials.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: raw } = await params;
  const cat = findCategory(raw);
  if (!cat) notFound();

  const courses = await fetchMarketplaceCourses({ category: cat.value });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/courses" className="flex items-center gap-2 font-semibold">
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

      {/* Breadcrumb + hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/courses">Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{cat.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge variant="secondary" className="capitalize">
            {cat.value.replace("-", " ")}
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            {cat.label} Courses
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
            Project-based {cat.label.toLowerCase()} programs with AI tutors,
            capstone deliverables, and skill-verified digital credentials.
            Every certificate links to a public verification page.
          </p>
        </div>
      </section>

      {/* Course grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        {courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">No courses in this category yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon — new programs are added regularly.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/courses">Browse all courses</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              {courses.length} course{courses.length === 1 ? "" : "s"} available
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CategoryCourseCard key={course.id} course={course} />
              ))}
            </div>
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

function CategoryCourseCard({
  course,
}: {
  course: Awaited<ReturnType<typeof fetchMarketplaceCourses>>[number];
}) {
  const isFree = course.price === 0;
  return (
    <Card
      className={`overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md ${
        course.featured ? "border-primary/60 ring-1 ring-primary/30" : ""
      }`}
    >
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
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base line-clamp-2 leading-snug">{course.name}</h3>
          {course.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{course.subtitle}</p>
          )}
        </div>
        {course.instructorName && (
          <p className="text-xs text-muted-foreground">By {course.instructorName}</p>
        )}
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
