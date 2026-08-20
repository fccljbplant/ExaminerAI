"use client";

// src/modules/ui-v3/platform-users.tsx — V3 Platform Users (full restyle).
// Reimplements v2 PlatformUsers (platform-portal/users.tsx, 387 lines)
// with v3 design tokens. Same /api/users endpoints, same business logic
// (search, role + status filters, pagination, approve/block/role-change/
// delete with confirmation dialog).
//
// Reuses v2 Dialog + DropdownMenu (complex Radix-based components —
// re-implementing would be P4). Buttons, inputs, chips, badges, cards
// all use v3 design tokens.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Ban, CheckCircle2, ChevronLeft, ChevronRight,
  MoreHorizontal, RefreshCw, Search, ShieldCheck, Trash2, UserCheck,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/modules/ui/dialog";
import { Button } from "@/modules/ui/button";
import { initialsOf, roleLabel } from "@/modules/shell";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateSkeleton } from "./states";

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

export function V3PlatformUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query: string, roleFilter: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (query.trim()) params.set("q", query.trim());
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as Page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void load(q, role, 1);
      setPage(1);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, role, load]);

  useEffect(() => { void load(q, role, page); }, [page, load]);

  async function act(id: string, path: string, method: string, body?: unknown) {
    setBusyId(id);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
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

  const [pending, setPending] = useState<
    { kind: "block" | "role" | "delete"; user: UserRow; nextRole?: string } | null
  >(null);

  function requestBlock(u: UserRow) { setPending({ kind: "block", user: u }); }
  function requestRole(u: UserRow, next: string) { setPending({ kind: "role", user: u, nextRole: next }); }
  function requestDelete(u: UserRow) { setPending({ kind: "delete", user: u }); }

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
        ? { title: "Unblock user", body: `Restore access for ${who}?`, cta: "Unblock", destructive: false }
        : {
            title: "Block user",
            body: `${who} will be signed out and unable to use the platform until unblocked.`,
            cta: "Block",
            destructive: false,
          };
    }
    if (pending.kind === "role") {
      return {
        title: `Make ${roleLabel(pending.nextRole ?? "")}`,
        body: `${who} will get ${roleLabel(pending.nextRole ?? "")} permissions across the platform. This is audited.`,
        cta: "Change role",
        destructive: false,
      };
    }
    return {
      title: "Delete user",
      body: `Delete ${who} and ALL of their data — enrollments, submissions, progress, certificates? This cannot be undone.`,
      cta: "Delete forever",
      destructive: true,
    };
  })();

  const visible = data?.users.filter((u) => status === "all" || statusOf(u) === status) ?? [];

  return (
    <>
      <V3PageHeader
        title="Users"
        subtitle="All user accounts on the platform — search, filter by role, manage status."
      />

      {/* Filters */}
      <div className="v3-filter-row" style={{ marginBottom: "var(--p-space-5)" }}>
        <div className="v3-search-wrap">
          <span aria-hidden><Search size={14} /></span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="v3-input search"
          />
        </div>
        <div style={{ display: "flex", gap: "var(--p-space-1)", overflowX: "auto" }}>
          <button
            type="button"
            onClick={() => setRole("")}
            aria-pressed={!role}
            className={`v3-chip-btn ${!role ? "active" : ""}`}
          >All roles</button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`v3-chip-btn ${role === r ? "active" : ""}`}
            >{roleLabel(r)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--p-space-1)", overflowX: "auto" }}>
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatus(s.id)}
              aria-pressed={status === s.id}
              className={`v3-chip-btn ${status === s.id ? "active" : ""}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <V3Card className="v3-empty" style={{ marginBottom: "var(--p-space-5)" }} role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
            <AlertTriangle size={16} aria-hidden style={{ color: "var(--danger-on)" }} />
            <span style={{ fontSize: "var(--p-type-sm)", color: "var(--text)" }}>{error}</span>
            <button
              type="button"
              onClick={() => void load(q, role, page)}
              className="v3-btn"
              style={{ marginLeft: "auto", fontSize: "var(--p-type-xs)", padding: "var(--p-space-2) var(--p-space-3)" }}
            >
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          </div>
        </V3Card>
      )}

      {/* Table */}
      {loading ? (
        <StateSkeleton cards={5} />
      ) : visible.length === 0 ? (
        <V3Card className="v3-empty">
          <h3>No users match these filters.</h3>
          <p>Try adjusting the search query or clearing filters.</p>
        </V3Card>
      ) : (
        <V3Card style={{ padding: 0 }}>
          {visible.map((u) => {
            const st = statusOf(u);
            return (
              <div
                key={u.id}
                className="v3-course-row"
                style={{ paddingInline: "var(--p-space-5)" }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: "var(--brand-subtle)",
                    color: "var(--brand)",
                    fontSize: "var(--p-type-xs)",
                    fontWeight: 600,
                  }}
                >
                  {initialsOf(u.name) || "?"}
                </span>
                <div className="v3-course-info">
                  <strong style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--p-space-2)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                    {st === "pending" && <V3Badge variant="warning">Pending</V3Badge>}
                    {st === "blocked" && <V3Badge variant="warning">Blocked</V3Badge>}
                  </strong>
                  <small>
                    {u.email} · {roleLabel(u.role)}
                    {u.lastLogin ? ` · last active ${new Date(u.lastLogin).toLocaleDateString()}` : ""}
                  </small>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)", flexShrink: 0 }}>
                  {st === "pending" && (
                    <button
                      type="button"
                      onClick={() => approve(u)}
                      disabled={busyId === u.id}
                      className="v3-btn v3-btn-primary"
                      style={{ padding: "var(--p-space-2) var(--p-space-3)", fontSize: "var(--p-type-xs)" }}
                    >
                      <UserCheck size={12} aria-hidden /> Approve
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${u.name}`}
                        className="v3-btn"
                        style={{ padding: "var(--p-space-2)", minWidth: 44, minHeight: 44 }}
                      >
                        <MoreHorizontal size={14} aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      {u.role !== "platform_admin" && (
                        <DropdownMenuItem onSelect={() => requestBlock(u)}>
                          {u.blocked ? <CheckCircle2 size={14} aria-hidden /> : <Ban size={14} aria-hidden />}
                          {u.blocked ? "Unblock" : "Block"}
                        </DropdownMenuItem>
                      )}
                      {u.role !== "platform_admin" && (
                        <>
                          {ROLES.filter((r) => r !== u.role).map((r) => (
                            <DropdownMenuItem key={r} onSelect={() => requestRole(u, r)}>
                              <ShieldCheck size={14} aria-hidden />
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
                          <Trash2 size={14} aria-hidden />
                          Delete user
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </V3Card>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--p-space-3)", marginTop: "var(--p-space-5)" }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="v3-btn"
            style={{ padding: "var(--p-space-2) var(--p-space-3)", fontSize: "var(--p-type-xs)" }}
          >
            <ChevronLeft size={14} aria-hidden /> Prev
          </button>
          <span style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            {data.pagination.page} / {data.pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page >= data.pagination.totalPages}
            className="v3-btn"
            style={{ padding: "var(--p-space-2) var(--p-space-3)", fontSize: "var(--p-type-xs)" }}
          >
            Next <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* Destructive-action confirmation (audit 9.6) */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingCopy?.title}</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: "var(--p-type-sm)", lineHeight: 1.5, color: "var(--text-secondary)" }}>{pendingCopy?.body}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingCopy?.destructive ? "destructive" : "default"}
              onClick={confirmPending}
            >
              {pendingCopy?.cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
