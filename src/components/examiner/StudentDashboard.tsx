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
  Bot, ClipboardList, FileText, BookOpen, ArrowRight, CheckCircle2,
  AlertCircle, Award, ChevronRight, Activity, Target, Clock, MessageSquare,
} from "lucide-react";
import type { StatsResponse, Mode } from "@/components/examiner/student/types";
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
import { CollapsibleCard, CardRefreshButton } from "@/components/shared/collapsible-card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
} from "recharts";

export type StudentView = "home" | "study" | "project" | "progress";

export default function StudentDashboard({ initialMode = "default" }: { initialMode?: Mode }) {
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
      const res = await api.get<StatsResponse>("/api/stats?as=student");
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

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

      {/* Unassigned Student View — first-class onboarding screen for students
          with no course assigned yet. Replaces the old "empty dashboard" that
          showed blank stat cards + a broken SelfPacedAdvanceButton. */}
      {stats && !stats.projectConfig?.courseAssigned && view === "home" && (
        <UnassignedStudentView />
      )}

      {view === "home" && stats && stats.projectConfig?.courseAssigned && (
        <div className="space-y-4">
          <SelfPacedAdvanceButton />
          {/* Project setup nudge — only shown when the student's course has
              projects enabled AND the student hasn't created any project tasks yet.
              The Project nav item itself is conditionally rendered in AppShell
              (hidden entirely when the course has projects disabled or no course
              assigned), so we don't need a separate banner for those cases. */}
          {stats && stats.tasks.length === 0 && stats.projectConfig?.projectEnabled && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Target className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Start your capstone project
                      {stats.projectConfig.projectRequired && (
                        <Badge variant="outline" className="ml-2 text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          Required
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define your project to get AI-generated weekly tasks, milestones, and a Gantt chart.
                    </p>
                  </div>
                  <Button onClick={() => setView("project")} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0">
                    Set Up Project <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <HomeView stats={stats} onNavigate={setView} onReload={load} />
        </div>
      )}
      {view === "study" && <StudyView stats={stats} onReload={load} onNavigate={setView} />}
      {view === "project" && <GanttPanel stats={stats} onReload={load} onMode={() => setView("study")} />}
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
// UNASSIGNED STUDENT VIEW — first-class onboarding screen
// Shown when the student has no course assigned yet (courseAssigned === false).
// Replaces the old "empty dashboard" that showed blank stat cards.
// ============================================================
function UnassignedStudentView() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto pt-8">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Welcome to ExaminerAI!
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            You haven&apos;t been assigned a course yet. Your instructor or coordinator
            will set this up shortly — once assigned, you&apos;ll see your daily curriculum,
            AI Tutor, practice questions, tests, and project workspace right here.
          </p>
          <div className="rounded-lg border border-border bg-background/70 p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              What you&apos;ll get once enrolled:
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Daily curriculum with topics, objectives, and learning resources</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>AI Tutor for personalized help with today&apos;s topic</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Daily check-ins + practice questions to reinforce learning</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Weekly Socratic tests with per-question explanations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Capstone project planner with AI-generated weekly tasks</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Progress reports, certificates, and 7-dimension psychological insights</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("view", "messages");
                window.location.href = url.toString();
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message your instructor
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            If you&apos;ve been waiting more than 24 hours, reach out to your instructor
            via Messages (above) or contact your institution administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// HOME VIEW — "What do I do today?"
// ============================================================
function HomeView({ stats, onNavigate, onReload }: {
  stats: StatsResponse;
  onNavigate: (v: StudentView) => void;
  onReload: () => void;
}) {
  const { stats: s, tasks, dailyLogs } = stats;
  const grade = scoreToGrade(s.progress);
  const hasProject = tasks.length > 0;
  const todayTasks = tasks.filter(t => t.week === s.currentWeek);
  const completedToday = todayTasks.filter(t => t.status === "completed").length;
  const hasCheckedInToday = dailyLogs.some(d => {
    const logDate = new Date(d.date);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  });

  const [motivation, setMotivation] = useState("");
  useEffect(() => {
    api.get<{ statement: string }>("/api/daily-motivation")
      .then((r) => setMotivation(r.statement))
      .catch(() => setMotivation("Every expert was once a beginner who refused to give up."));
  }, []);

  const dailyActions = [
    {
      label: "Daily Check-in",
      description: hasCheckedInToday ? "Completed ✓" : "Log today's progress",
      done: hasCheckedInToday,
      action: () => onNavigate("study"),
      icon: CalendarCheck,
    },
    {
      label: "Practice Questions",
      description: "Socratic practice for this week's topic",
      done: false,
      action: () => onNavigate("study"),
      icon: Bot,
    },
    {
      label: "Weekly Test",
      description: s.latestScore !== null ? `Last score: ${s.latestScore}%` : "Not started yet",
      done: false,
      action: () => onNavigate("study"),
      icon: ClipboardList,
    },
    // Only show the "Project Tasks" action when the student's course has
    // projects enabled. Hidden entirely when projects are disabled or no
    // course is assigned — the Project nav item is also hidden in that case.
    ...(stats.projectConfig?.projectEnabled ? [{
      label: "Project Tasks",
      description: hasProject ? `${completedToday}/${todayTasks.length} done this week` : "Set up your project",
      done: false,
      action: () => onNavigate("project"),
      icon: Target,
    }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Motivation banner */}
      {motivation && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm italic text-foreground">{motivation}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats — 4-up grid.
          Fixed: "Engagement" label was misleading (showed streak days, not
          engagement score). Now labeled "Streak" which matches the value. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Award} label="Current Grade" value={grade} color="text-amber-600" />
        <StatCard icon={TrendingUp} label="Overall Progress" value={`${s.progress}%`} color="text-blue-600" />
        <StatCard icon={Activity} label="Streak" value={`${s.streak || 0} days`} color="text-emerald-600" />
        <StatCard icon={BookOpen} label="Week" value={`${s.currentWeek}`} color="text-purple-600" />
      </div>

      {/* Today's Tasks — collapsible, with badge showing pending count */}
      <CollapsibleCard
        title="Today's Tasks"
        description="Complete these to stay on track"
        icon={CalendarCheck}
        badge={`${dailyActions.filter(a => !a.done).length} pending`}
        storageKey="student-home-today-tasks"
        action={<CardRefreshButton onClick={onReload} loading={false} />}
      >
        <div className="grid sm:grid-cols-2 gap-2">
          {dailyActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                action.done ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-primary/10"
              )}>
                {action.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <action.icon className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-muted-foreground truncate">{action.description}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* Upcoming Deadlines — new section showing project tasks with due dates */}
      {(() => {
        const now = new Date();
        const upcoming = tasks
          .filter(t => t.dueDate && t.status !== "completed" && new Date(t.dueDate) >= now)
          .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
          .slice(0, 5);
        if (upcoming.length === 0) return null;
        return (
          <CollapsibleCard
            title="Upcoming Deadlines"
            description="Project tasks due soon"
            icon={Clock}
            badge={`${upcoming.length} due`}
            storageKey="student-home-deadlines"
            defaultOpen={false}
          >
            <div className="space-y-2">
              {upcoming.map(t => {
                const due = new Date(t.dueDate!);
                const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000);
                const isOverdue = daysUntil < 0;
                const isSoon = daysUntil >= 0 && daysUntil <= 2;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isOverdue ? "bg-red-500" : isSoon ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Week {t.week} · Due {due.toLocaleDateString()}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] flex-shrink-0",
                        isOverdue
                          ? "border-red-500/40 bg-red-500/10 text-red-600"
                          : isSoon
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                      )}
                    >
                      {isOverdue ? `${Math.abs(daysUntil)}d overdue` : isSoon ? `${daysUntil}d left` : `${daysUntil}d left`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        );
      })()}

      {/* Score trend — collapsible (only if tests exist) */}
      {stats.weeklyTests.length > 0 && (
        <CollapsibleCard
          title="Your Test Score Trend"
          description={`${stats.weeklyTests.length} test${stats.weeklyTests.length === 1 ? "" : "s"} taken`}
          icon={TrendingUp}
          storageKey="student-home-score-trend"
          defaultOpen={false}
        >
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.weeklyTests.map(t => ({ week: `Wk ${t.week}`, score: t.score || 0 }))}>
              <defs>
                <linearGradient id="studentScoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "12px" }} />
              <Area type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2} fill="url(#studentScoreGradient)" dot={{ fill: "var(--chart-1)", r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CollapsibleCard>
      )}

      {/* AI Tutor CTA */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">Ask the AI Tutor</div>
                <div className="text-xs text-muted-foreground">Get help with today's topic or your project</div>
              </div>
            </div>
            <Button size="sm" onClick={() => redirectToView("ai-tutor")}>
              Open AI Tutor <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// STUDY VIEW — "Let me learn + practice"
// ============================================================
function StudyView({ stats, onReload, onNavigate }: {
  stats: StatsResponse;
  onReload: () => void;
  onNavigate: (v: StudentView) => void;
}) {
  const [studyMode, setStudyMode] = useState<"practice" | "daily-test" | "weekly-test" | "checkin">("practice");

  const studyTabs: Array<{ key: typeof studyMode; label: string; icon: any; desc: string }> = [
    { key: "practice", label: "Practice", icon: Bot, desc: "Socratic questions on any topic" },
    { key: "daily-test", label: "Daily Test", icon: CalendarCheck, desc: "3-question check-in" },
    { key: "weekly-test", label: "Weekly Test", icon: ClipboardList, desc: "15-question exam" },
    { key: "checkin", label: "Check-in", icon: FileText, desc: "Log today's progress" },
  ];

  return (
    <div className="space-y-4">
      {/* Study mode tabs — prominent */}
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

      {/* Study content */}
      {studyMode === "practice" && (
        <QuestionPanel currentWeek={stats.stats.currentWeek} onAnswered={onReload} stats={stats} />
      )}
      {studyMode === "daily-test" && (
        <DailyTestPanel />
      )}
      {studyMode === "weekly-test" && (
        <WeeklyTestPanel stats={stats} onReload={onReload} onMode={() => onNavigate("home")} />
      )}
      {studyMode === "checkin" && (
        <CheckInPanel currentWeek={stats.stats.currentWeek} onSaved={onReload} stats={stats} onMode={() => onNavigate("home")} />
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
