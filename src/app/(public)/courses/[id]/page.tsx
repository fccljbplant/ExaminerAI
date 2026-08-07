import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Star, Users, Clock, Award, BookOpen, CheckCircle2, Sparkles,
  GraduationCap, Globe, ArrowRight, ShieldCheck, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMarketplaceCourseDetail, MARKETPLACE_CATEGORIES, MARKETPLACE_LEVELS } from "@/lib/marketplace";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const course = await fetchMarketplaceCourseDetail(id);
  if (!course) return { title: "Course not found — TraineesAI" };
  return {
    title: `${course.name} — TraineesAI`,
    description: course.subtitle || course.description.slice(0, 160),
  };
}

export default async function CourseDetailPage({ params }: Params) {
  const { id } = await params;
  const course = await fetchMarketplaceCourseDetail(id);
  if (!course) notFound();

  const isFree = course.price === 0;
  const categoryLabel =
    MARKETPLACE_CATEGORIES.find((c) => c.value === course.category)?.label ?? course.category;
  const levelLabel =
    MARKETPLACE_LEVELS.find((l) => l.value === course.level)?.label ?? course.level;

  const totalDays = course.weeks.reduce((sum, w) => sum + w.days.length, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/courses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <BookOpen className="h-4 w-4" />
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
              <Badge variant="secondary">{categoryLabel}</Badge>
              <Badge variant="outline">{levelLabel}</Badge>
              {course.featured && (
                <Badge className="bg-primary text-primary-foreground">
                  <Sparkles className="h-3 w-3 mr-1" /> Featured
                </Badge>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              {course.name}
            </h1>
            {course.subtitle && (
              <p className="text-lg text-muted-foreground">{course.subtitle}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {course.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">{course.rating.toFixed(1)}</span>
                  <span>({course.reviewCount} reviews)</span>
                </span>
              )}
              {course.enrollmentCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> {course.enrollmentCount.toLocaleString()} enrolled
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {course.durationWeeks} weeks
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" /> {course.language}
              </span>
              {course.instructorName && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" /> {course.instructorName}
                </span>
              )}
            </div>

            {/* CTA + price */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/app">
                  {isFree ? "Start free" : "Enroll now"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="text-2xl font-bold">
                {isFree ? (
                  <span className="text-emerald-500">Free</span>
                ) : (
                  `${course.currency} ${course.price.toFixed(2)}`
                )}
              </span>
            </div>
          </div>

          {/* Right: thumbnail / trailer */}
          <div className="lg:col-span-1">
            <div className="aspect-video rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
              {course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnailUrl} alt={course.name} className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-12 w-12 text-muted-foreground/40" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-3 gap-8">
        {/* Left: course content */}
        <div className="lg:col-span-2 space-y-10">
          {/* What you'll learn */}
          {course.whatYouWillLearn.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" /> What you&apos;ll learn
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {course.whatYouWillLearn.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {course.description && (
            <section>
              <h2 className="text-xl font-semibold mb-3">About this course</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
            </section>
          )}

          {/* Curriculum */}
          {course.weeks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Curriculum
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {course.weeks.length} weeks · {totalDays} lessons · capstone-ready
              </p>
              <div className="space-y-3">
                {course.weeks.map((week) => (
                  <Card key={week.id} className="py-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">
                          W{week.weekNumber}
                        </span>
                        <span>{week.phase}</span>
                        {week.milestone && (
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            {week.milestone}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-1.5">
                        {week.days.map((day) => (
                          <li key={day.id} className="flex items-start gap-2 text-sm">
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">
                              D{day.day}
                            </span>
                            <div>
                              <span className="font-medium">{day.title}</span>
                              {day.objective && (
                                <span className="text-muted-foreground"> — {day.objective}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Prerequisites */}
          {course.prerequisites.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Prerequisites</h2>
              <ul className="space-y-2">
                {course.prerequisites.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right: sidebar */}
        <aside className="space-y-6">
          {/* Skills verified */}
          {course.skillsVerified.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Skills verified
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Each skill below is graded via Socratic assessment + capstone defense. You&apos;ll receive a verified credential once your final score ≥ 75.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {course.skillsVerified.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructor */}
          {course.instructorName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Instructor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm">{course.instructorName}</p>
                {course.instructorBio && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{course.instructorBio}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Capstone + credential info */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" /> Capstone + credential
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>Every course includes a hands-on capstone project — GitHub repo, live demo, and written reflection.</p>
              <p>On completion (score ≥ 75), you receive a verified digital credential with:</p>
              <ul className="space-y-1 pl-4 list-disc">
                <li>Public verification URL</li>
                <li>Add-to-LinkedIn button</li>
                <li>Distinct grade if score ≥ 85</li>
              </ul>
              <Button asChild size="sm" className="w-full mt-3">
                <Link href="/app">{isFree ? "Start free" : "Enroll now"}</Link>
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
