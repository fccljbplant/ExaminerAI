"use client";

/**
 * TeacherDashboard — the massive powerful assistant for 100 students.
 *
 * ARCHITECTURE:
 * - Sidebar is the PRIMARY navigation (5 items: Today/Students/Mentorship/Assignments/Insights)
 * - NO inline tabs for messages/myload/settings (sidebar handles those)
 * - Single data load: stats + alerts fetched ONCE, passed to all views
 * - Pagination support: uses hasMore/page from API (no silent student loss)
 *
 * DESIGN PRINCIPLES:
 * 1. Triage-first — every view answers "who needs me?"
 * 2. Glanceable — color, badges, charts (can't read 100 rows)
 * 3. AI as teammate — surfaces what to look at, drafts responses
 * 4. One-click actions — every item has a clear next action
 * 5. No duplicates — each feature lives in exactly one place
 */

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProminentTabs } from "@/components/shared/prominent-tabs";
import {
  CalendarDays, Users, HeartHandshake, ClipboardList, BarChart3,
  Loader2, RefreshCw, AlertTriangle, Sparkles, Activity,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/teacher/types";
import { TodayView } from "@/components/examiner/teacher/TodayView";
import { StudentsRoster } from "@/components/examiner/teacher/StudentsRoster";
import { MentorshipView } from "@/components/examiner/teacher/MentorshipView";
import { AssignmentsTab } from "@/components/examiner/teacher/AssignmentsTab";
import { InsightsView } from "@/components/examiner/teacher/InsightsView";
import { StudentPortfolioPage } from "@/components/examiner/teacher/StudentPortfolioPage";
import { AIAssistantBox } from "@/components/examiner/teacher/ai/AIAssistantBox";

export type TeacherTab = "today" | "students" | "mentorship" | "assignments" | "insights";

interface TeacherStats {
  totalStudents: number;
  pendingApprovals: number;
  totalTeachers: number;
  testsThisWeek: number;
  studentsWithProjects: number;
  studentsWithoutProjects: number;
  studentsNeedingAttention: number;
  totalWithTests: number;
  totalActiveToday: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  loadedCount?: number;
}

interface AlertItem {
  id: string;
  userId: string;
  type: string;
  severity: string;
  reason: string;
  metric?: string;
  metricValue?: string;
  status: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; batchId: string | null };
}

