"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProminentTabs } from "@/components/shared/prominent-tabs";
import {
  CalendarDays, Users, ClipboardList, BarChart3,
  Loader2, RefreshCw, AlertTriangle, Sparkles, Activity,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/instructor/types";
import { TodayView } from "@/components/examiner/instructor/TodayView";
import { StudentsRoster } from "@/components/examiner/instructor/StudentsRoster";
import { AssignmentsTab } from "@/components/examiner/instructor/AssignmentsTab";
import { InsightsView } from "@/components/examiner/instructor/InsightsView";
import { CohortAnalyticsView } from "@/components/examiner/instructor/CohortAnalyticsView";
import { StudentPortfolioPage } from "@/components/examiner/instructor/StudentPortfolioPage";
import { AIAssistantBox } from "@/components/examiner/instructor/ai/AIAssistantBox";

export type InstructorTab = "today" | "students" | "assignments" | "insights" | "analytics";

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loading && students.length === 0 && !stats) {
    return (
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No students assigned yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              You don&apos;t have any students in this course yet. Once an administrator
 enrolls students to your courses, they&apos;ll appear here with their progress,
 wellbeing indicators, and action items.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { load(); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TABS: Array<{ key: InstructorTab; label: string; icon: any; badge?: number; badgeColor?: "warning" | "red" }> = [
    { key: "today", label: "Today", icon: CalendarDays, badge: openAlertCount || undefined, badgeColor: "warning" as const },
    { key: "students", label: "Students", icon: Users },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    { key: "insights", label: "Insights", icon: BarChart3 },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instructor Dashboard</h1>
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
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

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
        />
      )}

      {tab === "analytics" && (
        <CohortAnalyticsView
          courseId={courseId}
          onMessageStudent={() => setTab("students")}
        />
      )}
    </div>
  );
}