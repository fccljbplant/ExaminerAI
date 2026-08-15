import Link from "next/link";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import { COPY } from "@/content/copy";
import { Button } from "@/modules/ui/button";
import { Card, CardContent, CardHeader } from "@/modules/ui/card";
import { LoginForm } from "@/modules/auth/login-form";
import { Badge } from "@/modules/ui/badge";
import {
  ArrowRight, Bot, Brain, ShieldCheck, Award, CheckCircle2, Sparkles,
  Building2, Clock, GraduationCap, Search, TrendingUp, Users, Star,
  PackageOpen, Flame,
} from "lucide-react";
import { db } from "@/lib/db";
import { fetchMarketplaceCourses, fetchMarketplacePaths, MARKETPLACE_CATEGORIES } from "@/lib/marketplace";
import MarketplaceCourseCard from "./courses/MarketplaceCourseCard";

export const metadata: Metadata = {
  title: "TraineesAI — AI-Driven Training OS for Engineers & Teams",
  description: COPY.heroSub,
  alternates: { canonical: "/" },
  openGraph: {
    title: "TraineesAI — We share the training burden",
    description: COPY.heroSub,
    url: "/",
    type: "website",
    siteName: "TraineesAI",
  },
};

export const dynamic = "force-dynamic";

/** Category icon map for the storefront category strip. */
function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "technology": return <Bot className="h-4 w-4" aria-hidden />;
    case "engineering": return <WrenchIcon />;
    case "business": return <Building2 className="h-4 w-4" aria-hidden />;
    case "finance": return <TrendingUp className="h-4 w-4" aria-hidden />;
    case "healthcare": return <ShieldCheck className="h-4 w-4" aria-hidden />;
    case "manufacturing": return <PackageOpen className="h-4 w-4" aria-hidden />;
    case "hr": return <Users className="h-4 w-4" aria-hidden />;
    case "compliance": return <Award className="h-4 w-4" aria-hidden />;
    case "soft-skills": return <Sparkles className="h-4 w-4" aria-hidden />;
    default: return <BookIcon />;
  }
}

function WrenchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 12l-2-2 2.7-3.7z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  );
}

