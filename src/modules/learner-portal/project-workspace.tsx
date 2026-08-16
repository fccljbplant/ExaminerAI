"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  Flag,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L7 Project workspace, rebuilt for the v2
 * project flow:
 *
 *   1. Proposal — the learner writes a proposal (description, objectives,
 *      duration). New projects start as pending_approval.
 *   2. Approval — an instructor approves or rejects it (with a note).
 *      Task generation stays LOCKED until approval.
 *   3. Timeline — once approved, the learner generates a course-aligned
 *      week-by-week timeline with per-day tasks, and works it like a
 *      proper project board (toggle / add / delete / regenerate).
 *
 * Legacy "active" projects keep working (generation enabled).
 */

interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  order: number;
  status: string;
  completedAt: string | null;
}

interface WeekView {
  id: string;
  week: number;
  title: string;
  summary: string;
  milestones: string[];
}

interface TaskView {
  id: string;
  title: string;
  status: string;
  week: number;
  day: number | null;
  dueDate: string | null;
  isMilestone: boolean;
  courseTopicLink: string | null;
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
    description: string | null;
    objectives: string[];
    durationWeeks: number | null;
    approvalNote: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    courseName: string | null;
    createdAt: string;
  };
  milestones: MilestoneView[];
  weeks: WeekView[];
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

