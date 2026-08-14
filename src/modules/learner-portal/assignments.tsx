"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, RefreshCw } from "lucide-react";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L5 Assignments (REDESIGN-P3 §L5)
 *
 * Learner's own assignments as a ListCard stack with status filter
 * chips (sheet on xs → inline chips here; the list itself is the xs
 * table). Rows link to the L6 submission flow. States: skeleton /
 * error+retry / empty.
 */

/* ---------------- payload types (mirror GET /api/v2/assignments) ------- */

interface AssignmentItem {
  id: string;
  courseId: string;
  courseName: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  week: number | null;
  maxScore: number;
  requiredTypes: string[];
  milestoneLabel: string | null;
  submissionId: string | null;
  status: string | null;
  cycle: number | null;
  score: number | null;
  submittedAt: string | null;
  hasDraft: boolean;
}

interface AssignmentsData {
  items: AssignmentItem[];
  nextCursor: string | null;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "in_review", label: "In review" },
  { key: "returned", label: "Returned" },
  { key: "graded", label: "Graded" },
] as const;

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "info" | "muted" }> = {
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "Submitted", tone: "info" },
  in_review: { label: "In review", tone: "info" },
  resubmitted: { label: "Resubmitted", tone: "info" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  signed_off: { label: "Signed off", tone: "success" },
};

const TONE_CLASSES: Record<(typeof STATUS_META)[string]["tone"], string> = {
  success: "bg-success-subtle text-success-on",
  warning: "bg-warning-subtle text-warning-on",
  info: "bg-info-subtle text-info-on",
  muted: "bg-bg-subtle text-fg-muted",
};

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  return `Due ${new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/* ---------------- page ------------------------------------------------ */

export function LearnerAssignments() {
  const [filter, setFilter] = useState<string>("all");

  const path = useMemo(
    () => `/api/v2/assignments${filter !== "all" ? `?status=${filter}` : ""}`,
    [filter],
  );

  const { data, error, isLoading, retry } = useApi<AssignmentsData>(path);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Assignments</h1>

        {/* status filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={
                filter === f.key
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
        <Skeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-fg-secondary">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-subtle px-4 text-sm font-medium text-fg hover:border-line-strong"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <ClipboardList className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No assignments here</p>
          <p className="max-w-sm text-xs text-fg-muted">
            {filter === "all"
              ? "Assignments from your courses will show up here."
              : "Nothing matches this filter — try another one."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data?.items.map((a) => {
            const meta = STATUS_META[a.status ?? ""];
            return (
              <Link
                key={a.id}
                href={`/learner/assignments/${a.id}`}
                className="group flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{a.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-fg-muted">
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">
                      {a.courseName ?? "Course"} · {dueLabel(a.dueDate)}
                      {a.cycle != null && a.cycle > 1 ? ` · cycle ${a.cycle}` : ""}
                    </span>
                  </p>
                </div>
                {a.score != null && (
                  <span className="hidden shrink-0 text-sm font-medium tabular-nums text-fg-secondary sm:block">
                    {a.score}/{a.maxScore}
                  </span>
                )}
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                    TONE_CLASSES[meta?.tone ?? "muted"]
                  }`}
                >
                  {meta?.label ?? "Not started"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse space-y-2 px-4 py-3">
          <div className="h-3.5 w-2/3 rounded bg-bg-subtle" />
          <div className="h-3 w-1/3 rounded bg-bg-subtle" />
        </div>
      ))}
    </div>
  );
}
