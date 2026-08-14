"use client";

// modules/learn/components/study-flow/SrsQueueCard.tsx — L12 SRS review queue.

import { useState } from "react";
import { Repeat, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SrsCard } from "@/modules/learn/contracts";
import { ListCard, ListCardRow } from "@/modules/ui/list-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/dialog";

/**
 * SRS review queue (REDESIGN-P3 §L12). Lists due cards with "due" chips;
 * "Review now" opens the self-rating runner (Again / Hard / Good / Easy →
 * score bands consumed by `srsSchedule`). Reviewed cards drop off the
 * queue locally — the next real due date comes back from the server.
 */

const RATING_SCORES = [
  { label: "Again", score: 30, hint: "Couldn't recall" },
  { label: "Hard", score: 55, hint: "Recalled with effort" },
  { label: "Good", score: 80, hint: "Recalled fine" },
  { label: "Easy", score: 95, hint: "Instant recall" },
] as const;

interface ReviewResponse {
  dueAt: string;
  interval: number;
  ease: "again" | "hard" | "good" | "easy";
  mastered?: boolean;
}

function dueLabel(dueAt: string): string {
  const days = Math.floor((Date.now() - new Date(dueAt).getTime()) / 86_400_000);
  if (days <= 0) return "due now";
  if (days === 1) return "1d overdue";
  return `${days}d overdue`;
}

interface SrsQueueCardProps {
  cards: SrsCard[];
  onQueueChange: (cards: SrsCard[]) => void;
}

export function SrsQueueCard({ cards, onQueueChange }: SrsQueueCardProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const card = cards[index];

  function openRunner() {
    setIndex(0);
    setLastResult(null);
    setError(null);
    setOpen(true);
  }

  async function rate(score: number) {
    if (!card) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ ok: boolean; data: ReviewResponse }>(
        `/api/v2/srs/${card.id}/review`,
        { score },
      );
      setLastResult(res.data);
      // Remove the reviewed card locally so the queue visibly shrinks.
      onQueueChange(cards.filter((c) => c.id !== card.id));
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed — try again");
    } finally {
      setSubmitting(false);
    }
  }

  const doneWithQueue = cards.length === 0;

  return (
    <>
      <ListCard
        header={
          <span>
            Review queue{" "}
            <span className="normal-case text-fg-muted">({cards.length} due)</span>
          </span>
        }
      >
        {doneWithQueue ? (
          <div className="flex items-center gap-3 px-4 py-5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
            <div>
              <p className="text-sm font-medium text-fg">All caught up!</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                Nothing to review right now — we&apos;ll queue cards as they
                come due.
              </p>
            </div>
          </div>
        ) : (
          <>
            {cards.slice(0, 4).map((c) => (
              <ListCardRow
                key={c.id}
                leading={
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                    <Repeat className="h-4 w-4" aria-hidden />
                  </span>
                }
                title={c.topic}
                meta={`${c.attempts} attempt${c.attempts === 1 ? "" : "s"}`}
                trailing={
                  <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning-on">
                    {dueLabel(c.dueAt.toISOString())}
                  </span>
                }
              />
            ))}
            {cards.length > 4 && (
              <ListCardRow
                title={`${cards.length - 4} more…`}
                meta="Review now to see them all"
              />
            )}
            <div className="p-3">
              <button
                type="button"
                onClick={openRunner}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <Repeat className="h-4 w-4" aria-hidden />
                Review now ({cards.length})
              </button>
            </div>
          </>
        )}
      </ListCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {card ? "How well did you know it?" : "Review complete"}
            </DialogTitle>
          </DialogHeader>

          {card ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {card.topic}
                </p>
                <p className="mt-1 text-sm text-fg-secondary">
                  Think of the answer first — then rate yourself honestly.
                  The schedule adapts either way.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {RATING_SCORES.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    disabled={submitting}
                    onClick={() => void rate(r.score)}
                    className="rounded-lg border border-line bg-bg p-3 text-left transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-sm font-semibold text-fg">{r.label}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{r.hint}</p>
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full text-center text-xs font-semibold text-fg-muted transition-colors hover:text-fg"
              >
                Stop reviewing for now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-fg-secondary">
                {lastResult
                  ? `Next review in about ${lastResult.interval} day${lastResult.interval === 1 ? "" : "s"}.${lastResult.mastered ? " This card is mastered — great work!" : ""}`
                  : "All reviews done for now."}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover sm:w-auto"
              >
                Done
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
