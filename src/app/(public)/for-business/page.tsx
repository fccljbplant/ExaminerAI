import Link from "next/link";
import type { Metadata } from "next";
import { COPY } from "@/content/copy";
import { ROICalculator } from "./ROICalculator";
import {
  Sparkles,
  Briefcase,
  Users,
  ClipboardList,
  BarChart3,
  FileText,
  Award,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
  ShieldCheck,
  Building2,
  Zap,
  Target,
  TrendingUp,
  Clock,
  Server,
  Lock,
  Bot,
} from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Card, CardContent } from "@/modules/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/modules/ui/accordion";

export const metadata: Metadata = {
  title: "TraineesAI for Business — Share the Training Burden",
  description: COPY.b2bStrip +
    " AI-driven training for interns and engineers — seat management, course assignment, team analytics, verified certificates, and mentor triage.",
  alternates: { canonical: "/for-business" },
  openGraph: {
    title: "TraineesAI for Business — Share the Training Burden",
    description:
      "AI-driven training for interns and engineers. 60% completion vs 15% industry average. Book a demo or start a 10-seat pilot today.",
    url: "/for-business",
    type: "website",
    siteName: "TraineesAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "TraineesAI for Business",
    description: COPY.b2bStrip,
  },
  keywords: [
    "B2B training platform",
    "engineering training",
    "intern onboarding",
    "team learning",
    "AI-driven training",
    "corporate LMS",
    "verified certificates",
    "TraineesAI Business",
  ],
};

const PROBLEM_POINTS = [
  "Every hour a senior engineer spends on basic training is an hour not shipped.",
  "Interns wait days for feedback that should arrive in minutes.",
  "Projects slip because onboarding eats the first month.",
  "Managers fly blind — no signal on who's progressing, who's stuck.",
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "AI trains daily",
    desc: "Each trainee gets a personalized curriculum, daily tasks, and an AI tutor that teaches in their language. Your senior engineers are freed from routine instruction — they step in where the AI flags struggle.",
    icon: Bot,
  },
  {
    step: "02",
    title: "Platform tracks & flags",
    desc: "Every interaction is logged. The platform auto-flags strugglers, inactivity, and score drops — surfacing only what needs a human's eyes.",
    icon: BarChart3,
  },
  {
    step: "03",
    title: "Mentors message only strugglers",
    desc: "Instructors open one queue — ranked by attention score — and message the few who actually need them. The 80% who are fine are left alone.",
    icon: MessageSquare,
  },
];

const FEATURES = [
  {
    icon: Users,
    title: "Seat Management",
    desc: "Allocate, reallocate, and revoke seats across teams. Pause a seat when an intern leaves, reassign it to a new hire — no procurement loop.",
  },
  {
    icon: ClipboardList,
    title: "Course Assignment",
    desc: "Assign role-specific learning paths to cohorts. New frontend hire? Assign the frontend path. New analyst? Assign the data path. Done in seconds.",
  },
  {
    icon: BarChart3,
    title: "Team Analytics",
    desc: "Cohort dashboards with completion rates, attention scores, and time-to-ready. Export to CSV for board meetings and quarterly reviews.",
  },
  {
    icon: FileText,
    title: "Readiness Reports",
    desc: "Auto-generated reports that tell you when a trainee is ready to ship — based on weekly test scores, project progress, and skill mastery.",
  },
  {
    icon: Award,
    title: "Verified Certificates",
    desc: "Every certificate links to a public verification page. Recruiters and clients can confirm skills in one click — no more LinkedIn trust gaps.",
  },
  {
    icon: MessageSquare,
    title: "Mentor Triage",
    desc: "Attention-scored queue ranks trainees by who needs help. Mentors open the queue, message the top 3, and close it. 10 hours saved per intern.",
  },
];

const PROOF_METRICS = [
  {
    value: "60%",
    label: "completion rate",
    sub: "vs 15% industry average",
    icon: TrendingUp,
  },
  {
    value: "10 hrs",
    label: "saved per intern",
    sub: "by senior engineers on training",
    icon: Clock,
  },
  {
    value: "4×",
    label: "faster onboarding",
    sub: "from week 4 to week 1 ready",
    icon: Zap,
  },
  {
    value: "100%",
    label: "verified certificates",
    sub: "public, fraud-proof, recruiter-friendly",
    icon: ShieldCheck,
  },
];

