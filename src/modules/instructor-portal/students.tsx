"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search, UserRound } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — I5 Students roster (REDESIGN-P3 §I5, W6)
 *
 * Roster of students in the instructor's courses (GET /api/v2/instructor/
 * students — scoped by CourseEnrollment, enriched with attention
 * signals). Search + at-risk filter chips; rows show progress and the
 * top risk reason. Drill-down (I6) lands with the student-profile
 * workstream.
 */

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  attentionScore: number;
  attentionReasons: string[];
  progress: number;
  latestScore: number | null;
  lastCheckIn: string | null;
}

interface StudentsData {
  items: RosterStudent[];
  total: number;
}

export function StudentsRoster() {
  const [q, setQ] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (onlyRisk) params.set("risk", "1");
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    return `/api/v2/instructor/students${qs ? `?${qs}` : ""}`;
  }, [q, onlyRisk]);

  const { data, error, isLoading, retry } = useApi<StudentsData>(path);

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-fg md:text-xl">Students</h1>
          <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-fg-secondary">
            {data?.total ?? 0}
          </span>
        </div>

        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students"
            aria-label="Search students"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
        </label>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setOnlyRisk(false)}
            aria-pressed={!onlyRisk}
            className={
              !onlyRisk
                ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-on-brand"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong"
            }
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setOnlyRisk(true)}
            aria-pressed={onlyRisk}
            className={
              onlyRisk
                ? "rounded-full bg-warning px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong"
            }
          >
            At risk
          </button>
        </div>
      </header>

      {isLoading ? (
        <RosterSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load students</p>
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
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <UserRound className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">
            {onlyRisk ? "No at-risk students" : "No students match your search"}
          </p>
          <p className="max-w-sm text-xs text-fg-muted">
            {onlyRisk ? "Everyone is on track — nice work." : "Try clearing the search or the filter."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((s) => (
            <div key={s.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                <UserRound className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                <p className="mt-0.5 truncate text-xs text-fg-muted">
                  {s.attentionReasons[0] ?? "On track"}
                </p>
              </div>
              <div className="hidden w-24 shrink-0 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${s.progress}%` }} />
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-fg-muted">{s.progress}%</p>
              </div>
              {s.attentionScore >= 30 ? (
                <span className="shrink-0 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-on">
                  {s.attentionScore} pts
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-on">
                  OK
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterSkeleton() {
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
