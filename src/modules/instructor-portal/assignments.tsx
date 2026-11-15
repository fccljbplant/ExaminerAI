"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";
import {
  assignmentStatusChip,
  type ReconciledAssignmentRow,
} from "@/modules/submission/lib/instructor-assignments";

/**
 * modules/instructor-portal — Assignments & Events
 *
 * Assignments are created in the CANONICAL `Assignment` store
 * (/api/v2/instructor/assignments), so they flow end-to-end: learners
 * see them, submit against them, and they arrive in the review queue.
 * Legacy `GroupTask` rows are reconciled into the same list through the
 * verified read-time mapping — badged "Legacy" so provenance is always
 * visible (COMBINED-AUDIT fixation 2; no parallel writes, nothing
 * dropped). Class events (create / delete) are unchanged.
 */

interface Course {
  id: string;
  name: string;
  isActive: boolean;
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
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // assignment form — title/description/due/week/maxScore go to the
  // canonical store; the old "type" select had no canonical column and
  // was write-only data, so it is gone.
  const [tTitle, setTTitle] = useState("");
  const [tDescription, setTDescription] = useState("");
  const [tDue, setTDue] = useState("");
  const [tWeek, setTWeek] = useState("1");
  const [tMax, setTMax] = useState("100");

  // event form
  const [eTitle, setETitle] = useState("");
  const [eType, setEType] = useState("deadline");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eLoc, setELoc] = useState("");

  const listPath = courseId
    ? `/api/v2/instructor/assignments?courseId=${courseId}`
    : null;
  const {
    data: listData,
    error: listError,
    isLoading,
    retry: reloadList,
  } = useApi<{ items: ReconciledAssignmentRow[] }>(listPath);
  const assignments = listData?.items ?? null;

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

  const loadEvents = useCallback(async (cid: string) => {
    if (!cid) return;
    setEventError(null);
    try {
      const e = await fetch(`/api/events?courseId=${cid}`).then((r) => r.json());
      setEvents((e as { events: CalEvent[] }).events ?? []);
    } catch (err) {
      setEvents([]);
      setEventError(err instanceof Error ? err.message : "Failed to load events");
    }
  }, []);

  useEffect(() => {
    if (courseId) void loadEvents(courseId);
  }, [courseId, loadEvents]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/v2/instructor/assignments", {
        courseId,
        title: tTitle.trim(),
        description: tDescription.trim() || undefined,
        dueDate: tDue || undefined,
        week: Number(tWeek) || undefined,
        maxScore: Number(tMax) || undefined,
      });
      toast.success("Assignment published — learners can see it now");
      setTTitle("");
      setTDescription("");
      reloadList();
    } catch (err) {
      toast.error("Couldn't create assignment", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  async function setCanonicalStatus(row: ReconciledAssignmentRow, status: "published" | "archived") {
    setBusy(true);
    try {
      await api.patch("/api/v2/instructor/assignments", {
        assignmentId: row.id,
        status,
      });
      toast.success(status === "archived" ? "Assignment archived" : "Assignment published");
      reloadList();
    } catch (err) {
      toast.error("Couldn't update assignment", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCanonical(row: ReconciledAssignmentRow) {
    if (
      !window.confirm(
        `Delete "${row.title}"? Assignments with submissions are protected — archive those instead.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.del("/api/v2/instructor/assignments", { assignmentId: row.id });
      toast.success("Assignment deleted");
      reloadList();
    } catch (err) {
      // 409 carries the server's "has N submissions — archive instead".
      toast.error("Couldn't delete assignment", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  /** Legacy GroupTask rows keep their v1 actions (close/delete). */
  async function closeLegacy(row: ReconciledAssignmentRow) {
    setBusy(true);
    try {
      await api.patch("/api/group-tasks", { taskId: row.id, status: "closed" });
      toast.success("Legacy task closed");
      reloadList();
    } catch (err) {
      toast.error("Couldn't close legacy task", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteLegacy(row: ReconciledAssignmentRow) {
    if (!window.confirm(`Delete legacy task "${row.title}" and its submissions?`)) return;
    setBusy(true);
    try {
      await api.del("/api/group-tasks", { taskId: row.id });
      toast.success("Legacy task deleted");
      reloadList();
    } catch (err) {
      toast.error("Couldn't delete legacy task", {
        description: err instanceof Error ? err.message : "",
      });
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
      void loadEvents(courseId);
    } catch (err) {
      toast.error("Couldn't create event", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(eventId: string) {
    setBusy(true);
    try {
      await api.del("/api/events", { eventId });
      toast.success("Event deleted");
      void loadEvents(courseId);
    } catch (err) {
      toast.error("Couldn't delete event", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setBusy(false);
    }
  }

  const hasLegacy = (assignments ?? []).some((r) => r.legacy);

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Courses &amp; assignments</h1>

      <label className="flex items-center gap-2 text-sm text-fg">
        <span className="text-fg-muted">Course</span>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          aria-label="Select course"
          className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* assignments — canonical store + reconciled legacy rows */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Assignments
          </h2>
          <form onSubmit={createAssignment} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              required
              placeholder="Assignment title"
              aria-label="Assignment title"
              className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            />
            <textarea
              value={tDescription}
              onChange={(e) => setTDescription(e.target.value)}
              placeholder="What should learners do? (optional)"
              aria-label="Assignment description"
              rows={2}
              maxLength={4000}
              className="min-h-11 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            />
            <div className="flex flex-wrap gap-2">
              <input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} aria-label="Due date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" />
              <select value={tWeek} onChange={(e) => setTWeek(e.target.value)} aria-label="Week" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
              <input type="number" value={tMax} onChange={(e) => setTMax(e.target.value)} aria-label="Max score" className="h-11 w-24 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" />
              <button
                type="submit"
                disabled={busy || !tTitle.trim() || !courseId}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Publish
              </button>
            </div>
          </form>

          {listError ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
              {listError}
              <button type="button" onClick={reloadList} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </button>
            </div>
          ) : assignments === null && isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
          ) : (assignments ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-5 text-center text-sm text-fg-muted">
              No assignments yet for this course — publish the first one above and learners
              will see it instantly.
            </p>
          ) : (
            <>
              {hasLegacy && (
                <p className="px-1 text-[11px] leading-relaxed text-fg-muted">
                  Rows badged <span className="font-semibold">Legacy</span> were created in
                  the previous assignments tool. They stay visible here but are not part of
                  the learner submission flow.
                </p>
              )}
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {(assignments ?? []).map((t) => {
                  const chip = assignmentStatusChip(t);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg">
                          <span className="truncate">{t.title}</span>
                          <span
                            className={
                              chip.tone === "active"
                                ? "shrink-0 rounded-full bg-brand-subtle px-1.5 py-0.5 text-[10px] font-semibold text-brand"
                                : "shrink-0 rounded-full bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted"
                            }
                          >
                            {chip.label}
                          </span>
                        </p>
                        <p className="truncate text-xs text-fg-muted">
                          due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          {t.week ? ` · week ${t.week}` : ""} · {t.maxScore} pts ·{" "}
                          {t.submissionCount} submission{t.submissionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      {t.legacy ? (
                        // legacy rows keep their v1 close action
                        t.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => void closeLegacy(t)}
                            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-medium text-fg-secondary hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                          >
                            Close
                          </button>
                        )
                      ) : (
                        // canonical rows: archive/unarchive
                        <button
                          type="button"
                          onClick={() =>
                            void setCanonicalStatus(t, t.status === "archived" ? "published" : "archived")
                          }
                          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-fg-secondary hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                        >
                          {t.status === "archived" ? (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Publish
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void (t.legacy ? deleteLegacy(t) : deleteCanonical(t))}
                        aria-label={`Delete ${t.title}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-danger focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
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
              className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            />
            <div className="flex flex-wrap gap-2">
              <select value={eType} onChange={(e) => setEType(e.target.value)} aria-label="Event type" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                {["deadline", "exam", "meeting", "vocational", "holiday", "other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} required aria-label="Start date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" />
              <input type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} aria-label="End date" className="h-11 rounded-lg border border-line bg-bg px-2 text-sm text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" />
              <input value={eLoc} onChange={(e) => setELoc(e.target.value)} placeholder="Location" aria-label="Location" className="h-11 w-28 rounded-lg border border-line bg-bg px-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" />
              <button
                type="submit"
                disabled={busy || !eTitle.trim() || !eStart || !courseId}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Add
              </button>
            </div>
          </form>
          {eventError ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
              {eventError}
              <button type="button" onClick={() => void loadEvents(courseId)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </button>
            </div>
          ) : events === null ? (
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
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-danger focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
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
