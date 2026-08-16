"use client";

import { useState } from "react";
import { LifeBuoy, Loader2, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/**
 * modules/platform-portal — Support (2026-08-17 SaaS control plane)
 *
 * User lookup + audited support actions: login-as (impersonation with a
 * required reason — every step lands in AuditLog) and a link to the
 * password-reset queue for temp-password issuance.
 */

interface UserCard {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  blocked: boolean;
  banReason: string | null;
  lastLogin: string | null;
  createdAt: string;
}

export function PlatformSupport() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<UserCard | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const email = query.trim();
    if (!email) return;
    setBusy(true);
    setUser(null);
    try {
      const res = await api.get<{ data: { user: UserCard | null } }>(
        `/api/users/lookup?email=${encodeURIComponent(email)}`,
      );
      if (!res.data.user) {
        toast.error("No account found with that email");
      } else {
        setUser(res.data.user);
      }
    } catch (err) {
      toast.error("Lookup failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function loginAs() {
    if (!user) return;
    const reason = window.prompt("Reason for support access (recorded in the audit log):");
    if (!reason) return;
    setBusy(true);
    try {
      await api.post("/api/v2/platform/impersonate", { userId: user.id, reason });
      toast.success(`Acting as ${user.email} — every action is audited`);
      window.location.href = "/learner";
    } catch (err) {
      toast.error("Couldn't start support session", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function toggleBan() {
    if (!user) return;
    const reason = window.prompt(user.blocked ? "Unblock this account?" : "Ban reason (shown to the user):");
    if (reason === null) return;
    setBusy(true);
    try {
      await api.put(`/api/users/${user.id}/block`, { blocked: !user.blocked, reason });
      setUser({ ...user, blocked: !user.blocked, banReason: user.blocked ? null : reason });
      toast.success(user.blocked ? "Account unblocked" : "Account banned");
    } catch (err) {
      toast.error("Ban update failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg md:text-xl">Support</h1>
        <p className="text-sm text-fg-muted">
          Look up a user, act on their behalf (audited), or issue a temporary password.
        </p>
      </div>

      <form onSubmit={lookup} className="flex max-w-xl items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="user@example.com"
            type="email"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Look up
        </button>
      </form>

      {user && (
        <div className="max-w-xl rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{user.name}</p>
              <p className="truncate text-xs text-fg-muted">{user.email}</p>
              <p className="mt-1 text-xs text-fg-secondary">
                {user.role} · {user.status}
                {user.blocked ? " · BLOCKED" : ""} · joined{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
              {user.banReason && <p className="mt-1 text-xs text-danger">Ban reason: {user.banReason}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loginAs()}
              disabled={busy || user.blocked}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden />
              Login as user
            </button>
            <button
              type="button"
              onClick={() => void toggleBan()}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg hover:bg-bg-subtle disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {user.blocked ? "Unblock" : "Ban"}
            </button>
            <a
              href="/platform/resets"
              className="inline-flex min-h-11 items-center rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg hover:bg-bg-subtle"
            >
              Temp password →
            </a>
          </div>
        </div>
      )}

      <p className="max-w-xl text-xs leading-relaxed text-fg-muted">
        Login-as opens a scoped session flagged <code className="rounded bg-bg-subtle px-1">sup</code> —
        a banner is shown to you and every support action is written to the audit log with your
        identity and the reason above.
      </p>
    </div>
  );
}
