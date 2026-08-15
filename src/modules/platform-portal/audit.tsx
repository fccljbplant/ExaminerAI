"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCw, ScrollText } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/platform-portal — P6 Global audit (REDESIGN-P3 §P6, W7)
 *
 * Whole-platform AuditLog feed with action filter + CSV export —
 * same pattern as the org audit, scoped up.
 */

interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditData {
  items: AuditRow[];
  nextCursor: string | null;
}

const ACTIONS = [
  { key: "", label: "All actions" },
  { key: "org_member_added", label: "Member added" },
  { key: "org_member_removed", label: "Member removed" },
  { key: "org_settings_updated", label: "Settings changed" },
  { key: "org_registry_updated", label: "Registry changed" },
] as const;

export function PlatformAudit() {
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (actorId.trim()) params.set("actorId", actorId.trim());
    const qs = params.toString();
    return `/api/v2/platform/audit${qs ? `?${qs}` : ""}`;
  }, [action, actorId]);
  const { data, error, isLoading, retry } = useApi<AuditData>(path);

  function exportCsv() {
    const rows = (data?.items ?? []).map((r) => ({
      action: r.action,
      actor: r.actorName,
      role: r.actorRole,
      target: `${r.targetType}:${r.targetId}`,
      date: new Date(r.createdAt).toISOString(),
    }));
    exportToCSV("platform-audit.csv", rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Audit</h1>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data || data.items.length === 0}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder="Filter by actor user id…"
          aria-label="Filter by actor user id"
          className="h-11 w-64 rounded-lg border border-line bg-surface px-3 font-mono text-xs text-fg placeholder:text-fg-muted"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden]">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAction(a.key)}
            aria-pressed={action === a.key}
            className={
              action === a.key
                ? "shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-on-brand"
                : "shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong"
            }
          >
            {a.label}
          </button>
        ))}
        </div>
      </div>

      {isLoading ? (
        <AuditSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load the audit log</p>
          <p className="mt-1 text-xs text-fg-muted">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <ScrollText className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No audited actions</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Privileged actions across the platform appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data?.items.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <button
                type="button"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                aria-expanded={expanded === r.id}
                className="flex min-h-12 w-full items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{r.action}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {r.actorName} ({r.actorRole}) · {r.targetType}
                    {r.reason ? ` · “${r.reason}”` : ""}
                    {r.ipAddress ? ` · ${r.ipAddress}` : ""} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                {(r.before || r.after) && (
                  <span className="shrink-0 text-xs font-medium text-brand">
                    {expanded === r.id ? "Hide" : "Details"}
                  </span>
                )}
              </button>
              {expanded === r.id && (r.before || r.after) && (
                <div className="mt-2 grid grid-cols-1 gap-2 border-t border-line pt-2 md:grid-cols-2">
                  <DiffBlock label="Before" value={r.before} />
                  <DiffBlock label="After" value={r.after} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div className="rounded-lg bg-bg-subtle p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{label}</p>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-fg">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-bg-subtle" />
            <div className="h-3 w-2/3 rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
