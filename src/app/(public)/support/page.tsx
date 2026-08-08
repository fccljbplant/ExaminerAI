import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GraduationCap, Mail, MessageSquare, BookOpen, HelpCircle,
  Building2, ArrowRight, Search,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Support — TraineesAI Help Center",
  description: "Get help with TraineesAI. Browse docs, contact support, or book a call with our team.",
  alternates: { canonical: "/support" },
};

export const dynamic = "force-dynamic";

export default function SupportPage() {
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
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
          </div>
          <Button asChild size="sm"><Link href="/app">Sign In</Link></Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
          <Badge variant="outline" className="mb-4">Help Center</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold">How can we help?</h1>
          <p className="mt-3 text-muted-foreground">Search our docs, contact support, or book a call.</p>
          <div className="mt-6 relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search help articles..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Contact support */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Contact Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Stuck on something? Send us a message — we respond within 24 hours.
              </p>
              <a href="mailto:support@traineesai.com" className="text-sm text-primary hover:underline">
                support@traineesai.com →
              </a>
            </CardContent>
          </Card>

          {/* Book a call */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Book a Call</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Talk to our team about your training needs — for teams or individual learners.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/for-business">Book a Demo <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Docs */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Technical docs, API reference, and guides for developers and admins.
              </p>
              <div className="space-y-1 text-sm">
                <Link href="/docs/BLUEPRINT" className="block text-primary hover:underline">Product Blueprint →</Link>
                <Link href="/docs/ARCHITECTURE" className="block text-primary hover:underline">Architecture →</Link>
                <Link href="/docs/UI-STANDARDS" className="block text-primary hover:underline">UI Standards →</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
          <div className="flex items-center gap-2 mb-8">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Common questions</h2>
          </div>
          <div className="space-y-6">
            {[
              { q: "How do I create an account?", a: "Go to our sign-up page, enter your name, email, and a password. You'll start with a free learner account. Teams should contact us for a pilot." },
              { q: "How do I enroll in a course?", a: "Browse courses at /courses, click any course, then 'Enroll Free' or 'Proceed to Payment'. You'll be learning in under a minute." },
              { q: "How do certificates work?", a: "When you complete a course with a score of 75+, a certificate is auto-issued. It has a public /verify/ URL you can share on LinkedIn." },
              { q: "I'm an org admin — how do I add trainees?", a: "Go to your Org Dashboard, click 'Invite Member', enter their email. You can assign seats and roles from there." },
              { q: "The AI tutor isn't responding — what do I do?", a: "Check /support for status. If the AI is degraded, your messages are saved and you can retry. For persistent issues, email support@traineesai.com." },
              { q: "Can I get a refund?", a: "Yes — 30-day money-back guarantee for paid plans. Email support@traineesai.com with your account email." },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground text-sm">{faq.q}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* B2B/B2C split */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <Building2 className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold text-lg">For Teams</h3>
                <p className="mt-1 text-sm text-muted-foreground">Need to train 10+ engineers? Get a demo + pilot.</p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/for-business">Book a Demo <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-6">
                <GraduationCap className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold text-lg">For Learners</h3>
                <p className="mt-1 text-sm text-muted-foreground">Individual learner? Start free in under a minute.</p>
                <Button asChild variant="outline" className="mt-4" size="sm">
                  <Link href="/for-learners">Start Free <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
