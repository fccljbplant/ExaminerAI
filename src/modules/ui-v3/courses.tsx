"use client";

// src/modules/ui-v3/courses.tsx — V3-styled courses catalog.
// Renders inside the V3 shell (provided by layout). Purple/indigo primary,
// white cards with colored thumbnails, search + level + category chips.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApi } from "./use-api";
import { V3PageHeader, V3Progress } from "./v3-shell";

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

const THUMB_COLORS = ["", "green", "amber", "pink", "blue"];
const THUMB_INITIALS = ["∑", "⚛", "✦", "◉", "▲", "♦", "✿", "⬡"];

function colorForCourse(id: string, idx: number) {
  const i = (id.charCodeAt(0) || 0) % THUMB_COLORS.length;
  return THUMB_COLORS[i] || "";
}
function initialForCourse(name: string, idx: number) {
  if (!name) return "∑";
  const ch = name.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(ch) ? ch : THUMB_INITIALS[idx % THUMB_INITIALS.length];
}

export function V3CoursesCatalog() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");

  // Debounce search
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

  const { data, error, loading: isLoading, retry } = useApi<CatalogData>(path);
  // useApi now auto-unwraps the { ok, data } envelope — `data` here is
  // already the { items, categories } payload (or null on error/loading).
  const hasFilters = Boolean(q || category || level);

  return (
    <>
      <V3PageHeader
        title="Courses"
        subtitle="Browse the catalog and continue where you left off."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/learner/practice" className="v3-btn">✦ Practice</Link>
            <Link href="/learner/assignments" className="v3-btn">📋 Assignments</Link>
          </div>
        }
      />

      {/* Filter row */}
      <div className="v3-filter-row">
        <div className="v3-search-wrap">
          <span>🔍</span>
          <input
            className="v3-input search"
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search courses"
            aria-label="Search courses"
          />
        </div>
        <select
          className="v3-select"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="Filter by level"
        >
          <option value="">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {/* Category chips */}
      {data && Array.isArray(data.categories) && data.categories.length > 0 && (
        <div className="v3-filter-row" style={{ marginBottom: 18 }}>
          <button
            className={`v3-chip-btn ${category === "" ? "active" : ""}`}
            onClick={() => setCategory("")}
          >
            All
          </button>
          {data.categories.map((c) => (
            <button
              key={c}
              className={`v3-chip-btn ${category === c ? "active" : ""}`}
              onClick={() => setCategory(category === c ? "" : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* States */}
      {isLoading ? (
        <div className="v3-catalog-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="v3-skeleton v3-skeleton-card" />
          ))}
        </div>
      ) : error ? (
        <div className="v3-empty">
          <h3>Couldn&apos;t load the catalog</h3>
          <p>{error}</p>
          <button className="v3-btn v3-btn-primary" style={{ marginTop: 16 }} onClick={retry}>Retry</button>
        </div>
      ) : data && Array.isArray(data.items) && data.items.length === 0 ? (
        <div className="v3-empty">
          <h3>No matching courses</h3>
          <p>
            {hasFilters
              ? "Try different keywords or drop a filter."
              : "Nothing is published in the catalog yet — check back soon."}
          </p>
          {hasFilters && (
            <button
              className="v3-btn"
              style={{ marginTop: 16 }}
              onClick={() => { setInput(""); setCategory(""); setLevel(""); }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : data && Array.isArray(data.items) && data.items.length > 0 ? (
        <div className="v3-catalog-grid">
          {data.items.map((c, i) => (
            <Link key={c.id} href={`/learner/courses/${c.id}`} className="v3-course-card">
              <div className={`v3-course-thumb ${colorForCourse(c.id, i)}`}>
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initialForCourse(c.name, i)
                )}
                {c.enrolled && <span className="v3-enrolled-pill">Enrolled</span>}
                {c.featured && !c.enrolled && (
                  <span className="v3-enrolled-pill v3-featured-pill">★ Featured</span>
                )}
              </div>
              <div className="v3-course-body">
                <h3>{c.name}</h3>
                {c.subtitle && <p className="v3-course-sub">{c.subtitle}</p>}
                <div className="v3-course-meta">
                  <span className="v3-chip" style={{ textTransform: "capitalize" }}>{c.category}</span>
                  <span className="v3-chip" style={{ textTransform: "capitalize" }}>{c.level}</span>
                  <span>· {c.durationWeeks}w</span>
                  {c.rating > 0 && <span>· ★ {c.rating.toFixed(1)}</span>}
                </div>
                {c.enrolled && c.progress && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Week {c.progress.week} · Day {c.progress.day}</span>
                      <span>Continue →</span>
                    </div>
                    {/*
                      Progress estimate — uses durationWeeks so a 2-week
                      course at week 1 day 3 reads 33%, not 100%. Falls
                      back to 4-week denominator if durationWeeks is 0/null
                      (audit fix — was hardcoded to a 4-week shape).
                    */}
                    <V3Progress
                      value={Math.min(
                        100,
                        Math.round(
                          (((c.progress.week - 1) * 7 + c.progress.day) /
                            Math.max(1, (c.durationWeeks || 4) * 7)) * 100,
                        ),
                      )}
                    />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
