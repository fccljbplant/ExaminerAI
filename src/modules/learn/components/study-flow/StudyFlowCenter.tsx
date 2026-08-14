"use client";

// modules/learn/components/study-flow/StudyFlowCenter.tsx — L12 Study-Flow Center.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { PlanItem, SrsCard, StudyPlanResponse } from "@/modules/learn/contracts";
import { BudgetSelector, type BudgetValue } from "./BudgetSelector";
import { WeeklyPlanCard } from "./WeeklyPlanCard";
import { CatchUpCard } from "./CatchUpCard";
import { CramCard } from "./CramCard";
import { SrsQueueCard } from "./SrsQueueCard";
import { DiagnosticBanner } from "./DiagnosticBanner";
import { PlanPreviewDialog } from "./PlanPreviewDialog";

/**
 * Study-Flow Center (REDESIGN-P3 §L12, W3). One page that adapts to the
 * learner's situation: absence / cram / diagnostic cards appear only when
 * the engine detects them, the plan always respects the chosen budget,
 * and every option previews its plan before committing.
 *
 * Data: GET /api/v2/study-plan (plan + scenario, single round trip) and
 * GET /api/v2/srs/queue. States law: skeleton → error/Retry → empty CTA.
 */

type FetchState = "loading" | "ready" | "error" | "no-enrollment";

interface ChooseResponse {
  scenario: string;
  items: PlanItem[];
  totalMin: number;
  budgetMin: number;
}

const OPTION_COPY: Record<string, { title: string; description: string }> = {
  resume: {
    title: "Resume your journey",
    description: "Here's what's next, starting where you left off.",
  },
  what_i_missed: {
    title: "What you missed",
    description: "A quick pass over the lessons from while you were away.",
  },
  condensed: {
    title: "Condensed catch-up",
    description: "The key ideas only — short and focused.",
  },
  start_today: {
    title: "Start from today",
    description: "Fresh material first; older bits can wait.",
  },
  condense: {
    title: "Condensed next topics",
    description: "Short versions of the upcoming lessons to protect retention.",
  },
  full_speed: {
    title: "Full speed ahead",
    description: "Your usual plan, keeping the current pace.",
  },
  break: {
    title: "Break scheduled",
    description: "A short rest is part of the plan — it helps retention.",
  },
};

