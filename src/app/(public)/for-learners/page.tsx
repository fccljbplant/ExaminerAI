import Link from "next/link";
import type { Metadata } from "next";
import { COPY } from "@/content/copy";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import {
  ArrowRight, Bot, Brain, Award, CheckCircle2, GraduationCap,
  Sparkles, Zap, TrendingUp, Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "TraineesAI for Learners — Build skills employers verify",
  description: "AI teaches you daily. AI tests you Socratically. You build a real project. You earn a verified certificate. Start free — no credit card.",
  alternates: { canonical: "/for-learners" },
  openGraph: {
    title: "TraineesAI for Learners — Start Free",
    description: COPY.learnerPromise,
    url: "/for-learners",
  },
};

export const dynamic = "force-dynamic";

export default function ForLearnersPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand">
              <GraduationCap className="h-5 w-5" />
            </div>
            TraineesAI
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/for-business" className="text-fg-muted hover:text-fg">For Teams</Link>
            <Link href="/courses" className="text-fg-muted hover:text-fg">Courses</Link>
            <Link href="/pricing" className="text-fg-muted hover:text-fg">Pricing</Link>
            <Link href="/support" className="text-fg-muted hover:text-fg">Support</Link>
          </div>
          <Button asChild size="sm">
            <Link href="/login">Start Free <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-brand-subtle blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5 border-brand/30 bg-brand-subtle">
              <GraduationCap className="h-3 w-3 text-brand" />
              FOR LEARNERS
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Build skills employers
              <br />
              <span className="text-brand">actually verify.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-fg-muted leading-relaxed max-w-2xl mx-auto">
              {COPY.learnerPromise}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="h-12 text-base">
                <Link href="/app?view=signup">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Free — No Credit Card
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 text-base">
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-fg-muted">
              Free daily test quota · Verified certificate · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">What you get</h2>
            <p className="mt-4 text-fg-muted">Everything you need to go from beginner to job-ready.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {[
              { icon: Bot, title: "Daily AI tutor", desc: "A personal tutor that teaches today's topic in your language. Ask anything, anytime. Connects every concept to your project." },
              { icon: Brain, title: "Socratic tests", desc: "Not multiple choice. AI asks 'why' and 'how' — then grades your answer. You'll know exactly what you understand and what you don't." },
              { icon: Award, title: "Verified certificate", desc: "Every certificate has a public /verify URL. Share it on LinkedIn. Employers can validate your skills, projects, and scores." },
              { icon: Zap, title: "Spaced-repetition drills", desc: "Wrong answers come back as drill cards. Master them before they expire. Your weak spots get reinforced automatically." },
              { icon: TrendingUp, title: "Transparent progress", desc: "Your Learning Signal is a 0-100 score computed from your scores, completion, and activity. Nothing hidden. You can argue with it." },
              { icon: Clock, title: "Capstone project", desc: "Build a real project across the course. AI examines each phase. You graduate with a portfolio piece, not just a certificate." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-line bg-surface p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle mb-4">
                  <item.icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works for learners */}
      <section className="border-t border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Your daily routine</h2>
            <p className="mt-4 text-fg-muted">3 steps. ~30 minutes a day. That's it.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Check in", desc: "Tell the AI what you did yesterday, what you're stuck on. Takes 2 minutes." },
              { step: "02", title: "Learn + test", desc: "AI teaches today's topic. Then 3 Socratic questions to check you understood. ~20 min." },
              { step: "03", title: "Build", desc: "Apply it to your capstone project. AI examines your work. Your mentor steps in if you're stuck." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-brand/10 absolute -top-4 -left-2">{s.step}</div>
                <div className="relative">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing strip */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold">Start free. Upgrade when you're ready.</h2>
            <p className="mt-4 text-fg-muted">No credit card to start. No lock-in. Cancel anytime.</p>
            <Button asChild size="lg" className="mt-8 h-12 text-base">
              <Link href="/app?view=signup">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Your Free Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-fg-muted">
              <Link href="/pricing" className="text-brand hover:underline">See pricing →</Link>
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
