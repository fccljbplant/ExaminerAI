"use client";

// src/modules/learn/components/classroom/QuickBar.tsx — the classroom's
// bottom control bar. One control per job (classroom audit A3/A4):
// prev-slide · prev-topic (contextual) · ONE contextual CTA · next-slide.
// The mobile-only "Ask AI" opens the chat sheet because on md+ the chat
// rail is permanently visible beside the stage.

import { ArrowLeft, ArrowRight, Brain, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageSquare, Presentation } from "lucide-react";
import type { SlideData } from "@/modules/learn/types";
import type { PostStage } from "./PostFlow";

interface QuickBarProps {
  postStage: PostStage;
  slides: SlideData[];
  slideIdx: number;
  totalSlides: number;
  loadingSlide: boolean;
  topicComplete: boolean;
  completing: boolean;
  isLastTopicInCourse: boolean;
  hasPrevTopic: boolean;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onPrevTopic: () => void;
  onJumpSlide: (idx: number) => void;
  onPostStage: (s: PostStage) => void;
  onCompleteTopic: () => void;
  onAskAboutSlide: () => void;
}

export function QuickBar({
  postStage,
  slides,
  slideIdx,
  loadingSlide,
  topicComplete,
  completing,
  isLastTopicInCourse,
  hasPrevTopic,
  onPrevSlide,
  onNextSlide,
  onPrevTopic,
  onJumpSlide,
  onPostStage,
  onCompleteTopic,
  onAskAboutSlide,
}: QuickBarProps) {
  const inSlides = postStage === "slides";
  const isFirstSlide = slideIdx === 0 && slides.length > 0;
  const isLastSlide = slideIdx >= slides.length - 1 && slides.length > 0;

  return (
    <div className="flex h-14 flex-shrink-0 items-center gap-1.5 border-t bg-surface px-2.5 md:h-16 md:gap-2 md:px-4">
      {inSlides && (
        <button
          type="button"
          onClick={onPrevSlide}
          disabled={isFirstSlide || slides.length === 0}
          aria-label="Previous slide"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      )}

      {/* Re-learn the previous topic in the course sequence */}
      {inSlides && hasPrevTopic && (
        <button
          type="button"
          onClick={onPrevTopic}
          aria-label="Previous topic"
          title="Go back to the previous topic"
          className="inline-flex min-h-11 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:px-3"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden md:inline">Prev topic</span>
        </button>
      )}

      {/* ONE contextual CTA. After the slides, the daily Socratic test
          takes the stage — then the topic can be finished, which advances
          to the next topic (fresh slides next day). */}
      {topicComplete && inSlides ? (
        <button
          type="button"
          onClick={() => onPostStage("test")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:gap-2 md:px-4 md:text-sm"
        >
          <Brain className="h-4 w-4" aria-hidden />
          Daily test
        </button>
      ) : topicComplete && inSlides ? null : !inSlides ? (
        <button
          type="button"
          onClick={() => onPostStage("slides")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:gap-2 md:px-4 md:text-sm"
        >
          <Presentation className="h-4 w-4" aria-hidden />
          Slides
        </button>
      ) : (
        <button
          type="button"
          onClick={onNextSlide}
          disabled={loadingSlide}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50 md:gap-2 md:px-4 md:text-sm"
        >
          {loadingSlide ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden />
          )}
          {loadingSlide ? "Generating…" : slides.length === 0 ? "Start learning" : "Next slide"}
        </button>
      )}

      {inSlides && (
        <button
          type="button"
          onClick={() => onJumpSlide(Math.min(slides.length - 1, slideIdx + 1))}
          disabled={isLastSlide || slides.length === 0}
          aria-label="Next slide"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}

      {/* Ask AI — mobile only: on md+ the chat rail is always visible
          next to the stage, so a second entry point would be a
          duplicate control (audit A4). */}
      {inSlides && (
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onAskAboutSlide}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            title="Ask the AI tutor about this slide"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Ask AI
          </button>
        </div>
      )}
    </div>
  );
}

/** Icon parity for the finish-topic CTA (used by the shell's test stage). */
export const QuickBarIcons = { CheckCircle2, Loader2 };
