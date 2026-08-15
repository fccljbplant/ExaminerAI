"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

/**
 * modules/platform-portal — admin-extras (W16: the remaining V1 admin
 * panels restored on the v2 stack)
 *
 *   HomeOverview       → user stats, PM action items, recent signups
 *   AILimitsCard       → per-category daily AI limits + demo AI toggle
 *   AIConnectionCard   → live pipeline test (+ optional inline key test)
 *   SystemEnvCard      → env-var presence (names only, never values)
 *   CacheStatsCard     → token-cache stats + purge
 *
 * Each card degrades to a friendly error row — never blocks the page.
 */

/* ── Home overview ─────────────────────────────────────────────────── */

export interface OverviewData {
  stats: {
    total: number;
    pending: number;
    blocked: number;
    activeToday: number;
    learners: number;
    instructors: number;
    orgAdmins: number;
    pendingResets: number;
    learnersWithoutProjects: number;
  };
  recentSignups: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    blocked: boolean;
    createdAt: string;
  }>;
}

export function HomeOverview({ data }: { data: OverviewData }) {
  const s = data.stats;
  const actions: { label: string; href: string; count: number }[] = [
    { label: "Pending approvals", href: "/platform/users", count: s.pending },
    { label: "Pending password resets", href: "/platform/resets", count: s.pendingResets },
    { label: "Blocked accounts", href: "/platform/users", count: s.blocked },
    {
      label: "Learners without a project",
      href: "/platform/users",
      count: s.learnersWithoutProjects,
    },
  ].filter((a) => a.count > 0);

  return (
    <div className="space-y-4">
      {/* user stat tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MiniKpi label="Total users" value={s.total} icon={Users} tone="brand" />
        <MiniKpi label="Learners" value={s.learners} icon={Users} tone="info" />
        <MiniKpi label="Instructors" value={s.instructors} icon={Users} tone="muted" />
        <MiniKpi
          label="Pending approval"
          value={s.pending}
          icon={AlertTriangle}
          tone={s.pending > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* PM action items */}
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Action items
          </h2>
          {actions.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-5 text-sm text-fg-muted">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              Nothing waiting on you.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {actions.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
                >
                  <span className="text-sm font-medium text-fg">{a.label}</span>
                  <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-warning-on">
                    {a.count}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* recent signups */}
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Recent signups
          </h2>
          {data.recentSignups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-5 text-center text-sm text-fg-muted">
              No signups yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.recentSignups.map((u) => (
                <div key={u.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{u.name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {u.email} · {u.role} · {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {u.blocked && (
                    <span className="shrink-0 rounded-md bg-danger-subtle px-2 py-0.5 text-[10px] font-semibold text-danger-on">
                      blocked
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: "brand" | "info" | "warning" | "success" | "muted";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    info: "bg-info-subtle text-info-on",
    warning: "bg-warning-subtle text-warning-on",
    success: "bg-success-subtle text-success-on",
    muted: "bg-bg-subtle text-fg-muted",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}

/* ── AI limits ─────────────────────────────────────────────────────── */

interface AILimitsData {
  limits: { test: number; tutor: number; assistant: number };
  demoAiEnabled: boolean;
}

export function AILimitsCard() {
  const [data, setData] = useState<AILimitsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/v2/platform/ai-limits");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = (await res.json()) as { data: AILimitsData };
      setData(payload.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load limits");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v2/platform/ai-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limits: data.limits, demoAiEnabled: data.demoAiEnabled }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Save failed");
      toast.success("AI limits saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Daily AI limits
      </h2>
      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void load()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : !data ? (
        <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["test", "tutor", "assistant"] as const).map((cat) => (
              <label key={cat} className="block">
                <span className="text-xs font-medium capitalize text-fg-secondary">{cat} / day</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={data.limits[cat]}
                  onChange={(e) =>
                    setData({
                      ...data,
                      limits: { ...data.limits, [cat]: Number(e.target.value) },
                    })
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm tabular-nums text-fg"
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={data.demoAiEnabled}
              onChange={(e) => setData({ ...data, demoAiEnabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Demo accounts can use AI
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            Save limits
          </button>
        </div>
      )}
    </section>
  );
}

/* ── AI connection ─────────────────────────────────────────────────── */

export function AIConnectionCard() {
  const [key, setKey] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key.trim() ? { apiKey: key.trim() } : {}),
      });
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((payload.error as string) || `Test failed (${res.status})`);
      }
      const ok = payload.ok ?? payload.success ?? payload;
      setResult(
        `✓ ${(payload.provider as string) ?? "provider"} responded in ${
          (payload.latencyMs as number) ?? "—"
        }ms${(payload.model as string) ? ` · model ${payload.model}` : ""}`
      );
      toast.success("Pipeline healthy");
    } catch (e) {
      setResult(`✗ ${e instanceof Error ? e.message : "Test failed"}`);
      toast.error("Connection test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Activity className="h-3.5 w-3.5" aria-hidden />
        AI connection
      </h2>
      <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs text-fg-muted">
          Run a live pipeline test. Optionally test an alternate API key — the key is used
          once for the test call and never stored.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Alternate DeepSeek key (optional)"
            aria-label="Alternate API key"
            className="h-11 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-fg-muted"
          />
          <button
            type="button"
            onClick={() => void test()}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
            Test connection
          </button>
        </div>
        {result && (
          <p
            role="status"
            className={result.startsWith("✓") ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"}
          >
            {result}
          </p>
        )}
      </div>
    </section>
  );
}

/* ── System env ────────────────────────────────────────────────────── */

export function SystemEnvCard({ env }: { env: Record<string, string | boolean | null> }) {
  const rows = Object.entries(env)
    .filter(([, v]) => v !== null)
    .map(([key, v]) => ({ key, set: Boolean(v) }));
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Database className="h-3.5 w-3.5" aria-hidden />
        Environment
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.key} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5">
            <span className="font-mono text-xs text-fg">{r.key}</span>
            {r.set ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> set
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                <XCircle className="h-3.5 w-3.5" aria-hidden /> missing
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Cache stats ───────────────────────────────────────────────────── */

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  /** hitRate comes back 0-100 from the cache lib. */
  estimatedTokensSaved?: number;
  tokensSaved?: number;
}

export function CacheStatsCard() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache");
      if (!res.ok) return;
      const payload = (await res.json()) as { stats: CacheStats };
      setStats(payload.stats);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear() {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/cache", { method: "DELETE" });
      if (!res.ok) throw new Error("Clear failed");
      toast.success("Token cache cleared");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Zap className="h-3.5 w-3.5" aria-hidden />
        AI token cache
      </h2>
      {!stats ? (
        <div className="h-20 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold tabular-nums text-fg">{stats.size}</p>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">entries</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums text-fg">
                {Math.round(stats.hitRate)}%
              </p>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">hit rate</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums text-fg">
                {(stats.tokensSaved ?? stats.estimatedTokensSaved ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">tokens saved</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void clear()}
            disabled={clearing}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:bg-bg-subtle disabled:opacity-50"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserCheck className="h-3.5 w-3.5" aria-hidden />}
            Clear cache
          </button>
        </div>
      )}
    </section>
  );
}
