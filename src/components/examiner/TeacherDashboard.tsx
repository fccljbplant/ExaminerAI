"use client";
import { showError } from "@/lib/toast-helpers";
import { StudentPortfolioPage } from "@/components/examiner/teacher/StudentPortfolioPage";
import { MentorshipTab } from "@/components/examiner/teacher/MentorshipTab";
import { StatCard } from "@/components/examiner/teacher/StatCard";
import { TeacherCourseProgressView } from "@/components/examiner/teacher/TeacherCourseProgressView";
import { computeMasteryFromInteractions } from "@/components/examiner/teacher/computeMasteryFromInteractions";
import { CalibrationScatterCard } from "@/components/examiner/teacher/CalibrationScatterCard";
import { AssignmentsTab } from "@/components/examiner/teacher/AssignmentsTab";
import { PeerAssessmentTeacherView } from "@/components/examiner/teacher/PeerAssessmentTeacherView";
import type { TeacherView } from "@/components/examiner/teacher/types";
// TeacherShell not used — AppShell sidebar handles main nav, sub-tabs handle teacher nav
import { TodayView } from "@/components/examiner/teacher/TodayView";
import { StudentsRoster } from "@/components/examiner/teacher/StudentsRoster";
import { BatchView } from "@/components/examiner/teacher/BatchView";
import { MyLoadView } from "@/components/examiner/teacher/MyLoadView";
import { CoPilotBox } from "@/components/examiner/teacher/ai/CoPilotBox";
import { VoiceTouchpointLogger } from "@/components/examiner/teacher/VoiceTouchpointLogger";
import { TeacherRulesPanel } from "@/components/examiner/teacher/TeacherRulesPanel";
import { CaseReviewPanel } from "@/components/examiner/teacher/CaseReviewPanel";
import type { StudentRow, PortfolioData } from "@/components/examiner/teacher/types";

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scoreToGrade, gradeColor } from "@/lib/constants";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  CalendarDays,
  GraduationCap, HeartHandshake, Plus, Download, Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ReferenceLine, Cell,
} from "recharts";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui/empty-state";
import { exportToCSV } from "@/lib/csv-export";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  approvedAt: string | null;
  createdAt: string;
  lastLogin: string | null;
  currentWeek: number;
  projectName?: string | null;
}

interface StatsResponse {
  role: "teacher";
  stats: {
    totalStudents: number;
    pendingApprovals: number;
    totalTeachers: number;
    testsThisWeek: number;
    studentsWithProjects: number;
    studentsWithoutProjects: number;
    // Phase 3.1: attention summary
    studentsNeedingAttention?: number;
    // D3: server-side aggregates for full batch (not just paginated page)
    totalWithTests?: number;
    totalActiveToday?: number;
    // Scale: pagination metadata
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
    loadedCount?: number;
  };
  students: StudentRow[];
}

