import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Clock, BookOpen, Sparkles, GraduationCap, ArrowRight, Code2,
  Route as RouteIcon, CheckCircle2,
} from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/card";
import { fetchMarketplacePathDetail } from "@/lib/marketplace";
import { formatPrice } from "@/lib/format";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const path = await fetchMarketplacePathDetail(id);
  if (!path) return { title: "Learning path not found — TraineesAI" };
  return {
    title: `${path.title} — TraineesAI Path`,
    description: path.subtitle || path.description.slice(0, 160),
  };
}

export default async function LearningPathDetailPage({ params }: Params) {
  const { id } = await params;
  const path = await fetchMarketplacePathDetail(id);
  if (!path) notFound();

  const isFree = path.price === 0;
  // Sum the individual course prices for the "bundle savings" comparison.
  const individualTotal = path.courses.reduce((sum, c) => sum + (c.price || 0), 0);
  const savings = individualTotal - path.price;
  const hasSavings = savings > 0;
  const totalWeeks = path.courses.reduce((sum, c) => sum + c.durationWeeks, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/courses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <RouteIcon className="h-4 w-4" />
            <span>Marketplace</span>
          </Link>
          <Button asChild size="sm">
            <Link href="/app">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-3 gap-8">
          {/* Left: title + meta */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {path.category.replace("-", " ")}
              </Badge>
              <Badge variant="outline" className="capitalize">{path.level}</Badge>
              {path.featured && (
                <Badge className="bg-primary text-primary-foreground">
                  <Sparkles className="h-3 w-3 mr-1" /> Featured
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-5xl leading-none" aria-hidden>
                {path.icon || "🎓"}
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                {path.title}
              </h1>
            </div>
            {path.subtitle && (
              <p className="text-lg text-muted-foreground">{path.subtitle}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" /> {path.courseCount} course{path.courseCount === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {path.durationWeeks} weeks
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" /> {path.level}
              </span>
            </div>

            {/* CTA + price */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/app">
                  {isFree ? "Start free path" : "Enroll in Path"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {isFree ? (
                    <span className="text-growth-sage">Free</span>
                  ) : (
                    formatPrice(path.price, path.currency)
                  )}
                </span>
                {hasSavings && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(individualTotal, path.currency)}
                  </span>
                )}
              </div>
              {hasSavings && (
                <Badge variant="outline" className="bg-growth-sage-soft text-growth-sage-foreground border-growth-sage">
                  Save {formatPrice(savings, path.currency)}
                </Badge>
              )}
            </div>
          </div>

          {/* Right: path summary card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-primary" /> Path summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Courses</span>
                  <span className="font-medium">{path.courseCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total weeks</span>
                  <span className="font-medium">{totalWeeks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bundle price</span>
                  <span className="font-medium">
                    {isFree ? "Free" : formatPrice(path.price, path.currency)}
                  </span>
                </div>
                {hasSavings && (
                  <div className="flex justify-between text-growth-sage dark:text-growth-sage">
                    <span>You save</span>
                    <span className="font-medium">
                      {formatPrice(savings, path.currency)}
                    </span>
                  </div>
                )}
                <Button asChild className="w-full mt-2">
                  <Link href="/app">{isFree ? "Start free path" : "Enroll in Path"}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-3 gap-8">
        {/* Left: course sequence */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          {path.description && (
            <section>
              <h2 className="text-xl font-semibold mb-3">About this path</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {path.description}
              </p>
            </section>
          )}

          {/* Course sequence */}
          {path.courses.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Course sequence
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {path.courses.length} courses · {totalWeeks} weeks of content · capstone-ready
              </p>
              <ol className="space-y-3">
                {path.courses.map((c) => (
                  <li key={c.id}>
                    <Card className={c.isCapstone ? "border-primary/40 bg-primary/5" : ""}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {c.order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm">
                                <Link
                                  href={`/courses/${c.courseId}`}
                                  className="hover:underline"
                                >
                                  {c.name}
                                </Link>
                              </h3>
                              {c.subtitle && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {c.subtitle}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {c.isCapstone && (
                                <Badge className="bg-primary/15 text-primary border-primary/30">
                                  <Code2 className="h-3 w-3 mr-1" /> Capstone
                                </Badge>
                              )}
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {c.level}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {c.durationWeeks}w
                            </span>
                            <span>
                              {c.price === 0 ? (
                                <span className="text-growth-sage dark:text-growth-sage font-medium">Free</span>
                              ) : (
                                formatPrice(c.price, path.currency)
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Right: sidebar */}
        <aside className="space-y-6">
          {/* What's included */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> What&apos;s included
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>Every learning path bundles:</p>
              <ul className="space-y-1 pl-4 list-disc">
                <li>{path.courseCount} structured courses with daily objectives</li>
                <li>AI tutor + weekly assessments per course</li>
                <li>Hands-on capstone project (final course)</li>
                <li>Verified digital credential per course</li>
                <li>Public verification URL for employers</li>
              </ul>
              {hasSavings && (
                <p className="mt-3 text-growth-sage dark:text-growth-sage font-medium">
                  Bundle saves you {formatPrice(savings, path.currency)} vs. buying each course separately.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Capstone + credential info */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" /> Capstone + credential
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                The final course in this path is a capstone project — GitHub repo, live demo, and written reflection.
              </p>
              <p>On completion (score ≥ 75), you receive a verified digital credential with:</p>
              <ul className="space-y-1 pl-4 list-disc">
                <li>Public verification URL</li>
                <li>Add-to-LinkedIn button</li>
                <li>Distinct grade if score ≥ 85</li>
              </ul>
              <Button asChild size="sm" className="w-full mt-3">
                <Link href="/app">{isFree ? "Start free path" : "Enroll in Path"}</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} TraineesAI · Verified digital credentials · AI-driven curriculum
        </div>
      </footer>
    </div>
  );
}
