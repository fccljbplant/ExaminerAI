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

export function useApi<T>(path: string | null): ApiState<T> {
  // Single state atom so a refetch keeps showing stale data (no
  // synchronous setState in the fetch effect — react-hooks rule).
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api
      .get<ApiEnvelope<T>>(path)
      .then((res) => {
        if (cancelled) return;
        setState({ data: res.data ?? null, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : "Something went wrong",
          loading: false,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  return {
    data: state.data,
    error: state.error,
    // Also covers late-activated paths (e.g. lazy tabs): no data and no
    // error yet means the first fetch is in flight.
    isLoading:
      state.loading || (path !== null && state.data === null && state.error === null),
    retry,
  };
}
