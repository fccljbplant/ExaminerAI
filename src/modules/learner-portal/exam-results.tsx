"use client";

import Link from "next/link";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  Flag,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";
import { RadialProgress } from "@/modules/ui/radial-progress";
import { PostTestReflection } from "@/modules/assessment";

/**
 * modules/learner-portal — L10 Exam results (REDESIGN-P3 §L10, W5)
 *
 * Score ring + pass badge, then a per-question accordion review: your
 * answer / correct answer / explanation / score chip (and flag chip for
 * questions the learner marked). XP + notification line. Retake is not
 * offered (daily resets tomorrow; weekly retakes are a later workstream).
 */

/* ---------------- payload types (mirror GET /api/v2/exams/[id]/results) -- */

interface ExamAnswerRecord {
  index: number;
  question: string;
  format: string;
  answer: string;
  score: number;
  explanation: string;
  correctAnswer: string;
  flagged: boolean;
}

interface ExamResultsData {
  slug: string;
  kind: "daily" | "weekly";
  courseId: string;
  courseName: string | null;
  status: string;
  questionIndex: number;
  total: number;
  score: number | null;
  questions: { question: string; format: string }[];
  answers: ExamAnswerRecord[];
  xpAwarded: number;
  startedAt: string;
  completedAt: string | null;
}

const PASS = 60;

function scoreTone(score: number): "sage" | "warning" | "coral" {
  if (score >= PASS) return "sage";
  if (score >= 40) return "warning";
  return "coral";
}

export function ExamResults({ examId }: { examId: string }) {
  const { data, error, isLoading, retry } = useApi<ExamResultsData>(
    `/api/v2/exams/${examId}/results`,
  );

  if (isLoading) return <ResultsSkeleton />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-10 text-center">
        <p className="text-sm text-fg-secondary">{error ?? "Results unavailable."}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-subtle px-4 text-sm font-medium text-fg hover:border-line-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  const score = data.score ?? 0;
  const passed = score >= PASS;
  const byIndex = new Map(data.answers.map((a) => [a.index, a]));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs text-fg-muted">
          <Link href="/learner/exams" className="hover:text-fg">
            Exams
          </Link>{" "}
          · {data.courseName ?? "Course"}
        </p>
        <h1 className="text-lg font-semibold text-fg md:text-xl">
          {data.kind === "daily" ? "Daily check-in" : "Weekly test"} results
        </h1>
      </header>

      {/* score summary */}
      <section className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
        <RadialProgress
          value={score}
          size="lg"
          tone={scoreTone(score)}
          label={`${Math.round(score)}%`}
          sublabel={`${data.answers.length}/${data.total} questions graded`}
        />
        <div>
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
              passed ? "bg-success-subtle text-success-on" : "bg-warning-subtle text-warning-on"
            )}
          >
            {passed ? <Trophy className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {passed ? "Passed" : "Keep practicing"}
          </p>
          {data.xpAwarded > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
              <Award className="h-4 w-4 text-fg-muted" aria-hidden />
              +{data.xpAwarded} XP earned
            </p>
          )}
          <p className="mt-2 max-w-md text-xs leading-relaxed text-fg-muted">
            {passed
              ? "Nice work. Review the explanations below to lock it in."
              : "Read each explanation below — they teach exactly what you missed."}
          </p>
        </div>
      </section>

      {/* coaching reflection (v1 PostTestReflection) */}
      <PostTestReflection
        score={Math.round(score)}
        testType={data.kind === "daily" ? "daily_test" : "weekly_test"}
      />

      {/* per-question review */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Question review
        </h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.questions.map((q, i) => {
            const a = byIndex.get(i);
            const answered = Boolean(a);
            return (
              <details key={i} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [-webkit-tap-highlight-color:transparent]">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      !answered
                        ? "bg-bg-subtle text-fg-muted"
                        : (a?.score ?? 0) >= 60
                          ? "bg-success-subtle text-success-on"
                          : "bg-warning-subtle text-warning-on"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{q.question}</span>
                  {a?.flagged && <Flag className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Flagged" />}
                  {answered && (
                    <span className="shrink-0 text-xs font-medium tabular-nums text-fg-secondary">
                      {Math.round(a?.score ?? 0)}%
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-3 border-t border-line px-4 py-3">
                  {!answered ? (
                    <p className="text-sm text-fg-muted">Not answered.</p>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Your answer</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                          {a?.answer || "(empty)"}
                        </p>
                      </div>
                      {a?.correctAnswer && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-success-on">Correct answer</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                            {a.correctAnswer}
                          </p>
                        </div>
                      )}
                      {a?.explanation && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Explanation</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
                            {a.explanation}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="pt-2">
        <Link
          href="/learner/exams"
          className="flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
        >
          Back to exams
        </Link>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4">
      <div className="h-6 w-1/3 rounded bg-bg-subtle" />
      <div className="flex flex-col items-center gap-3 rounded-xl bg-bg-subtle py-10" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
