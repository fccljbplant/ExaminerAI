"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Flag, FlagOff, Loader2, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/modules/ui/bottom-sheet";

/* ---------------- payload types (mirror /api/v2/exams/[id]/*) ---------- */

interface ExamQuestion {
  question: string;
  format: string;
  conceptId?: string;
  isSpacedRepetition?: boolean;
}

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

interface ExamSessionView {
  slug: string;
  kind: "daily" | "weekly";
  courseId: string;
  courseName: string | null;
  status: string;
  questionIndex: number;
  total: number;
  score: number | null;
  questions: ExamQuestion[];
  answers: ExamAnswerRecord[];
  xpAwarded: number;
  startedAt: string;
  completedAt: string | null;
}

/**
 * modules/learner-portal — L9 Exam runner (REDESIGN-P3 §L9, W5)
 *
 * One question per screen. Autosave (debounced PATCH, idempotent per
 * index), Flag persisted with the answer, offline retry queue, exit
 * sheet ("progress saved — resume anytime"), and true resume: the
 * server restores the exact question index + drafts on reload.
 * The BottomNav hides while the runner is active (data-exam body flag).
 */

const AUTOSAVE_MS = 1200;
const OFFLINE_KEY = "tx-exam-pending";

interface ExamRunnerProps {
  examId: string; // slug: daily-<courseId>-<date> | weekly-<courseId>-<week>
}

