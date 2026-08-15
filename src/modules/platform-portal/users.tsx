"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/dialog";
import { Button } from "@/modules/ui/button";
import { initialsOf, roleLabel } from "@/modules/shell";

/**
 * modules/platform-portal — Users (W11 audit: V1 Users tab restored)
 *
 * Full user management on the v2 stack: search, role + status filters,
 * pagination, approve / block / change-role / delete actions. Consumes
 * the surviving v1 user endpoints (already RBAC-guarded for admins).
 */

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  approvedAt: string | null;
  createdAt: string;
  lastLogin: string | null;
  currentWeek: number | null;
}

interface Page {
  users: UserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const ROLES = ["learner", "instructor", "org_admin", "platform_admin"] as const;
const STATUSES = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "blocked", label: "Blocked" },
] as const;

function statusOf(u: UserRow): "pending" | "blocked" | "active" {
  if (u.blocked) return "blocked";
  if (!u.approvedAt && u.role === "learner") return "pending";
  return "active";
}

export function PlatformUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query: string, roleFilter: string, p: number) => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (query.trim()) params.set("q", query.trim());
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as Page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void load(q, role, 1);
      setPage(1);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, role, load]);

  useEffect(() => {
    void load(q, role, page);
  }, [page, load]);

  async function act(id: string, path: string, method: string, body?: unknown) {
    setBusyId(id);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
      toast.success("Saved");
      void load(q, role, page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function approve(u: UserRow) {
    void act(u.id, `/api/users/${u.id}/approve`, "PUT", {});
  }
  // Destructive/privilege actions confirm first (audit 9.6) — the old
  // window.confirm blocked the page thread and role changes fired with
  // no confirmation at all.
  const [pending, setPending] = useState<
    { kind: "block" | "role" | "delete"; user: UserRow; nextRole?: string } | null
  >(null);

  function requestBlock(u: UserRow) {
    setPending({ kind: "block", user: u });
  }
  function requestRole(u: UserRow, next: string) {
    setPending({ kind: "role", user: u, nextRole: next });
  }
  function requestDelete(u: UserRow) {
    setPending({ kind: "delete", user: u });
  }

  function confirmPending() {
    if (!pending) return;
    const { kind, user, nextRole } = pending;
    setPending(null);
    if (kind === "block") {
      void act(user.id, `/api/users/${user.id}/block`, "PUT", { blocked: !user.blocked });
    } else if (kind === "role" && nextRole) {
      void act(user.id, `/api/users/${user.id}/role`, "PATCH", { role: nextRole });
    } else if (kind === "delete") {
      void act(user.id, `/api/users/${user.id}`, "DELETE");
    }
  }

  const pendingCopy = (() => {
    if (!pending) return null;
    const who = `${pending.user.name} (${pending.user.email})`;
    if (pending.kind === "block") {
      return pending.user.blocked
        ? { title: "Unblock user", body: `Restore access for ${who}?`, cta: "Unblock" }
        : {
            title: "Block user",
            body: `${who} will be signed out and unable to use the platform until unblocked.`,
            cta: "Block",
          };
    }
    if (pending.kind === "role") {
      return {
        title: `Make ${roleLabel(pending.nextRole ?? "")}`,
        body: `${who} will get ${roleLabel(pending.nextRole ?? "")} permissions across the platform. This is audited.`,
        cta: "Change role",
      };
    }
    return {
      title: "Delete user",
      body: `Delete ${who} and ALL of their data — enrollments, submissions, progress, certificates? This cannot be undone.`,
      cta: "Delete forever",
    };
  })();

  const visible =
    data?.users.filter((u) => status === "all" || statusOf(u) === status) ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Users</h1>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          />
        </label>
        <div className="flex items-center gap-1 overflow-x-auto">
          <FilterChip label="All roles" active={!role} onClick={() => setRole("")} />
          {ROLES.map((r) => (
            <FilterChip key={r} label={roleLabel(r)} active={role === r} onClick={() => setRole(r)} />
          ))}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUSES.map((s) => (
            <FilterChip key={s.id} label={s.label} active={status === s.id} onClick={() => setStatus(s.id)} />
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void load(q, role, page)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!data ? (
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-muted">
          No users match these filters.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {visible.map((u) => {
            const st = statusOf(u);
            return (
              <div key={u.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg">
                  {initialsOf(u.name) || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                    <span className="truncate">{u.name}</span>
                    {st === "pending" && <StatusBadge tone="warning" label="Pending" />}
                    {st === "blocked" && <StatusBadge tone="danger" label="Blocked" />}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {u.email} · {roleLabel(u.role)}
                    {u.lastLogin ? ` · last active ${new Date(u.lastLogin).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {st === "pending" && (
                    <button
                      type="button"
                      onClick={() => approve(u)}
                      disabled={busyId === u.id}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-50"
                    >
                      <UserCheck className="h-3.5 w-3.5" aria-hidden />
                      Approve
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${u.name}`}
                        className="flex h-11 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      {u.role !== "platform_admin" && (
                        <DropdownMenuItem onSelect={() => requestBlock(u)}>
                          {u.blocked ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
                          {u.blocked ? "Unblock" : "Block"}
                        </DropdownMenuItem>
                      )}
                      {u.role !== "platform_admin" && (
                        <>
                          {ROLES.filter((r) => r !== u.role).map((r) => (
                            <DropdownMenuItem key={r} onSelect={() => requestRole(u, r)}>
                              <ShieldCheck className="h-4 w-4" aria-hidden />
                              Make {roleLabel(r)}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      {u.role !== "platform_admin" && (
                        <DropdownMenuItem
                          onSelect={() => requestDelete(u)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Delete user
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex h-11 items-center gap-1 rounded-lg border border-line px-3 text-xs font-semibold text-fg disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
          </button>
          <span className="text-xs tabular-nums text-fg-muted">
            {data.pagination.page} / {data.pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page >= data.pagination.totalPages}
            className="inline-flex h-11 items-center gap-1 rounded-lg border border-line px-3 text-xs font-semibold text-fg disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {/* Destructive-action confirmation (audit 9.6) */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingCopy?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-fg-secondary">{pendingCopy?.body}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.kind === "delete" ? "destructive" : "default"}
              onClick={confirmPending}
            >
              {pendingCopy?.cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition-colors ${
        active ? "bg-brand text-on-brand" : "border border-line bg-surface text-fg-secondary hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ tone, label }: { tone: "warning" | "danger"; label: string }) {
  const cls =
    tone === "warning"
      ? "bg-warning-subtle text-warning-on"
      : "bg-danger-subtle text-danger-on";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
  );
}
