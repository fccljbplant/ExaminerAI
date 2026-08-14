"use client";

/**
 * StudentDashboard — redesigned for clarity.
 *
 * OLD: 7 nav items (Today, Learning Hub, Practice, Weekly Test, My Project,
 *      My Progress, First Time?) — too many, overlapping, confusing.
 *
 * NEW: 4 clear views driven by the student's daily routine:
 *   1. Home — "What do I do today?" (daily action items, motivation, stats)
 *   2. Study — "Let me learn + practice" (AI Tutor, practice, daily test, weekly test)
 *   3. Project — "What's my capstone?" (tasks, Gantt, settings)
 *   4. Progress — "How am I doing?" (report cards, score trends, competencies)
 *
 * Removed:
 * - "First Time?" (JourneyWizard) — one-time onboarding, doesn't belong in nav
 * - "Learning Hub" (duplicate of Study)
 * - Separate "Practice" + "Weekly Test" (merged into Study)
 * - Separate "My Project" + "My Progress" (merged into Project + Progress)
 * - Settings (moved to sidebar only, not duplicated in dashboard)
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarCheck, Loader2, RefreshCw,
  Bot, ClipboardList, ClipboardCheck, AlertCircle,
} from "lucide-react";
import type { StatsResponse, Mode } from "@/components/examiner/student/types";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";
import { LearnerHome } from "@/modules/learn/components/dashboard/LearnerHome";
import { WeeklyTestPanel } from "@/components/examiner/student/WeeklyTestPanel";
import { QuestionPanel } from "@/components/examiner/student/PracticePanel";
import { CheckInPanel } from "@/components/examiner/student/CheckInPanel";
import { ReportCardPanel } from "@/components/examiner/student/ReportCardPanel";
import { ComprehensiveReportView } from "@/components/examiner/student/ComprehensiveReportView";
import { SelfPacedAdvanceButton } from "@/components/examiner/student/SelfPacedAdvanceButton";
import { GanttPanel } from "@/components/examiner/student/GanttPanel";
import { DailyTestPanel } from "@/components/examiner/student/DailyTestPanel";
import TodayView from "@/components/examiner/student/TodayView";
import { CredentialsView } from "@/components/examiner/student/CredentialsView";
import MyCoursesView from "@/components/examiner/student/MyCoursesView";
import { LearnerXPBar } from "@/modules/gamification";
import { LearnerBadgeCollection } from "@/modules/gamification";
import { logger } from "@/lib/logger";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
} from "recharts";

export type StudentView = "home" | "study" | "project" | "progress" | "credentials" | "my-courses";

export default function StudentDashboard({ initialMode = "default", enrollments, activeCourseId }: {
  initialMode?: Mode;
  enrollments?: EnrollmentResponse["enrollments"];
  activeCourseId?: string;
}) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<StudentView>("home");
  const [userId, setUserId] = useState<string>("");
  // Course picked inside the dashboard (LearnerHome coverage widget). The
  // AppShell-level activeCourseId prop wins again whenever it changes.
  const [courseOverride, setCourseOverride] = useState<string | null>(null);
  const effectiveCourseId = courseOverride ?? activeCourseId;

  useEffect(() => { setCourseOverride(null); }, [activeCourseId]);

  // Fetch current user's ID (for comprehensive report)
  useEffect(() => {
    api.get<{ user: { id: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.id) setUserId(res.user.id);
    }).catch((err) => { logger.warn("Operation failed", { err }); });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const courseParam = effectiveCourseId ? `&courseId=${encodeURIComponent(effectiveCourseId)}` : "";
      const res = await api.get<StatsResponse>(`/api/stats?as=student${courseParam}`);
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [effectiveCourseId]);

  useEffect(() => { load(); }, [load]);

  // Map initialMode to internal view (zombie modes "question"/"weekly-test"
  // were removed in the nav cleanup — only "checkin", "gantt", "report-card"
  // reach here now).
  useEffect(() => {
    if (initialMode === "checkin") {
      setView("study");
    } else if (initialMode === "gantt") {
      setView("project");
    } else if (initialMode === "report-card") {
      setView("progress");
    } else if (initialMode === "credentials") {
      setView("credentials");
    } else if (initialMode === "my-courses") {
      setView("my-courses");
    }
  }, [initialMode]);

  if (error || !stats) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-semibold">Something went wrong</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{error || "Unable to load your dashboard data."}</p>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" /> Refreshing…
        </div>
      )}

      {/* TodayView — the modern "what do I do next?" landing card */}
      {view === "home" && (
        <TodayView onNavigate={(v) => setView(v as StudentView)} />
      )}

      {/* LearnerHome — Star Admin dashboard: stat tiles, assignments,
          course coverage, project progress, activity feed. */}
      {view === "home" && (
        <LearnerHome
          stats={stats!}
          enrollments={enrollments}
          activeCourseId={effectiveCourseId}
          onNavigate={(v) => setView(v as StudentView)}
          onReload={load}
          onSelectCourse={setCourseOverride}
        />
      )}
      {view === "study" && <StudyView stats={stats!} onReload={load} onNavigate={setView} />}
      {view === "project" && <GanttPanel stats={stats!} onReload={load} onMode={() => setView("study")} />}
      {view === "progress" && (
        <div className="space-y-6">
          {/* XP + Badges — the gamification layer */}
          <LearnerXPBar />
          <LearnerBadgeCollection />
          {userId && <ComprehensiveReportView studentId={userId} />}
          <ReportCardPanel reportCards={stats?.reportCards || []} comments={stats?.comments || []} studentId={userId || undefined} />
        </div>
      )}
      {view === "credentials" && <CredentialsView />}
      {view === "my-courses" && (
        <MyCoursesView onNavigate={(v) => setView(v as StudentView)} />
      )}

      {/* DailyTaskReminder popup removed — replaced by the inline DueTodayCard
          mounted inside TodayView. Popups are now reserved for red-tier alerts
          only. The DailyTaskReminder.tsx file is kept for now as a "remove
          candidate" — see scripts/ui-backend-audit.sh section E. */}
    </div>
  );
}

// ============================================================
// ============================================================
// ============================================================
// StudyView — study mode tabs (Practice, Daily Test, Weekly Test, Check-in)
// ============================================================
function StudyView({ stats, onReload, onNavigate }: {
  stats: StatsResponse;
  onReload: () => void;
  onNavigate: (v: StudentView) => void;
}) {
  const [studyMode, setStudyMode] = useState<string>("checkin");
  const studyTabs = [
    { key: "checkin", label: "Daily Check-in", icon: CalendarCheck },
    { key: "practice", label: "Practice", icon: Bot },
    { key: "daily-test", label: "Daily Test", icon: ClipboardCheck },
    { key: "weekly-test", label: "Weekly Test", icon: ClipboardList, ClipboardCheck },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap p-1 bg-muted/50 rounded-xl border border-border/50">
        {studyTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = studyMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStudyMode(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {studyMode === "practice" && (
        <QuestionPanel currentWeek={stats?.stats.currentWeek ?? 1} onAnswered={onReload} stats={stats!} />
      )}
      {studyMode === "daily-test" && <DailyTestPanel />}
      {studyMode === "weekly-test" && (
        <WeeklyTestPanel stats={stats!} onReload={onReload} onMode={() => onNavigate("home")} />
      )}
      {studyMode === "checkin" && (
        <CheckInPanel currentWeek={stats?.stats.currentWeek ?? 1} onSaved={onReload} stats={stats!} onMode={() => onNavigate("home")} />
      )}
    </div>
  );
}


