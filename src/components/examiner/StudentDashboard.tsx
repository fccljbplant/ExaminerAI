"use client";
import { showError } from "@/lib/toast-helpers";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { scoreToGrade, gradeColor, PILLARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import { getBootcampDayNumber } from "@/lib/course-topics";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import { DailyTaskReminder } from "@/components/examiner/DailyTaskReminder";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
// Phase 5.1: Shared types + small components extracted to separate files
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";
import { TeacherComments } from "@/components/examiner/student/TeacherComments";
import { redirectToView,  StatSquareCard, GanttChartIcon, GithubIcon, safeParse } from "@/components/examiner/student/shared";
import { ThemePreferenceControl } from "@/components/examiner/student/ThemePreferenceControl";
import { DailyTestPanel } from "@/components/examiner/student/DailyTestPanel";
import { StudentAssignmentsPanel } from "@/components/examiner/student/StudentAssignmentsPanel";
import { PostTestReflection } from "@/components/examiner/student/PostTestReflection";
import { TeachingFeedbackCard, type TeachingFeedback } from "@/components/examiner/student/TeachingFeedbackCard";
import { WeeklyTestPanel } from "@/components/examiner/student/WeeklyTestPanel";
import { QuestionPanel } from "@/components/examiner/student/PracticePanel";
import { JourneyWizard } from "@/components/examiner/student/JourneyWizard";
import { Overview } from "@/components/examiner/student/OverviewPanel";
import { CheckInPanel } from "@/components/examiner/student/CheckInPanel";
import { CourseWizardPreview } from "@/components/examiner/student/CourseWizardPreview";
import { CourseOutlineRedirect } from "@/components/examiner/student/CourseOutlineRedirect";
import { ProjectReportPanel } from "@/components/examiner/student/ProjectReportPanel";
import { ReportCardPanel } from "@/components/examiner/student/ReportCardPanel";
import { FinalResultPanel } from "@/components/examiner/student/FinalResultPanel";
import { ProjectSettingsCard } from "@/components/examiner/student/ProjectSettingsCard";
import { SettingsPanel } from "@/components/examiner/student/SettingsPanel";
import { SecurityQuestionPanel } from "@/components/examiner/student/SecurityQuestionPanel";
import { ProjectWeekPlan } from "@/components/examiner/student/ProjectWeekPlan";
import { ProjectProgressChart } from "@/components/examiner/student/ProjectProgressChart";
import { ProjectDescriptionCard } from "@/components/examiner/student/ProjectDescriptionCard";
import { CompactGantt } from "@/components/examiner/student/CompactGantt";
import { GanttPanel } from "@/components/examiner/student/GanttPanel";
import { RadialProgress } from "@/components/ui/radial-progress";
import { EmptyState } from "@/components/ui/empty-state";

export default function StudentDashboard({ initialMode = "default" }: { initialMode?: Mode }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [userRole, setUserRole] = useState<string>("student");
  const isGuardian = userRole === "guardian";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Admin impersonating student should see the demo student's data.
      // Guardians see their linked student's data (resolved server-side via GuardianLink).
      const res = await api.get<StatsResponse>("/api/stats?as=student");
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current user role once on mount — used to switch to read-only guardian mode.
  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me")
      .then((r) => { if (r.user) setUserRole(r.user.role); })
      .catch(() => {/* silent — default to "student" */});
  }, []);

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { load(); }, [load]);

  if (error || !stats) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <Alert className="border-destructive/30 bg-transparent">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Something went wrong</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {error || "Unable to load your dashboard data."}
            </AlertDescription>
          </Alert>
          <Button onClick={load} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Note: when refreshing stats in the background (e.g. after submitting an
  // answer), we keep the previously-loaded stats rendered so the user's
  // in-progress view (question/answer/evaluation) is not unmounted.
  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" /> Refreshing…
        </div>
      )}
      {isGuardian && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span><strong>Read-only mode:</strong> You are viewing your child's progress as a guardian. Action buttons (submit check-in, take test, etc.) are disabled — students must log in themselves to complete work.</span>
        </div>
      )}
      {mode === "default" && <Overview stats={stats} onMode={setMode} onReload={load} />}
      {mode === "journey" && (isGuardian ? <Overview stats={stats} onMode={setMode} onReload={load} /> : <JourneyWizard stats={stats} onMode={setMode} onReload={load} />)}
      {mode === "checkin" && (isGuardian ? <Overview stats={stats} onMode={setMode} onReload={load} /> : <CheckInPanel currentWeek={stats.stats.currentWeek} onSaved={load} stats={stats} onMode={setMode} />)}
      {mode === "question" && (isGuardian ? <Overview stats={stats} onMode={setMode} onReload={load} /> : <QuestionPanel currentWeek={stats.stats.currentWeek} onAnswered={load} stats={stats} />)}
      {mode === "weekly-test" && (isGuardian ? <ReportCardPanel reportCards={stats.reportCards} comments={stats.comments} /> : <WeeklyTestPanel stats={stats} onReload={load} onMode={setMode} />)}
      {mode === "gantt" && <GanttPanel stats={stats} onReload={load} onMode={setMode} />}
      {mode === "report-card" && <ReportCardPanel reportCards={stats.reportCards} comments={stats.comments} />}
      {mode === "settings" && !isGuardian && <SettingsPanel />}
      {mode === "ai-tutor" && <AITutorRedirect />}
      {mode === "course-outline" && <CourseOutlineRedirect />}

      {/* Daily task reminder — floating popup that auto-opens every 3 minutes
          when there are pending tasks, with a corner badge that turns green
          when everything is done. Visible on every student dashboard view. */}
      <DailyTaskReminder onChanged={load} onNavigate={(m) => setMode(m)} />
    </div>
  );
}