export function StudyFlowCenter({ courseId }: { courseId?: string }) {
  const [state, setState] = useState<FetchState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [budget, setBudget] = useState<BudgetValue>(null);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [srsQueue, setSrsQueue] = useState<SrsCard[]>([]);
  const [tick, setTick] = useState(0);

  // Preview dialog state (option value + copy ride along with the items).
  const [preview, setPreview] = useState<{
    option: string;
    title: string;
    description: string;
    items: PlanItem[];
    totalMin: number;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  // Plan + scenario (single round trip). Until the learner picks a budget
  // chip, the server-side suggestion rides along and preselects it.
  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev === "ready" ? prev : "loading"));
    setErrorMsg(null);

    const qs = new URLSearchParams();
    if (courseId) qs.set("courseId", courseId);
    if (budgetTouched && budget !== null) qs.set("budgetMin", String(budget));

    api
      .get<{ ok: boolean; data: StudyPlanResponse }>(`/api/v2/study-plan?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setPlan(res.data);
        if (!budgetTouched) setBudget((res.data.scenario.budget ?? 30) as BudgetValue);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof Error && "status" in e && (e as { status: number }).status === 404) {
          setState("no-enrollment");
          return;
        }
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, budget, budgetTouched, tick]);

  // SRS queue — keyed to the resolved course so it always matches the plan.
  useEffect(() => {
    if (!plan?.courseId) return;
    let cancelled = false;
    api
      .get<{ ok: boolean; data: { cards: SrsCard[] } }>(
        `/api/v2/srs/queue?courseId=${plan.courseId}`,
      )
      .then((res) => {
        if (!cancelled) setSrsQueue(res.data.cards ?? []);
      })
      .catch(() => {
        // Queue is secondary — a failure here must not blank the page.
        if (!cancelled) setSrsQueue([]);
      });
    return () => {
      cancelled = true;
    };
  }, [plan?.courseId, tick]);

  function handleBudgetChange(next: BudgetValue) {
    setBudget(next);
    setBudgetTouched(true);
  }

  async function handleChooseOption(option: string) {
    if (!plan) return;
    try {
      const res = await api.post<{ ok: boolean; data: ChooseResponse }>(
        "/api/v2/study-plan",
        { courseId: plan.courseId, scenario: option, budgetMin: budget ?? undefined },
      );
      const copy = OPTION_COPY[option] ?? {
        title: "Your plan",
        description: "Here's what we suggest next.",
      };
      setPreview({
        option,
        title: copy.title,
        description: copy.description,
        items: res.data.items,
        totalMin: res.data.totalMin,
      });
    } catch (e) {
      toast.error("Couldn't build that plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

  async function handleConfirmPreview() {
    setConfirming(true);
    try {
      // The choice was already recorded server-side on preview; confirm
      // just adopts the plan locally and celebrates briefly.
      if (preview) {
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                items: preview.items,
                totalMin: preview.totalMin,
              }
            : prev,
        );
      }
      toast.success("Plan updated — let's go!");
      setPreview(null);
    } finally {
      setConfirming(false);
    }
  }

  if (state === "loading") return <StudyFlowSkeleton />;
  if (state === "no-enrollment") return <NoEnrollment />;
  if (state === "error" || !plan) {
    return (
      <StudyFlowError message={errorMsg ?? "Something went wrong"} onRetry={retry} />
    );
  }

  const { scenario } = plan;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Study Flow</h1>
        {plan.courseName && (
          <p className="text-sm text-fg-muted">{plan.courseName}</p>
        )}
      </header>

      <BudgetSelector
        value={budget}
        suggested={(scenario.budget ?? 30) as BudgetValue}
        onChange={handleBudgetChange}
      />

      {scenario.absence.level === "long" && (
        <DiagnosticBanner daysSince={scenario.absence.daysSince} courseId={plan.courseId} />
      )}
      {scenario.absence.level === "short" && (
        <CatchUpCard
          daysSince={scenario.absence.daysSince}
          onChoose={(v) => void handleChooseOption(v)}
        />
      )}
      {scenario.cram.isCramming && (
        <CramCard
          lessonsPerHour={scenario.cram.lessonsPerHour}
          ratio={scenario.cram.ratio}
          onChoose={(v) => void handleChooseOption(v)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <WeeklyPlanCard
          items={plan.items}
          totalMin={plan.totalMin}
          budgetMin={budget}
        />
        <SrsQueueCard cards={srsQueue} onQueueChange={setSrsQueue} />
      </div>

      <PlanPreviewDialog
        open={preview !== null}
        title={preview?.title ?? "Your plan"}
        description={preview?.description ?? ""}
        items={preview?.items ?? []}
        totalMin={preview?.totalMin ?? 0}
        busy={confirming}
        onConfirm={() => void handleConfirmPreview()}
        onOpenChange={(next) => {
          if (!next) setPreview(null);
        }}
      />
    </div>
  );
}

/* ---------------- states (skeleton / error / empty) --------------------- */

function StudyFlowSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true">
      <div className="h-7 w-40 animate-pulse rounded-md bg-bg-subtle" />
      <div className="h-9 w-72 animate-pulse rounded-full bg-bg-subtle" />
      <div className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <div className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </div>
  );
}

function StudyFlowError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your study flow</p>
      <p className="mt-1 text-xs text-fg-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </div>
  );
}

function NoEnrollment() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-fg">
        <BookOpen className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-fg">Study flow needs a course</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        Join a course and this page builds a daily plan around your time,
        your reviews, and your goals.
      </p>
      <Link
        href="/learner/learn"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Browse courses
      </Link>
    </div>
  );
}
