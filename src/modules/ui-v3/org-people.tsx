"use client";

// src/modules/ui-v3/org-people.tsx — V3 Org People & Roles (full restyle).
// Reimplements v2 OrgPeople (org-portal/people.tsx, 598 lines) with v3
// design tokens. Same /api/v2/org/members + /departments + /catalog
// endpoints, same business logic (invite, seat toggle, deactivate-with-undo,
// department sidebar with course rules, CSV bulk import).
//
// Reuses v2 OrgCourseAssigner (complex b2b sub-component — re-implementing
// would be P5). All other UI uses v3 tokens.

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Armchair, BookOpen, Building2, Plus,
  RefreshCw, Upload, UserPlus, Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "./use-api";
import { OrgCourseAssigner } from "@/modules/b2b";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateError, StateSkeleton, StateEmpty } from "./states";

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

function roleBadgeVariant(role: string): "primary" | "warning" | undefined {
  if (role === "admin") return "primary";
  if (role === "mentor") return "warning";
  return undefined;
}

export function V3OrgPeople() {
  const { data, error, loading, retry } = useApi<MembersData>("/api/v2/org/members");
  const departments = useApi<DepartmentsData>("/api/v2/org/departments");
  const catalog = useApi<{ linked: CatalogCourse[]; available: CatalogCourse[] }>("/api/v2/org/catalog");

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
  const roster = data?.members.filter((m) => selectedDepartment ? m.departmentId === selectedDepartment : true);

  function refreshAll() { retry(); departments.retry(); catalog.retry(); }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      await api.post("/api/v2/org/members", { email, role, seat });
      setEmail(""); setSeat(false);
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
      toast.success(member.seat ? "Seat removed" : "Seat assigned", { description: member.user.name });
      retry();
    } catch (err) {
      toast.error("Couldn't update seat", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(member: MemberRow, status: "active" | "removed") {
    setBusyId(member.id);
    try {
      await api.patch(`/api/v2/org/members/${member.id}`, { status });
      if (status === "removed") {
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
      toast.error("Couldn't update member", { description: err instanceof Error ? err.message : "Try again." });
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
      toast.error("Couldn't create department", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setCreatingDepartment(false);
    }
  }

  async function assignDepartment(member: MemberRow, departmentId: string | null) {
    setBusyId(member.id);
    try {
      const target = departmentId !== null ? departmentId : (member.departmentId ?? "");
      const body = departmentId !== null
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
      toast.error("Couldn't update department", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCourseRule(courseId: string, checked: boolean) {
    if (!selectedDept) return;
    const current = selectedDept.courses.map((c) => c.id);
    const next = checked ? [...new Set([...current, courseId])] : current.filter((id) => id !== courseId);
    try {
      await api.patch(`/api/v2/org/departments/${selectedDept.id}`, { courseIds: next });
      toast.success("Course rules updated", {
        description: `${selectedDept.name} now has ${next.length} course rule${next.length === 1 ? "" : "s"}.`,
      });
      departments.retry();
    } catch (err) {
      toast.error("Couldn't update course rules", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)",
  };

  return (
    <>
      <V3PageHeader
        title="People & roles"
        subtitle="Manage members, seats, departments, and invitations."
        action={
          <div style={{ display: "flex", gap: "var(--p-space-2)", alignItems: "center" }}>
            {data && (
              <V3Badge variant="primary">{data.seatsUsed}/{data.org.seats} seats</V3Badge>
            )}
            <CsvImportButton onImported={refreshAll} />
          </div>
        }
      />

      {/* Invite form */}
      <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)" }}>
          <UserPlus size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
          Invite member
        </h3>
        <form onSubmit={invite} style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-3)", marginTop: "var(--p-space-3)" }}>
          <div style={{ display: "flex", gap: "var(--p-space-2)", flexWrap: "wrap" }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@company.com"
              aria-label="Member email"
              className="v3-input"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              aria-label="Member role"
              className="v3-select"
            >
              <option value="member">Member</option>
              <option value="mentor">Mentor</option>
              <option value="admin">Admin</option>
            </select>
            <label style={{ display: "flex", minHeight: 44, alignItems: "center", gap: "var(--p-space-2)", paddingInline: "var(--p-space-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-subtle)", color: "var(--text-secondary)", fontSize: "var(--p-type-sm)" }}>
              <input
                type="checkbox"
                checked={seat}
                onChange={(e) => setSeat(e.target.checked)}
                style={{ height: 16, width: 16, accentColor: "var(--brand)" }}
              />
              Uses a seat
            </label>
            <button type="submit" disabled={inviting} className="v3-btn v3-btn-primary">
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
          {inviteError && (
            <p role="alert" style={{ fontSize: "var(--p-type-sm)", color: "var(--danger-on)", margin: 0 }}>
              {inviteError}
            </p>
          )}
        </form>
      </V3Card>

      {/* Assign courses */}
      {data && data.members.length > 0 && (
        <section style={{ marginBottom: "var(--p-space-5)" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)", fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "var(--p-space-3)" }}>
            <BookOpen size={14} aria-hidden />
            Assign courses
          </h3>
          <OrgCourseAssigner
            members={data.members.map((m) => ({ id: m.id, user: { id: m.user.id, name: m.user.name, email: m.user.email } }))}
          />
        </section>
      )}

      {/* Departments sidebar + Roster */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--p-space-5)" }}>
        {/* Departments sidebar */}
        <aside>
          <V3Card style={{ marginBottom: "var(--p-space-3)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)" }}>
              <Building2 size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
              Departments
            </h3>
            <form onSubmit={createDepartment} style={{ display: "flex", gap: "var(--p-space-2)", marginTop: "var(--p-space-3)" }}>
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="New department"
                aria-label="New department name"
                className="v3-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                type="submit"
                disabled={creatingDepartment || !newDepartment.trim()}
                aria-label="Create department"
                className="v3-btn v3-btn-primary"
                style={{ padding: "var(--p-space-2)", minHeight: 44, minWidth: 44 }}
              >
                <Plus size={14} aria-hidden />
              </button>
            </form>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-1)", marginTop: "var(--p-space-3)" }}>
              <button
                type="button"
                onClick={() => setSelectedDepartment(null)}
                className={`v3-chip-btn ${selectedDepartment === null ? "active" : ""}`}
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <span>All members</span>
                <span style={{ fontSize: "var(--p-type-xs)", fontVariantNumeric: "tabular-nums" }}>
                  {data?.members.length ?? 0}
                </span>
              </button>
              {deptRows.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDepartment(d.id)}
                  className={`v3-chip-btn ${selectedDepartment === d.id ? "active" : ""}`}
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                  <span style={{ fontSize: "var(--p-type-xs)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {d.memberCount} · {d.courseRuleCount}c
                  </span>
                </button>
              ))}
              {departments.loading ? (
                <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", padding: "var(--p-space-2) var(--p-space-3)" }}>Loading departments…</p>
              ) : deptRows.length === 0 ? (
                <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", padding: "var(--p-space-2) var(--p-space-3)" }}>
                  No departments yet — create one above.
                </p>
              ) : null}
            </div>
          </V3Card>

          {/* Course rules for selected department */}
          {selectedDept && (
            <V3Card>
              <h3 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)" }}>
                <BookOpen size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
                {selectedDept.name} courses
              </h3>
              {catalog.loading ? (
                <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", marginTop: "var(--p-space-3)" }}>Loading courses…</p>
              ) : publishedCourses.length === 0 ? (
                <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", marginTop: "var(--p-space-3)" }}>No published courses available.</p>
              ) : (
                <div style={{ maxHeight: 256, overflowY: "auto", paddingRight: "var(--p-space-1)", marginTop: "var(--p-space-3)", display: "flex", flexDirection: "column", gap: "var(--p-space-1)" }}>
                  {publishedCourses.map((c) => (
                    <label
                      key={c.id}
                      style={{ display: "flex", alignItems: "flex-start", gap: "var(--p-space-2)", padding: "var(--p-space-2)", borderRadius: "var(--radius-md)", fontSize: "var(--p-type-sm)", color: "var(--text-secondary)", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDept.courses.some((dc) => dc.id === c.id)}
                        onChange={(e) => void toggleCourseRule(c.id, e.target.checked)}
                        style={{ marginTop: 2, height: 16, width: 16, accentColor: "var(--brand)" }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                        {c.subtitle && (
                          <span style={{ display: "block", fontSize: "var(--p-type-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{c.subtitle}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p style={{ fontSize: "var(--p-type-xs)", lineHeight: 1.5, color: "var(--text-muted)", marginTop: "var(--p-space-2)" }}>
                Checked courses become compliance rules for this department.
              </p>
            </V3Card>
          )}
        </aside>

        {/* Roster */}
        <div>
          {loading ? (
            <StateSkeleton cards={3} />
          ) : error ? (
            <StateError message={error} onRetry={retry} />
          ) : !data || data.members.length === 0 ? (
            <StateEmpty
              headline="No members yet"
              description="Invite your first member above or import a CSV list."
            />
          ) : roster && roster.length === 0 ? (
            <StateEmpty
              headline="No members in this department"
              description="Pick a department from each member row to move them here."
            />
          ) : (
            <V3Card style={{ padding: 0 }}>
              {roster?.map((m) => {
                const badge = roleBadgeVariant(m.role);
                return (
                  <div key={m.id} className="v3-course-row" style={{ paddingInline: "var(--p-space-5)" }}>
                    <div className="v3-course-info">
                      <strong>{m.user.name}</strong>
                      <small>
                        {m.user.email}
                        {m.seat ? " · seat" : ""}
                        {m.user.lastLogin ? ` · last login ${new Date(m.user.lastLogin).toLocaleDateString()}` : ""}
                      </small>
                    </div>
                    <select
                      value={m.departmentId ?? ""}
                      onChange={(e) => void assignDepartment(m, e.target.value === "" ? null : e.target.value)}
                      disabled={busyId === m.id}
                      aria-label={`Department for ${m.user.name}`}
                      className="v3-select"
                      style={{ height: 36, flexShrink: 0, fontSize: "var(--p-type-xs)" }}
                    >
                      <option value="">No department</option>
                      {deptRows.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {badge
                      ? <V3Badge variant={badge}>{m.role}</V3Badge>
                      : <V3Badge>{m.role}</V3Badge>}
                    <button
                      type="button"
                      onClick={() => toggleSeat(m)}
                      disabled={busyId === m.id}
                      aria-pressed={m.seat}
                      aria-label={`${m.seat ? "Remove seat from" : "Assign seat to"} ${m.user.name}`}
                      className="v3-btn"
                      style={{ padding: "var(--p-space-2)", minHeight: 36, minWidth: 36, fontSize: "var(--p-type-xs)" }}
                    >
                      <Armchair size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(m, m.status === "active" ? "removed" : "active")}
                      disabled={busyId === m.id}
                      className="v3-btn"
                      style={{
                        padding: "var(--p-space-2) var(--p-space-3)", minHeight: 36, fontSize: "var(--p-type-xs)",
                        borderColor: m.status === "active" ? "var(--danger)" : "var(--success)",
                        color: m.status === "active" ? "var(--danger-on)" : "var(--success-on)",
                        background: m.status === "active" ? "var(--danger-subtle)" : "var(--success-subtle)",
                      }}
                    >
                      {m.status === "active" ? "Deactivate" : "Restore"}
                    </button>
                  </div>
                );
              })}
            </V3Card>
          )}
        </div>
      </div>
    </>
  );
}

/** CSV import — reads file text client-side, POSTs to bulk-import route. */
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
          description: `${result.skipped.length} skipped — ${result.skipped.slice(0, 3).map((s) => `${s.email}: ${s.reason}`).join(" · ")}${result.skipped.length > 3 ? " …" : ""}`,
        });
      } else {
        toast.success(`Imported ${result.created} member(s)`);
      }
      onImported();
    } catch (err) {
      toast.error("Import failed", { description: err instanceof Error ? err.message : "Try again." });
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
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
        aria-label="Import members CSV"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="v3-btn"
        style={{ fontSize: "var(--p-type-xs)" }}
      >
        <Upload size={12} aria-hidden />
        {busy ? "Importing…" : "Import CSV"}
      </button>
    </>
  );
}