/** Compact Course Wizard preview shown on the Overview dashboard.
 *  Shows the 6-week stepper + current week highlight, with a CTA to open
 *  the full Project Plan tab. Always visible — guides fresh users. */
// ============================================================
// JOURNEY WIZARD — guided step-by-step from project planning to
// graduation. Starts with project selection + planning, walks through
// task/timeline/progress setup, then each week's curriculum with
// AI Tutor encouragement.
// ============================================================


// ============================================================
// JOURNEY WIZARD — TRUE step-by-step guided experience
// Shows ONE thing at a time. No clutter. No timeline dump.
// ============================================================

/** Redirects to a nav view via URL param. */

function AITutorRedirect() {
  useEffect(() => { redirectToView("ai-tutor"); }, []);
  return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

/** Reusable component that shows teacher comments for a specific entity
 *  (interaction, task, daily log, or weekly test). Used on the student
 *  dashboard so students can see teacher feedback on their work. */
/** Compact square stat card — short label + big value, designed for a
 *  2-row grid of small squares. No sub-text. */
/** ProjectReportPanel — student submits weekly/final project reports.
 *  The AI analyzes each report (like practice-question evaluation) on:
 *  projectUnderstanding, technicalDepth, progress, clarity.
 *  Shows strengths, weaknesses, and feedback. */
/** Final Result Panel — shows the student's overall 6-week bootcamp performance.
 *  Auto-fetches from /api/students/final-result and displays:
 *  - Performance grade (based on test scores)
 *  - Participation grade (how many of 60 questions answered)
 *  - Behavioral pattern analysis (simple English)
 *  - Areas to improve (to become a professional)
 *  - Career readiness
 *  - Per-week breakdown table
 *  Always shown at the top of the Report Card tab. Auto-updates after every test. */
/** Project Settings — rename or delete the project. Shows current name,
 *  lets the student edit it, or delete the entire project + all tasks
 *  to start fresh. */
/** Theme preference control — uses next-themes directly (same as the sidebar toggle). */
/** Security question management — wires up the previously-dead /api/auth/set-security-question route. */
// ============================================================
// UNIFIED PROJECT VIEW
// Merges the Gantt chart + task manager + course wizard into ONE
// professional, guided experience.
//
// Structure:
//   1. Course Wizard — 6-week guided timeline (top)
//   2. Gantt Chart — compact visual progress (middle)
//   3. Task Manager — integrated CRUD (bottom)
// ============================================================

/** ProjectWeekPlan — unified week plan + task manager.
 *  Shows AI-generated week titles + summaries with tasks grouped under each week.
 *  All weeks are COLLAPSIBLE. On page load, all are collapsed EXCEPT the current week.
 *  Week titles + summaries are editable inline. Tasks can be added/edited/deleted
 *  within each week's expanded section. */
/** Project Progress Chart — shows project task completion per week (NOT curriculum).
 *  This is the project-only chart that pairs with the Learning Progress chart
 *  on the dashboard. */
/** Project Description Card — shows the project's scope, objectives, requirements,
 *  business case, duration, GitHub/deploy URLs, and notes at the top of the
 *  Project tab. Read-only with an "Edit" link that takes the user to Settings.
 *  Also includes a "Generate Tasks with AI" button that creates project-specific
 *  tasks tailored to the student's project definition. */
// ============================================================
// 2. COMPACT GANTT — visual progress bar, no separate card border
// ============================================================
