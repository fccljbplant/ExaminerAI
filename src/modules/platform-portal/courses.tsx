"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Loader2, RefreshCw, Star } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";
import { cn } from "@/lib/utils";

/**
 * modules/platform-portal — Courses (W16: V1 CourseManagementPanel
 * restored on the v2 stack)
 *
 * Every course with enrollment + test stats; publish / feature /
 * activate toggles. PATCH /api/v2/platform/courses (audited).
 */

interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  level: string | null;
  isActive: boolean;
  published: boolean;
  featured: boolean;
  weeks: number;
  learners: number;
  instructors: number;
  completedTests: number;
  createdAt: string;
}

export function PlatformCourses() {
  const { data, error, isLoading, retry } = useApi<{ courses: CourseRow[] }>(
    "/api/v2/platform/courses",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function toggle(c: CourseRow, field: "published" | "featured" | "isActive") {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/v2/platform/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, [field]: !c[field] }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Update failed");
      toast.success(`${c.name} updated`);
      retry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />;
  if (error || !data) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
        {error}
        <button type="button" onClick={retry} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  const rows = data.courses.filter((c) =>
    !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Courses</h1>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search courses…"
        aria-label="Search courses"
        className="h-11 w-full max-w-sm rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-muted">
          No courses match.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((c) => (
            <div key={c.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                <BookOpen className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  <span className="truncate">{c.name}</span>
                  {c.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-warning-on">
                      <Star className="h-2.5 w-2.5" aria-hidden /> Featured
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {c.weeks} weeks · {c.learners} learners · {c.instructors} instructors ·{" "}
                  {c.completedTests} tests completed
                  {c.domain ? ` · ${c.domain}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Toggle
                  label={c.published ? "Published" : "Unpublished"}
                  on={c.published}
                  busy={busyId === c.id}
                  onClick={() => toggle(c, "published")}
                />
                <Toggle
                  label={c.featured ? "Featured" : "Feature"}
                  on={c.featured}
                  busy={busyId === c.id}
                  onClick={() => toggle(c, "featured")}
                />
                <Toggle
                  label={c.isActive ? "Active" : "Inactive"}
                  on={c.isActive}
                  busy={busyId === c.id}
                  onClick={() => toggle(c, "isActive")}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  busy,
  onClick,
}: {
  label: string;
  on: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
        on
          ? "bg-brand-subtle text-brand"
          : "border border-line bg-bg-subtle text-fg-muted hover:border-line-strong hover:text-fg"
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}
