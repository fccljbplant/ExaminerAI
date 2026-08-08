"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProminentTabs } from "@/components/shared/prominent-tabs";
import { DashboardHeader } from "@/components/shared/dashboard-shell";
import { StatCard } from "@/components/shared/stat-card";
import { SkeletonPanel, EmptyState } from "@/components/ui/states";
import { COPY } from "@/content/copy";
import {
  CalendarDays, Users, ClipboardList, BarChart3,
  RefreshCw, AlertTriangle, Activity,
  Wallet,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/instructor/types";
import { TodayView } from "@/components/examiner/instructor/TodayView";
import { StudentsRoster } from "@/components/examiner/instructor/StudentsRoster";
import { AssignmentsTab } from "@/components/examiner/instructor/AssignmentsTab";
import { InsightsView } from "@/components/examiner/instructor/InsightsView";
import { StudentPortfolioPage } from "@/components/examiner/instructor/StudentPortfolioPage";
import { AIAssistantBox } from "@/components/examiner/instructor/ai/AIAssistantBox";
import EarningsDashboard from "@/components/examiner/instructor/EarningsDashboard";

export type InstructorTab = "today" | "students" | "assignments" | "insights" | "earnings";

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

export default function InstructorDashboard({ initialTab, courseId }: { initialTab?: InstructorTab; courseId?: string } = {}) {
  const [tab, setTab] = useState<InstructorTab>(initialTab || "today");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(-1);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    try {
      const courseParam = courseId ? `&courseId=${encodeURIComponent(courseId)}` : "";
      const [statsRes, alertsRes] = await Promise.all([
        api.get<{
          stats: TeacherStats;
          students: StudentRow[];
          hasMore?: boolean;
        }>(`/api/stats?as=instructor&page=0&pageSize=100${courseParam}`, undefined, AI_TIMEOUT_MS),
        api.get<{ alerts: AlertItem[] }>("/api/students/alerts").catch(() => ({ alerts: [] as AlertItem[] })),
      ]);
      setStats(statsRes?.stats || null);
      setStudents(Array.isArray(statsRes?.students) ? statsRes.students : []);
      setAlerts(Array.isArray(alertsRes?.alerts) ? alertsRes.alerts : []);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to load dashboard");
      setStudents([]);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Instructor" }]}
          title="Loading dashboard…"
          subtitle={COPY.mentorBrief}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonPanel key={i} lines={2} className="h-24" />
            ))}
          </div>
          <SkeletonPanel lines={6} className="h-96" />
        </div>
      </div>
    );
  }

  if (!loading && students.length === 0 && !stats) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Instructor" }]}
          title="Instructor Dashboard"
          subtitle={COPY.mentorBrief}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <EmptyState
            icon="👥"
            title="No students assigned yet"
            hint="You don't have any students in this course yet. Once an administrator enrolls students to your courses, they'll appear here with their progress, wellbeing indicators, and action items."
            action={
              <Button variant="outline" size="sm" onClick={() => { load(); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const TABS: Array<{ key: InstructorTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeColor?: "warning" | "red" }> = [
    { key: "today", label: "Today", icon: CalendarDays, badge: openAlertCount || undefined, badgeColor: "warning" as const },
    { key: "students", label: "Students", icon: Users },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    // MERGED: Insights + Analytics were near-duplicates (both showed cohort
    // performance, top performers, at-risk students). Analytics is now a
    // section inside Insights (which also has the AI Assistant + trend
    // charts). One tab, not two.
    { key: "insights", label: "Insights", icon: BarChart3 },
    { key: "earnings", label: "Earnings", icon: Wallet },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <DashboardHeader
        crumbs={[{ label: "Instructor" }]}
        title="Instructor Dashboard"
        subtitle={COPY.mentorBrief}
        chips={
          <div className="hidden sm:flex items-center gap-1.5">
            {stats && (
              <>
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {stats.totalStudents} students
                </Badge>
                {stats.studentsNeedingAttention > 0 && (
                  <Badge variant="outline" className="text-xs bg-growth-amber-soft text-growth-amber-foreground border-growth-amber dark:bg-amber-950/30 dark:text-growth-amber dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {stats.studentsNeedingAttention} need attention
                  </Badge>
                )}
                {stats.pendingApprovals > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                    {stats.pendingApprovals} pending
                  </Badge>
                )}
              </>
            )}
          </div>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Stat strip — the at-a-glance numbers */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Students"
            value={stats.totalStudents}
            icon={Users}
            tone="info"
            hint={`${stats.studentsWithProjects} with projects`}
          />
          <StatCard
            label="Need Attention"
            value={stats.studentsNeedingAttention}
            icon={AlertTriangle}
            tone={stats.studentsNeedingAttention > 0 ? "warning" : "success"}
            hint="Flagged by AI triage"
          />
          <StatCard
            label="Active Today"
            value={stats.totalActiveToday}
            icon={Activity}
            tone={stats.totalActiveToday > 0 ? "success" : "default"}
            hint="Logged in today"
          />
          <StatCard
            label="Tests This Week"
            value={stats.testsThisWeek}
            icon={ClipboardList}
            tone="default"
            hint={`${stats.pendingApprovals} pending approvals`}
          />
        </div>
      )}

      <ProminentTabs
        tabs={TABS.map(item => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          badge: item.badge,
          badgeColor: item.badgeColor,
        }))}
        active={tab}
        onChange={(key) => setTab(key as InstructorTab)}
        variant="pill"
        size="md"
      />

      {tab === "today" && (
        <div className="space-y-4">
          <TodayView
            students={students}
            stats={stats}
            alerts={alerts}
            onStudentClick={handleStudentClick}
            onViewChange={(v) => setTab(v as InstructorTab)}
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

      {tab === "assignments" && <AssignmentsTab students={students} courseId={courseId} />}

      {tab === "insights" && (
        <InsightsView
          students={students}
          stats={stats}
          alerts={alerts}
          onStudentClick={handleStudentClick}
          courseId={courseId}
          onMessageStudent={() => setTab("students")}
        />
      )}

      {tab === "earnings" && <EarningsDashboard />}
      </div>
    </div>
  );
}