export default function TeacherDashboard({ initialTab }: { initialTab?: TeacherTab } = {}) {
  const [tab, setTab] = useState<TeacherTab>(initialTab || "today");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(-1);
  // M1 fix: batch switcher state — when the teacher has 2+ batches, a dropdown
  // appears in the header to let them focus on one batch at a time.
  const [teacherBatches, setTeacherBatches] = useState<Array<{ id: string; name: string; studentCount: number }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  // Update tab when initialTab prop changes (from sidebar nav clicks)
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    try {
      const batchParam = selectedBatchId ? `&batchId=${encodeURIComponent(selectedBatchId)}` : "";
      const [statsRes, alertsRes] = await Promise.all([
        api.get<{
          stats: TeacherStats;
          students: StudentRow[];
          hasMore?: boolean;
          teacherBatches?: Array<{ id: string; name: string; studentCount: number }>;
        }>(`/api/stats?as=teacher&page=0&pageSize=100${batchParam}`, undefined, AI_TIMEOUT_MS),
        api.get<{ alerts: AlertItem[] }>("/api/students/alerts").catch(() => ({ alerts: [] as AlertItem[] })),
      ]);
      setStats(statsRes?.stats || null);
      setStudents(Array.isArray(statsRes?.students) ? statsRes.students : []);
      setAlerts(Array.isArray(alertsRes?.alerts) ? alertsRes.alerts : []);
      // M1 fix: populate the batch switcher options (only when no batch is selected)
      if (statsRes?.teacherBatches) {
        setTeacherBatches(statsRes.teacherBatches);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to load dashboard");
      setStudents([]);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBatchId]);

  useEffect(() => { load(); }, [load]);

  // Student portfolio navigation
  const handleStudentClick = (student: StudentRow) => {
    const idx = students.findIndex(s => s.id === student.id);
    setSelectedStudentIndex(idx);
    setSelectedStudent(student);
  };

  const handleNextStudent = () => {
    if (selectedStudentIndex < students.length - 1) {
      const nextIdx = selectedStudentIndex + 1;
      setSelectedStudentIndex(nextIdx);
      setSelectedStudent(students[nextIdx]);
    }
  };

  const handlePrevStudent = () => {
    if (selectedStudentIndex > 0) {
      const prevIdx = selectedStudentIndex - 1;
      setSelectedStudentIndex(prevIdx);
      setSelectedStudent(students[prevIdx]);
    }
  };

  if (selectedStudent) {
    return (
      <StudentPortfolioPage
        student={selectedStudent}
        onBack={() => { setSelectedStudent(null); setSelectedStudentIndex(-1); load(); }}
        onMessage={() => { setSelectedStudent(null); }}
        onNext={selectedStudentIndex < students.length - 1 ? handleNextStudent : undefined}
        onPrev={selectedStudentIndex > 0 ? handlePrevStudent : undefined}
        studentPosition={selectedStudentIndex >= 0 ? `${selectedStudentIndex + 1} / ${students.length}` : undefined}
      />
    );
  }

  const openAlertCount = alerts.filter(a => a.status === "open").length;
  const crisisCount = alerts.filter(a => a.severity === "red" && a.status === "open").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS: Array<{ key: TeacherTab; label: string; icon: any; badge?: number; badgeColor?: "warning" | "red" }> = [
    { key: "today", label: "Today", icon: CalendarDays, badge: openAlertCount || undefined, badgeColor: "warning" as const },
    { key: "students", label: "Students", icon: Users },
    { key: "mentorship", label: "Mentorship", icon: HeartHandshake, badge: crisisCount || undefined, badgeColor: "red" as const },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    { key: "insights", label: "Insights", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header bar — with inline stat pills */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Dashboard</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {stats && (
              <>
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {stats.totalStudents} students
                </Badge>
                {stats.studentsNeedingAttention > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {stats.studentsNeedingAttention} need attention
                  </Badge>
                )}
                {stats.pendingApprovals > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                    {stats.pendingApprovals} pending
                  </Badge>
                )}
                {stats.testsThisWeek > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <ClipboardList className="w-3 h-3 mr-1" />
                    {stats.testsThisWeek} tests this week
                  </Badge>
                )}
                {stats.totalActiveToday > 0 && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                    <Activity className="w-3 h-3 mr-1" />
                    {stats.totalActiveToday} active today
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* M1 fix: Batch switcher — only shows when the teacher has 2+ batches.
              Lets them focus on one batch at a time instead of seeing all students mixed. */}
          {teacherBatches.length > 1 && (
            <select
              value={selectedBatchId}
              onChange={(e) => { setSelectedBatchId(e.target.value); setLoading(true); }}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground h-8"
              title="Filter students by batch"
            >
              <option value="">All Batches ({teacherBatches.reduce((a, b) => a + b.studentCount, 0)} students)</option>
              {teacherBatches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.studentCount})</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Inline tab nav — ONLY the 5 main views (no messages/myload/settings — sidebar handles those) */}
      <ProminentTabs
        tabs={TABS.map(item => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          badge: item.badge,
          badgeColor: item.badgeColor,
        }))}
        active={tab}
        onChange={(key) => setTab(key as TeacherTab)}
        variant="pill"
        size="md"
      />

      {/* Tab content — each view receives students + stats + alerts as props (no refetching) */}
      {tab === "today" && (
        <div className="space-y-4">
          <TodayView
            students={students}
            stats={stats}
            alerts={alerts}
            onStudentClick={handleStudentClick}
            onViewChange={(v) => setTab(v as TeacherTab)}
          />
          <AIAssistantBox students={students} onStudentClick={handleStudentClick} />
        </div>
      )}

      {tab === "students" && (
        <StudentsRoster
          students={students}
          stats={stats}
          onStudentClick={handleStudentClick}
        />
      )}

      {tab === "mentorship" && (
        <MentorshipView
          students={students}
          alerts={alerts}
          onStudentClick={handleStudentClick}
        />
      )}

      {tab === "assignments" && <AssignmentsTab students={students} />}

      {tab === "insights" && (
        <InsightsView
          students={students}
          stats={stats}
          alerts={alerts}
          onStudentClick={handleStudentClick}
        />
      )}
    </div>
  );
}
