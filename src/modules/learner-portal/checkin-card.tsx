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
  const [showHistory, setShowHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadHistory() {
    setShowHistory((v) => {
      if (!v) {
        setHistory(null);
        fetch("/api/daily-logs" + (courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""))
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { logs?: typeof history } | null) => setHistory(d?.logs ?? []))
          .catch(() => setHistory([]));
      }
      return !v;
    });
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
      <section
        aria-label="Daily check-in"
        className="rounded-xl border border-success-subtle bg-success-subtle p-4"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-success-on">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Checked in — see you tomorrow!
        </p>
      </section>
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
            A quick update for your mentor — takes 20 seconds.
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
        onClick={() => void loadHistory()}
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
          {history === null ? (
            <p className="py-2 text-xs text-fg-muted" aria-busy="true">Loading…</p>
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
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
            <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Confidence">
              {CONFIDENCE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={confidence === c.value}
                  onClick={() => setConfidence(c.value)}
                  className={cn(
                    "min-h-11 flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    confidence === c.value
                      ? "border-brand bg-brand-subtle text-fg"
                      : "border-line bg-bg-subtle text-fg-secondary hover:border-line-strong"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            required
            placeholder="What did you work on today?"
            aria-label="What did you work on today?"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            Save check-in
          </button>
        </form>
      )}
    </section>
  );
}
