"use client";

/**
 * TeachingFeedbackCard — the unified "tests teach, not just grade" card
 * shown after every test (practice / daily / weekly).
 *
 * Renders:
 *   1. What a strong answer looked like (modelAnswer)
 *   2. What you could have added (missedPoints[])
 *   3. Per-question explanations (questionExplanations[]) — collapsible.
 *      Each entry shows the question, the student's answer, the RIGHT
 *      answer, why it's correct, and a specific encouragement.
 *   4. Next time (nextTime)
 *
 * Used by:
 *   - DailyTestPanel
 *   - StudentDashboard practice panel
 *   - StudentDashboard WeeklyTestPanel
 *
 * If `feedback` is null (e.g. older tests taken before this feature
 * shipped), the card renders nothing.
 *
 * Language: All text from the AI is rendered as-is (the AI matches the
 * student's language). UI labels ("Question", "Your answer", "Right
 * answer", "Why", "Encouragement", "Next time") stay in English for
 * consistency — they're short and the student needs to recognize them.
 */

import { useState } from "react";
import { BookOpen, Lightbulb, ArrowRight, ChevronDown, ChevronRight, CheckCircle2, HelpCircle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuestionExplanation {
  questionIndex: number;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  encouragement: string;
}

export interface TeachingFeedback {
  modelAnswer: string;
  missedPoints: string[];
  nextTime: string;
  /** Per-question breakdown — empty for practice (single-topic
   *  conversation), populated for daily + weekly tests. */
  questionExplanations?: QuestionExplanation[];
}

export function TeachingFeedbackCard({ feedback }: { feedback: TeachingFeedback | null }) {
  if (!feedback) return null;

  const hasQuestions = (feedback.questionExplanations ?? []).length > 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      {/* Section 1: Overall model answer */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">What a strong answer looked like</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{feedback.modelAnswer}</p>

      {/* Section 2: Missed points */}
      {feedback.missedPoints.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-semibold text-foreground">What you could have added</p>
          </div>
          <ul className="space-y-1.5">
            {feedback.missedPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Section 3: Per-question explanations (collapsible) */}
      {hasQuestions && (
        <PerQuestionExplanations explanations={feedback.questionExplanations!} />
      )}

      {/* Section 4: Next-time tip */}
      <div className="rounded-md bg-background/70 border border-border p-2 mt-1">
        <p className="text-xs text-foreground">
          <span className="font-semibold">Next time: </span>
          {feedback.nextTime}
        </p>
      </div>
    </div>
  );
}

/** Collapsible list of per-question explanations. First question is
 *  expanded by default; the rest are collapsed to keep the card scannable
 *  for tests with many questions (e.g. weekly test has 10-15). */
function PerQuestionExplanations({ explanations }: { explanations: QuestionExplanation[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [allExpanded, setAllExpanded] = useState(false);

  const toggle = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set([0]));
      setAllExpanded(false);
    } else {
      setExpanded(new Set(explanations.map((_, i) => i)));
      setAllExpanded(true);
    }
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">
            Right answer for each question
          </p>
          <span className="text-[10px] text-muted-foreground">({explanations.length})</span>
        </div>
        <button
          onClick={toggleAll}
          className="text-[10px] text-primary hover:underline"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="space-y-2">
        {explanations.map((q, i) => {
          const isOpen = expanded.has(i);
          return (
            <div key={i} className="rounded-md border border-border bg-background/60 overflow-hidden">
              {/* Header — click to expand/collapse */}
              <button
                onClick={() => toggle(i)}
                className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-muted/40 transition-colors"
              >
                {isOpen
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-primary mb-0.5">Q{q.questionIndex + 1}</p>
                  <p className="text-xs text-foreground line-clamp-2">{q.question}</p>
                </div>
              </button>

              {/* Body — only when expanded */}
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
                  {/* Student's answer */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Your answer</p>
                    <p className="text-xs text-muted-foreground italic">&ldquo;{q.studentAnswer}&rdquo;</p>
                  </div>

                  {/* Right answer */}
                  <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Right answer</p>
                    </div>
                    <p className="text-xs text-foreground">{q.correctAnswer}</p>
                  </div>

                  {/* Why — explanation */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Why</p>
                    <p className="text-xs text-foreground leading-relaxed">{q.explanation}</p>
                  </div>

                  {/* Encouragement */}
                  <div className="flex items-start gap-1.5 pt-1">
                    <Heart className="h-3 w-3 text-pink-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground italic">{q.encouragement}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
