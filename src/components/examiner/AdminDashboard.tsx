"use client";
import { showError, showSuccess } from "@/lib/toast-helpers";
import type { UserRow } from "@/components/examiner/admin/types";
import { AdminOverview } from "@/components/examiner/admin/AdminOverview";
import { OverviewStat } from "@/components/examiner/admin/OverviewStat";
import { QuickAction } from "@/components/examiner/admin/QuickAction";
import { FeaturesPanel } from "@/components/examiner/admin/FeaturesPanel";
import { AdminPrincipalTab } from "@/components/examiner/admin/AdminPrincipalTab";
import { AdminCoordinatorTab } from "@/components/examiner/admin/AdminCoordinatorTab";
import { AdminPMTab } from "@/components/examiner/admin/AdminPMTab";
import { AdminCoursesPanel } from "@/components/examiner/admin/AdminCoursesPanel";
import { SystemPanel } from "@/components/examiner/admin/SystemPanel";
import { hasAdminRole, hasPrincipalRole } from "@/lib/client-rbac";
import { AILimitsPanel } from "@/components/examiner/admin/AILimitsPanel";
import { UserAuditTab } from "@/components/examiner/teacher/UserAuditTab";
import { AuditLogPanel } from "@/components/examiner/admin/AuditLogPanel";
import { AccessGrantsPanel } from "@/components/examiner/admin/AccessGrantsPanel";
import { AIConnectionPanel } from "@/components/examiner/admin/AIConnectionPanel";
import { PasswordResetPanel } from "@/components/examiner/admin/PasswordResetPanel";
import { RoleNavConfigPanel } from "@/components/examiner/admin/RoleNavConfigPanel";
import { TeacherBehaviorTab } from "@/components/examiner/admin/TeacherBehaviorTab";
import { LayoutDashboard } from "@/components/examiner/admin/LayoutDashboard";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save, Gauge, Search, ChevronLeft, ChevronRight,
} from "lucide-react";

interface Props {
  initialView?: "overview" | "users" | "courses" | "features" | "resets" | "system" | "principal" | "coordinator" | "pm" | "teacher-behavior" | "ai-limits" | "user-audit";
}

