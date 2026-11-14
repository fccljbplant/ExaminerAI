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
  courseId: string;
  courseName: string;
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

/** Course selection is editable in the cross-course workspace, but fixed when
 * a proposal is started from a specific course's Coursework tab. */
export function ProjectCourseField({
  courses,
  preferredCourseId,
  selectedCourseId,
  onCourseChange,
}: {
  courses: CourseRow[];
  preferredCourseId?: string;
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
}) {
  if (preferredCourseId) {
    const preferredCourse = courses.find((course) => course.id === preferredCourseId);
    if (!preferredCourse) {
      return (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3">
          <p className="text-sm font-semibold text-fg">Course unavailable</p>
          <p className="mt-1 text-xs text-fg-muted">
            This course is no longer available for new project proposals. Return to your course list and refresh before trying again.
          </p>
        </div>
      );
    }

    return (
      <div className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Course</span>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3">
          <span className="min-w-0 truncate text-sm text-fg">{preferredCourse.name}</span>
          <span className="shrink-0 rounded-full bg-brand-subtle px-2 py-1 text-[11px] font-semibold text-brand">
            Current course
          </span>
        </div>
      </div>
    );
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-fg">Course</span>
      <select
        value={selectedCourseId}
        onChange={(event) => onCourseChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <option value="">Select a course…</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>{course.name}</option>
        ))}
      </select>
    </label>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Needs changes",
  active: "In progress",
};

export function LearnerProjects({
  courseId,
  embedded = false,
}: {
  courseId?: string;
  embedded?: boolean;
}) {
  const path = courseId
    ? `/api/learn/projects?courseId=${encodeURIComponent(courseId)}`
    : "/api/learn/projects";
  const { data, error, isLoading, retry } = useApi<ProjectsData>(path);

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
      {!embedded && (
        <header className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-brand" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-fg md:text-xl">Projects</h1>
            <p className="text-xs text-fg-muted">
              Projects stay with their course from proposal through approval, milestones and review.
            </p>
          </div>
        </header>
      )}

      <NewProjectForm
        key={courseId ?? "all-courses"}
        courses={data.courses}
        preferredCourseId={courseId}
        onCreated={retry}
      />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Course projects
        </h2>
        {data.projects.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <Target className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
            <p className="mt-2 text-sm font-medium text-fg">No projects yet</p>
            <p className="mt-1 text-xs text-fg-muted">
              {courseId
                ? "No projects in this course yet. Use the form above to propose one."
                : data.courses.length > 0
                  ? "Projects from your enrolled courses will appear here."
                  : "Enroll in a course to propose a project and keep its work with that course."}
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
                  <p className="truncate text-xs font-semibold text-brand">{p.courseName}</p>
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

function NewProjectForm({
  courses,
  preferredCourseId,
  onCreated,
}: {
  courses: CourseRow[];
  preferredCourseId?: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(
    () => courses.find((course) => course.id === preferredCourseId)?.id ?? courses[0]?.id ?? "",
  );
  const preferredCourse = preferredCourseId
    ? courses.find((course) => course.id === preferredCourseId) ?? null
    : null;
  const selectedCourseId = preferredCourseId ? preferredCourse?.id ?? "" : courseId;
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
    if (!selectedCourseId) {
      toast.error("Pick the course this project belongs to");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/learn/projects", {
        courseId: selectedCourseId,
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

  if (preferredCourseId && !preferredCourse) {
    return (
      <ProjectCourseField
        courses={courses}
        preferredCourseId={preferredCourseId}
        selectedCourseId={selectedCourseId}
        onCourseChange={setCourseId}
      />
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-4">
        <p className="text-sm font-semibold text-fg">Projects are part of a course</p>
        <p className="mt-1 text-xs text-fg-muted">
          Enroll in a course before proposing a project. Its approval, milestones and feedback will stay with that course.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={preferredCourse ? `New project proposal for ${preferredCourse.name}` : undefined}
        className="flex w-full min-h-12 flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 text-sm font-semibold text-brand transition-colors hover:border-brand/50 hover:bg-brand-subtle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span>New project proposal</span>
        {preferredCourse && (
          <span className="max-w-[45%] truncate rounded-full bg-brand-subtle px-2 py-1 text-[11px] font-semibold text-brand">
            {preferredCourse.name}
          </span>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={submit} aria-busy={saving} className="space-y-3 rounded-xl border border-brand/30 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          New project proposal
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
      {courses.length > 0 && (
        <ProjectCourseField
          courses={courses}
          preferredCourseId={preferredCourseId}
          selectedCourseId={selectedCourseId}
          onCourseChange={setCourseId}
        />
      )}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What will you build?"
          className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Goal</span>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What does success look like?"
          className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Proposal description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the project your instructor will review."
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-fg">Objectives (one per line)</span>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={2}
          placeholder="Pick a niche\nList 5 products"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-fg">Timeline length</span>
          <select
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
            className="h-11 w-full rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
            className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-on-brand transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
