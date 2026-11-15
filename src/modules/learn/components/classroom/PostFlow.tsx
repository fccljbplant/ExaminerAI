"use client";

// src/modules/learn/components/classroom/PostFlow.tsx — the post-lesson
// flow (W12/W13): after the slides, the daily Socratic test takes the
// stage, then results → (weekly test when due) → project → check-in →
// next topic. One file for the stepper and every stage body (classroom
// audit A5: extracted from the 1446-line shell).

import { useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowRight, Brain, CalendarCheck, CheckCircle2, ChevronLeft,
  ChevronRight, Loader2, Presentation, Target, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyTestPanel } from "@/modules/assessment/components/DailyTestPanel";
import { WeeklyTestPanel } from "@/modules/assessment/components/WeeklyTestPanel";

export type PostStage =
  | "slides" | "test" | "results" | "weekly" | "project" | "checkin" | "next";

export interface PostFlowProject {
  id: string;
  title: string;
  activeMilestone: { id: string; title: string } | null;
}

/** Step order shown after the slides. "weekly" appears only when due. */
function stepsFor(hasProject: boolean): { key: PostStage; label: string }[] {
  return [
    { key: "test", label: "Test" },
    { key: "weekly", label: "Weekly" },
    ...(hasProject ? [{ key: "project" as const, label: "Project" }] : []),
    { key: "checkin", label: "Check-in" },
    { key: "next", label: "Next topic" },
  ];
}

