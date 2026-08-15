"use client";

// src/modules/learn/components/classroom/LessonStage.tsx — Slide stage (presentational).
// Renders the topic banner, filmstrip dots, and the current slide as a
// proper presentation slide: gradient card, strong type hierarchy, and
// only meaningful content (bullets, key terms, analogy, example,
// check-question). The decorative 4-bar "visual board" was removed
// (W16 user request) — slides are text-first and readable.
// All flow control (generate/complete/jump) is handled by the parent
// shell — this component only displays state and forwards user events.

import { CheckCircle2, Lightbulb, ListChecks, Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlideData, TopicContext } from "@/modules/learn/types";

interface LessonStageProps {
  /** Topic metadata for the banner (null while loading). */
  topic: TopicContext | null;
  /** True on first load (skeleton shows). */
  loading: boolean;
  /** Course fully completed — renders the completion state. */
  courseCompleted: boolean;
  /** Slides generated so far. */
  slides: SlideData[];
  /** Index of the slide currently displayed. */
  slideIdx: number;
  /** Total slides planned for this topic. */
  totalSlides: number;
  /** All slides viewed — topic resources panel shows. */
  topicComplete: boolean;
  /** Jump to a generated slide (filmstrip dot click). */
  onJumpToSlide: (idx: number) => void;
}

export function LessonStage({
  topic,
  loading,
  courseCompleted,
  slides,
  slideIdx,
  totalSlides,
  topicComplete,
  onJumpToSlide,
}: LessonStageProps) {
  // ── Loading — skeleton shaped like a slide (no spinner reflow) ──
  if (loading || !topic) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4" aria-busy="true" aria-label="Loading lesson">
        <div className="h-3 w-40 animate-pulse rounded bg-bg-subtle" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-bg-subtle" />
        <div className="h-4 w-full animate-pulse rounded bg-bg-subtle" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-bg-subtle" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-bg-subtle" />
      </div>
    );
  }

  // ── Course complete ─────────────────────────────────────────────
  if (courseCompleted) {
    return (
      <div className="py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-growth-sage" />
        <h1 className="mt-4 text-2xl font-bold">Course complete</h1>
        <p className="mt-2 text-fg-muted">
          You&apos;ve finished every topic. Browse the Library for resources or start a new course.
        </p>
      </div>
    );
  }

  const currentSlide = slides[slideIdx];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Topic banner — compact on mobile */}
      <div className="mb-3 md:mb-5">
        <div className="text-[10px] uppercase tracking-wide text-fg-muted">
          Week {topic.week} Day {topic.day} · {topic.phase}
        </div>
        <h1 className="text-xl font-bold leading-tight md:text-2xl">{topic.title}</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted md:mt-1 md:text-sm">
          {topic.objective}
        </p>
      </div>

      {/* Slide navigation — numbered dots; slides generate on load and
          on Next, never via a visible "generate" control. */}
      <div className="mb-3 flex items-center gap-1.5 md:mb-5" role="tablist" aria-label="Slides">
        {Array.from({ length: totalSlides }).map((_, i) => {
          const generated = i < slides.length;
          const isCurrent = i === slideIdx && generated;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => generated && onJumpToSlide(i)}
              disabled={!generated}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors md:h-8 md:w-8",
                isCurrent
                  ? "bg-brand text-on-brand"
                  : generated
                    ? "bg-brand-subtle text-fg hover:bg-brand-subtle"
                    : "bg-bg-subtle text-fg-muted",
              )}
            >
              {i + 1}
            </button>
          );
        })}
        <span className="ml-1.5 text-[10px] tabular-nums text-fg-muted md:ml-2">
          Slide {slides.length > 0 ? slideIdx + 1 : "—"} of {totalSlides}
        </span>
      </div>

      {/* ── The slide — a proper presentation slide (W16 redesign) ── */}
      {currentSlide ? (
        <article
          className="relative overflow-hidden rounded-2xl border border-line p-4 shadow-elev-1 md:p-8"
          style={{
            background:
              "linear-gradient(165deg, var(--surface) 0%, color-mix(in oklab, var(--brand-subtle) 45%, var(--surface)) 55%, var(--surface) 100%)",
          }}
        >
          {/* brand accent bar */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />

          {/* slide header */}
          <header className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
              Slide {slideIdx + 1}
            </p>
            <p className="truncate text-[10px] font-medium text-fg-muted">
              {topic.phase}
            </p>
          </header>
          <h2 className="mt-2 text-lg font-bold leading-snug text-fg md:mt-3 md:text-2xl md:leading-tight">
            {currentSlide.title}
          </h2>

          {/* bullets — the meat of the slide */}
          {currentSlide.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 md:mt-5 md:space-y-2.5">
              {currentSlide.bullets.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fg md:text-base">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand md:mt-2" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* key terms — quiet chips row */}
          {currentSlide.keyTerms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4">
              {currentSlide.keyTerms.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11px] font-medium text-fg-secondary md:text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* analogy — one-line insight strip, not a box */}
          {currentSlide.analogy && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface/60 p-2.5 text-sm leading-relaxed text-fg md:mt-4 md:text-[15px]">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden />
              <span>
                <span className="font-semibold text-fg">Think of it like this: </span>
                {currentSlide.analogy}
              </span>
            </p>
          )}

          {/* real-world example — quiet inline strip */}
          {currentSlide.realWorldExample && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-surface/60 p-2.5 text-sm leading-relaxed text-fg md:mt-3 md:text-[15px]">
              <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden />
              <span>
                <span className="font-semibold text-fg">In the real world: </span>
                {currentSlide.realWorldExample}
              </span>
            </p>
          )}

          {/* check question — the slide's takeaway prompt */}
          {currentSlide.checkQuestion && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface/90 p-3 md:mt-5 md:p-4">
              <ListChecks className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Check your understanding
                </p>
                <p className="mt-1 text-sm font-medium text-fg md:text-[15px]">
                  {currentSlide.checkQuestion}
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  Tip: ask the tutor (right pane) to evaluate your answer.
                </p>
              </div>
            </div>
          )}

          {/* slide footer */}
          <footer className="mt-4 flex items-center justify-between border-t border-line/70 pt-2.5 text-[10px] tabular-nums text-fg-muted md:mt-6">
            <span className="truncate">{topic.title}</span>
            <span className="shrink-0">
              {slideIdx + 1} / {totalSlides}
            </span>
          </footer>
        </article>
      ) : (
        <div className="rounded-lg border-2 border-dashed py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium">Ready to start learning</p>
          <p className="mt-1 text-xs text-fg-muted">
            Click &quot;Start learning&quot; below and I&apos;ll teach this topic to you, one slide at a time.
          </p>
        </div>
      )}

      {/* Topic-complete resources panel */}
      {topicComplete && (
        <div className="mt-4 rounded-lg border-2 border-primary/40 bg-brand/5 p-4 md:mt-6">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Topic resources</h3>
          </div>
          <p className="mb-3 text-sm text-fg-muted">
            Review these before moving on. The next topic builds on what you learned here.
          </p>
          <ul className="space-y-1.5">
            {topic.resources.map((r, i) => (
              <li key={i}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  → {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