const PRICING = [
  {
    name: "Team",
    price: "$29",
    unit: "/ seat / month",
    desc: "For teams of 5–50 who need structured training without procurement friction.",
    features: [
      "Up to 50 seats",
      "All marketplace courses included",
      "Team analytics dashboard",
      "Course assignment & seat management",
      "Verified certificates",
      "Email support",
    ],
    cta: "Start 10-Seat Pilot",
    href: "/signup/b2b",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "talk to sales",
    desc: "For organizations that need SSO, custom curriculum, and dedicated success managers.",
    features: [
      "Unlimited seats",
      "SSO (SAML / OIDC) + SCIM provisioning",
      "Custom courses & private marketplace",
      "Dedicated success manager",
      "Quarterly business reviews",
      "99.9% uptime SLA + priority support",
      "On-prem / private-cloud deployment available",
    ],
    cta: "Book a Demo",
    href: "/signup/b2b",
    highlight: true,
  },
];

const FAQS = [
  {
    q: "We already have an LMS. Why switch?",
    a: "You don't have to switch. TraineesAI complements your LMS for the engineering / technical-training slice where traditional LMS platforms underperform: hands-on capstone projects, Socratic AI testing, and mentor-triage workflows. Most customers run TraineesAI alongside their LMS, exporting completion data into the LMS of record.",
  },
  {
    q: "How is this different from Udemy for Business?",
    a: "Udemy is video-first — passive consumption, ~15% completion. TraineesAI is project-first: every learner ships a capstone, takes Socratic AI tests, and gets daily AI-tutor instruction in their language. Completion rates run 4× higher because the platform tests and tutors, not just streams video.",
  },
  {
    q: "What about data security & compliance?",
    a: "We're SOC 2 Type II-ready (audit in progress). Enterprise plans include SSO via SAML/OIDC, SCIM user provisioning, audit logs, role-based access control, and optional private-cloud deployment. PII is encrypted at rest and in transit. We sign DPAs and BAAs on request.",
  },
  {
    q: "Can we pilot before committing?",
    a: "Yes — the 10-seat pilot is risk-free for 30 days. Pick any 10 interns or new hires, assign a learning path, and watch the analytics dashboard fill in. If it doesn't save your senior engineers at least 10 hours per intern in month one, walk away. No contract.",
  },
];