export function PostFlowStepper({
  stage,
  hasProject,
  onStage,
}: {
  stage: PostStage;
  hasProject: boolean;
  onStage: (s: PostStage) => void;
}) {
  const steps = stepsFor(hasProject);
  const currentIdx = stage === "results" ? 0 : steps.findIndex((x) => x.key === stage);
  return (
    <ol className="mx-auto mb-4 flex max-w-2xl items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <li className="shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1 text-[11px] font-semibold text-success-on">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Slides
        </span>
      </li>
      {steps.map((x, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={x.key} className="flex shrink-0 items-center gap-1">
            <span className="text-fg-muted" aria-hidden>
              <ChevronRight className="h-3 w-3" />
            </span>
            <button
              type="button"
              onClick={() => (done ? onStage(x.key) : undefined)}
              disabled={!done}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                done
                  ? "bg-bg-subtle text-fg-muted hover:text-fg"
                  : active
                    ? "bg-brand text-on-brand"
                    : "bg-bg-subtle text-fg-muted/60",
              )}
            >
              {done && <CheckCircle2 className="h-3 w-3" aria-hidden />}
              {x.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Test stage — the daily Socratic test takes the stage. */
export function TestStage({
  courseId,
  topicLabel,
  hasProject,
  onScore,
  onStage,
}: {
  courseId: string;
  topicLabel?: string;
  hasProject: boolean;
  onScore: (score: number | null) => void;
  onStage: (s: PostStage) => void;
}) {
  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="test" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto max-w-2xl">
        <DailyTestPanel courseId={courseId} topicLabel={topicLabel} onComplete={onScore} />
      </div>
    </div>
  );
}

/** Results stage — the daily score + what comes next. */
export function ResultsStage({
  score,
  weeklyDue,
  hasProject,
  onStage,
}: {
  score: number | null;
  weeklyDue: boolean;
  hasProject: boolean;
  onStage: (s: PostStage) => void;
}) {
  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="results" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-sm md:p-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle text-success-on">
          <Trophy className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">Daily test complete</h3>
        <p className="mt-2 text-4xl font-bold tabular-nums text-fg">
          {score != null ? `${score}%` : "—"}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          {score != null && score >= 60
            ? "Strong work — the concept is locked in."
            : "The examiner's explanations below show what to review before moving on."}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onStage(weeklyDue ? "weekly" : hasProject ? "project" : "checkin")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onStage("slides")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <Presentation className="h-4 w-4" aria-hidden />
            Review slides
          </button>
        </div>
      </div>
    </div>
  );
}

/** Weekly stage — the end-of-week test, shown when due. */
export function WeeklyStage({
  courseId,
  week,
  weekLabel,
  hasProject,
  onScore,
  onContinue,
  score,
  onStage,
}: {
  courseId: string;
  week: number;
  weekLabel?: string;
  hasProject: boolean;
  onScore: (score: number | null) => void;
  onContinue: () => void;
  score: number | null;
  onStage: (s: PostStage) => void;
}) {
  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="weekly" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto max-w-2xl">
        <WeeklyTestPanel courseId={courseId} week={week} weekLabel={weekLabel} onComplete={onScore} />
        {score !== null && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Next-topic stage — finish the topic, then fresh slides. */
export function NextStage({
  isLastTopic,
  completing,
  onComplete,
  hasProject,
  onStage,
}: {
  isLastTopic: boolean;
  completing: boolean;
  onComplete: () => void;
  hasProject: boolean;
  onStage: (s: PostStage) => void;
}) {
  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="next" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-sm md:p-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-fg">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">All steps complete</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          Slides, Socratic test, project and check-in are all done for this topic.
          Ready for the next one?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-success px-5 text-sm font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            {isLastTopic ? "Complete course" : "Proceed to next topic"}
          </button>
          <button
            type="button"
            onClick={() => onStage("slides")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <Presentation className="h-4 w-4" aria-hidden />
            Review slides
          </button>
        </div>
      </div>
    </div>
  );
}

/** Project stage — a quick optional project note, then check-in. */
export function ProjectStage({
  project,
  courseId,
  week,
  hasProject,
  onDone,
  onBack,
  onStage,
}: {
  project: PostFlowProject;
  courseId: string;
  week: number;
  hasProject: boolean;
  onDone: () => void;
  onBack: () => void;
  onStage: (s: PostStage) => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function continueFlow() {
    if (!note.trim()) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/tasks", {
        description: `[Topic update] ${note.trim()}`,
        week,
        courseId,
        projectId: project.id,
      });
      toast.success("Project updated", { description: "The note is attached to your project tasks." });
      onDone();
    } catch (e) {
      toast.error("Couldn't save the project note", {
        description: e instanceof Error ? e.message : undefined,
      });
      setSaving(false);
    }
  }

  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="project" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info-subtle text-info-on">
          <Target className="h-7 w-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">Your project</h3>
        <p className="mt-1 text-sm font-medium text-fg">{project.title}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {project.activeMilestone
            ? `Active milestone: ${project.activeMilestone.title}`
            : "All milestones complete 🎉"}
        </p>
        <label htmlFor="project-note" className="mt-4 block text-xs font-medium text-fg-secondary">
          Quick update (optional) — what did you do for the project today?
        </label>
        <textarea
          id="project-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Wrote the requirements section for my capstone brief…"
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <button
            type="button"
            onClick={() => void continueFlow()}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
            Continue to check-in
          </button>
        </div>
      </div>
    </div>
  );
}

const CHECKIN_CONFIDENCE = [
  { value: 1, label: "Lost" },
  { value: 2, label: "Struggling" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

/** Check-in stage — a quick stand-up for the mentor. */
export function CheckinStage({
  courseId,
  hasProject,
  onDone,
  onBack,
  onStage,
}: {
  courseId: string;
  hasProject: boolean;
  onDone: () => void;
  onBack: () => void;
  onStage: (s: PostStage) => void;
}) {
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v2/learn/checkin", {
        courseId,
        whatDidYouDo: note.trim(),
        confidence,
      });
      toast.success("Check-in saved", { description: "Your instructor can see today's update." });
      onDone();
    } catch (err) {
      toast.error("Couldn't save check-in", {
        description: err instanceof Error ? err.message : undefined,
      });
      setSaving(false);
    }
  }

  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="checkin" hasProject={hasProject} onStage={onStage} />
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-subtle text-warning-on">
          <CalendarCheck className="h-7 w-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">Daily check-in</h3>
        <p className="mt-1 text-xs text-fg-muted">
          A quick stand-up for your mentor — how did today&apos;s topic feel?
        </p>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-fg-secondary">How did it go today?</legend>
          <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Confidence">
            {CHECKIN_CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={confidence === c.value}
                onClick={() => setConfidence(c.value)}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  confidence === c.value
                    ? "border-brand bg-brand-subtle text-fg"
                    : "border-line bg-bg-subtle text-fg-secondary hover:border-line-strong",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="flow-checkin-note" className="mt-4 block text-xs font-medium text-fg-secondary">
          What did you work on today?
        </label>
        <textarea
          id="flow-checkin-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          placeholder="Today I learned…"
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            Save check-in
          </button>
        </div>
      </form>
    </div>
  );
}

/** Kept for the QuickBar's test CTA icon parity. */
export const PostFlowIcons = { Brain };