export default function AdminDashboard({ initialView = "overview" }: Props) {
  const [view, setView] = useState<"overview" | "users" | "courses" | "features" | "resets" | "system" | "principal" | "coordinator" | "pm" | "teacher-behavior" | "ai-limits" | "user-audit">(
    initialView === "users" ? "users" :
    initialView === "courses" ? "courses" :
    initialView === "features" ? "features" :
    initialView === "resets" ? "resets" :
    initialView === "system" ? "system" :
    initialView === "principal" ? "principal" :
    initialView === "coordinator" ? "coordinator" :
    initialView === "pm" ? "pm" :
    initialView === "teacher-behavior" ? "teacher-behavior" :
    initialView === "ai-limits" ? "ai-limits" :
    initialView === "user-audit" ? "user-audit" :
    "overview"
  );
  const [users, setUsers] = useState<UserRow[]>([]);
  const [enrollmentsMap, setEnrollmentsMap] = useState<Record<string, Array<{ courseId: string; courseName: string; role: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState("");
  // P1.3: Fetch current user's role for role-based tab visibility
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin");
  // Search + pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number }>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const pageSize = 20;

  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.role) setCurrentUserRole(res.user.role);
    }).catch(() => {/* silent */});
  }, []);

  // P1.3: Role-based tab visibility — different admin roles see different tabs
  const isAdminRole = hasAdminRole(currentUserRole);
  const isPrincipalRole = hasPrincipalRole(currentUserRole);
  const isDevRole = currentUserRole === "demo" || isAdminRole;

  const load = useCallback(async (pageNum?: number) => {
    setLoading(true);
    try {
      const usersRes = await (async () => {
        const isOverview = view === "overview";
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (roleFilter) params.set("role", roleFilter);
        if (!isOverview) {
          params.set("page", String(pageNum ?? page));
          params.set("pageSize", String(pageSize));
        } else {
          params.set("pageSize", "200");
        }
        const qs = params.toString();
        return api.get<{ users: UserRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/users${qs ? `?${qs}` : ""}`);
      })();
      setUsers(usersRes.users);
      if (usersRes.pagination) setPagination(usersRes.pagination);
      // Fetch enrollments for students to show in Courses column
      const studentIds = usersRes.users.filter(u => u.role === "student").map(u => u.id);
      if (studentIds.length > 0) {
        const enrollMap: Record<string, Array<{ courseId: string; courseName: string; role: string }>> = {};
        for (const sid of studentIds) {
          try {
            const res = await api.get<{ enrollments: Array<{ courseId: string; courseName: string; role: string }> }>(`/api/enrollments?userId=${encodeURIComponent(sid)}`);
            enrollMap[sid] = res.enrollments || [];
          } catch {
            enrollMap[sid] = [];
          }
        }
        setEnrollmentsMap(enrollMap);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [searchQuery, roleFilter, page, view]);

  // Debounced search — reload page 1 when searchQuery or roleFilter changes
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(t);
     
  }, [searchQuery, roleFilter]);

  // Reload when page changes
  useEffect(() => { load(); }, [page]);  

  // Reload when view changes (overview needs all users, users tab needs pagination)
  useEffect(() => { load(); }, [view]);  

  useEffect(() => { setView(initialView); }, [initialView]);

  const changeRole = async (id: string, role: string) => {
    if (!confirm(`Change this user's role to "${role}"? This affects their permissions immediately.`)) return;
    setBusy(id);
    try { await api.patch(`/api/users/${id}/role`, { role }); await load(); }
    catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const toggleEnrollment = async (userId: string, courseId: string, action: "enroll" | "unenroll") => {
    setBusy(userId);
    try {
      const role = action === "enroll" ? "student" : undefined;
      await api.patch(`/api/enrollments/${userId}`, { courseId, action, role });
      showSuccess(action === "enroll" ? "Enrolled." : "Unenrolled.");
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  };

  const [enrollDialog, setEnrollDialog] = useState<{ userId: string; open: boolean }>({ userId: "", open: false });

  const remove = async (id: string) => {
    if (!confirm("Delete this user and ALL their data? This cannot be undone.")) return;
    setBusy(id);
    try { await api.del(`/api/users/${id}`); await load(); }
    catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const toggleBlock = async (id: string, currentlyBlocked: boolean) => {
    if (!confirm(`${currentlyBlocked ? "Unblock" : "Block"} this user? ${currentlyBlocked ? "They will be able to log in again." : "They will not be able to log in until unblocked."}`)) return;
    setBusy(id);
    try {
      await api.put(`/api/users/${id}/block`, { blocked: !currentlyBlocked });
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await api.put(`/api/users/${id}/approve`, {});
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  // Batch-approve all pending users — useful when onboarding a batch.
  const approveAllPending = async () => {
    const pendingIds = users.filter(u => u.role === "pending").map(u => u.id);
    if (pendingIds.length === 0) return;
    setBusy("batch-approve");
    try {
      const res = await api.post<{ approved: string[]; skipped: { id: string; reason: string }[] }>("/api/users/batch-approve", { userIds: pendingIds });
      const skippedCount = res.skipped?.length ?? 0;
      showSuccess(`Approved ${res.approved.length} user${res.approved.length === 1 ? "" : "s"}${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}.`);
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Bulk approve failed"); }
    finally { setBusy(null); }
  };

  const reseed = async () => {
    setBusy("seed");
    try {
      await api.get("/api/seed");
      setSeedMsg("✓ Database reseeded.");
      await load();
      setTimeout(() => setSeedMsg(""), 3000);
    } catch (e) { setSeedMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const pending = users.filter(u => u.role === "pending");
  const students = users.filter(u => u.role === "student");
  const teachers = users.filter(u => u.role === "instructor" || u.role === "teacher");
  const blocked = users.filter(u => u.blocked);

  return (
    <div className="space-y-6">
      {/* Tab switcher — P1.3: role-based visibility */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setView("overview")} variant={view === "overview" ? "default" : "outline"} className={view === "overview" ? "bg-primary text-primary-foreground" : "border-border"}>
          <LayoutDashboard className="h-4 w-4" /> Overview
        </Button>
        {/* Principal tab — visible to principal + administrator */}
        {isPrincipalRole && (
          <Button onClick={() => setView("principal")} variant={view === "principal" ? "default" : "outline"} className={view === "principal" ? "bg-primary text-primary-foreground" : "border-border"}>
            <ShieldAlert className="h-4 w-4" /> Principal
          </Button>
        )}
        {/* Teacher Behavior tab — visible to principal + administrator (pastoral data) */}
        {isPrincipalRole && (
          <Button onClick={() => setView("teacher-behavior")} variant={view === "teacher-behavior" ? "default" : "outline"} className={view === "teacher-behavior" ? "bg-primary text-primary-foreground" : "border-border"}>
            <GraduationCap className="h-4 w-4" /> Teacher Behavior
          </Button>
        )}
        {/* Coordinator tab — visible to all admin-equivalent roles */}
        <Button onClick={() => setView("coordinator")} variant={view === "coordinator" ? "default" : "outline"} className={view === "coordinator" ? "bg-primary text-primary-foreground" : "border-border"}>
          <BookOpen className="h-4 w-4" /> Coordinator
        </Button>
        {/* Operations tab — visible to all admin-equivalent roles */}
        <Button onClick={() => setView("pm")} variant={view === "pm" ? "default" : "outline"} className={view === "pm" ? "bg-primary text-primary-foreground" : "border-border"}>
          <ClipboardList className="h-4 w-4" /> Operations
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        {/* Users tab — visible to administrator + principal (user management roles) */}
        {isPrincipalRole && (
          <Button onClick={() => setView("users")} variant={view === "users" ? "default" : "outline"} className={view === "users" ? "bg-primary text-primary-foreground" : "border-border"}>
            <Users className="h-4 w-4" /> Users ({users.length})
          </Button>
        )}
        <Button onClick={() => setView("courses")} variant={view === "courses" ? "default" : "outline"} className={view === "courses" ? "bg-primary text-primary-foreground" : "border-border"}>
          <BookOpen className="h-4 w-4" /> Courses
        </Button>
        {/* Features + Resets — admin only (not demo) */}
        {isAdminRole && (
          <>
            <Button onClick={() => setView("features")} variant={view === "features" ? "default" : "outline"} className={view === "features" ? "bg-primary text-primary-foreground" : "border-border"}>
              <SettingsIcon className="h-4 w-4" /> Features
            </Button>
            <Button onClick={() => setView("resets")} variant={view === "resets" ? "default" : "outline"} className={view === "resets" ? "bg-primary text-primary-foreground" : "border-border"}>
              <Key className="h-4 w-4" /> Resets
            </Button>
          </>
        )}
        {/* AI Limits tab — visible to administrator + principal + demo.
            Demo only sees the demo-AI-enable toggle inside the panel. */}
        {(isAdminRole || isPrincipalRole || isDevRole) && (
          <Button onClick={() => setView("ai-limits")} variant={view === "ai-limits" ? "default" : "outline"} className={view === "ai-limits" ? "bg-primary text-primary-foreground" : "border-border"}>
            <Gauge className="h-4 w-4" /> AI Limits
          </Button>
        )}
        {/* User Audit tab — visible to administrator + principal (NOT demo).
            Lets admins search for any user and view their full audit trail. */}
        {(isAdminRole || isPrincipalRole) && (
          <Button onClick={() => setView("user-audit")} variant={view === "user-audit" ? "default" : "outline"} className={view === "user-audit" ? "bg-primary text-primary-foreground" : "border-border"}>
            <ShieldCheck className="h-4 w-4" /> User Audit
          </Button>
        )}
        {/* System & Dev tab — visible to administrator only (NOT demo).
            Demo is read-only and has no system-level authority. */}
        {isAdminRole && (
          <Button onClick={() => setView("system")} variant={view === "system" ? "default" : "outline"} className={view === "system" ? "bg-primary text-primary-foreground" : "border-border"}>
            <Server className="h-4 w-4" /> System
          </Button>
        )}
      </div>

      {/* Overview tab */}
      {view === "overview" && (
        <AdminOverview users={users} pending={pending} students={students} teachers={teachers} blocked={blocked} onTab={setView} />
      )}

      {/* Phase 8: Principal tab — institutional health */}
      {view === "principal" && (
        <AdminPrincipalTab users={users} students={students} teachers={teachers} pending={pending} blocked={blocked} />
      )}

      {/* Teacher Behavior tab — teacher AI Assistant usage + behavioral signals */}
      {view === "teacher-behavior" && <TeacherBehaviorTab />}

      {/* Phase 8: Coordinator tab — curriculum management */}
      {view === "coordinator" && <AdminCoordinatorTab />}

      {/* Phase 8: PM tab — operations + delivery */}
      {view === "pm" && <AdminPMTab users={users} students={students} pending={pending} />}

      {/* Courses tab — Phase fix: admin can now see + manage courses directly
          from the admin panel without navigating to the separate Course Planner */}
      {view === "courses" && <AdminCoursesPanel />}

      {/* Users tab */}
      {view === "users" && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-foreground">All Users ({pagination.total})</CardTitle>
                <CardDescription className="text-muted-foreground">Manage roles, approvals, blocks, and accounts</CardDescription>
              </div>
              <div className="flex gap-2">
                {pending.length > 0 && (
                  <Button onClick={approveAllPending} disabled={busy === "batch-approve"} variant="outline" size="sm" className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
                    {busy === "batch-approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />} Approve All Pending ({pending.length})
                  </Button>
                )}
                <Button onClick={() => load()} disabled={loading} variant="outline" size="sm" className="border-border">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
                </Button>
              </div>
            </div>
            {seedMsg && <span className="text-xs text-primary">{seedMsg}</span>}
            {/* Search + filter bar */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All roles</option>
                <option value="pending">Pending</option>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="teacher">Teacher (legacy)</option>
                <option value="course_coordinator">Course Coordinator</option>
                <option value="counselor">Counselor</option>
                <option value="guardian">Guardian</option>
                <option value="principal">Principal</option>
                <option value="administrator">Administrator</option>
                <option value="demo">Demo</option>
              </select>
              {(searchQuery || roleFilter) && (
                <Button
                  onClick={() => { setSearchQuery(""); setRoleFilter(""); }}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3 hidden sm:table-cell">Email</th>
                    <th className="text-left py-2 px-3">Role</th>
                    <th className="text-left py-2 px-3 hidden lg:table-cell">Courses</th>
                    <th className="text-left py-2 px-3 hidden md:table-cell">Project</th>
                    <th className="text-left py-2 px-3 hidden md:table-cell">Last Login</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b border-border hover:bg-muted/50 ${u.blocked ? "opacity-50" : ""}`}>
                      <td className="py-2 px-3 text-foreground font-medium">
                        {u.name}
                        {u.blocked && <Badge variant="outline" className="ml-2 text-[9px] text-red-500 border-red-500/30 bg-red-500/10">Blocked</Badge>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                      <td className="py-2 px-3">
                        <Select value={u.role || "pending"} onValueChange={(r) => changeRole(u.id, r)} disabled={busy === u.id || u.email === "admin@examiner.ai" || currentUserRole === "demo"}>
                          <SelectTrigger className="bg-muted border-border h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="instructor">Instructor / Mentor</SelectItem>
                            <SelectItem value="teacher">Teacher (legacy)</SelectItem>
                            <SelectItem value="course_coordinator">Course Coordinator</SelectItem>
                            <SelectItem value="counselor">Counselor</SelectItem>
                            <SelectItem value="guardian">Guardian</SelectItem>
                            <SelectItem value="principal">Principal</SelectItem>
                            <SelectItem value="administrator">Administrator</SelectItem>
                            <SelectItem value="demo">Demo (read-only)</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {u.role === "student" && enrollmentsMap[u.id]?.length > 0 ? (
                            enrollmentsMap[u.id].map((enr, ei) => (
                              <Badge key={ei} variant="secondary" className="text-[9px] px-1.5 py-0">
                                {enr.courseName}
                                {isAdminRole && (
                                  <button
                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                    onClick={() => toggleEnrollment(u.id, enr.courseId, "unenroll")}
                                    title="Remove from course"
                                  >
                                    ×
                                  </button>
                                )}
                              </Badge>
                            ))
                          ) : u.role === "student" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {u.role === "student" && isAdminRole && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[9px] h-5 px-1.5 border-dashed"
                              onClick={() => setEnrollDialog({ userId: u.id, open: true })}
                            >
                              + Enroll
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">{u.projectName || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {u.email !== "admin@examiner.ai" && currentUserRole !== "demo" && (
                            <>
                              {u.role === "pending" && (
                                <Button size="sm" variant="ghost" onClick={() => approve(u.id)} disabled={busy === u.id} className="h-7 w-7 p-0 text-emerald-600" title="Approve" aria-label="Approve user">
                                  {busy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => toggleBlock(u.id, u.blocked)} disabled={busy === u.id} className={`h-7 w-7 p-0 ${u.blocked ? "text-emerald-600" : "text-amber-600"}`} title={u.blocked ? "Unblock" : "Block"}>
                                <Ban className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => remove(u.id)} disabled={busy === u.id} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete" aria-label="Delete user">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {currentUserRole === "demo" && (
                            <span className="text-[10px] text-muted-foreground italic px-2">read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} users
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || loading}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-border"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-border"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            {pagination.total === 0 && !loading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No users found. {searchQuery || roleFilter ? "Try adjusting your search or filters." : "No users in the database."}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Features tab */}
      {view === "features" && <FeaturesPanel />}

      {/* Resets tab */}
      {view === "resets" && <PasswordResetPanel />}

      {/* AI Limits tab — per-user daily rate limits + demo AI toggle.
          Demo only sees the demo-AI-enable toggle (the AILimitsPanel
          component handles this by checking the current user's role). */}
      {view === "ai-limits" && <AILimitsPanel />}

      {/* User Audit tab — search any user + view their full audit trail.
          Admin/principal only. Lets admins audit teachers, counselors,
          other admins — not just students. */}
      {view === "user-audit" && <UserAuditSearchPanel />}

      {/* System & Dev tab — ALL dev stuff here, nowhere else.
          Admin-only (NOT demo) — the tab button is hidden from demo above. */}
      {view === "system" && <SystemPanel users={users} />}

      {/* Enroll Dialog — assign a student to a course */}
      {enrollDialog.open && enrollDialog.userId && (
        <EnrollDialog
          userId={enrollDialog.userId}
          onClose={() => setEnrollDialog({ userId: "", open: false })}
          onEnrolled={() => { setEnrollDialog({ userId: "", open: false }); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// User Audit Search Panel — lets admin search for any user
// and view their full audit trail (actions BY + ABOUT them).
// ============================================================
function UserAuditSearchPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", searchQuery.trim());
      params.set("pageSize", "20");
      const res = await api.get<{ users: UserRow[] }>(`/api/users?${params.toString()}`);
      setSearchResults(res.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
     
  }, [searchQuery]);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> User Audit Trail
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Search for any user (student, teacher, counselor, admin) to view their complete audit trail — all actions they performed and all actions taken about them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedUserId(null); }}
            placeholder="Search by name or email to find a user..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Search results */}
        {searchQuery.trim() && !selectedUserId && (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
            ) : (
              searchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="w-full flex items-center justify-between p-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{u.role}</Badge>
                </button>
              ))
            )}
          </div>
        )}

        {/* Selected user's audit trail */}
        {selectedUserId && (
          <div className="space-y-3">
            <Button onClick={() => setSelectedUserId(null)} variant="outline" size="sm" className="border-border">
              <ChevronLeft className="h-3 w-3" /> Back to search results
            </Button>
            <UserAuditTab userId={selectedUserId} />
          </div>
        )}

        {/* Empty state */}
        {!searchQuery.trim() && !selectedUserId && (
          <div className="text-center py-8">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Start typing to search for a user.</p>
            <p className="text-xs text-muted-foreground mt-1">You can view the audit trail for any user — students, teachers, counselors, and admins.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Overview tab — clean admin dashboard with stats + quick actions
// ============================================================
// ============================================================
// Features tab — toggle app features on/off
// ============================================================
// ============================================================
// Phase 8: Principal Tab — institutional health from the school
// principal's perspective. Enrollment funnel, completion rates,
// certificates, wellbeing summary.
// ============================================================
// ============================================================
// Phase 8: Coordinator Tab — curriculum management from the
// course coordinator's perspective. Course catalog, batch
// assignments, content quality.
// ============================================================
// ============================================================
// Phase 8: PM Tab — operations + delivery from the project
// manager's perspective. Action items, bottlenecks, AI cost.
// ============================================================
// ============================================================
// Courses tab — admin can see + manage courses directly from the admin
// panel. Shows the course list with week/day counts, batch assignments,
// and quick actions (edit, delete, seed default). Links to the full
// Course Planner for detailed editing.
// ============================================================
// ============================================================
// System & Dev tab — completely rewritten Phase 8
// Professional admin tooling: env vars, deployment info, DB stats,
// feature flags inline, system health, AI management, struggle
// detection, admin actions, recent activity.
// ============================================================
// ============================================================
// AuditLogPanel — Phase RBAC+AUDIT Phase 4 viewer.
// ============================================================
// ============================================================
// AccessGrantsPanel — Phase RBAC+AUDIT Phase 2 viewer.
// ============================================================
// ============================================================
// Password Reset Panel (kept from before)
// ============================================================
// LayoutDashboard icon (not imported from lucide in the main imports)
// ============================================================
// RoleNavConfigPanel — admin assigns nav items per role.
//
// Admin picks which tabs each role sees in their sidebar.
// Changes take effect immediately (AppShell re-fetches on next load).
// A "Reset to defaults" button restores the hardcoded defaults.
//
// Use case: "I want TA to see only educational data, guardians just
// to see overview of student progress, counselor to just see data
// important for counselor, etc."
// ============================================================

// ============================================================
// EnrollDialog — modal to enroll a student in a course
// ============================================================
function EnrollDialog({ userId, onClose, onEnrolled }: {
  userId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ courses: Array<{ id: string; name: string }> }>("/api/courses")
      .then(res => setCourses(res.courses || []))
      .catch(() => setError("Failed to load courses"));
  }, []);

  const enroll = async (courseId: string) => {
    setBusy(courseId);
    setError("");
    try {
      await api.patch(`/api/enrollments/${userId}`, { courseId, action: "enroll", role: "student" });
      onEnrolled();
    } catch (e: any) {
      setError(e?.message || "Failed to enroll");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Enroll in Course</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-2 max-h-60 overflow-y-auto">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {courses.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">Loading courses...</p>
          )}
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => enroll(c.id)}
              disabled={busy === c.id}
              className="w-full flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <span className="font-medium text-foreground">{c.name}</span>
              {busy === c.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border text-right">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}