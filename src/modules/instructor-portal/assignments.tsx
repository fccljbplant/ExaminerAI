"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";

/**
 * modules/instructor-portal — Assignments & Events (W11 audit: V1
 * AssignmentsTab restored)
 *
 * Class-level group tasks (create / close / delete, submission counts)
 * and calendar events (create / delete) for the instructor's course.
 * Consumes the surviving RBAC-guarded v1 endpoints.
 */

interface Course {
  id: string;
  name: string;
  isActive: boolean;
}

interface GroupTask {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  dueDate: string | null;
  week: number | null;
  maxScore: number | null;
  status: string;
  _count?: { submissions: number };
}

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

export function InstructorAssignments() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [tasks, setTasks] = useState<GroupTask[] | null>(null);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // task form
  const [tTitle, setTTitle] = useState("");
  const [tType, setTType] = useState("assignment");
  const [tDue, setTDue] = useState("");
  const [tWeek, setTWeek] = useState("1");
  const [tMax, setTMax] = useState("100");

  // event form
  const [eTitle, setETitle] = useState("");
  const [eType, setEType] = useState("deadline");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eLoc, setELoc] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const list = Array.isArray(d) ? d : d.courses;
        if (Array.isArray(list)) {
          setCourses(list.filter((c: Course) => c.isActive !== false));
          setCourseId(list[0]?.id ?? "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (cid: string) => {
    if (!cid) return;
    setError(null);
    try {
      const [t, e] = await Promise.all([
        fetch(`/api/group-tasks?courseId=${cid}`).then((r) => r.json()),
        fetch(`/api/events?courseId=${cid}`).then((r) => r.json()),
      ]);
      setTasks((t as { tasks: GroupTask[] }).tasks ?? []);
      setEvents((e as { events: CalEvent[] }).events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    if (courseId) void load(courseId);
  }, [courseId, load]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/group-tasks", {
        courseId,
        title: tTitle.trim(),
        type: tType,
        dueDate: tDue || undefined,
        week: Number(tWeek) || undefined,
        maxScore: Number(tMax) || undefined,
      });
      toast.success("Assignment created");
      setTTitle("");
      void load(courseId);
    } catch (err) {
      toast.error("Couldn't create assignment", { description: err instanceof Error ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  async function closeTask(taskId: string) {
    setBusy(true);
    try {
      await api.patch("/api/group-tasks", { taskId, status: "closed" });
      toast.success("Assignment closed");
      void load(courseId);
    } catch (err) {
      toast.error("Couldn't close assignment", { description: err instanceof Error ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Delete this assignment and its submissions?")) return;
    setBusy(true);
    try {
      await api.del("/api/group-tasks", { taskId });
      toast.success("Assignment deleted");
      void load(courseId);
    } catch (err) {
      toast.error("Couldn't delete assignment", { description: err instanceof Error ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/events", {
        title: eTitle.trim(),
        type: eType,
        startDate: eStart,
        endDate: eEnd || undefined,
        location: eLoc || undefined,
        courseId,
      });
      toast.success("Event created");
      setETitle("");
      setEEnd("");
      setELoc("");
      void load(courseId);
    } catch (err) {
      toast.error("Couldn't create event", { description: err instanceof Error ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(eventId: string) {
    setBusy(true);
    try {
      await api.del("/api/events", { eventId });
      toast.success("Event deleted");
      void load(courseId);
    } catch (err) {
      toast.error("Couldn't delete event", { description: err instanceof Error ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Courses &amp; assignments</h1>

      <label className="flex items-center gap-2 text-sm text-fg">
        <span className="text-fg-muted">Course</span>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          aria-label="Select course"
          className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void load(courseId)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* assignments */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Assignments
          </h2>
          <form onSubmit={createTask} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              required
              placeholder="Assignment title"
              aria-label="Assignment title"
              className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
            />
            <div className="flex flex-wrap gap-2">
              <select value={tType} onChange={(e) => setTType(e.target.value)} aria-label="Type" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg">
                {["assignment", "quiz", "project", "reading", "exercise"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} aria-label="Due date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg" />
              <select value={tWeek} onChange={(e) => setTWeek(e.target.value)} aria-label="Week" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
              <input type="number" value={tMax} onChange={(e) => setTMax(e.target.value)} aria-label="Max score" className="h-11 w-24 rounded-lg border border-line bg-bg px-2 text-sm text-fg" />
              <button
                type="submit"
                disabled={busy || !tTitle.trim() || !courseId}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Create
              </button>
            </div>
          </form>
          {tasks === null ? (
            <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
          ) : tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-5 text-center text-sm text-fg-muted">
              No assignments yet for this course.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{t.title}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {t.type} · due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"} ·{" "}
                      {t._count?.submissions ?? 0} submissions
                      {t.status === "closed" ? " · closed" : ""}
                    </p>
                  </div>
                  {t.status !== "closed" && (
                    <button
                      type="button"
                      onClick={() => void closeTask(t.id)}
                      className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-fg-secondary hover:border-line-strong hover:text-fg"
                    >
                      Close
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteTask(t.id)}
                    aria-label={`Delete ${t.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* events */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Class events
          </h2>
          <form onSubmit={createEvent} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <input
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              required
              placeholder="Event title"
              aria-label="Event title"
              className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
            />
            <div className="flex flex-wrap gap-2">
              <select value={eType} onChange={(e) => setEType(e.target.value)} aria-label="Event type" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg">
                {["deadline", "exam", "meeting", "vocational", "holiday", "other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} required aria-label="Start date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg" />
              <input type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} aria-label="End date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg" />
              <input value={eLoc} onChange={(e) => setELoc(e.target.value)} placeholder="Location" aria-label="Location" className="h-11 w-28 rounded-lg border border-line bg-bg px-2 text-sm text-fg placeholder:text-fg-muted" />
              <button
                type="submit"
                disabled={busy || !eTitle.trim() || !eStart || !courseId}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Add
              </button>
            </div>
          </form>
          {events === null ? (
            <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
          ) : events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-5 text-center text-sm text-fg-muted">
              No class events yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{ev.title}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {ev.type} · {new Date(ev.startDate).toLocaleString()}
                      {ev.endDate ? ` → ${new Date(ev.endDate).toLocaleString()}` : ""}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteEvent(ev.id)}
                    aria-label={`Delete ${ev.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
