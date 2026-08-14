"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, RefreshCw } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";
import { initialsOf, roleLabel } from "@/modules/shell";

/**
 * modules/platform-portal — Resets (W11 audit: V1 PasswordResetPanel restored)
 *
 * Approve pending password-reset requests with a temporary password.
 * Consumes the surviving admin-guarded v1 endpoints.
 */

interface ResetRequest {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  tempPassword: string | null;
  adminNote: string | null;
  user: { id: string; email: string; name: string; role: string };
}

export function PlatformResets() {
  const [status, setStatus] = useState("pending");
  const { data, error, isLoading, retry } = useApi<{ requests: ResetRequest[] }>(
    `/api/password-reset-requests?status=${status}`,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [note, setNote] = useState("");

  async function approve(id: string) {
    try {
      const res = await fetch(`/api/password-reset-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword, adminNote: note || undefined }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Approve failed");
      toast.success("Temporary password set");
      setOpenId(null);
      setTempPassword("");
      setNote("");
      retry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  }

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Password resets</h1>

      <div className="flex items-center gap-1 overflow-x-auto">
        {(["pending", "approved", "resolved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
              status === s
                ? "bg-brand text-on-brand"
                : "border border-line bg-surface text-fg-secondary hover:text-fg"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={retry} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-muted">
          No {status} requests.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {requests.map((r) => (
            <div key={r.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg">
                {initialsOf(r.user.name) || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">
                  {r.user.name} <span className="text-xs font-normal text-fg-muted">· {roleLabel(r.user.role)}</span>
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {r.user.email} · requested {new Date(r.createdAt).toLocaleDateString()}
                </p>
                {r.reason && <p className="mt-0.5 truncate text-xs text-fg-secondary">“{r.reason}”</p>}
                {r.tempPassword && (
                  <p className="mt-0.5 font-mono text-[11px] text-fg-muted">temp: {r.tempPassword}</p>
                )}
              </div>
              {r.status === "pending" &&
                (openId === r.id ? (
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                    <input
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Temp password (6+)"
                      aria-label="Temporary password"
                      className="h-11 w-40 rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note (optional)"
                      aria-label="Admin note"
                      className="h-11 w-36 rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted"
                    />
                    <button
                      type="button"
                      onClick={() => void approve(r.id)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand/90"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden /> Approve
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(r.id);
                      setTempPassword("");
                      setNote("");
                    }}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:bg-bg-subtle"
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden /> Set password
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
