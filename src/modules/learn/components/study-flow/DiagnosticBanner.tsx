"use client";

// modules/learn/components/study-flow/DiagnosticBanner.tsx — L12 diagnostic quiz (S6).

import { useState } from "react";
import { ClipboardList, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/dialog";

/**
 * Diagnostic banner + 10-question quiz runner (REDESIGN-P3 §L12, scenario
 * S6). Learners returning from a >1 week absence get a friendly check —
 * NOT a test — that routes them to the right restart point. Free-text
 * answers (or skips) are recorded per question; the final screen shows
 * the routing recommendation from the server.
 */

interface DiagnosticQuestion {
  index: number;
  topic: string;
  question: string;
}

interface StartResponse {
  sessionId: string;
  questions: DiagnosticQuestion[];
  totalQuestions: number;
}

interface AnswerResponse {
  complete: boolean;
  recommendation?: string;
  copy?: string;
}

type Phase = "idle" | "loading" | "quiz" | "done" | "error";

interface DiagnosticBannerProps {
  daysSince: number;
  courseId: string;
}

export function DiagnosticBanner({ daysSince, courseId }: DiagnosticBannerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<StartResponse | null>(null);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResponse | null>(null);

  async function startQuiz() {
    setPhase("loading");
    setResult(null);
    setCurrent(0);
    setAnswer("");
    try {
      const res = await api.post<{ ok: boolean; data: StartResponse }>(
        "/api/v2/diagnostic/start",
        { courseId },
      );
      setSession(res.data);
      setPhase(res.data.questions.length > 0 ? "quiz" : "done");
    } catch {
      setPhase("error");
    }
  }

  async function submitAnswer(skipped = false) {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ ok: boolean; data: AnswerResponse }>(
        "/api/v2/diagnostic/answer",
        {
          sessionId: session.sessionId,
          questionIndex: current,
          answer: skipped ? "(skipped)" : answer,
        },
      );
      setAnswer("");

      if (res.data.complete) {
        setResult(res.data);
        setPhase("done");
      } else {
        setCurrent((c) => Math.min(c + 1, session.questions.length - 1));
      }
    } catch {
      // A failed submit keeps the learner on the same question — they can
      // retry or skip; losing an answer silently would corrupt the routing.
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset so a re-open starts fresh (server sessions are append-only).
      setPhase("idle");
      setSession(null);
      setResult(null);
    }
  }

  const question = session?.questions[current];

  return (
    <>
      <section
        aria-label="Quick check-in"
        className="rounded-xl border border-line bg-info-subtle p-4 md:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-info">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">
                Been a while — welcome back!
              </p>
              <p className="mt-0.5 text-xs text-fg-secondary">
                A quick 10-question check helps us find the right spot to
                restart. No grades, no pressure.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              void startQuiz();
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Take the check
          </button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {phase === "done"
                ? "All done — nice work!"
                : `Quick check ${current + 1} of ${session?.totalQuestions ?? 10}`}
            </DialogTitle>
          </DialogHeader>

          {phase === "loading" || phase === "idle" ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-subtle" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-bg-subtle" />
            </div>
          ) : phase === "error" ? (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-fg">
                Something went wrong loading the check.
              </p>
              <button
                type="button"
                onClick={() => void startQuiz()}
                className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
              >
                Try again
              </button>
            </div>
          ) : phase === "quiz" && question ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {question.topic}
              </p>
              <p className="text-sm text-fg">{question.question}</p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Answer in your own words (or skip — that's fine too)"
                aria-label="Your answer"
                className="w-full rounded-lg border border-line bg-bg p-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void submitAnswer(true)}
                  disabled={submitting}
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => void submitAnswer()}
                  disabled={submitting || answer.trim().length === 0}
                  className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Next"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-fg-secondary">
                {result?.copy ??
                  "Great effort! Based on your answers, we recommend reviewing the fundamentals before moving ahead."}
              </p>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:w-auto"
              >
                Back to my study plan
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
