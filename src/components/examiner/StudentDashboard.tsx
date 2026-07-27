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
  AlertCircle, Award, ChevronRight, Activity, Target, Clock,
  HelpCircle, UserCircle,
} from "lucide-react";
import type { StatsResponse, Mode, StudentCoursePlan } from "@/components/examiner/student/types";
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

  // Map legacy initialMode to new view
  useEffect(() => {
    if (initialMode === "checkin" || initialMode === "question" || initialMode === "weekly-test") {
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

  // ============================================================
  // COURSE-PLAN-CENTRIC: Unassigned state.
  // When the student has no course assigned (coursePlan is null OR
  // coursePlan.courseAssigned is false), render the "Course Assignment
  // Pending" panel. Only Dashboard + Ask My Teacher + Messages + Settings
  // nav are visible (filtered in AppShell).
  // ============================================================
  const coursePlan = stats.coursePlan;
  const isAssigned = !!coursePlan && coursePlan.courseAssigned;
  if (!isAssigned) {
    return <UnassignedStudentView coursePlan={coursePlan} />;
  }

  return (
    <div className="space-y-4">
      {/* Course plan header — summary + key features + teacher.
          Gives the student a mental map of their journey + social presence. */}
      {coursePlan && (
        <CoursePlanHeader coursePlan={coursePlan} />
      )}

      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" /> Refreshing…
        </div>
      )}

      {view === "home" && (
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

      <DailyTaskReminder onChanged={load} onNavigate={() => setView("study")} />
    </div>
  );
}

// ============================================================
// UNASSIGNED STUDENT VIEW — "Course Assignment Pending"
// Rendered when the student has no course assigned yet.
// Psychological design: acknowledge the state without blame, provide
// a timeline anchor, offer agency (Contact Support / View Profile).
// ============================================================
function UnassignedStudentView({ coursePlan }: { coursePlan: StudentCoursePlan | null | undefined }) {
  return (
    <div className="max-w-2xl mx-auto py-6">
      <Card className="border-primary/20 bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-lg text-foreground">Welcome to ExaminerAI</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Your learning journey is being prepared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
            <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Course Assignment Pending
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Your learning journey hasn&apos;t been configured yet. Your instructor is preparing
              your personalized course plan. You&apos;ll receive a notification as soon as it&apos;s ready.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1.5">What happens next?</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Your instructor assigns a course plan to your batch.</li>
              <li>You&apos;ll see today&apos;s curriculum topic, daily tasks, and tests appear here.</li>
              <li>The AI Tutor + practice questions become available immediately.</li>
            </ol>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => redirectToView("ask-teacher")}>
              <HelpCircle className="h-3.5 w-3.5" /> Contact Your Teacher
            </Button>
            <Button variant="outline" size="sm" onClick={() => redirectToView("settings")}>
              <UserCircle className="h-3.5 w-3.5" /> View Profile
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Need help right away? Reach out to your institution&apos;s administration team via the Messages tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// COURSE PLAN HEADER — summary + key features + teacher card.
// Shown at the top of the student dashboard when a course is assigned.
// Gives the student a mental map of their journey (summary, features)
// and a social presence anchor (teacher name + email).
// ============================================================
function CoursePlanHeader({ coursePlan }: { coursePlan: StudentCoursePlan }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-foreground">{coursePlan.courseName || "Your Course"}</h2>
              {coursePlan.courseStatus === "published" ? (
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  Published
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  Draft
                </Badge>
              )}
              {coursePlan.hasProject && (
                <Badge variant="outline" className={`text-[9px] ${coursePlan.projectRequired ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"}`}>
                  Capstone {coursePlan.projectRequired ? "Required" : "Optional"}
                </Badge>
              )}
            </div>
            {coursePlan.courseSummary && (
              <p className="text-xs text-foreground/80 leading-relaxed">{coursePlan.courseSummary}</p>
            )}
            {coursePlan.courseKeyFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {coursePlan.courseKeyFeatures.map((f, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-background/60 text-foreground border-border">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5 text-primary" /> {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {coursePlan.teacher && (
            <div className="rounded-md border border-border bg-background p-2.5 flex items-center gap-2 flex-shrink-0 max-w-xs">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                {coursePlan.teacher.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Teacher</p>
                <p className="text-xs font-medium text-foreground truncate">{coursePlan.teacher.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{coursePlan.teacher.email}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Award} label="Current Grade" value={grade} color="text-amber-600" />
        <StatCard icon={TrendingUp} label="Overall Progress" value={`${s.progress}%`} color="text-blue-600" />
        <StatCard icon={Activity} label="Engagement" value={`${s.streak || 0} days`} color="text-emerald-600" />
        <StatCard icon={BookOpen} label="Week" value={`${s.currentWeek}`} color="text-purple-600" />
      </div>

      {/* Today's action items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            Today's Tasks
          </CardTitle>
          <CardDescription className="text-xs">Complete these to stay on track</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
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
        </CardContent>
      </Card>

      {/* Score trend (if tests exist) */}
      {stats.weeklyTests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Your Test Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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
