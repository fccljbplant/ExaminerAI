"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Armchair,
  BookOpen,
  Building2,
  Plus,
  RefreshCw,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";
import { OrgCourseAssigner } from "@/modules/b2b";

/**
 * modules/org-portal — O2 People & Roles (REDESIGN-P3 §O2, W7)
 *
 * Member roster with role badges + seat chips, invite-by-email form
 * (admin/mentor/member), and deactivate with an UNDO toast (the undo
 * restores via the same PATCH — sonner action).
 *
 * B2B enterprise ops (2026-08-17): departments sidebar (filter roster,
 * per-member department select, per-department course rules) and CSV
 * bulk import of members.
 */

interface MemberRow {
  id: string;
  role: string;
  status: string;
  seat: boolean;
  departmentId: string | null;
  user: { id: string; name: string; email: string; lastLogin: string | null };
}

interface MembersData {
  org: { id: string; name: string; seats: number };
  seatsUsed: number;
  members: MemberRow[];
}

interface DepartmentRow {
  id: string;
  name: string;
  memberCount: number;
  courseRuleCount: number;
  courses: { id: string; name: string }[];
}

interface DepartmentsData {
  departments: DepartmentRow[];
}

interface CatalogCourse {
  id: string;
  name: string;
  subtitle?: string | null;
  published?: boolean;
}

const ROLE_TONE: Record<string, string> = {
  admin: "bg-brand-subtle text-fg",
  mentor: "bg-info-subtle text-info-on",
  member: "bg-bg-subtle text-fg-secondary",
};

