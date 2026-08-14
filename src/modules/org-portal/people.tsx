"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O2 People & Roles (REDESIGN-P3 §O2, W7)
 *
 * Member roster with role badges + seat chips, invite-by-email form
 * (admin/mentor/member), and deactivate with an UNDO toast (the undo
 * restores via the same PATCH — sonner action).
 */

interface MemberRow {
  id: string;
  role: string;
  status: string;
  seat: boolean;
  user: { id: string; name: string; email: string; lastLogin: string | null };
}

interface MembersData {
  org: { id: string; name: string; seats: number };
  seatsUsed: number;
  members: MemberRow[];
}

const ROLE_TONE: Record<string, string> = {
  admin: "bg-brand-subtle text-fg",
  mentor: "bg-info-subtle text-info-on",
  member: "bg-bg-subtle text-fg-secondary",
};

export function OrgPeople() {
  const { data, error, isLoading, retry } = useApi<MembersData>("/api/v2/org/members");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "mentor" | "member">("member");
  const [seat, setSeat] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      await api.post("/api/v2/org/members", { email, role, seat });
      setEmail("");
      setSeat(false);
      toast.success("Member added", { description: `${email} joined the org.` });
      retry();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not invite member.");
    } finally {
      setInviting(false);
    }
  }

  async function setStatus(member: MemberRow, status: "active" | "removed") {
    setBusyId(member.id);
    try {
      await api.patch(`/api/v2/org/members/${member.id}`, { status });
      if (status === "removed") {
        // UNDO toast — restore is the same PATCH.
        toast("Member deactivated", {
          description: `${member.user.name} lost access.`,
          action: {
            label: "Undo",
            onClick: () => {
              void api.patch(`/api/v2/org/members/${member.id}`, { status: "active" });
              retry();
            },
          },
        });
      }
      retry();
    } catch (err) {
      toast.error("Couldn't update member", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">People</h1>
        {data && (
          <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-fg-secondary">
            {data.seatsUsed}/{data.org.seats} seats
          </span>
        )}
      </div>

      {/* invite form */}
      <form onSubmit={invite} className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <UserPlus className="h-4 w-4 text-fg-muted" aria-hidden />
          Invite member
        </h2>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@company.com"
            aria-label="Member email"
            className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            aria-label="Member role"
            className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="member">Member</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-subtle px-3 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={seat}
              onChange={(e) => setSeat(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Uses a seat
          </label>
          <button
            type="submit"
            disabled={inviting}
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {inviting ? "Inviting…" : "Invite"}
          </button>
        </div>
        {inviteError && (
          <p role="alert" className="text-xs text-danger-on">
            {inviteError}
          </p>
        )}
      </form>

      {isLoading ? (
        <RosterSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load members</p>
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
      ) : !data || data.members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <Users className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No members yet</p>
          <p className="max-w-sm text-xs text-fg-muted">Invite your first member above.</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.members.map((m) => (
            <div key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{m.user.name}</p>
                <p className="truncate text-xs text-fg-muted">
                  {m.user.email}
                  {m.seat ? " · seat" : ""}
                  {m.user.lastLogin
                    ? ` · last login ${new Date(m.user.lastLogin).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                  ROLE_TONE[m.role] ?? ROLE_TONE.member
                }`}
              >
                {m.role}
              </span>
              <button
                type="button"
                onClick={() => setStatus(m, m.status === "active" ? "removed" : "active")}
                disabled={busyId === m.id}
                className={
                  m.status === "active"
                    ? "shrink-0 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs font-medium text-danger-on hover:border-line-strong disabled:opacity-50"
                    : "shrink-0 rounded-md bg-success-subtle px-2 py-1 text-xs font-medium text-success-on disabled:opacity-50"
                }
              >
                {m.status === "active" ? "Deactivate" : "Restore"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true">
      {[0, 1, 2].map((i) => (
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
