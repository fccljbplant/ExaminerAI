"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, MessageCircleQuestion, Search } from "lucide-react";

/**
 * modules/learner-portal — L14 Help (REDESIGN-P3 §L14)
 *
 * Searchable FAQ (domain-neutral), AI-tutor pointer and a bridge to
 * the mentor inbox. No dead controls — every card navigates.
 */

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I continue where I left off?",
    a: "The Home tab always shows your most recent course with a Resume button. It jumps straight into your next lesson.",
  },
  {
    q: "What are the session time chips (15m / 30m / 1h)?",
    a: "They start a focused study session with a time budget. The session wraps up gracefully when your budget runs out.",
  },
  {
    q: "How does my streak work?",
    a: "Complete any lesson or daily check-in to keep your streak alive for the day. Missing a day resets it — your longest streak is kept on your Progress page.",
  },
  {
    q: "When do I get the weekly test?",
    a: "A weekly test unlocks for each course as you work through the week's lessons. Find it on the Exams tab.",
  },
  {
    q: "How do I earn a certificate?",
    a: "Finish every week of a course and pass the final assessment with 75% or higher. Distinction is awarded at 85%+.",
  },
  {
    q: "What is Bed Mode?",
    a: "An extra-dark, low-glare theme for studying at night. Switch to it from Profile → Appearance — no reload needed.",
  },
  {
    q: "Can I learn more than one course at once?",
    a: "Yes. Enroll in as many courses as you like; your Home tab tracks the most recently active one, and Progress shows rings for all of them.",
  },
];

export function LearnerHelp() {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-fg md:text-xl">Help</h1>
        <label className="relative mt-3 block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles"
            aria-label="Search help articles"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
        </label>
      </header>

      {/* FAQ */}
      <section aria-label="Frequently asked questions">
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No matches — try different keywords, or ask the AI tutor during your next lesson.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {matches.map((f) => (
              <details key={f.q} className="group px-4 py-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-fg [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <p className="pb-1 pt-2 text-sm leading-relaxed text-fg-secondary">{f.a}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* contact paths */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/learner"
          className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
            <Bot className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-fg">Ask the AI tutor</span>
            <span className="mt-0.5 block text-xs text-fg-muted">
              The tutor is available inside any lesson — open a course and ask away.
            </span>
          </span>
        </Link>
        <Link
          href="/learner/messages"
          className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
            <MessageCircleQuestion className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-fg">Message your mentor</span>
            <span className="mt-0.5 block text-xs text-fg-muted">
              Message your instructor directly — replies land in your inbox.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
