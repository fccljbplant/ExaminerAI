"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, ClipboardList, Clock, Search, SearchX, Sparkles, Star } from "lucide-react";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L2 Catalog (REDESIGN-P3 §L2)
 *
 * Search + category chips + level filter over GET /api/v2/courses.
 * Enrolled courses pin first (server sorts). Cards link to L3 detail.
 * xs 1-col · md 2-col · xl 3-col. Empty search → clear-filters CTA.
 */

/* ---------------- payload types (mirror GET /api/v2/courses) ---------- */

interface CourseItem {
  id: string;
  name: string;
  subtitle: string | null;
  description: string;
  category: string;
  level: string;
  durationWeeks: number;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  thumbnailUrl: string | null;
  featured: boolean;
  enrolled: boolean;
  progress: { week: number; day: number } | null;
}

interface CatalogData {
  items: CourseItem[];
  categories: string[];
}

/* ---------------- page ------------------------------------------------ */

export function LearnerCatalog() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");

  // Debounce the search box (300ms) into the request path.
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (level) params.set("level", level);
    const qs = params.toString();
    return `/api/v2/courses${qs ? `?${qs}` : ""}`;
  }, [q, category, level]);

  const { data, error, isLoading, retry } = useApi<CatalogData>(path);

  const hasFilters = Boolean(q || category || level);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-fg md:text-xl">Courses</h1>
          {/* L5 Assignments entry — keeps the 5-tab rule intact; the
              assignments workspace hangs off the Learn tab. */}
          <Link
            href="/learner/practice"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <Sparkles className="h-4 w-4 text-fg-muted" aria-hidden />
            Practice
          </Link>
          <Link
            href="/learner/assignments"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <ClipboardList className="h-4 w-4 text-fg-muted" aria-hidden />
            Assignments
          </Link>
        </div>

        {/* search + level filter row */}
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
              aria-hidden
            />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search courses"
              aria-label="Search courses"
              className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            aria-label="Filter by level"
            className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* category chips */}
        {data && data.categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip label="All" active={category === ""} onClick={() => setCategory("")} />
            {data.categories.map((c) => (
              <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)} />
            ))}
          </div>
        )}
      </header>

      {isLoading ? (
        <CatalogSkeleton />
      ) : error ? (
        <CatalogError message={error} onRetry={retry} />
      ) : data && data.items.length === 0 ? (
        <NoMatches
          hasFilters={hasFilters}
          onClear={() => {
            setInput("");
            setCategory("");
            setLevel("");
          }}
        />
      ) : data ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------------- pieces ------------------------------------------------ */

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-xs font-semibold capitalize transition-colors " +
        (active
          ? "border-transparent bg-brand text-on-brand"
          : "border-line bg-surface text-fg-secondary hover:bg-bg-subtle")
      }
    >
      {label}
    </button>
  );
}

function CourseCard({ course }: { course: CourseItem }) {
  return (
    <li>
      <Link
        href={`/learner/courses/${course.id}`}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
      >
        {/* thumbnail / fallback */}
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-brand-subtle">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-fg-muted">
              <BookOpen className="h-8 w-8" aria-hidden />
            </span>
          )}
          {course.enrolled && (
            <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-on-brand">
              Enrolled
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <h2 className="text-sm font-semibold leading-snug text-fg">{course.name}</h2>
            {course.subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{course.subtitle}</p>}
          </div>

          {/* meta chips */}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span className="capitalize">{course.category}</span>
            <span aria-hidden>·</span>
            <span className="capitalize">{course.level}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {course.durationWeeks}w
            </span>
            {course.rating > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="h-3 w-3" aria-hidden />
                  {course.rating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {course.enrolled && course.progress && (
            <p className="rounded-lg bg-bg-subtle px-3 py-2 text-xs font-medium text-fg-secondary">
              Week {course.progress.week} · Day {course.progress.day} — continue where you left off
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

/* ---------------- states ------------------------------------------------ */

function CatalogSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
      ))}
    </ul>
  );
}

function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load the catalog</p>
      <p className="mt-1 text-xs text-fg-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
      >
        Retry
      </button>
    </div>
  );
}

function NoMatches({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
      <SearchX className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">No matching courses</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        {hasFilters
          ? "Try different keywords or drop a filter."
          : "Nothing is published in the catalog yet — check back soon."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
