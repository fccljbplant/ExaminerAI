"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";


/**
 * modules/platform-portal — Access grants (W16: V1 AccessGrantsPanel
 * restored on the v2 stack)
 *
 * Scoped least-privilege grants (batch / student / course /
 * institution × full / wellbeing / crisis / content). Consumes the
 * surviving admin-guarded /api/access-grants.
 */

interface Grant {
  id: string;
  scopeType: string;
  scopeId: string;
  dataScope: string;
  grantedAt: string;
  grantee: { id: string; name: string; email: string; role: string } | null;
}

const SCOPE_TYPES = ["batch", "student", "course", "institution"] as const;
const DATA_SCOPES = ["full", "wellbeing", "crisis", "content"] as const;

export function PlatformAccess() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/access-grants");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = (await res.json()) as { grants: Grant[] };
      setGrants(payload.grants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void retry();
  }, [retry]);
  const [grantee, setGrantee] = useState("");
  const [scopeType, setScopeType] = useState<string>("student");
  const [scopeId, setScopeId] = useState("");
  const [dataScope, setDataScope] = useState<string>("full");
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/access-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granteeUserId: grantee.trim(), scopeType, scopeId: scopeId.trim(), dataScope }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Create failed");
      toast.success("Grant created");
      setGrantee("");
      setScopeId("");
      void retry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }



  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Access grants</h1>

      <form onSubmit={create} className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Plus className="h-4 w-4 text-fg-muted" aria-hidden />
          New grant
        </h2>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={grantee}
            onChange={(e) => setGrantee(e.target.value)}
            required
            placeholder="Grantee user id"
            aria-label="Grantee user id"
            className="h-11 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-fg-muted"
          />
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} aria-label="Scope type" className="h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg">
            {SCOPE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            required
            placeholder="Scope id"
            aria-label="Scope id"
            className="h-11 rounded-lg border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-fg-muted"
          />
          <select value={dataScope} onChange={(e) => setDataScope(e.target.value)} aria-label="Data scope" className="h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg">
            {DATA_SCOPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || !grantee.trim() || !scopeId.trim()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Grant
          </button>
        </div>
      </form>

      {grants === null && !error ? (
        <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void retry()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : (grants?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-muted">
          No active grants.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {(grants ?? []).map((g) => (
            <div key={g.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                <KeyRound className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {g.grantee?.name ?? "Unknown"} <span className="font-normal text-fg-muted">({g.grantee?.email ?? g.id})</span>
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {g.scopeType} <span className="font-mono">{g.scopeId}</span> · {new Date(g.grantedAt).toLocaleDateString()}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-brand-subtle px-2 py-0.5 text-xs font-semibold capitalize text-brand">
                {g.dataScope}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
