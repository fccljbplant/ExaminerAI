"use client";

// src/modules/learn/components/classroom/LessonStage.tsx — Slide stage (presentational).
// Renders the topic banner, filmstrip dots, and the current slide's content.
// All flow control (generate/complete/jump) is handled by the parent shell —
// this component only displays state and forwards user events.

import { CheckCircle2, ListChecks, Shapes, Sparkles } from "lucide-react";
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
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  // ── Course complete ─────────────────────────────────────────────
  if (courseCompleted) {
    return (
      <div className="py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-growth-sage" />
        <h1 className="mt-4 text-2xl font-bold">Course complete</h1>
        <p className="mt-2 text-muted-foreground">
          You&apos;ve finished every topic. Browse the Library for resources or start a new course.
        </p>
      </div>
    );
  }

  const currentSlide = slides[slideIdx];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Topic banner */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Week {topic.week} Day {topic.day} · {topic.phase}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{topic.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{topic.objective}</p>
      </div>

      {/* Filmstrip dots */}
      <div className="mb-5 flex items-center gap-1.5">
        {Array.from({ length: totalSlides }).map((_, i) => {
          const generated = i < slides.length;
          const isCurrent = i === slideIdx && generated;
          return (
            <button
              key={i}
              type="button"
              onClick={() => generated && onJumpToSlide(i)}
              disabled={!generated}
              aria-label={`Slide ${i + 1}${generated ? "" : " (not generated yet)"}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                isCurrent
                  ? "w-8 bg-primary"
                  : generated
                    ? "w-6 bg-primary/60 hover:bg-primary/80"
                    : "w-6 bg-muted cursor-not-allowed"
              )}
            />
          );
        })}
        <span className="ml-2 text-[10px] text-muted-foreground">
          {slides.length} / {totalSlides} prepared
        </span>
      </div>

      {/* Slide content */}
      {currentSlide ? (
        <article className="space-y-4">
          <div className="text-[11px] font-medium text-muted-foreground">Slide {slideIdx + 1}</div>
          <h2 className="text-xl font-semibold leading-tight">{currentSlide.title}</h2>

          {currentSlide.bullets.length > 0 && (
            <ul className="space-y-2">
              {currentSlide.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {currentSlide.keyTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentSlide.keyTerms.map((t, i) => (
                <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t}</span>
              ))}
            </div>
          )}

          {/* Visual board — renders the AI's visualSpec as a styled figure
              so slides feel visual, not text-only */}
          {currentSlide.visualSpec && (
            <figure className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <figcaption className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Shapes className="h-3.5 w-3.5" aria-hidden />
                Visual board
              </figcaption>
              {/* Abstract diagram bars — decorative, token-colored */}
              <div className="mb-3 flex items-end gap-2" aria-hidden>
                <div className="h-10 w-1/4 rounded-sm bg-primary/20" />
                <div className="h-16 w-1/4 rounded-sm bg-primary/35" />
                <div className="h-7 w-1/4 rounded-sm bg-primary/15" />
                <div className="h-12 w-1/4 rounded-sm bg-primary/25" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{currentSlide.visualSpec}</p>
            </figure>
          )}

          {currentSlide.analogy && (
            <div className="rounded-md border-l-4 border-growth-amber bg-growth-amber-soft p-3 text-sm">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-growth-amber-foreground">
                Analogy
              </div>
              <p className="leading-relaxed">{currentSlide.analogy}</p>
            </div>
          )}

          {currentSlide.realWorldExample && (
            <div className="rounded-md border-l-4 border-growth-sage bg-growth-sage-soft p-3 text-sm">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-growth-sage-foreground">
                Real-world example
              </div>
              <p className="leading-relaxed">{currentSlide.realWorldExample}</p>
            </div>
          )}

          {currentSlide.checkQuestion && (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Check your understanding
              </div>
              <p className="font-medium">{currentSlide.checkQuestion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: ask the tutor (right pane) to evaluate your answer.
              </p>
            </div>
          )}
        </article>
      ) : (
        <div className="rounded-lg border-2 border-dashed py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium">Ready to start learning</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &quot;Start learning&quot; below and I&apos;ll teach this topic to you, one slide at a time.
          </p>
        </div>
      )}

      {/* Topic-complete resources panel */}
      {topicComplete && (
        <div className="mt-6 rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Topic resources</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
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
