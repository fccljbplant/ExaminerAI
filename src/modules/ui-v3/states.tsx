"use client";

// src/modules/ui-v3/states.tsx — Shared loading / empty / error states
// for v3 content components. Built once in P0 item 5, reused everywhere
// afterward so no page hand-rolls its own state UI.
//
// All styling resolves through v2 semantic tokens (var(--bg), var(--text),
// var(--brand), etc.) — see v3-shell.tsx for the same convention.
//
// Usage:
//   const { data, loading, error, retry } = useApi<T>("/api/...");
//   if (loading) return <StateSkeleton cards={3} />;
//   if (error)   return <StateError message={error} onRetry={retry} />;
//   if (!data || data.length === 0)
//                 return <StateEmpty headline="No items" description="..." cta={<Link>...</Link>} />;

import type { ReactNode } from "react";

/**
 * Loading skeleton — a stack of N "card-shaped" skeletons with shimmer
 * animation. Count matches the final card count so there's no layout
 * shift when real data arrives.
 */
export function StateSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="v3-grid v3-grid-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="v3-skeleton v3-skeleton-card" />
      ))}
    </div>
  );
}

/**
 * Inline loading state for hero areas (single tall block).
 */
export function StateSkeletonHero() {
  return (
    <div className="v3-skeleton" style={{ height: 250 }} aria-hidden />
  );
}

/**
 * Empty state — headline + description + optional CTA. No illustration
 * for now (kept simple; illustration pass is P3 polish).
 */
export function StateEmpty({
  headline,
  description,
  cta,
}: {
  headline: string;
  description?: string;
  cta?: ReactNode;
}) {
  return (
    <div className="v3-empty" role="status">
      <h3>{headline}</h3>
      {description && <p>{description}</p>}
      {cta && <div style={{ marginTop: "var(--p-space-4)" }}>{cta}</div>}
    </div>
  );
}

/**
 * Error state — icon + message + retry button. Reusable for any
 * useApi() failure. Caller passes the retry callback.
 */
export function StateError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="v3-empty" role="alert">
      <h3>Couldn&apos;t load this page</h3>
      <p>{message || "Unknown error"}</p>
      {onRetry && (
        <button
          type="button"
          className="v3-btn v3-btn-primary"
          style={{ marginTop: "var(--p-space-4)" }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Convenience wrapper: render the right state for the useApi() tuple.
 * Returns null when data is loaded — caller renders content in that case.
 *
 *   const { data, error, loading, retry } = useApi<T>("/api/...");
 *   const state = <StateFor<T> data={data} loading={loading} error={error} retry={retry} />;
 *   if (state) return state;
 *   // ...render content using `data`
 */
export function StateFor<T>({
  data,
  loading,
  error,
  retry,
  emptyCheck = (d) => !d,
  emptyHeadline,
  emptyDescription,
}: {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry?: () => void;
  emptyCheck?: (d: T) => boolean;
  emptyHeadline?: string;
  emptyDescription?: string;
}) {
  if (loading) return <StateSkeleton />;
  if (error) return <StateError message={error} onRetry={retry} />;
  if (data !== null && emptyCheck(data) && emptyHeadline) {
    return <StateEmpty headline={emptyHeadline} description={emptyDescription} />;
  }
  return null;
}
