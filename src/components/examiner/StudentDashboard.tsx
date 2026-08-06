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
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { scoreToGrade, gradeColor } from "@/lib/constants";
import {
  CalendarCheck, TrendingUp, Loader2, RefreshCw, Sparkles,
  Bot, ClipboardList, ClipboardCheck, FileText, BookOpen, ArrowRight, CheckCircle2,
  AlertCircle, Award, ChevronRight, Activity, Target, Clock, MessageSquare,
} from "lucide-react";
import type { StatsResponse, Mode } from "@/components/examiner/student/types";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";
import { DailyTaskReminder } from "@/components/examiner/DailyTaskReminder";
import { WeeklyTestPanel } from "@/components/examiner/student/WeeklyTestPanel";
import { QuestionPanel } from "@/components/examiner/student/PracticePanel";
import { CheckInPanel } from "@/components/examiner/student/CheckInPanel";
import { ReportCardPanel } from "@/components/examiner/student/ReportCardPanel";
import { ComprehensiveReportView } from "@/components/examiner/student/ComprehensiveReportView";
import { SelfPacedAdvanceButton } from "@/components/examiner/student/SelfPacedAdvanceButton";
import { GanttPanel } from "@/components/examiner/student/GanttPanel";
import { redirectToView } from "@/components/examiner/student/shared";
import { DailyTestPanel } from "@/components/examiner/student/DailyTestPanel";
import TodayView from "@/components/examiner/student/TodayView";
import { CollapsibleCard, CardRefreshButton } from "@/components/shared/collapsible-card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
} from "recharts";

export type StudentView = "home" | "study" | "project" | "progress";

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

  // Fetch current user's ID (for comprehensive report)
  useEffect(() => {
    api.get<{ user: { id: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.id) setUserId(res.user.id);
    }).catch(() => {/* silent */});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const courseParam = activeCourseId ? `&courseId=${encodeURIComponent(activeCourseId)}` : "";
      const res = await api.get<StatsResponse>(`/api/stats?as=student${courseParam}`);
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [activeCourseId]);

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

      {/* My Courses overview — course cards from enrollments */}
      {view === "home" && enrollments && enrollments.length > 0 && (
        <div className="space-y-4">
          {enrollments.length === 1 ? (
            /* Single course: show current progress card */
            <SingleCourseHome enrollment={(enrollments && enrollments.length > 0) ? enrollments[0] : null as any} stats={stats!} onNavigate={setView} onReload={load} />
          ) : (
            /* Multiple courses: show card grid */
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">My Courses</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {enrollments.map(enr => (
                  <CourseCard
                    key={enr.courseId}
                    enrollment={enr}
                    isActive={enr.courseId === activeCourseId}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        const params = new URLSearchParams(window.location.search);
                        params.set("courseId", enr.courseId);
                        window.history.replaceState({}, "", `?${params.toString()}`);
                      }
                      // Reload stats for the selected course
                      load();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {view === "study" && <StudyView stats={stats!} onReload={load} onNavigate={setView} />}
      {view === "project" && <GanttPanel stats={stats!} onReload={load} onMode={() => setView("study")} />}
      {view === "progress" && (
        <div className="space-y-6">
          {userId && <ComprehensiveReportView studentId={userId} />}
          <ReportCardPanel reportCards={stats?.reportCards || []} comments={stats?.comments || []} studentId={userId || undefined} />
        </div>
      )}

      <DailyTaskReminder
        onChanged={load}
        onNavigate={(mode) => {
          // Map the reminder's navigation target to the correct StudentView.
          // Previously this ALWAYS went to "study" regardless of the mode —
          // clicking "Open Project Plan" navigated to Study instead of Project.
          if (mode === "gantt") setView("project");
          else if (mode === "checkin") setView("study");
          else if (mode === "study") setView("study");
        }}
      />
    </div>
  );
}

// ============================================================
// ============================================================
// ============================================================
// StudyView — study mode tabs (Practice, Daily Test, Weekly Test, Check-in)
// ============================================================
function StudyView({ stats, onReload, onNavigate }: {
  stats: StatsResponse | null;
  onReload: () => void;
  onNavigate: (v: any) => void;
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

// ============================================================
// Shared components
// ============================================================
function StatCard({ icon: Icon, label, value, color }: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
        <div className={cn("text-xl font-bold", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SingleCourseHome({ enrollment, stats, onNavigate, onReload }: {
  enrollment: EnrollmentResponse["enrollments"][0];
  stats: StatsResponse | null;
  onNavigate: (v: any) => void;
  onReload: () => void;
}) {
  const pct = enrollment.totalWeeks > 0
    ? Math.round((enrollment.currentWeek / enrollment.totalWeeks) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{enrollment.courseName}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Week {enrollment.currentWeek} of {enrollment.totalWeeks}
                {enrollment.latestScore !== null && ` · Latest: ${enrollment.latestScore}%`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{enrollment.avgScore !== null ? `${enrollment.avgScore}%` : "—"}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Score</div>
            </div>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-sm font-semibold text-foreground">{enrollment.currentWeek}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Week</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-sm font-semibold text-foreground">{enrollment.currentDay}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Day</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-sm font-semibold text-foreground">{enrollment.progress}%</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Tasks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (stats.tasks || []).length === 0 && enrollment.projectEnabled && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Start your capstone project
                  {enrollment.projectRequired && (
                    <Badge variant="outline" className="ml-2 text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      Required
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Define your project to get AI-generated weekly tasks, milestones, and a Gantt chart.
                </p>
              </div>
              <Button onClick={() => onNavigate("project")} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0">
                Set Up Project <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function CourseCard({ enrollment, isActive, onClick }: {
  enrollment: EnrollmentResponse["enrollments"][0];
  isActive: boolean;
  onClick: () => void;
}) {
  const pct = enrollment.totalWeeks > 0
    ? Math.round((enrollment.currentWeek / enrollment.totalWeeks) * 100)
    : 0;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isActive ? "ring-2 ring-primary" : ""
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{enrollment.courseName}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Week {enrollment.currentWeek}/{enrollment.totalWeeks}
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-base font-bold text-primary">
              {enrollment.avgScore !== null ? `${enrollment.avgScore}%` : "—"}
            </div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wider">Avg</div>
          </div>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Tasks: {enrollment.progress}%</span>
          {enrollment.latestScore !== null && <span>Latest: {enrollment.latestScore}%</span>}
        </div>
      </CardContent>
    </Card>
  );
}