export function OrgPeople() {
  const { data, error, isLoading, retry } = useApi<MembersData>("/api/v2/org/members");
  const departments = useApi<DepartmentsData>("/api/v2/org/departments");
  const catalog = useApi<{ linked: CatalogCourse[]; available: CatalogCourse[] }>(
    "/api/v2/org/catalog",
  );

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "mentor" | "member">("member");
  const [seat, setSeat] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState("");
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const deptRows = departments.data?.departments ?? [];
  const publishedCourses: CatalogCourse[] = [
    ...(catalog.data?.available ?? []),
    ...(catalog.data?.linked ?? []),
  ];
  const selectedDept = deptRows.find((d) => d.id === selectedDepartment) ?? null;
  const roster = data?.members.filter((m) =>
    selectedDepartment ? m.departmentId === selectedDepartment : true,
  );

  function refreshAll() {
    retry();
    departments.retry();
    catalog.retry();
  }

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

  async function toggleSeat(member: MemberRow) {
    setBusyId(member.id);
    try {
      await api.patch(`/api/v2/org/members/${member.id}`, { seat: !member.seat });
      toast.success(member.seat ? "Seat removed" : "Seat assigned", {
        description: member.user.name,
      });
      retry();
    } catch (err) {
      toast.error("Couldn't update seat", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusyId(null);
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

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    const name = newDepartment.trim();
    if (!name) return;
    setCreatingDepartment(true);
    try {
      await api.post("/api/v2/org/departments", { name });
      setNewDepartment("");
      toast.success("Department created", { description: name });
      departments.retry();
    } catch (err) {
      toast.error("Couldn't create department", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setCreatingDepartment(false);
    }
  }

  async function assignDepartment(member: MemberRow, departmentId: string | null) {
    setBusyId(member.id);
    try {
      // Assign: PATCH /departments/<new> { memberUserId }.
      // Remove: PATCH /departments/<current> { memberUserId, remove: true }.
      const target =
        departmentId !== null ? departmentId : (member.departmentId ?? "");
      const body =
        departmentId !== null
          ? { memberUserId: member.user.id }
          : { memberUserId: member.user.id, remove: true };
      await api.patch(`/api/v2/org/departments/${target}`, body);
      toast.success(
        departmentId
          ? `Moved ${member.user.name} to ${deptRows.find((d) => d.id === departmentId)?.name ?? "department"}`
          : `${member.user.name} left their department`,
      );
      refreshAll();
    } catch (err) {
      toast.error("Couldn't update department", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCourseRule(courseId: string, checked: boolean) {
    if (!selectedDept) return;
    const current = selectedDept.courses.map((c) => c.id);
    const next = checked
      ? [...new Set([...current, courseId])]
      : current.filter((id) => id !== courseId);
    try {
      await api.patch(`/api/v2/org/departments/${selectedDept.id}`, { courseIds: next });
      toast.success("Course rules updated", {
        description: `${selectedDept.name} now has ${next.length} course rule${next.length === 1 ? "" : "s"}.`,
      });
      departments.retry();
    } catch (err) {
      toast.error("Couldn't update course rules", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">People</h1>
        <div className="flex shrink-0 items-center gap-2">
          {data && (
            <span className="rounded-md bg-bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-fg-secondary">
              {data.seatsUsed}/{data.org.seats} seats
            </span>
          )}
          <CsvImportButton onImported={refreshAll} />
        </div>
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

      {/* assign courses (v1 Assign Courses card) */}
      {data && data.members.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Assign courses
          </h2>
          <OrgCourseAssigner
            members={data.members.map((m) => ({ id: m.id, user: { id: m.user.id, name: m.user.name, email: m.user.email } }))}
          />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* departments sidebar */}
        <aside className="space-y-2 lg:col-span-4">
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Building2 className="h-4 w-4 text-fg-muted" aria-hidden />
              Departments
            </h2>
            <form onSubmit={createDepartment} className="flex gap-2">
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="New department"
                aria-label="New department name"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={creatingDepartment || !newDepartment.trim()}
                aria-label="Create department"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </form>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedDepartment(null)}
                className={
                  selectedDepartment === null
                    ? "flex w-full items-center justify-between gap-2 rounded-lg bg-brand-subtle px-3 py-2 text-left text-sm font-medium text-fg"
                    : "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-subtle"
                }
              >
                All members
                <span className="text-xs tabular-nums text-fg-muted">
                  {data?.members.length ?? 0}
                </span>
              </button>
              {deptRows.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDepartment(d.id)}
                  className={
                    selectedDepartment === d.id
                      ? "flex w-full items-center justify-between gap-2 rounded-lg bg-brand-subtle px-3 py-2 text-left text-sm font-medium text-fg"
                      : "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-subtle"
                  }
                >
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                    {d.memberCount} · {d.courseRuleCount} course{d.courseRuleCount === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
              {departments.isLoading ? (
                <p className="px-3 py-2 text-xs text-fg-muted">Loading departments…</p>
              ) : deptRows.length === 0 ? (
                <p className="px-3 py-2 text-xs text-fg-muted">
                  No departments yet — create one above.
                </p>
              ) : null}
            </div>
          </div>

          {/* course rules for the selected department */}
          {selectedDept && (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <BookOpen className="h-4 w-4 text-fg-muted" aria-hidden />
                {selectedDept.name} courses
              </h3>
              {catalog.isLoading ? (
                <p className="text-xs text-fg-muted">Loading courses…</p>
              ) : publishedCourses.length === 0 ? (
                <p className="text-xs text-fg-muted">No published courses available.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {publishedCourses.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-bg-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDept.courses.some((dc) => dc.id === c.id)}
                        onChange={(e) => void toggleCourseRule(c.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-fg">{c.name}</span>
                        {c.subtitle && (
                          <span className="block truncate text-xs text-fg-muted">{c.subtitle}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-fg-muted">
                Checked courses become compliance rules for this department.
              </p>
            </div>
          )}
        </aside>

        {/* roster */}
        <div className="lg:col-span-8">
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
              <p className="max-w-sm text-xs text-fg-muted">
                Invite your first member above or import a CSV list.
              </p>
            </div>
          ) : roster && roster.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
              <Building2 className="h-6 w-6 text-fg-muted" aria-hidden />
              <p className="text-sm font-medium text-fg">No members in this department</p>
              <p className="max-w-sm text-xs text-fg-muted">
                Pick a department from each member row to move them here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {roster?.map((m) => (
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
                  <select
                    value={m.departmentId ?? ""}
                    onChange={(e) =>
                      void assignDepartment(m, e.target.value === "" ? null : e.target.value)
                    }
                    disabled={busyId === m.id}
                    aria-label={`Department for ${m.user.name}`}
                    className="h-9 shrink-0 rounded-lg border border-line bg-surface px-2 text-xs text-fg-secondary focus:border-brand focus:outline-none disabled:opacity-50"
                  >
                    <option value="">No department</option>
                    {deptRows.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                      ROLE_TONE[m.role] ?? ROLE_TONE.member
                    }`}
                  >
                    {m.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSeat(m)}
                    disabled={busyId === m.id}
                    aria-pressed={m.seat}
                    aria-label={`${m.seat ? "Remove seat from" : "Assign seat to"} ${m.user.name}`}
                    className={
                      m.seat
                        ? "shrink-0 rounded-md bg-brand-subtle px-2 py-1 text-xs font-medium text-fg disabled:opacity-50"
                        : "shrink-0 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs font-medium text-fg-secondary hover:border-line-strong disabled:opacity-50"
                    }
                  >
                    <Armchair className="h-3.5 w-3.5" aria-hidden />
                  </button>
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
      </div>
    </div>
  );
}

/** Import CSV — reads the file text client-side and POSTs it to the
 *  bulk-import route, then reports created/skipped counts via toast. */
function CsvImportButton({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const csv = await file.text();
      const envelope = await api.post<{
        ok: boolean;
        data: { created: number; skipped: Array<{ email: string; reason: string }> };
      }>("/api/v2/org/members/import", { csv });
      const result = envelope.data;
      if (result.skipped.length > 0) {
        toast.warning(`Imported ${result.created} member(s)`, {
          description: `${result.skipped.length} skipped — ${result.skipped
            .slice(0, 3)
            .map((s) => `${s.email}: ${s.reason}`)
            .join(" · ")}${result.skipped.length > 3 ? " …" : ""}`,
        });
      } else {
        toast.success(`Imported ${result.created} member(s)`);
      }
      onImported();
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="hidden"
        aria-label="Import members CSV"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg-secondary transition-colors hover:border-line-strong disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Importing…" : "Import CSV"}
      </button>
    </>
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
