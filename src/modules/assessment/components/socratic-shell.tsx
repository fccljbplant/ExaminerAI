"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import type { StatsResponse } from "@/modules/assessment/types";

/**
 * modules/assessment — SocraticShell (standalone wrapper, W10 audit)
 *
 * The restored Socratic panels (PracticePanel / WeeklyTestPanel) were
 * dashboard children — they expect the learner StatsResponse + parent
 * callbacks. This shell fetches /api/stats (the kept v1 learner
 * aggregate), builds the response the panels need, and provides the
 * callbacks so the Socratic experience stands alone in the v2 portal.
 */

interface StatsEnvelope {
  stats: StatsResponse["stats"];
  tasks?: StatsResponse["tasks"];
  weeklyTests?: StatsResponse["weeklyTests"];
}

export function SocraticShell({
  render,
  currentWeek,
}: {
  render: (props: { stats: StatsResponse; reload: () => void }) => React.ReactNode;
  currentWeek?: number;
}) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    api
      .get<StatsEnvelope>("/api/stats")
      .then((res) => {
        setData({
          stats: res.stats,
          tasks: res.tasks ?? [],
          weeklyTests: res.weeklyTests ?? [],
        } as StatsResponse);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Couldn't load your progress.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your Socratic session</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-7 w-48 rounded-md bg-bg-subtle" />
        <div className="h-80 rounded-xl bg-bg-subtle" />
      </div>
    );
  }

  return <>{render({ stats: data, reload, ...(currentWeek != null ? { currentWeek } : {}) })}</>;
}
