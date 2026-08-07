import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Star, Users, Clock, BookOpen, Sparkles, GraduationCap, Award, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { db } from "@/lib/db";

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
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
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
            <InstructorCourseCard key={course.id} course={course} />
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

function InstructorCourseCard({
  course,
}: {
  course: {
    id: string;
    name: string;
    subtitle: string | null;
    category: string;
    level: string;
    price: number;
    currency: string;
    durationWeeks: number;
    thumbnailUrl: string | null;
    rating: number;
    reviewCount: number;
    enrollmentCount: number;
    featured: boolean;
  };
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
        <Badge variant="secondary" className="absolute top-2 right-2 capitalize">
          {course.category.replace("-", " ")}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base line-clamp-2 leading-snug">{course.name}</h3>
          {course.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{course.subtitle}</p>
          )}
        </div>
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
            <Link href={`/courses/${course.id}`}>View Course</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