export function ExamRunner({ examId }: ExamRunnerProps) {
  const router = useRouter();
  const [view, setView] = useState<ExamSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drafts keyed by question index; flagged rides along with the answer.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [index, setIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [offline, setOffline] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef(false);

  // ── Boot: start is idempotent and returns the resume state ──────────
  useEffect(() => {
    let cancelled = false;
    api
      .post<{ ok: boolean; data: ExamSessionView }>(`/api/v2/exams/${examId}/start`, {})
      .then((res) => {
        if (cancelled) return;
        const v = res.data;
        setView(v);
        const drafts: Record<number, string> = {};
        const flags: Record<number, boolean> = {};
        for (const a of v.answers) {
          drafts[a.index] = a.answer;
          flags[a.index] = a.flagged;
        }
        setDrafts(drafts);
        setFlagged(flags);
        setIndex(Math.min(v.questionIndex, Math.max(0, v.total - 1)));
        hydratedRef.current = true;
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not start the exam.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  // ── Offline retry queue ───────────────────────────────────────────────
  const queueSave = useCallback(
    (idx: number, answer: string, flag: boolean) => {
      const pending = JSON.parse(sessionStorage.getItem(OFFLINE_KEY) ?? "[]") as unknown[];
      pending.push({ idx, answer, flag });
      sessionStorage.setItem(OFFLINE_KEY, JSON.stringify(pending));
    },
    [],
  );

  /** PATCH one answer (autosave / offline flush / explicit save). */
  const saveAnswer = useCallback(
    async (idx: number, answer: string, flag: boolean) => {
      if (!view) return;
      if (!navigator.onLine) {
        queueSave(idx, answer, flag);
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saving");
      try {
        await api.patch<{ ok: boolean; data: { saved: boolean; index: number; questionIndex: number } }>(
          `/api/v2/exams/${examId}/answer`,
          { index: idx, answer, flagged: flag },
        );
        setSaveStatus("saved");
        setDirty(false);
      } catch {
        setSaveStatus("error");
      }
    },
    [examId, view, queueSave],
  );

  const flushPending = useCallback(() => {
    const raw = sessionStorage.getItem(OFFLINE_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as { idx: number; answer: string; flag: boolean }[];
    sessionStorage.removeItem(OFFLINE_KEY);
    for (const p of pending) {
      void saveAnswer(p.idx, p.answer, p.flag);
    }
  }, [saveAnswer]);

  // ── Offline detection ─────────────────────────────────────────────────
  useEffect(() => {
    const on = () => {
      setOffline(false);
      flushPending();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [flushPending]);

  // ── Hide the BottomNav while the runner is active (P3 L9) ────────────
  useEffect(() => {
    document.body.dataset.exam = "on";
    return () => {
      delete document.body.dataset.exam;
    };
  }, []);

  // ── Debounced autosave on draft edits ────────────────────────────────
  useEffect(() => {
    if (!view || !dirty) return;
    const t = setTimeout(() => {
      void saveAnswer(index, drafts[index] ?? "", flagged[index] ?? false);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [drafts, index, dirty, view, saveAnswer, flagged]);

  function updateDraft(value: string) {
    setDrafts((d) => ({ ...d, [index]: value }));
    setDirty(true);
    setSaveStatus("saving");
  }

  function toggleFlag() {
    const next = !(flagged[index] ?? false);
    setFlagged((f) => ({ ...f, [index]: next }));
    setDirty(true);
  }

  function goNext() {
    if (!view) return;
    if (dirty) void saveAnswer(index, drafts[index] ?? "", flagged[index] ?? false);
    setIndex((i) => Math.min(i + 1, view.total - 1));
  }

  function goPrev() {
    if (!view) return;
    if (dirty) void saveAnswer(index, drafts[index] ?? "", flagged[index] ?? false);
    setIndex((i) => Math.max(0, i - 1));
  }

  async function finish() {
    if (!view) return;
    setCompleting(true);
    try {
      if (dirty) await saveAnswer(index, drafts[index] ?? "", flagged[index] ?? false);
      await api.post<{ ok: boolean; data: ExamSessionView }>(`/api/v2/exams/${examId}/complete`, {});
      router.replace(`/learner/exams/${examId}/results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish the exam.");
      setCompleting(false);
    }
  }

  // ── States ───────────────────────────────────────────────────────────
  if (loading) return <RunnerSkeleton />;
  if (error || !view) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-10 text-center">
        <p className="text-sm text-fg-secondary">{error ?? "Exam unavailable."}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-subtle px-4 text-sm font-medium text-fg hover:border-line-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  const question: ExamQuestion | undefined = view.questions[index];
  const answered = view.answers.length;
  const isLast = index === view.total - 1;
  const progressPct = Math.round(((index + 1) / view.total) * 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-28 md:pb-8">
      {/* header: exit + title + progress */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExitOpen(true)}
            aria-label="Exit exam"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-fg">
              {view.kind === "daily" ? "Daily check-in" : "Weekly test"}
            </p>
            <p className="truncate text-xs text-fg-muted">{view.courseName}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-xs font-medium tabular-nums",
              view.kind === "daily" ? "bg-info-subtle text-info-on" : "bg-brand-subtle text-fg"
            )}
          >
            {answered}/{view.total} done
          </span>
        </div>

        {/* progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        {/* status row */}
        <div className="flex items-center justify-between text-xs text-fg-muted" aria-live="polite">
          <span>
            Question {index + 1} of {view.total}
          </span>
          <span>
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Offline — saved on this device"}
          </span>
        </div>
      </header>

      {offline && (
        <div role="status" className="rounded-xl border border-warning-subtle bg-warning-subtle px-4 py-3 text-sm text-warning-on">
          You&apos;re offline — answers are kept on this device and will sync when you reconnect.
        </div>
      )}

      {/* question card */}
      {question && (
        <section className="space-y-4 rounded-xl border border-line bg-surface p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium leading-relaxed text-fg md:text-lg">{question.question}</p>
            <button
              type="button"
              onClick={toggleFlag}
              aria-pressed={flagged[index] ?? false}
              aria-label={flagged[index] ? "Unflag this question" : "Flag this question"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                flagged[index]
                  ? "border-warning bg-warning-subtle text-warning-on"
                  : "border-line bg-bg-subtle text-fg-muted hover:border-line-strong hover:text-fg"
              )}
            >
              {flagged[index] ? <Flag className="h-4 w-4" aria-hidden /> : <FlagOff className="h-4 w-4" aria-hidden />}
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">Your answer</span>
            <textarea
              value={drafts[index] ?? ""}
              onChange={(e) => updateDraft(e.target.value)}
              rows={5}
              placeholder={
                question.format === "short"
                  ? "A few words are enough…"
                  : question.format === "probe"
                    ? "Think it through — one or two sentences…"
                    : "Write your answer…"
              }
              className="mt-2 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </label>
        </section>
      )}

      {/* navigation */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-raised)] border-t border-line bg-surface p-3 md:static md:bottom-auto md:z-auto md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              disabled={completing}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {completing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Grading…
                </>
              ) : (
                <>
                  Finish exam
                  <Check className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover"
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* exit sheet — progress is saved, resume anytime */}
      <BottomSheet
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Leave the exam?"
        description="Your progress is saved automatically — you can resume anytime."
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExitOpen(false)}
            className="flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover"
          >
            Keep going
          </button>
          <Link
            href="/learner/exams"
            onClick={() => setExitOpen(false)}
            className="flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
          >
            Save &amp; exit
          </Link>
        </div>
      </BottomSheet>
    </div>
  );
}

function RunnerSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4 pb-28">
      <div className="h-11 rounded-lg bg-bg-subtle" />
      <div className="h-1.5 rounded-full bg-bg-subtle" />
      <div className="h-56 rounded-xl bg-bg-subtle" />
    </div>
  );
}
