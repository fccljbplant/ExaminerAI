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
  ShieldCheck, Save,
} from "lucide-react";

interface Props {
  initialView?: "overview" | "users" | "courses" | "features" | "resets" | "system" | "principal" | "coordinator" | "pm" | "teacher-behavior";
}

export default function AdminDashboard({ initialView = "overview" }: Props) {
  const [view, setView] = useState<"overview" | "users" | "courses" | "features" | "resets" | "system" | "principal" | "coordinator" | "pm" | "teacher-behavior">(
    initialView === "users" ? "users" :
    initialView === "courses" ? "courses" :
    initialView === "features" ? "features" :
    initialView === "resets" ? "resets" :
    initialView === "system" ? "system" :
    initialView === "principal" ? "principal" :
    initialView === "coordinator" ? "coordinator" :
    initialView === "pm" ? "pm" :
    initialView === "teacher-behavior" ? "teacher-behavior" :
    "overview"
  );
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState("");
  // P1.3: Fetch current user's role for role-based tab visibility
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin");
  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.role) setCurrentUserRole(res.user.role);
    }).catch(() => {/* silent */});
  }, []);

  // P1.3: Role-based tab visibility — different admin roles see different tabs
  const isAdminRole = ["administrator", "admin", "platform_admin"].includes(currentUserRole);
  const isPrincipalRole = ["principal", "institution_admin"].includes(currentUserRole) || isAdminRole;
  const isDevRole = ["developer"].includes(currentUserRole) || isAdminRole;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ users: UserRow[] }>("/api/users");
      setUsers(res.users);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (id: string, role: string) => {
    setBusy(id);
    try { await api.patch(`/api/users/${id}/role`, { role }); await load(); }
    catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this user and ALL their data? This cannot be undone.")) return;
    setBusy(id);
    try { await api.del(`/api/users/${id}`); await load(); }
    catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const toggleBlock = async (id: string, currentlyBlocked: boolean) => {
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
    } catch (e) { showError(e instanceof Error ? e.message : "Batch approve failed"); }
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
  const teachers = users.filter(u => u.role === "teacher");
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
        {/* Features + Resets — admin only (not developer) */}
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
        {/* System & Dev tab — visible to developer + administrator */}
        {isDevRole && (
          <Button onClick={() => setView("system")} variant={view === "system" ? "default" : "outline"} className={view === "system" ? "bg-primary text-primary-foreground" : "border-border"}>
            <Server className="h-4 w-4" /> System &amp; Dev
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">All Users ({users.length})</CardTitle>
                <CardDescription className="text-muted-foreground">Manage roles, approvals, blocks, and accounts</CardDescription>
              </div>
              <div className="flex gap-2">
                {pending.length > 0 && (
                  <Button onClick={approveAllPending} disabled={busy === "batch-approve"} variant="outline" size="sm" className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
                    {busy === "batch-approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />} Approve All Pending ({pending.length})
                  </Button>
                )}
                <Button onClick={reseed} disabled={busy === "seed"} variant="outline" size="sm" className="border-border">
                  {busy === "seed" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Reseed
                </Button>
                <Button onClick={load} variant="outline" size="sm" className="border-border">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              </div>
            </div>
            {seedMsg && <span className="text-xs text-primary">{seedMsg}</span>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3 hidden sm:table-cell">Email</th>
                    <th className="text-left py-2 px-3">Role</th>
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
                        <Select value={u.role || "pending"} onValueChange={(r) => changeRole(u.id, r)} disabled={busy === u.id || u.email === "admin@examiner.ai"}>
                          <SelectTrigger className="bg-muted border-border h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="teacher">Teacher / Mentor</SelectItem>
                            <SelectItem value="course_coordinator">Course Coordinator</SelectItem>
                            <SelectItem value="counselor">Counselor</SelectItem>
                            <SelectItem value="guardian">Guardian</SelectItem>
                            <SelectItem value="principal">Principal</SelectItem>
                            <SelectItem value="administrator">Administrator</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">{u.projectName || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {u.email !== "admin@examiner.ai" && (
                            <>
                              {u.role === "pending" && (
                                <Button size="sm" variant="ghost" onClick={() => approve(u.id)} disabled={busy === u.id} className="h-7 w-7 p-0 text-emerald-600" title="Approve">
                                  {busy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => toggleBlock(u.id, u.blocked)} disabled={busy === u.id} className={`h-7 w-7 p-0 ${u.blocked ? "text-emerald-600" : "text-amber-600"}`} title={u.blocked ? "Unblock" : "Block"}>
                                <Ban className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => remove(u.id)} disabled={busy === u.id} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features tab */}
      {view === "features" && <FeaturesPanel />}

      {/* Resets tab */}
      {view === "resets" && <PasswordResetPanel />}

      {/* System & Dev tab — ALL dev stuff here, nowhere else */}
      {view === "system" && <SystemPanel users={users} />}
    </div>
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