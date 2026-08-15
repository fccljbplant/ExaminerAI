"use client";

import Link from "next/link";
import { Brain, CalendarCheck, ClipboardCheck, Play, Sparkles } from "lucide-react";

/**
 * modules/learner-portal — L8 Exams (W12: Socratic-only hub)
 *
 * The concept-based Socratic testing system is the whole exam surface:
 * practice, the daily test, and the weekly test. The v2 runner
 * (daily/weekly ExamSession) has been removed — the daily Socratic test
 * now launches automatically in the classroom right after a topic's
 * teaching slides.
 */

export function LearnerExams() {
  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Exams</h1>

      {/* The flow explainer — daily tests launch in the classroom. */}
      <div className="flex items-start gap-3 rounded-xl border border-line bg-brand-subtle p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-fg">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-fg-secondary">
          <span className="font-semibold text-fg">How testing works: </span>
          after you finish a topic&apos;s teaching slides, the{" "}
          <span className="font-semibold text-fg">daily Socratic test</span> opens right there in
          the classroom — you answer, the examiner probes, and your results unlock the next
          topic. Weekly tests gate each week; practice is always open.
        </p>
      </div>

      {/* Socratic mode — the concept-based testing experience. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/learner/practice"
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-fg">
            <Brain className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 text-sm font-medium text-fg">Socratic practice</span>
          <span className="text-xs text-fg-muted">
            Chat with the AI examiner on any topic — same format as the tests, just shorter.
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
            <Play className="h-3.5 w-3.5" aria-hidden />
            Start
          </span>
        </Link>

        <Link
          href="/learner/exams/daily"
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-subtle text-warning-on">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 text-sm font-medium text-fg">Socratic daily test</span>
          <span className="text-xs text-fg-muted">
            Three concept questions for today — also launches in the classroom after each
            topic&apos;s slides.
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
            <Play className="h-3.5 w-3.5" aria-hidden />
            Open
          </span>
        </Link>

        <Link
          href="/learner/exams/weekly"
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-subtle text-info-on">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 text-sm font-medium text-fg">Socratic weekly test</span>
          <span className="text-xs text-fg-muted">
            The classic 10-question conversation — graded on concept understanding and
            reasoning.
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
            <Play className="h-3.5 w-3.5" aria-hidden />
            Open
          </span>
        </Link>
      </div>
    </div>
  );
}
