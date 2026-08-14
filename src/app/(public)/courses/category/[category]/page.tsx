import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/modules/ui/breadcrumb";
import {
  fetchMarketplaceCourses,
  MARKETPLACE_CATEGORIES,
} from "@/lib/marketplace";
import MarketplaceCourseCard from "../../MarketplaceCourseCard";

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
  const description = `Browse professional ${cat.label.toLowerCase()} training courses. Project-based learning, AI tutors, capstone deliverables, and skill-verified digital credentials.`;
  const url = `/courses/category/${cat.value}`;
  return {
    title: `${cat.label} Courses — TraineesAI`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${cat.label} Courses — TraineesAI`,
      description,
      url,
      type: "website",
      siteName: "TraineesAI",
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.label} Courses — TraineesAI`,
      description,
    },
    keywords: [
      cat.label,
      `${cat.label} courses`,
      "professional training",
      "TraineesAI",
      "verified credential",
      "capstone project",
    ],
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
                <MarketplaceCourseCard key={course.id} course={course} />
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
