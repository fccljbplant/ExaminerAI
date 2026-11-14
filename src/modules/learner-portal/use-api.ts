"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

/**
 * modules/learner-portal — useApi (REDESIGN-P3 §0 states law)
 *
 * Minimal GET hook over the standard envelope ({ ok, data }). Every
 * consumer gets loading / error / retry for free so pages can honour
 * the skeleton + error-Retry + empty-CTA contract at all breakpoints.
 */

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
}

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  retry: () => void;
}

interface ApiSnapshot<T> {
  path: string | null;
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Never project data fetched for a different resource path into the current view. */
export function getApiStateForPath<T>(
  state: ApiSnapshot<T>,
  path: string | null,
): Omit<ApiState<T>, "retry"> {
  const matchesPath = Boolean(path) && state.path === path;
  const data = matchesPath ? state.data : null;
  const error = matchesPath ? state.error : null;

  return {
    data,
    error,
    isLoading: Boolean(path) && (
      !matchesPath || state.loading || (data === null && error === null)
    ),
  };
}

export function useApi<T>(path: string | null): ApiState<T> {
  // Keep the path with its data so a route change never renders the previous
  // course/resource while the next request is pending. Same-path refetches
  // continue to retain their last good data.
  const [state, setState] = useState<ApiSnapshot<T>>({
    path,
    data: null,
    error: null,
    loading: Boolean(path),
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api
      .get<ApiEnvelope<T>>(path)
      .then((res) => {
        if (cancelled) return;
        setState({ path, data: res.data ?? null, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState((prev) => ({
          path,
          data: prev.path === path ? prev.data : null,
          error: e instanceof Error ? e.message : "Something went wrong",
          loading: false,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  return { ...getApiStateForPath(state, path), retry };
}
