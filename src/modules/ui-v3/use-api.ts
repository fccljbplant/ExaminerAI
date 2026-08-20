"use client";

// src/modules/ui-v3/use-api.ts — Simple fetch hook for v3 components.
//
// Auto-unwraps the standard { ok: true, data: T } envelope that the
// /api/v2/* endpoints return. If the payload doesn't have a `data`
// field, returns the raw payload — so non-envelope endpoints work too.
// (Audit finding §1.5.1: envelope wasn't standardized — every caller
// had to remember `raw?.data ?? raw`. That crashed production once.)
//
// Caller pattern:
//   const { data, loading, error, retry } = useApi<MyData>("/api/v2/foo");
//   if (loading) return <StateSkeleton />;
//   if (error)   return <StateError message={error} onRetry={retry} />;
//   // data is now MyData | null — type-narrow before using

import { useEffect, useState } from "react";

interface ApiEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

function unwrap<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return raw as T;
  const env = raw as ApiEnvelope<T>;
  // Standard envelope: { ok, data } — return .data (which may itself be null).
  if ("data" in env && "ok" in env) return env.data ?? null;
  // Already-unwrapped payload (e.g. raw array, or { items, categories }).
  return raw as T;
}

export function useApi<T = unknown>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const retry = () => setNonce((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url, { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          // Try to extract a JSON error message before throwing — most
          // /api/v2 routes return { error: "..." } on failure.
          return r.json().then(
            (body: ApiEnvelope<unknown>) => {
              throw new Error(body?.error || `HTTP ${r.status}`);
            },
            () => { throw new Error(`HTTP ${r.status}`); },
          );
        }
        return r.json();
      })
      .then((raw) => {
        if (cancelled) return;
        setData(unwrap<T>(raw));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Network error");
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce]);

  return { data, loading, error, retry };
}
