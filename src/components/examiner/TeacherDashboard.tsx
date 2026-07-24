"use client";

/**
 * TeacherDashboard — redesigned for 50-100 student scale with AI assistance.
 *
 * Design principles:
 * 1. Triage-first — the dashboard's #1 job is "who needs me now"
 * 2. Glanceable — color, badges, aggregation (can't read 100 rows)
 * 3. AI as teammate — surfaces what to look at, drafts responses
 * 4. One-click actions — every triage item has a clear next action
 * 5. Progressive disclosure — summary → detail → deep dive
 *
 * 5 purpose-driven views:
 * - Today: triage queue + batch health pulse (5-min morning scan)
 * - Students: searchable roster with attention flags
 * - Mentorship: GROW coaching queue + follow-ups due
 * - Assignments: group tasks + peer assessment + events
 * - Insights: batch-level analytics + AI copilot (weekly review)
 */

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, Users, HeartHandshake, ClipboardList, BarChart3,
  Mail, Activity, Settings as SettingsIcon, Loader2, RefreshCw,
  AlertTriangle, Sparkles,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/teacher/types";
import { TodayView } from "@/components/examiner/teacher/TodayView";
import { StudentsRoster } from "@/components/examiner/teacher/StudentsRoster";
import { MentorshipView } from "@/components/examiner/teacher/MentorshipView";
import { AssignmentsTab } from "@/components/examiner/teacher/AssignmentsTab";
import { InsightsView } from "@/components/examiner/teacher/InsightsView";
import { StudentPortfolioPage } from "@/components/examiner/teacher/StudentPortfolioPage";
import { CoPilotBox } from "@/components/examiner/teacher/ai/CoPilotBox";

export type TeacherTab = "today" | "students" | "mentorship" | "assignments" | "insights" | "messages" | "myload" | "settings";

interface TeacherStats {
  totalStudents: number;
  pendingApprovals: number;
  testsThisWeek: number;
  studentsWithProjects: number;
  studentsWithoutProjects: number;
  studentsNeedingAttention: number;
  totalWithTests: number;
  totalActiveToday: number;
}

export default function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>("today");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [openAlertCount, setOpenAlertCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        api.get<{
          stats: TeacherStats;
          students: StudentRow[];
        }>("/api/stats?as=teacher", undefined, AI_TIMEOUT_MS),
        api.get<{ alerts: any[] }>("/api/students/alerts").catch(() => ({ alerts: [] })),
      ]);
      setStats(statsRes.stats);
      setStudents(statsRes.students);
      setOpenAlertCount(alertsRes.alerts?.length || 0);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // If a student is selected, show the portfolio page
  if (selectedStudent) {
    return (
      <StudentPortfolioPage
        student={selectedStudent}
        onBack={() => { setSelectedStudent(null); load(); }}
        onMessage={(studentId) => { setSelectedStudent(null); setTab("messages"); }}
      />
    );
  }

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS: Array<{ key: TeacherTab; label: string; icon: any; badge?: number }> = [
    { key: "today", label: "Today", icon: CalendarDays, badge: openAlertCount || undefined },
    { key: "students", label: "Students", icon: Users },
    { key: "mentorship", label: "Mentorship", icon: HeartHandshake },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    { key: "insights", label: "Insights", icon: BarChart3 },
    { key: "messages", label: "Messages", icon: Mail },
    { key: "myload", label: "My Load", icon: Activity },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats ? `${stats.totalStudents} students · ${stats.studentsNeedingAttention} need attention · ${stats.testsThisWeek} tests this week` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openAlertCount > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {openAlertCount} open {openAlertCount === 1 ? "alert" : "alerts"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-2">
        {TABS.map(item => {
          const Icon = item.icon;
          const isActive = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors relative",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
              {item.badge && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "today" && (
        <div className="space-y-4">
          <TodayView
            students={students}
            stats={stats}
            onStudentClick={(s) => setSelectedStudent(s)}
            onViewChange={(v) => setTab(v as TeacherTab)}
          />
          <CoPilotBox students={students} onStudentClick={(s) => setSelectedStudent(s)} />
        </div>
      )}

      {tab === "students" && (
        <StudentsRoster
          students={students}
          onStudentClick={(s) => setSelectedStudent(s)}
        />
      )}

      {tab === "mentorship" && (
        <MentorshipView
          students={students}
          onStudentClick={(s) => setSelectedStudent(s)}
        />
      )}

      {tab === "assignments" && <AssignmentsTab />}

      {tab === "insights" && (
        <InsightsView
          students={students}
          stats={stats}
          onStudentClick={(s) => setSelectedStudent(s)}
        />
      )}

      {tab === "messages" && <MessagesTab onBack={() => setTab("today")} />}

      {tab === "myload" && <MyLoadView />}

      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

// ============================================================
// Messages tab (inline — simple compose)
// ============================================================
function MessagesTab({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back to Dashboard
      </Button>
      <div className="rounded-xl border bg-card p-8 text-center">
        <Mail className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-1">Messages</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Use the Messages tab in the sidebar to view and send messages to students and staff.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// My Load tab (inline — teacher's own wellbeing)
// ============================================================
function MyLoadView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/teacher/load").then((d: any) => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!data) return <div className="py-10 text-center text-sm text-muted-foreground">Unable to load.</div>;

  const tierColor = data.tier === "green" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
    : data.tier === "amber" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
    : "text-rose-600 bg-rose-50 dark:bg-rose-950/30";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">My Load & Wellbeing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Only you can see this. Burnout prevention matters.</p>
          </div>
          <Badge className={tierColor}>Tier: {data.tier || "green"}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Response Time</div>
            <div className="text-lg font-semibold mt-1">{data.avgResponseHours?.toFixed(1) || "—"}h</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Touchpoints (7d)</div>
            <div className="text-lg font-semibold mt-1">{data.touchpointsThisWeek || 0}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Crisis Load</div>
            <div className="text-lg font-semibold mt-1">{data.crisisLoad || 0}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Completion Rate</div>
            <div className="text-lg font-semibold mt-1">{data.completionRate?.toFixed(0) || 0}%</div>
          </div>
        </div>
        {data.reasons && data.reasons.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Signals</div>
            <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
              {data.reasons.map((r: string, i: number) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Settings tab (inline — change password)
// ============================================================
function SettingsTab() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold mb-2">Settings</h3>
      <p className="text-sm text-muted-foreground mb-4">Manage your account settings.</p>
      <Button variant="outline" size="sm">Change Password</Button>
    </div>
  );
}
