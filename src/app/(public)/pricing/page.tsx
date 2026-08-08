import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, GraduationCap, Building2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — TraineesAI",
  description: "Transparent pricing for teams and learners. B2B seats start at $29/seat/month. B2C learners start free.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            TraineesAI
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/for-business" className="text-muted-foreground hover:text-foreground">For Teams</Link>
            <Link href="/for-learners" className="text-muted-foreground hover:text-foreground">For Learners</Link>
            <Link href="/courses" className="text-muted-foreground hover:text-foreground">Courses</Link>
            <Link href="/support" className="text-muted-foreground hover:text-foreground">Support</Link>
          </div>
          <Button asChild size="sm"><Link href="/app">Sign In</Link></Button>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground">For teams and individuals. No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
          {/* B2B — Teams */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <Badge variant="outline" className="border-primary/30 text-primary">For Teams</Badge>
            </div>
            <h2 className="text-2xl font-bold">Teams &amp; Enterprises</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">$29</span>
              <span className="text-muted-foreground">/seat/month</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Billed monthly. Volume discounts above 50 seats.</p>

            <ul className="mt-6 space-y-3 text-sm flex-1">
              {[
                "Unlimited courses + AI tutor",
                "Seat management & cohort analytics",
                "Verified certificates for every trainee",
                "Mentor triage dashboard",
                "Priority support",
                "30-day risk-free pilot",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="mt-8 w-full" size="lg">
              <Link href="/for-business">Book a Demo <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">No credit card for pilot</p>
          </div>

          {/* B2C — Learners */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <Badge variant="outline">For Learners</Badge>
            </div>
            <h2 className="text-2xl font-bold">Individual Learner</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">$0</span>
              <span className="text-muted-foreground">/month to start</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Free tier. Upgrade for unlimited tests + mentor access.</p>

            <ul className="mt-6 space-y-3 text-sm flex-1">
              {[
                "Free daily test quota (3/day)",
                "AI tutor — daily teaching",
                "Capstone project builder",
                "Spaced-repetition drills",
                "Verified certificate on completion",
                "Community access",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild variant="outline" className="mt-8 w-full" size="lg">
              <Link href="/for-learners">Start Free <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">No credit card required</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I try before committing?", a: "Yes. Learners start free with a daily test quota. Teams get a 30-day risk-free pilot — no credit card, cancel anytime." },
              { q: "What's a 'seat'?", a: "A seat is one trainee enrollment. You can reassign seats when an intern leaves — no procurement loop." },
              { q: "Do certificates expire?", a: "No. Once earned, a certificate is permanently verifiable at its /verify/ URL." },
              { q: "Can I bring my own curriculum?", a: "Yes. Org admins can create custom courses via the Course Planner, or use courses from the marketplace." },
              { q: "What if the AI is wrong?", a: "Mentors can always override AI grades. The platform surfaces AI confidence levels so mentors know when to step in." },
            ].map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold text-foreground">{faq.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
