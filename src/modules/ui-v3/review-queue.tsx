"use client";

// src/modules/ui-v3/review-queue.tsx — V3 Review Queue content.
// Full v3 restyle of v2 ReviewQueue (instructor-portal/review-queue.tsx,
// 163 lines). Same /api/v2/review/queue endpoint + status filter chips.
// Replaces Tailwind utilities with v3 design tokens.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApi } from "./use-api";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateError, StateSkeleton } from "./states";

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

function statusBadge(status: string): { label: string; variant: "primary" | "success" | "warning" } {
  if (status === "changes_requested") return { label: "Returned", variant: "warning" };
  if (status === "in_review") return { label: "In review", variant: "primary" };
  if (status === "resubmitted") return { label: "Resubmitted", variant: "primary" };
  return { label: "Submitted", variant: "primary" };
}

function timeAgo(value?: string | null): string {
  if (!value) return "—";
  try {
    const diff = Date.now() - new Date(value).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return "—";
  }
}

export function V3ReviewQueue() {
  const [status, setStatus] = useState<string>("");

  const path = useMemo(
    () => `/api/v2/review/queue${status ? `?status=${status}` : ""}`,
    [status],
  );

  const { data, error, loading, retry } = useApi<QueueData>(path);

  return (
    <>
      <V3PageHeader
        title="Review queue"
        subtitle="Submissions waiting for your review across all courses you teach."
      />

      {/* Status filter chips */}
      <div className="v3-filter-row" style={{ marginBottom: "var(--p-space-5)" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            aria-pressed={status === f.key}
            className={`v3-chip-btn ${status === f.key ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <StateSkeleton cards={4} />
      ) : error ? (
        <StateError message={error} onRetry={retry} />
      ) : data && data.items.length === 0 ? (
        <V3Card className="v3-empty">
          <h3>Queue is clear</h3>
          <p>Submissions waiting for review will show up here.</p>
        </V3Card>
      ) : data ? (
        <V3Card style={{ padding: 0 }}>
          {data.items.map((item) => {
            const badge = statusBadge(item.status);
            return (
              <Link
                key={item.submissionId}
                href={`/instructor/review/${item.submissionId}`}
                className="v3-course-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="v3-course-icon" aria-hidden>👤</div>
                <div className="v3-course-info">
                  <strong>{item.learnerName}</strong>
                  <small>
                    {item.assignmentTitle}
                    {item.courseName ? ` · ${item.courseName}` : ""}
                    {item.cycle > 1 ? ` · cycle ${item.cycle}` : ""}
                    {item.submittedAt ? ` · ${timeAgo(item.submittedAt)}` : ""}
                  </small>
                </div>
                {item.score != null && (
                  <span style={{
                    fontSize: "var(--p-type-sm)",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}>
                    {item.score}%
                  </span>
                )}
                <V3Badge variant={badge.variant}>{badge.label}</V3Badge>
              </Link>
            );
          })}
        </V3Card>
      ) : null}
    </>
  );
}
