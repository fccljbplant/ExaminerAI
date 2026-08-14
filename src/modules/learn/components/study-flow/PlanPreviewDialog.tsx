"use client";

// modules/learn/components/study-flow/PlanPreviewDialog.tsx — L12 option → preview → confirm.

import type { PlanItem } from "@/modules/learn/contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/dialog";

/**
 * Plan preview modal (REDESIGN-P3 §L12): every scenario option opens this
 * first so the learner sees exactly what they're committing to before the
 * plan replaces Today's plan. Confirm is the only positive action — the
 * X / Cancel both bail out with no side effects.
 */

interface PlanPreviewDialogProps {
  open: boolean;
  title: string;
  description: string;
  items: PlanItem[];
  totalMin: number;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function PlanPreviewDialog({
  open,
  title,
  description,
  items,
  totalMin,
  confirmLabel = "Start this plan",
  busy = false,
  onConfirm,
  onOpenChange,
}: PlanPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="rounded-lg bg-bg-subtle p-3 text-sm text-fg-muted">
            This option has nothing scheduled right now — you&apos;re all caught
            up. Try another option or start from today&apos;s plan.
          </p>
        ) : (
          <ol className="max-h-64 space-y-1.5 overflow-y-auto">
            {items.map((item, i) => (
              <li
                key={`${i}-${item.title}`}
                className={
                  item.isBreak
                    ? "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 opacity-70"
                    : "flex items-center justify-between gap-3 rounded-lg bg-bg-subtle px-2 py-1.5"
                }
              >
                <span className="min-w-0 truncate text-sm text-fg">{item.title}</span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-fg-secondary">
                  {item.estMin}m
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="text-right text-xs tabular-nums text-fg-muted">
          Total: {totalMin} min
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || items.length === 0}
            className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Confirming…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
