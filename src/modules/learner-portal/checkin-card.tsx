"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, History, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * modules/learner-portal — CheckInCard (V1 CheckInPanel re-homed)
 *
 * Daily stand-up on the learner home: how today went + confidence.
 * One check-in per day (server upserts). Feeds the instructor's
 * engagement view + attention signals. Phase-1 compliant — no psych
 * scoring, just self-reported confidence + what-did-you-do.
 */

const CONFIDENCE = [
  { value: 1, label: "Lost" },
  { value: 2, label: "Struggling" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export function CheckInSavedState({ onEdit }: { onEdit: () => void }) {
  return (
    <section
      aria-label="Daily check-in"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-subtle bg-success-subtle p-4"
    >
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-success-on">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Today's check-in is saved for this course.
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 rounded-lg border border-success-on/20 px-3 text-sm font-semibold text-success-on hover:bg-success-on/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Edit check-in
      </button>
    </section>
  );
}

export function CheckInCard({ courseId }: { courseId?: string }) {
  const [open, setOpen] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !note.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v2/learn/checkin", {
        courseId,
        whatDidYouDo: note.trim(),
        confidence,
      });
      setDone(true);
      toast.success("Check-in saved", { description: "Your instructor can see today's update." });
    } catch (err) {
      toast.error("Couldn't save check-in", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const [history, setHistory] = useState<Array<{ id: string; date: string; whatDidYouDo: string; confidence: number | null }> | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshHistory() {
    setHistory(null);
    setHistoryError(null);
    try {
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
      const response = await fetch(`/api/daily-logs${query}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("History is temporarily unavailable");
      const payload = (await response.json()) as { logs?: unknown };
      if (!Array.isArray(payload.logs)) throw new Error("History response was invalid");
      setHistory(payload.logs as Array<{ id: string; date: string; whatDidYouDo: string; confidence: number | null }>);
    } catch {
      // An unavailable history is not an empty history. Keep the retry visible.
      setHistoryError("We couldn't load your check-in history. Try again.");
    }
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) void refreshHistory();
  }

  async function removeLog(id: string) {
    setDeletingId(id);
    try {
      await api.del(`/api/daily-logs/${id}`);
      toast.success("Check-in deleted");
      setHistory((h) => h?.filter((l) => l.id !== id) ?? h);
    } catch (err) {
      toast.error("Couldn't delete check-in", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (done) {
    return (
      <CheckInSavedState onEdit={() => { setDone(false); setOpen(true); }} />
    );
  }

  return (
    <section aria-label="Daily check-in" className="rounded-xl border border-line bg-surface p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-fg">Daily check-in</span>
          <span className="block text-xs text-fg-muted">
            Share a brief learning update with your instructor.
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-fg-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {/* history (v1 CheckInPanel recent logs) */}
      <button
        type="button"
        onClick={toggleHistory}
        aria-expanded={showHistory}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-fg-secondary">
          <History className="h-3.5 w-3.5" aria-hidden />
          Recent check-ins
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-fg-muted transition-transform", showHistory && "rotate-180")}
          aria-hidden
        />
      </button>

      {showHistory && (
        <div className="space-y-1.5 border-t border-line pt-2">
          {historyError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 py-2" role="alert">
              <p className="text-xs text-danger">{historyError}</p>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Try again
              </button>
            </div>
          ) : history === null ? (
            <p className="py-2 text-xs text-fg-muted" role="status" aria-busy="true">Loading check-ins…</p>
          ) : history.length === 0 ? (
            <p className="py-2 text-xs text-fg-muted">No check-ins yet.</p>
          ) : (
            history.slice(0, 7).map((l) => (
              <div key={l.id} className="flex items-start gap-2 rounded-lg bg-bg-subtle px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-muted">
                    {new Date(l.date).toLocaleDateString()}
                    {l.confidence != null ? ` · ${l.confidence}/5` : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-fg">{l.whatDidYouDo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeLog(l.id)}
                  disabled={deletingId === l.id}
                  aria-label={`Delete check-in from ${new Date(l.date).toLocaleDateString()}`}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {deletingId === l.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 border-t border-line pt-3">
          <fieldset>
            <legend className="text-xs font-medium text-fg-secondary">How did it go today?</legend>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {CONFIDENCE.map((c) => (
                <label key={c.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="daily-checkin-confidence"
                    value={c.value}
                    checked={confidence === c.value}
                    onChange={() => setConfidence(c.value)}
                    className="peer sr-only"
                  />
                  <span className={cn(
                    "flex min-h-11 items-center justify-center rounded-lg border px-1.5 py-2 text-center text-xs font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                    confidence === c.value
                      ? "border-brand bg-brand-subtle text-fg"
                      : "border-line bg-bg-subtle text-fg-secondary hover:border-line-strong"
                  )}>
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="daily-checkin-note" className="text-xs font-medium text-fg-secondary">
            What did you work on today?
          </label>
          <textarea
            id="daily-checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder="Share a short learning update…"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          />
          <p className="text-right text-xs text-fg-muted">{note.length}/2,000</p>
          <button
            type="submit"
            disabled={saving || !courseId || !note.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {saving ? "Saving check-in…" : "Save check-in"}
          </button>
        </form>
      )}
    </section>
  );
}
