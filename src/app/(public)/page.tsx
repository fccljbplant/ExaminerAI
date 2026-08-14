import Link from "next/link";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { COPY } from "@/content/copy";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import {
  ArrowRight, Bot, Users, ShieldCheck, Zap, Brain, Award,
  TrendingUp, Clock, CheckCircle2, Sparkles, Building2, GraduationCap,
} from "lucide-react";

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

export default async function LandingPage() {
  // Authenticated users skip the marketing page → go straight to dashboard.
  const user = await getAuthUser();
  if (user) redirect("/app");

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand">
                <GraduationCap className="h-5 w-5" />
              </div>
              TraineesAI
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/for-business" className="text-fg-muted hover:text-fg transition-colors">For Teams</Link>
              <Link href="/for-learners" className="text-fg-muted hover:text-fg transition-colors">For Learners</Link>
              <Link href="/courses" className="text-fg-muted hover:text-fg transition-colors">Courses</Link>
              <Link href="/pricing" className="text-fg-muted hover:text-fg transition-colors">Pricing</Link>
              <Link href="/support" className="text-fg-muted hover:text-fg transition-colors">Support</Link>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/app">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/for-learners">Start Free <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Gradient mesh background */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-brand-subtle blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-brand-subtle blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow */}
            <Badge variant="outline" className="mb-6 gap-1.5 border-brand/30 bg-brand-subtle">
              <Sparkles className="h-3 w-3 text-brand" />
              {COPY.heroEyebrow}
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              We don&apos;t replace your engineers.
              <br />
              <span className="text-brand">We share the training burden.</span>
            </h1>

            {/* Subhead */}
            <p className="mt-6 text-lg sm:text-xl text-fg-muted leading-relaxed max-w-2xl mx-auto">
              {COPY.heroSub}
            </p>

            {/* Dual CTA */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="h-12 text-base">
                <Link href="/for-business">
                  <Building2 className="h-4 w-4 mr-2" />
                  For Teams — Book a Demo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 text-base">
                <Link href="/for-learners">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  For Learners — Start Free
                </Link>
              </Button>
            </div>

            {/* Trust line */}
            <p className="mt-4 text-xs text-fg-muted">
              No credit card required · 30-day pilot for teams · Cancel anytime
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto">
            {COPY.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-brand tabular-nums">{stat.value}</div>
                <div className="mt-1 text-xs text-fg-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ─────────────────────────────────────────── */}
      <section className="border-t border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-destructive/30 text-destructive">The Problem</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              {COPY.problemLine}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-fg-muted leading-relaxed">
              Every hour a senior engineer spends tutoring an intern is an hour not shipped.
              Interns wait days for feedback. Projects slip. Managers fly blind.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              { icon: Clock, stat: "~15%", label: "industry completion rate", desc: "Most courses are abandoned. Yours don't have to be." },
              { icon: TrendingUp, stat: "7h/wk", label: "senior eng time lost", desc: "Per intern. On basic training that AI handles better." },
              { icon: ShieldCheck, stat: "Zero", label: "visibility into progress", desc: "Managers have no signal until it's too late." },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-surface p-6 text-center">
                <item.icon className="h-8 w-8 text-destructive mx-auto mb-3" />
                <div className="text-2xl font-bold text-fg tabular-nums">{item.stat}</div>
                <div className="mt-1 text-xs font-semibold text-fg-muted uppercase tracking-wider">{item.label}</div>
                <p className="mt-2 text-sm text-fg-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE SOLUTION ────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="outline" className="mb-4 border-growth-sage text-growth-sage">The Solution</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              AI handles the daily load. Mentors handle the judgment.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-fg-muted leading-relaxed">
              {COPY.mentorBrief}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              {
                icon: Bot,
                title: "AI trains daily",
                desc: "Each trainee gets a personalized curriculum, daily tasks, and an AI tutor. Your senior engineers are freed from routine instruction.",
              },
              {
                icon: Brain,
                title: "Socratic tests",
                desc: "Not multiple choice. AI asks 'why' and 'how' — then grades the answer. Confidence is explicit (Sure / Guessing), not guessed.",
              },
              {
                icon: ShieldCheck,
                title: "Mentor triage",
                desc: "The platform auto-flags strugglers. Mentors message only the few who need them. The 80% who are fine are left alone.",
              },
              {
                icon: Award,
                title: "Verified certs",
                desc: "Every certificate has a public /verify/ URL. Employers can validate skills, projects, and scores — not just completion.",
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-line bg-surface p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle mb-4">
                  <feature.icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="text-base font-semibold text-fg">{feature.title}</h3>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section className="border-t border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Three steps. Zero busywork.
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 max-w-5xl mx-auto">
            {[
              { step: "01", title: "AI trains daily", desc: "Each trainee gets a personalized curriculum, daily tasks, and an AI tutor that teaches in their language. No senior engineer time required for routine instruction." },
              { step: "02", title: "Platform tracks & flags", desc: "Every interaction is logged. The platform auto-flags strugglers, inactivity, and score drops — surfacing only what needs a human's eyes." },
              { step: "03", title: "Mentors message only strugglers", desc: "Instructors open one queue — ranked by attention score — and message the few who actually need them. The 80% who are fine are left alone." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-brand/10 absolute -top-4 -left-2">{s.step}</div>
                <div className="relative">
                  <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DUAL CTA ────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
            {/* B2B CTA */}
            <div className="rounded-2xl border border-brand/30 bg-brand-subtle p-8">
              <Building2 className="h-8 w-8 text-brand mb-4" />
              <h3 className="text-xl font-bold text-fg">For Teams</h3>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">
                {COPY.b2bStrip}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-fg">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> Seat management & cohort analytics</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> Verified certificates for every trainee</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> 30-day risk-free pilot</li>
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link href="/for-business">Book a Demo <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </div>

            {/* B2C CTA */}
            <div className="rounded-2xl border border-line bg-surface p-8">
              <GraduationCap className="h-8 w-8 text-brand mb-4" />
              <h3 className="text-xl font-bold text-fg">For Learners</h3>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">
                {COPY.learnerPromise}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-fg">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> Free daily test quota</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> Build a real capstone project</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" /> Verified certificate on completion</li>
              </ul>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link href="/for-learners">Start Free <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-bold mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-on-brand">
                  <GraduationCap className="h-4 w-4" />
                </div>
                TraineesAI
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                AI-driven training OS. We share the training burden — your experts keep their time, your trainees keep their humans.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">Platform</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/for-business" className="text-fg-muted hover:text-fg transition-colors">For Teams</Link></li>
                <li><Link href="/for-learners" className="text-fg-muted hover:text-fg transition-colors">For Learners</Link></li>
                <li><Link href="/courses" className="text-fg-muted hover:text-fg transition-colors">Browse Courses</Link></li>
                <li><Link href="/pricing" className="text-fg-muted hover:text-fg transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">Resources</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/support" className="text-fg-muted hover:text-fg transition-colors">Help Center</Link></li>
                <li><Link href="/support" className="text-fg-muted hover:text-fg transition-colors">Contact Support</Link></li>
                <li><Link href="/app" className="text-fg-muted hover:text-fg transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">Company</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/for-business" className="text-fg-muted hover:text-fg transition-colors">About</Link></li>
                <li><Link href="/support" className="text-fg-muted hover:text-fg transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-fg-muted">© 2026 TraineesAI by Inzet Enterprises. All rights reserved.</p>
            <p className="text-xs text-fg-muted">AI = hands. Mentors = judgment.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
