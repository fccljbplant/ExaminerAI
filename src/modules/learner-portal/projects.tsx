"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Target,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — Projects home (v2 project flow).
 *
 * The missing entry point: a full project list + the "new project"
 * proposal form. New projects start as pending_approval — the workspace
 * takes over from there (approval → timeline → weekly task management).
 */

interface ProjectRow {
  id: string;
  title: string;
  goal: string | null;
  status: string;
  durationWeeks: number | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  kpis: { taskProgress: number; tasksDone: string };
}

interface CourseRow {
  id: string;
  name: string;
}

interface ProjectsData {
  projects: ProjectRow[];
  courses: CourseRow[];
}

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Needs changes",
  active: "In progress",
};

export function LearnerProjects() {
  const { data, error, isLoading, retry } = useApi<ProjectsData>("/api/learn/projects");

  if (isLoading) return <ProjectsSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load projects</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <FolderKanban className="h-5 w-5 text-brand" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold text-fg md:text-xl">Projects</h1>
          <p className="text-xs text-fg-muted">
            Propose a project, get it approved, then work the week-by-week timeline.
          </p>
        </div>
      </header>

      <NewProjectForm courses={data.courses} onCreated={retry} />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Your projects
        </h2>
        {data.projects.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <Target className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
            <p className="mt-2 text-sm font-medium text-fg">No projects yet</p>
            <p className="mt-1 text-xs text-fg-muted">
              Use the form above to propose your first project.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.projects.map((p) => (
              <Link
                key={p.id}
                href={`/learner/projects/${p.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle/60"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    p.status === "pending_approval" && "bg-warning-subtle text-warning-on",
                    p.status === "approved" && "bg-success-subtle text-success-on",
                    p.status === "rejected" && "bg-danger/10 text-danger",
                    p.status === "active" && "bg-info-subtle text-info-on",
                  )}
                >
                  {p.status === "pending_approval" ? (
                    <Clock className="h-4 w-4" aria-hidden />
                  ) : p.status === "rejected" ? (
                    <XCircle className="h-4 w-4" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{p.title}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {STATUS_LABEL[p.status] ?? p.status}
                    {p.durationWeeks ? ` · ${p.durationWeeks}-week timeline` : ""}
                    {p.deadline ? ` · due ${new Date(p.deadline).toLocaleDateString()}` : ""}
                    {" · "}{p.kpis.tasksDone} tasks
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- new project form ------------------------------------- */

function NewProjectForm({ courses, onCreated }: { courses: CourseRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(() => courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (!courseId) {
        toast.error("Pick the course this project belongs to");
        return;
      }
      await api.post("/api/learn/projects", {
        courseId,
        title: title.trim(),
        goal: goal.trim() || null,
        description: description.trim() || null,
        objectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean),
        durationWeeks,
        deadline: deadline || null,
      });
      toast.success("Proposal submitted", {
        description: "Your instructor has been notified — approval unlocks your timeline.",
      });
      setOpen(false);
      setTitle("");
      setGoal("");
      setDescription("");
      setObjectives("");
      onCreated();
    } catch (err) {
      toast.error("Couldn't submit proposal", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 text-sm font-semibold text-brand transition-colors hover:border-brand/50 hover:bg-brand-subtle/40"
      >
        <Plus className="h-4 w-4" aria-hidden />
        New project proposal
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-brand/30 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          New project proposal
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
      {courses.length > 0 && (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Course</span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-bg px-2 text-sm text-fg"
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What will you build?"
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
          rows={3}
          placeholder="Describe the project your instructor will review."
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Objectives (one per line)</span>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={2}
          placeholder="Pick a niche\nList 5 products"
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
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-on-brand disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        Submit for approval
      </button>
    </form>
  );
}

/* ---------------- skeleton --------------------------------------------- */

function ProjectsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 w-40 rounded-md bg-bg-subtle" />
      <div className="h-12 rounded-xl bg-bg-subtle" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