export default function TeacherDashboard() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  // Phase 7: Teacher tab system — now uses TeacherShell sidebar
  const [teacherTab, setTeacherTab] = useState<TeacherView>("today");
  // Phase B.5: Search + filter for the student table
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<"all" | "attention" | "ontrack" | "project" | "noproject">("all");
  // Scale: client-side pagination on the student table (25 per page)
  const [studentPage, setStudentPage] = useState(0);
  const STUDENT_PAGE_SIZE = 25;
  const c = useChartColors();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // Admin impersonating teacher should see real batch data.
      // Use AI_TIMEOUT_MS (60s) — the stats route does heavy DB work
      // (fetches all students + their tasks, tests, interactions).
      const [statsRes, usersRes] = await Promise.all([
        api.get<StatsResponse>("/api/stats?as=teacher", undefined, AI_TIMEOUT_MS),
        api.get<{ users: UserRow[] }>("/api/users", undefined, AI_TIMEOUT_MS),
      ]);
      setData(statsRes);
      setUsers(usersRes.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setApprovingId(id);
    try {
      await api.put(`/api/users/${id}/approve`, {});
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovingId(null);
    }
  };

  const toggleBlock = async (id: string, currentlyBlocked: boolean) => {
    if (!confirm(currentlyBlocked ? "Unblock this user?" : `Block this user? They will not be able to log in until unblocked.`)) return;
    setApprovingId(id);
    try {
      await api.put(`/api/users/${id}/block`, { blocked: !currentlyBlocked });
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovingId(null);
    }
  };

  const sendMessage = async () => {
    if (!composeTo || !composeBody.trim()) return;
    setSending(true);
    try {
      await api.post("/api/messages", { toId: composeTo, subject: composeSubject, body: composeBody });
      setComposeOpen(false); setComposeTo(""); setComposeSubject(""); setComposeBody("");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  // Scale: Reset page when filter changes — MUST be before any early returns
  // to avoid violating React's Rules of Hooks (hooks must run in the same
  // order every render, but early returns skip subsequent hooks).
  useEffect(() => { setStudentPage(0); }, [studentSearch, studentFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <Alert className="border-destructive/30 bg-transparent">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Something went wrong</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {error || "Unable to load batch data."}
            </AlertDescription>
          </Alert>
          <Button onClick={load} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pending = users.filter((u) => u.role === "pending");
  const chartData = data.students.map((s) => ({ name: s.name.split(" ")[0], progress: s.progress, score: s.latestScore ?? 0 }));
  const studentsWithProjects = data.students.filter((s) => s.hasProject);
  const studentsNeedingAttention = data.students.filter((s) => s.hasProject && (s.blockedTasks > 0 || s.progress < 30));

  // Phase B.5: Filtered + searched students for the table
  const filteredStudents = data.students.filter((s) => {
    // Text search across name + email (case-insensitive)
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
    }
    // Status filter
    switch (studentFilter) {
      case "attention": return s.needsAttention === true;
      case "ontrack": return !s.needsAttention;
      case "project": return s.hasProject;
      case "noproject": return !s.hasProject;
      default: return true;
    }
  });

  // Scale: paginate the filtered list (25 per page)
  const totalStudentPages = Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE);
  const pagedStudents = filteredStudents.slice(
    studentPage * STUDENT_PAGE_SIZE,
    (studentPage + 1) * STUDENT_PAGE_SIZE
  );

  // If a student is selected, show the full-page portfolio view (not a dialog)
  if (selectedStudent) {
    return (
      <StudentPortfolioPage
        student={selectedStudent}
        onBack={() => { setSelectedStudent(null); load(); }}
        onMessage={(studentId) => { setSelectedStudent(null); setComposeTo(studentId); setComposeOpen(true); }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Sub-navigation tabs */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-2">
        {([
          { key: "today", label: "Today", icon: CalendarDays },
          { key: "students", label: "Students", icon: Users },
          { key: "batch", label: "Batch", icon: GraduationCap },
          { key: "mentorship", label: "Mentorship", icon: HeartHandshake },
          { key: "assignments", label: "Assignments", icon: ClipboardList },
          { key: "messages", label: "Messages", icon: Mail },
          { key: "myload", label: "My Load", icon: Activity },
          { key: "settings", label: "Settings", icon: SettingsIcon },
        ] as const).map(item => {
          const Icon = item.icon;
          const isActive = teacherTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTeacherTab(item.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </div>
      {/* ===== TODAY VIEW (new — triage list) ===== */}
      {teacherTab === "today" && data && (
        <div className="space-y-4">
          <TodayView
            students={data.students}
            onStudentClick={(s) => setSelectedStudent(s)}
            onViewChange={(v) => setTeacherTab(v as TeacherView)}
          />
          <CoPilotBox
            students={data.students}
            onStudentClick={(s) => setSelectedStudent(s)}
          />
        </div>
      )}

      {/* ===== STUDENTS ROSTER (new — unified, replaces Psych/Edu tabs) ===== */}
      {teacherTab === "students" && data && (
        <StudentsRoster
          students={data.students}
          onStudentClick={(s) => setSelectedStudent(s)}
        />
      )}

      {/* ===== BATCH VIEW (fixed — replaces old Overview tab) ===== */}
      {teacherTab === "batch" && data && (
        <BatchView students={data.students} stats={data.stats} onStudentClick={(s) => setSelectedStudent(s)} />
      )}

      {/* ===== MENTORSHIP (keep existing + add voice logger + case review + rules) ===== */}
      {teacherTab === "mentorship" && (
        <div className="space-y-4">
          <VoiceTouchpointLogger onLogged={() => { /* could refresh mentorship data */ }} />
          <MentorshipTab students={data?.students || []} onCompose={(studentId) => { setComposeTo(studentId); setComposeOpen(true); }} />
          <CaseReviewPanel />
          <TeacherRulesPanel />
        </div>
      )}

      {/* ===== ASSIGNMENTS (keep existing) ===== */}
      {teacherTab === "assignments" && data && (
        <AssignmentsTab students={data.students} />
      )}

      {/* ===== MESSAGES (keep existing — badge count in sidebar) ===== */}
      {teacherTab === "messages" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Messages</CardTitle>
            <CardDescription>View and send messages to students and staff.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => { setComposeOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Send className="h-4 w-4 mr-1" /> New Message
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Full message inbox coming soon. For now, use the compose dialog.</p>
          </CardContent>
        </Card>
      )}

      {/* ===== MY LOAD (teacher wellbeing) ===== */}
      {teacherTab === "myload" && (
        <MyLoadView />
      )}

      {/* ===== SETTINGS (keep existing) ===== */}
      {teacherTab === "settings" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Teacher Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Profile, notification preferences, and password management.</p>
            <Button variant="outline" className="border-border" onClick={() => { window.location.href = "/api/auth/change-password"; }}>
              Change Password
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Legacy overview content — shown when "batch" is selected and data exists */}
      {teacherTab === "batch" && data && data.stats.totalStudents > 0 && (
        <div className="mt-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total Students" value={data.stats.totalStudents} icon={<Users className="h-4 w-4" />} accent="emerald" />
            <StatCard label="Pending Approvals" value={data.stats.pendingApprovals} icon={<UserCheck className="h-4 w-4" />} accent="amber" />
            <StatCard label="Active Projects" value={data.stats.studentsWithProjects} sub={`${data.stats.studentsWithoutProjects} not started`} icon={<FolderOpen className="h-4 w-4" />} accent="cyan" />
            <StatCard label="Tests This Week" value={data.stats.testsThisWeek} icon={<CheckCircle2 className="h-4 w-4" />} accent="violet" />
            <StatCard
              label="Needs Attention"
              value={data.stats.studentsNeedingAttention ?? 0}
              sub={data.stats.studentsNeedingAttention ? "see red flags below" : "all on track"}
              icon={<AlertCircle className="h-4 w-4" />}
              accent={data.stats.studentsNeedingAttention ? "red" : "emerald"}
            />
          </div>

      {/* Scale: Batch Stats Dashboard — uses server-side aggregates (D3 fix)
          so averages are correct even when batch > 100 students (paginated) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Batch Analytics
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Aggregate stats across all {data.stats.totalStudents} students · {data.stats.loadedCount ?? data.students.length} loaded on this page
                {data.stats.hasMore && <span className="text-amber-600"> (more available — use pagination)</span>}
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                exportToCSV(`batch-stats-${new Date().toISOString().slice(0, 10)}.csv`,
                  data.students.map(s => ({
                    Name: s.name, Email: s.email, Week: s.currentWeek,
                    Progress: `${s.progress}%`, Score: s.latestScore ?? "",
                    Attention: s.needsAttention ? "Yes" : "No",
                    AttentionScore: s.attentionScore ?? 0,
                    AttentionReasons: (Array.isArray(s.attentionReasons) ? s.attentionReasons : []).join("; "),
                    Interactions: s.interactions,
                    LastActive: s.lastActive ?? "",
                  }))
                );
              }}
              size="sm" variant="outline" className="border-border"
            >
              <Download className="h-3 w-3" /> Export Full Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Avg score */}
            {(() => {
              const scores = data.students.map(s => s.latestScore).filter((s): s is number => s !== null);
              const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
              const gradeA = scores.filter(s => s >= 90).length;
              const gradeF = scores.filter(s => s < 60).length;
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Avg Score</p>
                  <p className="text-xl font-bold text-foreground">{avg}%</p>
                  <p className="text-[9px] text-muted-foreground">{scores.length} tests graded</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-600">{gradeA} A's</Badge>
                    {gradeF > 0 && <Badge variant="outline" className="text-[8px] bg-red-500/10 text-red-600">{gradeF} F's</Badge>}
                  </div>
                </div>
              );
            })()}
            {/* Avg progress */}
            {(() => {
              const avgProgress = data.students.length > 0
                ? Math.round(data.students.reduce((a, s) => a + s.progress, 0) / data.students.length) : 0;
              const notStarted = data.students.filter(s => s.progress === 0).length;
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Avg Progress</p>
                  <p className="text-xl font-bold text-foreground">{avgProgress}%</p>
                  <p className="text-[9px] text-muted-foreground">{notStarted} not started</p>
                </div>
              );
            })()}
            {/* Attention distribution */}
            {(() => {
              const attention = data.students.filter(s => s.needsAttention).length;
              const onTrack = data.students.length - attention;
              const pct = data.students.length > 0 ? Math.round((attention / data.students.length) * 100) : 0;
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Needs Attention</p>
                  <p className="text-xl font-bold text-amber-600">{attention}</p>
                  <p className="text-[9px] text-muted-foreground">{pct}% of batch · {onTrack} on track</p>
                </div>
              );
            })()}
            {/* Test completion rate — D3: use server-side totalWithTests */}
            {(() => {
              const withTests = data.stats.totalWithTests ?? data.students.filter(s => s.latestScore !== null).length;
              const rate = data.stats.totalStudents > 0 ? Math.round((withTests / data.stats.totalStudents) * 100) : 0;
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Test Completion</p>
                  <p className="text-xl font-bold text-foreground">{rate}%</p>
                  <p className="text-[9px] text-muted-foreground">{withTests}/{data.stats.totalStudents} have scores</p>
                </div>
              );
            })()}
            {/* Project engagement — D3: use server-side studentsWithProjects */}
            {(() => {
              const withProjects = data.stats.studentsWithProjects;
              const blockedTasks = data.students.reduce((a, s) => a + s.blockedTasks, 0);
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Project Engagement</p>
                  <p className="text-xl font-bold text-foreground">{withProjects}</p>
                  <p className="text-[9px] text-muted-foreground">{blockedTasks} blocked tasks (this page)</p>
                </div>
              );
            })()}
            {/* Active today — D3: use server-side totalActiveToday */}
            {(() => {
              const activeToday = data.stats.totalActiveToday ?? (() => {
                const today = new Date().toISOString().slice(0, 10);
                return data.students.filter(s => s.lastActive && s.lastActive.slice(0, 10) === today).length;
              })();
              return (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">Active Today</p>
                  <p className="text-xl font-bold text-foreground">{activeToday}</p>
                  <p className="text-[9px] text-muted-foreground">{data.stats.totalStudents - activeToday} inactive</p>
                </div>
              );
            })()}
          </div>

          {/* Score distribution bar chart */}
          {(() => {
            const scores = data.students.map(s => s.latestScore).filter((s): s is number => s !== null);
            if (scores.length === 0) return null;
            const dist = [
              { range: "A (90-100)", count: scores.filter(s => s >= 90).length, fill: "#10b981" },
              { range: "B (80-89)", count: scores.filter(s => s >= 80 && s < 90).length, fill: "#84cc16" },
              { range: "C (70-79)", count: scores.filter(s => s >= 70 && s < 80).length, fill: "#f59e0b" },
              { range: "D (60-69)", count: scores.filter(s => s >= 60 && s < 70).length, fill: "#f97316" },
              { range: "F (<60)", count: scores.filter(s => s < 60).length, fill: "#ef4444" },
            ];
            return (
              <div className="mt-4">
                <p className="text-xs font-medium text-foreground mb-2">Score Distribution</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dist}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                    <XAxis dataKey="range" stroke={c.axis} tick={{ fontSize: 10 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle(c)} />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {dist.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Phase 3.1: Attention alert banner — shown when students need help.
          Phase C: uses growth-coral soft tint instead of harsh red. */}
      {data.stats.studentsNeedingAttention && data.stats.studentsNeedingAttention > 0 && (
        <Card className="border-growth-coral bg-growth-coral-soft">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-growth-coral flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {data.stats.studentsNeedingAttention} student{data.stats.studentsNeedingAttention === 1 ? "" : "s"} need{data.stats.studentsNeedingAttention === 1 ? "s" : ""} attention
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Students are sorted by attention score (highest first). Coral dots + badges show the specific concerns.
                  Click a student to view their full portfolio + reach out.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="border-primary/30 bg-secondary/20">
          <CardHeader><CardTitle className="text-base text-primary">Pending Approvals ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {/* Phase C: staggered entrance — approvals fade in one by one */}
            <div className="animate-stagger">
              {pending.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md bg-secondary/40 p-3" style={{ ["--stagger-index" as string]: pending.indexOf(u) }}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => approve(u.id)} disabled={approvingId === u.id} size="sm" className="bg-primary hover:bg-primary/90 text-foreground">
                      {approvingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                      Approve
                    </Button>
                    <Button onClick={() => toggleBlock(u.id, false)} disabled={approvingId === u.id} size="sm" variant="outline" className="border-amber-500/30 text-amber-600">
                      Block
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects needing attention — surfaced on the main dashboard */}
      {studentsNeedingAttention.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Projects Needing Attention
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Students with blocked tasks or low progress — click to review &amp; comment
                </CardDescription>
              </div>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">{studentsNeedingAttention.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentsNeedingAttention.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedStudent(s); setPortfolioOpen(true); }}
                className="w-full flex items-center justify-between rounded-md bg-amber-500/10 hover:bg-amber-500/20 p-3 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-700">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.blockedTasks > 0 ? `${s.blockedTasks} blocked task${s.blockedTasks > 1 ? "s" : ""}` : `${s.progress}% progress`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={s.progress} className="h-1.5 w-20" />
                  <MessageSquare className="h-4 w-4 text-amber-600" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Batch progress chart */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Batch Progress</CardTitle>
          <CardDescription className="text-muted-foreground">Per-student completion % and latest test score</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            /* Phase C: illustrated empty state replaces bare text */
            <EmptyState
              icon={Users}
              title="No students enrolled yet"
              description="Student progress charts will appear here once students sign up and are approved."
              tone="sage"
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis dataKey="name" stroke={c.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={c.axis} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle(c)} cursor={{ fill: c.cursorFill }} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="progress" fill={c.chart1} radius={[4, 4, 0, 0]} name="Progress %" />
                <Bar dataKey="score" fill={c.chart2} radius={[4, 4, 0, 0]} name="Latest Score" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Students table — now with project column */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base text-foreground">Students</CardTitle>
              <CardDescription className="text-muted-foreground">
                {filteredStudents.length === data.students.length
                  ? `${data.students.length} active · ${data.stats.studentsWithProjects} with projects · click any row to view portfolio & comment`
                  : `${filteredStudents.length} of ${data.students.length} shown · click any row to view portfolio & comment`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                exportToCSV(`students-${new Date().toISOString().slice(0, 10)}.csv`,
                  filteredStudents.map(s => ({
                    Name: s.name,
                    Email: s.email,
                    Week: s.currentWeek,
                    Progress: `${s.progress}%`,
                    LatestScore: s.latestScore ?? "",
                    HasProject: s.hasProject ? "Yes" : "No",
                    TasksCompleted: s.completedTasks,
                    TasksTotal: s.taskCount,
                    NeedsAttention: s.needsAttention ? "Yes" : "No",
                    LastActive: s.lastActive ?? "",
                  }))
                );
              }} size="sm" variant="outline" className="border-border">
                <Download className="h-3 w-3" /> Export CSV
              </Button>
              <Button onClick={() => setComposeOpen(true)} size="sm" className="bg-primary hover:bg-primary/90 text-foreground">
                <Mail className="h-3 w-3" /> Message
              </Button>
            </div>
          </div>
          {/* Phase B.5: Search + filter row */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="bg-muted border-border pr-8 text-sm"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <Select value={studentFilter} onValueChange={(v) => setStudentFilter(v as typeof studentFilter)}>
              <SelectTrigger className="bg-muted border-border w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
                <SelectItem value="ontrack">On track</SelectItem>
                <SelectItem value="project">Has project</SelectItem>
                <SelectItem value="noproject">No project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Email</th>
                  <th className="text-left py-2 px-3 font-medium">Week</th>
                  <th className="text-left py-2 px-3 font-medium">Project</th>
                  <th className="text-left py-2 px-3 font-medium">Progress</th>
                  <th className="text-left py-2 px-3 font-medium">Score</th>
                  <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Interactions</th>
                  <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Last Active</th>
                  {/* Phase 3.1: Attention column header */}
                  <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {data.students.length === 0
                        ? "No students enrolled yet."
                        : "No students match your search or filter."}
                    </td>
                  </tr>
                ) : (
                  pagedStudents.map((s) => (
                    <tr key={s.id} className={`border-b border-border hover:bg-muted/50 cursor-pointer ${s.needsAttention ? "bg-red-500/5" : ""}`} onClick={() => { setSelectedStudent(s); setPortfolioOpen(true); }}>
                      <td className="py-2 px-3 text-foreground font-medium">
                        <div className="flex items-center gap-2">
                          {/* Phase 3.1: Red dot for students who need attention */}
                          {s.needsAttention && (
                            <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" title={(Array.isArray(s.attentionReasons) ? s.attentionReasons : []).join(", ")} />
                          )}
                          {s.name}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{s.email}</td>
                      <td className="py-2 px-3 text-foreground/80">{s.currentWeek}</td>
                      <td className="py-2 px-3">
                        {s.hasProject ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            {s.completedTasks}/{s.taskCount} tasks
                            {s.blockedTasks > 0 && <span className="ml-1 text-amber-600">· {s.blockedTasks} blocked</span>}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">No project</Badge>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={s.progress} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {s.latestScore !== null ? (
                          <span className={`font-bold ${gradeColor(scoreToGrade(s.latestScore))}`}>{s.latestScore}%</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-foreground/80 hidden md:table-cell">{s.interactions}</td>
                      <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">{s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}</td>
                      {/* Phase 3.1: Attention reasons column (visible on large screens) */}
                      <td className="py-2 px-3 hidden lg:table-cell max-w-[200px]">
                        {s.attentionReasons && s.attentionReasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.attentionReasons.slice(0, 2).map((reason, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/30">
                                {reason}
                              </Badge>
                            ))}
                            {s.attentionReasons.length > 2 && (
                              <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground">
                                +{s.attentionReasons.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-emerald-600">On track</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Scale: pagination controls */}
          {totalStudentPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-muted-foreground">
                Page {studentPage + 1} of {totalStudentPages} · {filteredStudents.length} students
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={studentPage === 0} onClick={() => setStudentPage(p => p - 1)} className="border-border h-7">Previous</Button>
                <Button size="sm" variant="outline" disabled={studentPage + 1 >= totalStudentPages} onClick={() => setStudentPage(p => p + 1)} className="border-border h-7">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      )}

      {/* Legacy psych/edu/mentorship/assignments tabs were merged into
          the new Students roster + Batch view above. The components
          (PsychologicalHealthTab, EducationalHealthTab, etc.) are still
          imported and available for the StudentPortfolioPage detail view. */}

      {/* ===== COMPOSE DIALOG ===== */}

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Send Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground">To</Label>
              <Select value={composeTo} onValueChange={setComposeTo}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select student..." /></SelectTrigger>
                <SelectContent>
                  {data.students.filter(s => s.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Subject</Label>
              <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Message</Label>
              <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} className="w-full min-h-32 rounded-md bg-muted border border-border p-3 text-sm text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={sendMessage} disabled={sending || !composeTo || !composeBody.trim()} className="bg-primary hover:bg-primary/90 text-foreground">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Student Portfolio Dialog — shows tasks, logs, interactions,
// comments, and a composer for the teacher to add new comments.
// ============================================================

// ============================================================
// StudentPortfolioPage — FULL PAGE view (not a dialog)
// Shows student portfolio with back button, vertical layout,
// tab navigation, and all the same content as before but
// properly responsive on mobile.
// ============================================================

// ============================================================
// Phase 7: Psychological Health Tab
// Shows batch-wide behavioral patterns — confidence trends,
// cognitive load, engagement levels. Helps the teacher spot
// emotional/mental health issues before they become failures.
// ============================================================
// ============================================================
// Phase 7: Educational Health Tab
// Shows academic performance patterns — score distribution,
// completion rates, topic difficulty. Helps the teacher spot
// curriculum problems before students fail.
// ============================================================
// ============================================================
// Phase 7: Mentorship Tab
// Shows teacher-student interaction overview — who's been
// contacted, who hasn't, pending messages.
// ============================================================
// BehavioralTrendsTab removed — was dead code after the three-tab redesign
// replaced 'trends' with 'psychological' | 'educational' | 'mentorship'.
// Score-trend chart + week-by-week table were migrated into EducationalTab.

// ============================================================
// Phase Three-Tab Redesign — Psychological / Educational / Mentorship
//
// Replaces the old `trends` tab (BehavioralTrendsTab) with three clearly
// scoped tabs that each answer a different question. Content does NOT
// overlap between tabs — anything that belongs in one is removed from
// the others.
//
// - Psychological: how the student thinks and feels (internal state)
// - Educational: what the student knows and can do (academic mastery)
// - Mentorship: how the student is being supported, and by whom
// ============================================================

// ============================================================
// Tab 1 — PsychologicalTab
// Question: what's going on internally — cognition, confidence,
// emotional state — independent of grades or who's supporting them.
//
// Detection/current-state side of wellbeing lives here. The human
// RESPONSE to any concern lives on the Mentorship tab. CrisisFlag
// existence/state shown here; what a human did about it is on Mentorship.
//
// NOTE: This is a faithful minimal implementation. The full spec
// (PSYCH-HEALTH-DASHBOARD-PROMPT.md) calls for 7 expandable dimensions
// sourced from PsychEvidence — the data model is in place, this tab
// surfaces what currently exists (psychObs + psychTrend + weekly test
// psychAnalysis + ConfidenceRating + WellbeingState + CrisisFlag).
// Can be expanded incrementally as PsychEvidence rows get written.
// ============================================================
// ============================================================
// Tab 2 — EducationalTab
// Question: academically, where does this student actually stand,
// and where specifically are the gaps.
//
// SkillMastery computed from Interaction/WeeklyTest data — actionable
// specificity ("database queries: developing") vs. week-level scores.
// Score-trend chart + week-by-week table migrated from old trends tab.
// ============================================================
/** Compute SkillMastery from Interaction data when no persisted SkillMastery rows exist.
 *  Aggregates correctness per topic — same logic the /api/skill-mastery endpoint uses. */
// ============================================================
// Tab 3 — MentorshipTabV2 (version 2 — portfolio-scoped, replaces
// the existing top-level MentorshipTab which is for the batch list)
// Question: is this student actually being looked after — not just
// "is something wrong," but "is a real relationship happening here."
//
// Touchpoint history + presence tracking + escalation chain status.
// This is the most novel tab — nothing like it existed in the app.
// ============================================================
// ============================================================
// CalibrationScatterCard — confidence vs. actual scatter chart.
// Chart is the glanceable layer; click title to expand the evidence
// rows behind it.
// ============================================================
// ============================================================
// AssignmentsTab — Scale Tier 2: Group Tasks + Events
//
// Teachers can:
//   - Create group assignments/tasks for their entire batch
//   - View submission counts per task
//   - View + grade individual submissions
//   - Create events (deadlines, exams, meetings, activities)
//   - See upcoming events in a chronological list
// ============================================================
// ============================================================
// PeerAssessmentTeacherView — shows peer assessment results
// for a group task. Teachers see who rated whom, the scores
// across 5 dimensions, and any text feedback.
// ============================================================