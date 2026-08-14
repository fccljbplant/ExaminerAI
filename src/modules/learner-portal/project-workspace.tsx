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
  Plus,
  RefreshCw,
  Target,
  Trash2,
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

  // Task CRUD (v1 /api/tasks — the learner's own ProjectTask rows)
  const [newTask, setNewTask] = useState("");
  const [newTaskWeek, setNewTaskWeek] = useState(1);
  const [adding, setAdding] = useState(false);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    setAdding(true);
    try {
      await api.post("/api/tasks", { description: newTask.trim(), week: newTaskWeek });
      setNewTask("");
      toast.success("Task added");
      retry();
    } catch (err) {
      toast.error("Couldn't add task", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(t: TaskView) {
    setBusyId(t.id);
    try {
      await api.patch("/api/tasks", {
        id: t.id,
        status: t.status === "completed" ? "planned" : "completed",
      });
      retry();
    } catch (err) {
      toast.error("Couldn't update task", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTask(t: TaskView) {
    setBusyId(t.id);
    try {
      await api.del(`/api/tasks?id=${t.id}`);
      toast.success("Task deleted");
      retry();
    } catch (err) {
      toast.error("Couldn't delete task", {
        description: err instanceof Error ? err.message : "Try again.",
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
      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Tasks</h2>
        <form onSubmit={addTask} className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-3">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            aria-label="New task description"
            className="h-11 min-w-40 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
          />
          <select
            value={newTaskWeek}
            onChange={(e) => setNewTaskWeek(Number(e.target.value))}
            aria-label="Task week"
            className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding || !newTask.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Add
          </button>
        </form>
        {data.tasks.length > 0 && (
          <div className="space-y-3">
          {[...byWeek.entries()].map(([week, tasks]) => (
            <div key={week} className="space-y-1.5">
              <p className="px-1 text-xs font-medium text-fg-muted">Week {week}</p>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {tasks.map((t) => (
                  <div key={t.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleTask(t)}
                      disabled={busyId === t.id}
                      aria-label={t.status === "completed" ? `Mark ${t.title} incomplete` : `Mark ${t.title} complete`}
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border",
                        t.status === "completed"
                          ? "border-success bg-success"
                          : "border-line bg-bg"
                      )}
                    />
                    <p className={cn("min-w-0 flex-1 truncate text-sm", t.status === "completed" ? "text-fg-muted line-through" : "text-fg")}>
                      {t.title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                        TASK_TONE[t.status] ?? "bg-bg-subtle text-fg-muted"
                      )}
                    >
                      {t.status.replace("-", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTask(t)}
                      disabled={busyId === t.id}
                      aria-label={`Delete ${t.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        )}
      </section>

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