const CAN_GENERATE = (status: string) => status === "approved" || status === "active";
const CAN_EDIT_PROPOSAL = (status: string) => status === "pending_approval" || status === "rejected";

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { data, error, isLoading, retry } = useApi<ProjectData>(`/api/v2/projects/${projectId}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tasksPerWeek, setTasksPerWeek] = useState(5);

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

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.post<{ message?: string }>(
        `/api/v2/projects/${projectId}/generate`,
        { tasksPerWeek },
      );
      toast.success("Timeline generated", {
        description: res.message ?? "Your week-by-week plan is ready.",
      });
      retry();
    } catch (e) {
      toast.error("Couldn't generate timeline", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    if (!window.confirm("Regenerate the timeline? Your current tasks will be replaced.")) return;
    await generate();
  }

  async function toggleTask(t: TaskView) {
    setBusyId(t.id);
    try {
      await api.patch(`/api/v2/projects/${projectId}/tasks`, {
        taskId: t.id,
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
      await api.del(`/api/v2/projects/${projectId}/tasks?taskId=${t.id}`);
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

  const tasksByWeek = useMemo(() => {
    const map = new Map<number, TaskView[]>();
    for (const t of data?.tasks ?? []) {
      const list = map.get(t.week) ?? [];
      list.push(t);
      map.set(t.week, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    return map;
  }, [data]);
  const weeksByNumber = useMemo(
    () => new Map((data?.weeks ?? []).map((w) => [w.week, w])),
    [data],
  );

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

  const { project, milestones, weeks, tasks, kpis } = data;
  const canWork = CAN_GENERATE(project.status);
  const maxWeek = tasks.reduce((m, t) => Math.max(m, t.week), weeks.length);

  return (
    <div className="space-y-4">
      {/* header */}
      <header className="space-y-1">
        <p className="text-xs text-fg-muted">
          <Link href="/learner" className="hover:text-fg">
            Home
          </Link>{" "}
          · {project.courseName ?? "Project"}
        </p>
        <h1 className="text-lg font-semibold text-fg md:text-xl">{project.title}</h1>
        {project.goal && <p className="text-sm text-fg-secondary">{project.goal}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {project.stack && (
            <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs text-fg-secondary">
              {project.stack}
            </span>
          )}
          {project.deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs text-fg-secondary">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {new Date(project.deadline).toLocaleDateString()}
            </span>
          )}
          <StatusChip status={project.status} />
        </div>
      </header>

      <StatusBanner
        status={project.status}
        approvalNote={project.approvalNote}
        approvedByName={project.approvedByName}
        onEdit={() => setEditing(true)}
        onGenerate={generate}
        generating={generating}
        hasTasks={tasks.length > 0}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Milestones" value={`${kpis.milestoneProgress}%`} icon={Flag} tone="brand" />
        <Kpi label="Milestones done" value={kpis.milestonesDone} icon={Target} tone="info" />
        <Kpi label="Tasks" value={`${kpis.taskProgress}%`} icon={TrendingUp} tone="muted" />
        <Kpi label="Tasks done" value={kpis.tasksDone} icon={CheckCircle2} tone="success" />
      </div>

      {/* proposal */}
      <ProposalCard
        project={project}
        projectId={projectId}
        editing={editing}
        setEditing={setEditing}
        onSaved={retry}
      />

      {/* timeline */}
      <TimelineSection
        projectId={projectId}
        status={project.status}
        tasks={tasks}
        tasksByWeek={tasksByWeek}
        weeksByNumber={weeksByNumber}
        maxWeek={maxWeek}
        generating={generating}
        tasksPerWeek={tasksPerWeek}
        setTasksPerWeek={setTasksPerWeek}
        onGenerate={generate}
        onRegenerate={regenerate}
        onToggleTask={toggleTask}
        onDeleteTask={deleteTask}
        busyId={busyId}
        onChanged={retry}
      />

      {/* milestone stepper */}
      {milestones.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Milestones
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {milestones.map((m, i) => {
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
                      disabled={busyId === m.id || !canWork}
                      title={canWork ? undefined : "Unlocks after instructor approval"}
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

/* ---------------- status chip + banner --------------------------------- */

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_approval: { label: "Awaiting approval", cls: "bg-warning-subtle text-warning-on" },
    approved: { label: "Approved", cls: "bg-success-subtle text-success-on" },
    rejected: { label: "Needs changes", cls: "bg-danger/10 text-danger" },
    active: { label: "In progress", cls: "bg-info-subtle text-info-on" },
  };
  const m = map[status] ?? { label: status, cls: "bg-bg-subtle text-fg-muted" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

function StatusBanner({
  status,
  approvalNote,
  approvedByName,
  onEdit,
  onGenerate,
  generating,
  hasTasks,
}: {
  status: string;
  approvalNote: string | null;
  approvedByName: string | null;
  onEdit: () => void;
  onGenerate: () => void;
  generating: boolean;
  hasTasks: boolean;
}) {
  if (status === "pending_approval") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-subtle/60 p-4">
        <Clock className="h-5 w-5 shrink-0 text-warning-on" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Awaiting instructor approval</p>
          <p className="text-xs text-fg-secondary">
            Your timeline and task generation unlock once an instructor approves this proposal.
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-line-strong"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit proposal
        </button>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Proposal sent back for changes</p>
            {approvalNote && <p className="mt-0.5 text-xs text-fg-secondary">&ldquo;{approvalNote}&rdquo;</p>}
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-line-strong"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit &amp; resubmit
          </button>
        </div>
        <p className="text-xs text-fg-muted">
          Saving your edited proposal automatically resubmits it for approval.
        </p>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success-subtle/60 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-success-on" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            Approved{approvedByName ? ` by ${approvedByName}` : ""}
          </p>
          <p className="text-xs text-fg-secondary">
            {hasTasks ? "Timeline generated — work it week by week." : "You're cleared to generate your task timeline."}
          </p>
        </div>
        {!hasTasks && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Generate timeline
          </button>
        )}
      </div>
    );
  }
  return null;
}

/* ---------------- proposal card ---------------------------------------- */

function ProposalCard({
  project,
  projectId,
  editing,
  setEditing,
  onSaved,
}: {
  project: ProjectData["project"];
  projectId: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onSaved: () => void;
}) {
  const editable = CAN_EDIT_PROPOSAL(project.status);
  const [title, setTitle] = useState(project.title);
  const [goal, setGoal] = useState(project.goal ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [objectives, setObjectives] = useState(project.objectives.join("\n"));
  const [durationWeeks, setDurationWeeks] = useState(project.durationWeeks ?? 4);
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/api/v2/projects/${projectId}`, {
        title,
        goal: goal || null,
        deadline: deadline || null,
        description: description || null,
        objectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean),
        durationWeeks,
      });
      toast.success(
        project.status === "rejected"
          ? "Proposal resubmitted for approval"
          : "Proposal updated",
      );
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error("Couldn't save proposal", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Proposal
          </h2>
          {editable && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-brand hover:bg-brand-subtle"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          )}
        </div>
        {project.description ? (
          <p className="text-sm leading-relaxed text-fg-secondary">{project.description}</p>
        ) : (
          <p className="text-sm text-fg-muted">No proposal description yet.</p>
        )}
        {project.objectives.length > 0 && (
          <ul className="space-y-1">
            {project.objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fg-muted">
          {project.durationWeeks ? `${project.durationWeeks}-week timeline` : "Timeline length not set"}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-brand/30 bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Edit proposal
      </h2>
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Project title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Goal</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What does success look like?"
            className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Proposal description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the project your instructor will review: the problem, your approach, the deliverable."
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Objectives (one per line)</span>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={3}
            placeholder={"Research competitor stores\nPick 5 products to test\nList first 10 products"}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg">Timeline length</span>
            <select
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-line bg-bg px-2 text-sm text-fg"
            >
              {Array.from({ length: 25 }, (_, i) => i + 2).map((w) => (
                <option key={w} value={w}>{w} weeks</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg">Deadline</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            />
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving || !title.trim()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {project.status === "rejected" ? "Save & resubmit" : "Save proposal"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-xs font-medium text-fg hover:border-line-strong"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- timeline section -------------------------------------- */

function TimelineSection({
  projectId,
  status,
  tasks,
  tasksByWeek,
  weeksByNumber,
  maxWeek,
  generating,
  tasksPerWeek,
  setTasksPerWeek,
  onGenerate,
  onRegenerate,
  onToggleTask,
  onDeleteTask,
  busyId,
  onChanged,
}: {
  projectId: string;
  status: string;
  tasks: TaskView[];
  tasksByWeek: Map<number, TaskView[]>;
  weeksByNumber: Map<number, WeekView>;
  maxWeek: number;
  generating: boolean;
  tasksPerWeek: number;
  setTasksPerWeek: (n: number) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onToggleTask: (t: TaskView) => void;
  onDeleteTask: (t: TaskView) => void;
  busyId: string | null;
  onChanged: () => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [newTaskWeek, setNewTaskWeek] = useState(Math.max(maxWeek, 1));
  const [adding, setAdding] = useState(false);
  const canGenerate = CAN_GENERATE(status);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    setAdding(true);
    try {
      await api.post(`/api/v2/projects/${projectId}/tasks`, {
        description: newTask.trim(),
        week: newTaskWeek,
      });
      setNewTask("");
      toast.success("Task added");
      onChanged();
    } catch (err) {
      toast.error("Couldn't add task", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setAdding(false);
    }
  }

  // Nothing yet — show the locked/generate state.
  if (tasks.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Timeline</h2>
        <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center">
          {canGenerate ? (
            <>
              <Sparkles className="mx-auto h-6 w-6 text-brand" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-fg">Generate your project timeline</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-fg-muted">
                The AI builds a week-by-week plan with daily tasks, aligned to your course outline.
              </p>
              <div className="mx-auto mt-4 flex max-w-xs items-center gap-2">
                <select
                  value={tasksPerWeek}
                  onChange={(e) => setTasksPerWeek(Number(e.target.value))}
                  aria-label="Tasks per week"
                  className="h-11 flex-1 rounded-lg border border-line bg-bg px-2 text-sm text-fg"
                >
                  {[3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>{n} tasks/week</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={generating}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-on-brand disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden />
                  )}
                  Generate
                </button>
              </div>
            </>
          ) : (
            <>
              <Clock className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-fg">Timeline locked</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-fg-muted">
                Task generation unlocks after your instructor approves this project.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Timeline</h2>
        {canGenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={generating}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            Regenerate
          </button>
        )}
      </div>

      {/* add task */}
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
          {Array.from({ length: Math.max(maxWeek, 12) }, (_, i) => i + 1).map((w) => (
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

      {/* weeks */}
      <div className="space-y-3">
        {[...tasksByWeek.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([weekNum, weekTasks]) => {
            const week = weeksByNumber.get(weekNum);
            return (
              <div key={weekNum} className="overflow-hidden rounded-xl border border-line bg-surface">
                {week && (
                  <div className="border-b border-line bg-bg-subtle/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-subtle px-1.5 text-[11px] font-bold text-fg">
                        {weekNum}
                      </span>
                      <p className="text-sm font-semibold text-fg">{week.title}</p>
                    </div>
                    {week.summary && <p className="mt-1 text-xs text-fg-muted">{week.summary}</p>}
                    {week.milestones.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {week.milestones.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-fg-secondary">
                            <Flag className="h-3 w-3 text-brand" aria-hidden />
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="divide-y divide-line">
                  {weekTasks.map((t) => (
                    <div key={t.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleTask(t)}
                        disabled={busyId === t.id}
                        aria-label={t.status === "completed" ? `Mark ${t.title} incomplete` : `Mark ${t.title} complete`}
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-full border",
                          t.status === "completed" ? "border-success bg-success" : "border-line bg-bg"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", t.status === "completed" ? "text-fg-muted line-through" : "text-fg")}>
                          {t.title}
                        </p>
                        {t.courseTopicLink && (
                          <p className="truncate text-[11px] text-fg-muted">{t.courseTopicLink}</p>
                        )}
                      </div>
                      {t.day !== null && (
                        <span className="shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-fg-muted">
                          Day {t.day}
                        </span>
                      )}
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
                        onClick={() => onDeleteTask(t)}
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
            );
          })}
      </div>
    </section>
  );
}

/* ---------------- shared bits ------------------------------------------- */

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
      <div className="h-16 rounded-xl bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
