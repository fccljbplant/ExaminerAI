"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Flag,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L7 Project workspace (REDESIGN-P3 §L7, W10
 * audit: V1 Gantt/ProjectWeekPlan/ProjectReportPanel re-homed)
 *
 * Goal/stack header, milestone stepper (tap to complete, XP once),
 * week-grouped task board, progress KPIs. Mobile-adaptive.
 */

interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  order: number;
  status: string;
  completedAt: string | null;
}

interface TaskView {
  id: string;
  title: string;
  status: string;
  week: number;
  dueDate: string | null;
  isMilestone: boolean;
}

interface ProjectData {
  project: {
    id: string;
    title: string;
    goal: string | null;
    stack: string | null;
    currentState: string | null;
    deadline: string | null;
    status: string;
    courseName: string | null;
    createdAt: string;
  };
  milestones: MilestoneView[];
  tasks: TaskView[];
  kpis: {
    milestoneProgress: number;
    milestonesDone: string;
    taskProgress: number;
    tasksDone: string;
  };
}

const TASK_TONE: Record<string, string> = {
  completed: "bg-success-subtle text-success-on",
  "in-progress": "bg-info-subtle text-info-on",
  planned: "bg-bg-subtle text-fg-muted",
  blocked: "bg-warning-subtle text-warning-on",
};

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { data, error, isLoading, retry } = useApi<ProjectData>(
    `/api/v2/projects/${projectId}`,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function completeMilestone(mid: string) {
    setBusyId(mid);
    try {
      await api.post(`/api/v2/projects/${projectId}/milestones/${mid}/complete`, {});
      toast.success("Milestone complete", { description: "+15 XP" });
      retry();
    } catch (e) {
      toast.error("Couldn't complete milestone", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <ProjectSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load this project</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  // group tasks by week
  const byWeek = new Map<number, TaskView[]>();
  for (const t of data.tasks) {
    const list = byWeek.get(t.week) ?? [];
    list.push(t);
    byWeek.set(t.week, list);
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <header className="space-y-1">
        <p className="text-xs text-fg-muted">
          <Link href="/learner" className="hover:text-fg">
            Home
          </Link>{" "}
          · {data.project.courseName ?? "Project"}
        </p>
        <h1 className="text-lg font-semibold text-fg md:text-xl">{data.project.title}</h1>
        {data.project.goal && <p className="text-sm text-fg-secondary">{data.project.goal}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {data.project.stack && (
            <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs text-fg-secondary">
              {data.project.stack}
            </span>
          )}
          {data.project.deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs text-fg-secondary">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {new Date(data.project.deadline).toLocaleDateString()}
            </span>
          )}
          {data.project.currentState && (
            <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs text-fg-muted">
              {data.project.currentState}
            </span>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Milestones" value={`${data.kpis.milestoneProgress}%`} icon={Flag} tone="brand" />
        <Kpi label="Milestones done" value={data.kpis.milestonesDone} icon={Target} tone="info" />
        <Kpi label="Tasks" value={`${data.kpis.taskProgress}%`} icon={TrendingUp} tone="muted" />
        <Kpi label="Tasks done" value={data.kpis.tasksDone} icon={CheckCircle2} tone="success" />
      </div>

      {/* milestone stepper */}
      {data.milestones.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Milestones
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.milestones.map((m, i) => {
              const done = m.status === "completed";
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      done ? "bg-success-subtle text-success-on" : "bg-bg-subtle text-fg-muted"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", done ? "text-fg-secondary line-through" : "text-fg")}>
                      {m.title}
                    </p>
                    {m.description && <p className="truncate text-xs text-fg-muted">{m.description}</p>}
                  </div>
                  {!done && (
                    <button
                      type="button"
                      onClick={() => completeMilestone(m.id)}
                      disabled={busyId === m.id}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-line bg-bg-subtle px-3 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                    >
                      {busyId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Complete
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* task board by week */}
      {data.tasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Tasks</h2>
          {[...byWeek.entries()].map(([week, tasks]) => (
            <div key={week} className="space-y-1.5">
              <p className="px-1 text-xs font-medium text-fg-muted">Week {week}</p>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {tasks.map((t) => (
                  <div key={t.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-sm text-fg">{t.title}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                        TASK_TONE[t.status] ?? "bg-bg-subtle text-fg-muted"
                      )}
                    >
                      {t.status.replace("-", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <Link
        href="/learner"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to home
      </Link>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Target;
  tone: "brand" | "info" | "muted" | "success";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    info: "bg-info-subtle text-info-on",
    muted: "bg-bg-subtle text-fg-muted",
    success: "bg-success-subtle text-success-on",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 w-1/2 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
