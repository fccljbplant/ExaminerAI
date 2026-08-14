"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, RefreshCw, UserRound } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — I3 Review queue (REDESIGN-P3 §I3, W4 review side)
 *
 * The instructor's grading queue: submissions in active review states,
 * scoped to courses they teach. Chips filter by status; rows link to the
 * I4 review detail. States: skeleton / error+retry / empty.
 */

/* ---------------- payload types (mirror GET /api/v2/review/queue) ------- */

interface QueueItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseName: string | null;
  learnerId: string;
  learnerName: string;
  status: string;
  cycle: number;
  score: number | null;
  submittedAt: string | null;
  partTypes: string[];
  milestoneLabel: string | null;
}

interface QueueData {
  items: QueueItem[];
  nextCursor: string | null;
}

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In review" },
  { key: "resubmitted", label: "Resubmitted" },
  { key: "changes_requested", label: "Returned" },
] as const;

const STATUS_META: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Submitted", tone: "bg-info-subtle text-info-on" },
  in_review: { label: "In review", tone: "bg-info-subtle text-info-on" },
  resubmitted: { label: "Resubmitted", tone: "bg-info-subtle text-info-on" },
  changes_requested: { label: "Returned", tone: "bg-warning-subtle text-warning-on" },
};

export function ReviewQueue() {
  const [status, setStatus] = useState<string>("");

  const path = useMemo(
    () => `/api/v2/review/queue${status ? `?status=${status}` : ""}`,
    [status],
  );

  const { data, error, isLoading, retry } = useApi<QueueData>(path);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Review queue</h1>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              aria-pressed={status === f.key}
              className={
                status === f.key
                  ? "shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-on-brand"
                  : "shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong hover:text-fg"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <QueueSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load the queue</p>
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
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <ClipboardList className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">Queue is clear</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Submissions waiting for review will show up here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data?.items.map((item) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.submitted;
            return (
              <Link
                key={item.submissionId}
                href={`/instructor/review/${item.submissionId}`}
                className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{item.learnerName}</p>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {item.assignmentTitle}
                    {item.courseName ? ` · ${item.courseName}` : ""}
                    {item.cycle > 1 ? ` · cycle ${item.cycle}` : ""}
                  </p>
                </div>
                {item.score != null && (
                  <span className="hidden shrink-0 text-sm font-medium tabular-nums text-fg-secondary sm:block">
                    {item.score}%
                  </span>
                )}
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
                  {meta.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-bg-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-bg-subtle" />
            <div className="h-3 w-2/3 rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