export default async function LandingPage() {
  // Authenticated users skip the marketing page → go straight to dashboard.
  const user = await getAuthUser();
  if (user) redirect(homeForRole(user.role));

  // Marketplace data — courses first (page 1!), then paths.
  const featuredCourses = await fetchMarketplaceCourses({ featured: true });
  const marketplaceCourses = (featuredCourses.length ? featuredCourses : await fetchMarketplaceCourses({})).slice(0, 9);
  const paths = (await fetchMarketplacePaths().catch(() => [])).slice(0, 4);

  // Category counts for the storefront strip (same as /courses).
  const categoryCounts = await db.course.groupBy({
    by: ["category"],
    where: { published: true },
    _count: { _all: true },
  });
  const countByCategory = new Map(categoryCounts.map((c) => [c.category, c._count._all]));
  const totalPublished = categoryCounts.reduce((sum, c) => sum + c._count._all, 0);

  const freeCourses = marketplaceCourses.filter((c) => c.price === 0);
  const hasFree = freeCourses.length > 0;

  return (
    <div>
      {/* ── HERO — compact marketplace hero ─────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-brand-subtle blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_400px]">
            {/* Left — the pitch */}
            <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
              <Badge variant="outline" className="mb-5 gap-1.5 border-brand/30 bg-brand-subtle">
                <Sparkles className="h-3 w-3 text-brand" />
                {COPY.heroEyebrow}
              </Badge>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl sm:leading-[1.05]">
                Learn a skill that <span className="text-brand">actually ships.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base lg:mx-0 mx-auto">
                Project-based courses with an AI tutor that teaches, probes and grades —
                plus a verified certificate employers can check. Your mentors stay in the loop.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="h-12 text-base">
                  <Link href="/courses">
                    <PackageOpen className="h-4 w-4 mr-2" />
                    Browse Courses
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 text-base">
                  <Link href="/for-business">
                    <Building2 className="h-4 w-4 mr-2" />
                    For Teams — Book a Demo
                  </Link>
                </Button>
              </div>
              {/* trust line */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-fg-muted lg:justify-start">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" aria-hidden /> No credit card</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" aria-hidden /> 30-day team pilot</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" aria-hidden /> Verified certificates</span>
              </div>
            </div>

            {/* Right — sign in, embedded in the hero (2026-08-15) */}
            <div className="mx-auto w-full max-w-sm lg:max-w-none">
              <Card className="shadow-xl shadow-brand/5">
                <CardHeader className="pb-2 text-center">
                  <h2 className="text-xl font-bold text-fg">Sign in</h2>
                  <p className="text-xs text-fg-muted">
                    Continue learning — or jump into a demo account.
                  </p>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ── COURSES — the storefront, PAGE 1 ────────────────────── */}
      {marketplaceCourses.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold sm:text-2xl">Trending courses</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-warning-on">
                  <Flame className="h-3 w-3" aria-hidden /> Hot
                </span>
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                {totalPublished} courses live · AI curriculum · verified credentials
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/courses">
                View all courses <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {marketplaceCourses.slice(0, 9).map((course) => (
              <MarketplaceCourseCard key={course.id} course={course} highlightFeatured showWishlist={false} />
            ))}
          </div>
        </section>
      )}

      {/* ── FLASH-DEALS STYLE STRIP — free starters + paths ─────── */}
      {(hasFree || paths.length > 0) && (
        <section className="border-y border-line bg-bg-subtle/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Start free today</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-[10px] font-semibold text-danger-on">
                <Clock className="h-3 w-3" aria-hidden /> Limited-time pilot
              </span>
            </div>

            {hasFree && (
              <div className="mt-5 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {freeCourses.map((course) => (
                  <div key={course.id} className="w-64 shrink-0">
                    <MarketplaceCourseCard course={course} showWishlist={false} ctaLabel="Start Free" />
                  </div>
                ))}
              </div>
            )}

            {paths.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {paths.map((p) => (
                  <Link
                    key={p.id}
                    href={`/paths/${p.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                      <TrendingUp className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fg">{p.title}</span>
                      <span className="block text-xs text-fg-muted">
                        {p.courseCount ?? 0} courses · {p.level ?? "all levels"}
                      </span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── WHY TRAINEESAI — the platform pitch (below the store) ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-growth-sage text-growth-sage">Why TraineesAI</Badge>
          <h2 className="text-2xl font-bold sm:text-3xl">{COPY.mentorBrief}</h2>
          <p className="mt-3 text-sm text-fg-muted sm:text-base">{COPY.heroSub}</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Bot, title: "AI trains daily", desc: "Personalized curriculum + AI tutor in every lesson. Routine instruction stops eating mentor hours." },
            { icon: Brain, title: "Socratic tests", desc: "Not multiple choice — AI asks why and how, then grades the reasoning. Confidence comes from real check-ins." },
            { icon: ShieldCheck, title: "Mentor triage", desc: "Strugglers are auto-flagged by attention score. Mentors message only the few who need them." },
            { icon: Award, title: "Verified certs", desc: "Every certificate has a public /verify URL — employers can validate skills and projects." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle">
                <f.icon className="h-4 w-4 text-brand" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS — three steps ──────────────────────────── */}
      <section className="border-t border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">Three steps. Zero busywork.</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-8 sm:grid-cols-3">
            {[
              { step: "01", title: "AI trains daily", desc: "Personalized curriculum, daily tasks and an AI tutor that teaches in the learner's language — no senior time for routine instruction." },
              { step: "02", title: "Platform tracks & flags", desc: "Every interaction is logged. Strugglers, inactivity and score drops are surfaced — only what needs a human's eyes." },
              { step: "03", title: "Mentors message strugglers", desc: "One queue ranked by attention score. Mentors message the few who need them; the rest are left alone." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="absolute -top-4 -left-2 text-5xl font-black text-brand/10">{s.step}</div>
                <div className="relative">
                  <h3 className="text-base font-semibold text-fg">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-brand-subtle p-8 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-lg font-bold text-fg">Start learning today — it&apos;s free.</p>
            <p className="mt-1 text-sm text-fg-muted">
              Browse the marketplace, pick a course, and get your first AI lesson in minutes.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/courses">
                Browse Courses <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/for-business">
                <Building2 className="h-4 w-4 mr-2" /> For Teams
              </Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
