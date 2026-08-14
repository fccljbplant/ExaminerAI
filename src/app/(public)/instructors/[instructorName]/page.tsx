import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Star, Users, BookOpen, Sparkles, GraduationCap, Award, ChevronRight,
} from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/modules/ui/breadcrumb";
import { db } from "@/lib/db";
import MarketplaceCourseCard from "../../courses/MarketplaceCourseCard";

/**
 * /instructors/[instructorName] — server-rendered instructor profile page.
 *
 * Shows the instructor's bio, aggregate stats (# courses, # enrollments,
 * avg rating), and their published course catalogue.
 *
 * The instructorName is URL-decoded from the path segment. We match it
 * case-sensitively against `Course.instructorName` — the examiner sets
 * the display name in the CoursePlanner UI.
 */

function decodeName(raw: string): string {
  return decodeURIComponent(raw);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ instructorName: string }>;
}): Promise<Metadata> {
  const { instructorName: raw } = await params;
  const name = decodeName(raw);
  return {
    title: `${name} — Instructor Profile — TraineesAI`,
    description: `Courses taught by ${name}. Project-based learning, AI tutors, and verified digital credentials.`,
  };
}

export default async function InstructorProfilePage({
  params,
}: {
  params: Promise<{ instructorName: string }>;
}) {
  const { instructorName: raw } = await params;
  const name = decodeName(raw);

  // Fetch every published course for this instructor.
  const courses = await db.course.findMany({
    where: {
      published: true,
      instructorName: name,
    },
    select: {
      id: true,
      name: true,
      subtitle: true,
      category: true,
      level: true,
      price: true,
      currency: true,
      durationWeeks: true,
      thumbnailUrl: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      featured: true,
      instructorName: true,
      instructorBio: true,
    },
    orderBy: [
      { featured: "desc" },
      { enrollmentCount: "desc" },
      { createdAt: "desc" },
    ],
  });

  if (courses.length === 0) {
    notFound();
  }

  // Roll up stats.
  const totalEnrollments = courses.reduce((s, c) => s + c.enrollmentCount, 0);
  const ratingSum = courses.reduce((s, c) => s + c.rating * c.reviewCount, 0);
  const reviewCount = courses.reduce((s, c) => s + c.reviewCount, 0);
  const avgRating = reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : 0;
  const bio = courses.find((c) => c.instructorBio)?.instructorBio ?? null;

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
          <Button asChild size="sm">
            <Link href="/app">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Breadcrumb + hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-4">
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
                <BreadcrumbLink asChild>
                  <Link href="/courses">Instructors</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                {name}
              </h1>
              {bio && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  {bio}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" /> {courses.length} course{courses.length === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> {totalEnrollments.toLocaleString()} enrolled
                </span>
                {avgRating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-growth-amber" />
                    <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    <span>({reviewCount} review{reviewCount === 1 ? "" : "s"})</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Courses by {name}</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <MarketplaceCourseCard
              key={course.id}
              course={course}
              ctaLabel="View Course"
              showWishlist={false}
            />
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}