export default function ForBusinessPage() {
  return (
    <div>

      {/* ────────────────────────────────────────────────────────────
          1. Hero — tagline + dual CTA
         ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Ambient gradient background — dark, professional */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-brand-subtle blur-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <Briefcase className="h-3 w-3" />
              TraineesAI for Business
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              We don&apos;t replace your engineers.
              <br />
              <span className="text-brand">We share the training burden.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-fg-muted leading-relaxed max-w-2xl">
              {COPY.heroSub}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3" id="cta">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/signup/b2b">
                  <CalendarClock className="h-4 w-4" />
                  Book a Demo
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="/signup/b2b">
                  <Users className="h-4 w-4" />
                  Start 10-Seat Pilot
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-fg-muted">
              30-day risk-free pilot · No credit card · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          2. The Problem
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-surface/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 border-destructive/30 text-destructive">
              The Problem
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              {COPY.problemLine}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-fg-muted leading-relaxed">
              Interns wait. Projects slip. Your most expensive people end up
              tutoring the newest ones — alone — and the codebase pays for it.
            </p>
            <ul className="mt-8 space-y-3">
              {PROBLEM_POINTS.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                  <CheckCircle2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <span className="text-fg/90">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          2b. ROI Calculator — interactive, shows time + cost savings
         ──────────────────────────────────────────────────────────── */}
      <ROICalculator />

      {/* ────────────────────────────────────────────────────────────
          3. How It Works — 3 steps
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">
              <Zap className="h-3 w-3" />
              How It Works
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Three steps. Zero busywork.
            </h2>
            <p className="mt-3 text-base text-fg-muted">
              The platform does the routine 80%. Your mentors handle the high-leverage 20%.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.step} className="relative overflow-hidden py-6">
                  <div
                    aria-hidden
                    className="absolute -top-8 -right-4 text-8xl font-black text-brand/5 select-none"
                  >
                    {step.step}
                  </div>
                  <CardContent className="relative space-y-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
                      <Icon className="h-6 w-6 text-brand" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand uppercase tracking-wider">
                          Step {step.step}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold">{step.title}</h3>
                      <p className="text-sm text-fg-muted leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          4. B2B Feature Grid — 6 cards
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-surface/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mb-14">
            <Badge variant="outline" className="mb-4">
              <Building2 className="h-3 w-3" />
              For Teams
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Built for the way modern teams onboard.
            </h2>
            <p className="mt-3 text-base text-fg-muted">
              Everything a training manager, engineering lead, or L&amp;D head needs
              to run a serious program — without becoming one.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="py-6 transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
                      <Icon className="h-5 w-5 text-brand" />
                    </div>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm text-fg-muted leading-relaxed">
                      {f.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          5. Proof — metrics
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">
              <Target className="h-3 w-3" />
              Proof
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              The numbers don&apos;t lie.
            </h2>
            <p className="mt-3 text-base text-fg-muted">
              Measured across 1,200+ trainees on the TraineesAI platform in 2025–2026.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF_METRICS.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.label} className="py-6 text-center">
                  <CardContent className="space-y-2">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle mb-2">
                      <Icon className="h-5 w-5 text-brand" />
                    </div>
                    <div className="text-4xl sm:text-5xl font-black tracking-tight text-brand">
                      {m.value}
                    </div>
                    <div className="text-sm font-semibold text-fg">
                      {m.label}
                    </div>
                    <div className="text-xs text-fg-muted">{m.sub}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          6. Pricing — Team · Enterprise
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-surface/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">
              Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Pricing that scales with your hiring.
            </h2>
            <p className="mt-3 text-base text-fg-muted">
              Start with a 10-seat pilot. Upgrade when you hire the next cohort.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {PRICING.map((tier) => (
              <Card
                key={tier.name}
                className={`py-6 relative ${
                  tier.highlight
                    ? "border-brand shadow-lg shadow-primary/10 ring-1 ring-brand/20"
                    : ""
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-brand text-on-brand px-3 py-1">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="space-y-5">
                  <div>
                    <h3 className="text-2xl font-bold">{tier.name}</h3>
                    <p className="text-sm text-fg-muted mt-1">{tier.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black tracking-tight">{tier.price}</span>
                    <span className="text-sm text-fg-muted">{tier.unit}</span>
                  </div>
                  <ul className="space-y-2.5">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                        <span className="text-fg/90">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href={tier.href}>
                      {tier.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-fg-muted">
            All plans include verified certificates, AI tutor access, and the full marketplace catalogue.
            Annual billing saves 20%.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          7. FAQ — 4 B2B objections
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Common questions, honest answers.
            </h2>
            <p className="mt-3 text-base text-fg-muted">
              Don&apos;t see your question?{" "}
              <Link href="/signup/b2b" className="text-brand hover:underline">
                Talk to sales →
              </Link>
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-fg-muted leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          8. Final CTA
         ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-brand-subtle blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-24 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-lg mb-6">
            <Briefcase className="h-7 w-7" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Stop training. Start shipping.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed">
            Book a 30-minute demo, or start a 10-seat pilot today. Either way,
            your senior engineers get their hours back by next Monday.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/signup/b2b">
                <CalendarClock className="h-4 w-4" />
                Book a Demo
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="/signup/b2b">
                <Users className="h-4 w-4" />
                Start 10-Seat Pilot
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              SOC 2 Type II-ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-brand" />
              SSO + SCIM on Enterprise
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-brand" />
              Private-cloud deployment available
            </span>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          7b. Support / Contact — B2B buyers need a direct line
         ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-bg-subtle/30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
          <Badge variant="outline" className="mb-4 border-brand/30 text-brand">Talk to us</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            Have questions before you commit?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-fg-muted">
            We respond within 24 hours. No sales pressure — just honest answers about whether TraineesAI fits your team.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/signup/b2b">
                <Briefcase className="h-4 w-4 mr-2" />
                Create Your Org
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <a href="mailto:sales@traineesai.com?subject=B2B%20Inquiry">
                <MessageSquare className="h-4 w-4 mr-2" />
                Email Sales
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <Link href="/support">
                <HelpCircle className="h-4 w-4 mr-2" />
                Help Center
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          Footer
         ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fg-muted">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-brand text-on-brand">
              <Sparkles className="h-3 w-3" />
            </span>
            <span>© {new Date().getFullYear()} TraineesAI · AI-driven training for engineering teams</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/courses" className="hover:text-fg transition-colors">
              Browse Courses
            </Link>
            <Link href="/for-business" className="hover:text-fg transition-colors">
              For Business
            </Link>
            <Link href="/login" className="hover:text-fg transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
