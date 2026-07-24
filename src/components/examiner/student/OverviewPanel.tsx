"use client";

import { showError } from "@/lib/toast-helpers";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scoreToGrade, gradeColor, PILLARS } from "@/lib/constants";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import { getBootcampDayNumber } from "@/lib/course-topics";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";
import { TeacherComments } from "@/components/examiner/student/TeacherComments";
import { StatSquareCard, GanttChartIcon, GithubIcon, safeParse } from "@/components/examiner/student/shared";
import { DailyTestPanel } from "@/components/examiner/student/DailyTestPanel";
import { StudentAssignmentsPanel } from "@/components/examiner/student/StudentAssignmentsPanel";
import { RadialProgress } from "@/components/ui/radial-progress";
import { CourseWizardPreview } from "@/components/examiner/student/CourseWizardPreview";

export function Overview({ stats, onMode, onReload }: { stats: StatsResponse; onMode: (m: Mode) => void; onReload: () => void; }) {
  const { stats: s, tasks, dailyLogs } = stats;
  const grade = scoreToGrade(s.progress);
  const hasProject = tasks.length > 0;
  const currentWeekTasks = tasks.filter(t => t.week === s.currentWeek);
  const c = useChartColors();

  // --- Daily motivation statement (renews every day, same for all students) ---
  const [motivation, setMotivation] = useState<string>("");
  useEffect(() => {
    api.get<{ statement: string }>("/api/daily-motivation")
      .then((r) => setMotivation(r.statement))
      .catch(() => setMotivation("Every expert was once a beginner who refused to give up."));
  }, []);

  // --- Curriculum progress (for the Learning Progress chart) ---
  const [curriculum, setCurriculum] = useState<{
    weeks: { week: number; days: { isCompleted: boolean }[] }[];
    completionByWeek: Record<number, { completed: number; total: number; percent: number }>;
    overallCompletion: { completed: number; total: number; percent: number };
    todayDay: number;
    todayTopic: { title: string; objective: string } | null;
  } | null>(null);

  useEffect(() => {
    api.get<{
      weeks: { week: number; days: { isCompleted: boolean }[] }[];
      completionByWeek: Record<number, { completed: number; total: number; percent: number }>;
      overallCompletion: { completed: number; total: number; percent: number };
      todayDay: number;
      todayTopic: { title: string; objective: string } | null;
    }>("/api/curriculum/progress")
      .then(setCurriculum)
      .catch(() => {});
  }, []);

  // Phase 1.4: "Start Today's Work" button — fetches the daily-tasks summary
  // so we know what's pending and whether today is a rest day. The button
  // links the 4 daily surfaces (curriculum + practice + task + check-in)
  // into a single guided flow instead of making the student navigate 4 tabs.
  const [dailySummary, setDailySummary] = useState<{
    pendingCount: number;
    allDone: boolean;
    isRestDay: boolean;
    restDayLabel: string;
    curriculumCompleted: boolean;
    hasPracticedToday: boolean;
    hasCheckedInToday: boolean;
  } | null>(null);

  useEffect(() => {
    api.get<{
      pendingCount: number;
      allDone: boolean;
      isRestDay: boolean;
      restDayLabel: string;
      curriculumCompleted: boolean;
      hasPracticedToday: boolean;
      hasCheckedInToday: boolean;
    }>("/api/daily-tasks")
      .then(setDailySummary)
      .catch(() => {});
  }, [onReload]); // refetch when stats reload (e.g. after completing a task)

  // Phase 4.4 + 4.5: Certificate status — shows the student's certificate
  // if they've earned one, OR their progress toward earning one. When
  // eligible (all tests complete + reached final week), auto-generates the
  // certificate so the student sees it immediately on their dashboard.
  const [certStatus, setCertStatus] = useState<{
    certificate: {
      id: string;
      courseName: string;
      studentName: string;
      grade: string;
      score: number;
      issuedAt: string;
      signedBy: string;
      verifyToken: string;
      verifyUrl: string;
    } | null;
    completion: {
      currentWeek: number;
      totalWeeks: number;
      reachedFinalWeek: boolean;
      completedTests: number;
      allTestsCompleted: boolean;
      progressPercent: number;
      eligible: boolean;
    };
  } | null>(null);

  useEffect(() => {
    api.get<{
      certificate: {
        id: string;
        courseName: string;
        studentName: string;
        grade: string;
        score: number;
        issuedAt: string;
        signedBy: string;
        verifyToken: string;
        verifyUrl: string;
      } | null;
      completion: {
        currentWeek: number;
        totalWeeks: number;
        reachedFinalWeek: boolean;
        completedTests: number;
        allTestsCompleted: boolean;
        progressPercent: number;
        eligible: boolean;
      };
    }>("/api/certificates/user")
      .then((res) => {
        setCertStatus(res);
        // Phase 4.2: If the student is eligible but doesn't have a certificate
        // yet, auto-generate one. This makes the certificate appear immediately
        // when they complete their final test — no manual action needed.
        if (res.completion.eligible && !res.certificate) {
          api.post<{ verifyUrl: string }>("/api/certificates/generate")
            .then(() => {
              // Refetch to get the newly-created certificate
              api.get<{
                certificate: {
                  id: string;
                  courseName: string;
                  studentName: string;
                  grade: string;
                  score: number;
                  issuedAt: string;
                  signedBy: string;
                  verifyToken: string;
                  verifyUrl: string;
                } | null;
                completion: {
                  currentWeek: number;
                  totalWeeks: number;
                  reachedFinalWeek: boolean;
                  completedTests: number;
                  allTestsCompleted: boolean;
                  progressPercent: number;
                  eligible: boolean;
                };
              }>("/api/certificates/user").then((r) => setCertStatus(r)).catch(() => {});
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [onReload]);

  // --- Project progress bar chart data (per-week task completion) ---
  // Respect the student's configured project duration (default 6).
  const projectDurationWeeks = s.projectDurationWeeks ?? 6;
  const maxWeek = Math.max(projectDurationWeeks, ...tasks.map(t => t.week), 1);
  const projectChartData = Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => {
    const weekTasks = tasks.filter(t => t.week === w);
    const completed = weekTasks.filter(t => t.status === "completed").length;
    const total = weekTasks.length;
    return {
      week: `W${w}`,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // --- Learning progress chart data (curriculum completion per week) ---
  const learningChartData = curriculum
    ? curriculum.weeks.map(w => ({
        week: `W${w.week}`,
        completed: curriculum.completionByWeek[w.week]?.completed ?? 0,
        total: curriculum.completionByWeek[w.week]?.total ?? 0,
        percent: curriculum.completionByWeek[w.week]?.percent ?? 0,
      }))
    : [];

  // Today's project tasks (tasks for today's day number, using the `day` column)
  const todayDay = getBootcampDayNumber(new Date());
  // Today's project tasks: those with day === todayDay, OR those with day === null
  // (unscheduled tasks show up every day so the student doesn't lose track of them).
  const todayProjectTasks = currentWeekTasks.filter(t => t.day === todayDay || t.day === null || t.day === undefined);

  // Encouraging messages based on progress
  const encouragement = (() => {
    if ((s.consistencyPercent ?? 0) >= 80) return { title: "Consistent! 🌱", msg: `${s.consistencyPercent}% consistent over the last 2 weeks — that's how habits stick.` };
    if ((s.consistencyPercent ?? 0) >= 50) return { title: "Building momentum", msg: `${s.consistencyPercent}% consistent — you're showing up. Keep going.` };
    if (s.streak >= 7) return { title: "You're on fire! 🔥", msg: `${s.streak} days straight — keep it up!` };
    if (s.progress >= 75) return { title: "Outstanding progress!", msg: `You're ${s.progress}% through — almost there!` };
    if (s.progress >= 50) return { title: "Halfway there!", msg: `Solid work. Stay consistent.` };
    if (s.progress >= 25) return { title: "Great momentum!", msg: `You're building real skills.` };
    if (dailyLogs.length > 0) return { title: "Great start!", msg: `You've begun your journey — keep going.` };
    return { title: "Welcome to your journey!", msg: `Start with the My Journey guide to begin.` };
  })();

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Phase 4.4 + 4.5: Certificate / Alumni banner.
          - If the student has a certificate: show alumni banner + certificate card
          - If they're eligible but don't have one yet: auto-generates (in the effect above)
          - If they're in progress: show progress toward certificate */}
      {certStatus?.certificate && (
        <Card className="border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-background">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white flex-shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  🎓 Congratulations, {certStatus.certificate.studentName}!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You&apos;ve completed {certStatus.certificate.courseName} with grade{" "}
                  <strong className={gradeColor(certStatus.certificate.grade)}>
                    {certStatus.certificate.grade} ({certStatus.certificate.score}%)
                  </strong>
                  . Your certificate was issued on{" "}
                  {new Date(certStatus.certificate.issuedAt).toLocaleDateString()}.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a
                    href={certStatus.certificate.verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> View Certificate
                  </a>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `${certStatus.certificate!.studentName} — ${certStatus.certificate!.courseName} Certificate`,
                          url: `${window.location.origin}${certStatus.certificate!.verifyUrl}`,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard?.writeText(`${window.location.origin}${certStatus.certificate!.verifyUrl}`);
                        showError("Certificate link copied to clipboard!");
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Send className="h-3 w-3" /> Share
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 4.4: Certificate progress (shown when the student hasn't earned
          one yet but is making progress). Hidden once they have a certificate. */}
      {certStatus && !certStatus.certificate && certStatus.completion.progressPercent > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-foreground">
                    Certificate Progress
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {certStatus.completion.progressPercent}%
                  </span>
                </div>
                <Progress value={certStatus.completion.progressPercent} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {certStatus.completion.completedTests}/{certStatus.completion.totalWeeks} weekly tests completed ·
                  Week {certStatus.completion.currentWeek}/{certStatus.completion.totalWeeks}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slim welcome banner + daily motivation (one line) */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-background">
        <CardContent className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* Phase C: Radial progress replaces the static Sparkles icon.
                Visual cue for the student's rolling 14-day consistency %
                — auto-toned sage/amber/coral by value. */}
            <div className="flex-shrink-0">
              <RadialProgress
                value={s.consistencyPercent ?? 0}
                size="sm"
                autoTone
                sublabel="consistency"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm leading-tight">{encouragement.title}</p>
              <p className="text-xs text-muted-foreground leading-tight truncate">{motivation || encouragement.msg}</p>
            </div>
            <Button onClick={() => onMode("journey")} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs flex-shrink-0">
              <Sparkles className="h-3 w-3" /> My Journey
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Phase Three-Tab Redesign: Daily Test — feeds Psychological/Educational/Mentorship
          tabs daily, not just weekly. Sits right after the welcome banner so it's
          the first thing the student sees each day. */}
      <DailyTestPanel />

      {/* Stat cards — 6 most important stats in 3×2 grid (full width).
          Phase C: staggered entrance — cards appear one after another
          with a 40ms delay, giving the dashboard a "settling in" feel. */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 animate-stagger">
        <StatSquareCard label="Week" value={`${s.currentWeek}/${s.projectDurationWeeks ?? 6}`} icon={<CalendarCheck className="h-4 w-4" />} accent="emerald" />
        <StatSquareCard label="Progress" value={`${s.progress}%`} icon={<TrendingUp className="h-4 w-4" />} accent="cyan" />
        <StatSquareCard label="Consistency" value={`${s.consistencyPercent ?? 0}%`} icon={<Sparkles className="h-4 w-4" />} accent="amber" />
        <StatSquareCard label="Score" value={s.latestScore !== null ? `${s.latestScore}%` : "—"} icon={<FileText className="h-4 w-4" />} accent="violet" />
        <StatSquareCard label="Tasks" value={`${s.completedTasksThisWeek}/${s.tasksThisWeek}`} icon={<ClipboardList className="h-4 w-4" />} accent="cyan" />
        <StatSquareCard label="Practice" value={`${stats.recentInteractions.length}`} icon={<HelpCircle className="h-4 w-4" />} accent="amber" />
      </div>

      {/* Scale Tier 2: Student assignments + events panel */}
      <StudentAssignmentsPanel />

      {/* Two trends side-by-side: Project Progress + Learning Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* LEFT — Project Progress chart (tasks completed per week) */}
        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-0.5 pt-2 px-3">
            <CardTitle className="text-xs font-medium text-foreground flex items-center gap-1.5 whitespace-nowrap">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> Project Progress
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground">Project tasks completed per week</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-2 pb-2 flex-1 flex flex-col justify-center">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[140px] text-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground/40 mb-1" />
                <p className="text-[10px] text-muted-foreground">No project tasks yet.</p>
                <Button onClick={() => onMode("gantt")} size="sm" variant="outline" className="mt-1 h-6 text-[10px]">
                  Add Tasks
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={projectChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="week" stroke={c.axis} style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke={c.axis} style={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle(c)}
                    formatter={(value: unknown, name: unknown) => {
                      if (name === "completed") return [`${value} tasks`, "Completed"];
                      return [String(value), String(name)];
                    }}
                    labelFormatter={(label) => {
                      const item = projectChartData.find(d => d.week === String(label));
                      return item ? `${label} — ${item.completed}/${item.total} (${item.percent}%)` : String(label);
                    }}
                  />
                  <Bar dataKey="completed" name="completed" fill={c.chart1} radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Learning Progress chart (curriculum completion per week) */}
        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-0.5 pt-2 px-3">
            <CardTitle className="text-xs font-medium text-foreground flex items-center gap-1.5 whitespace-nowrap">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Learning Progress
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground">Curriculum days completed per week</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-2 pb-2 flex-1 flex flex-col justify-center">
            {!curriculum || learningChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[140px] text-center">
                <BookOpen className="h-6 w-6 text-muted-foreground/40 mb-1" />
                <p className="text-[10px] text-muted-foreground">Loading curriculum…</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={learningChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="week" stroke={c.axis} style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke={c.axis} style={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 5]} />
                  <Tooltip
                    contentStyle={tooltipStyle(c)}
                    formatter={(value: unknown, name: unknown) => {
                      if (name === "completed") return [`${value} days`, "Completed"];
                      return [String(value), String(name)];
                    }}
                    labelFormatter={(label) => {
                      const item = learningChartData.find(d => d.week === String(label));
                      return item ? `${label} — ${item.completed}/${item.total} days (${item.percent}%)` : String(label);
                    }}
                  />
                  <Bar dataKey="completed" name="completed" fill={c.chart2} radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's two-track summary: Today's Curriculum + Today's Project Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Today's Curriculum Topic mini-card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" /> Today&apos;s Curriculum
              </CardTitle>
              <Button onClick={() => onMode("checkin")} size="sm" variant="ghost" className="h-6 text-[10px] text-primary hover:bg-primary/10">
                Open Learning Hub →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {curriculum?.todayTopic ? (
              <div>
                <p className="text-xs font-medium text-foreground leading-snug">{curriculum.todayTopic.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{curriculum.todayTopic.objective}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[9px]">Day {curriculum.todayDay}</Badge>
                  <Badge variant="outline" className="text-[9px]">Week {s.currentWeek}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Loading today&apos;s topic…</p>
            )}
          </CardContent>
        </Card>

        {/* Today's Project Tasks mini-card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-1 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-primary" /> Today&apos;s Project Tasks
              </CardTitle>
              <Button onClick={() => onMode("gantt")} size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:bg-muted">
                Open Project →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {todayProjectTasks.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No tasks scheduled for today (Day {todayDay}). Add tasks in the Project tab.
              </p>
            ) : (
              <ul className="space-y-1">
                {todayProjectTasks.slice(0, 3).map(t => (
                  <li key={t.id} className="flex items-start gap-1.5 text-[11px]">
                    {t.status === "completed"
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      : <Circle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />}
                    <span className={`flex-1 leading-snug ${t.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {t.description}
                    </span>
                  </li>
                ))}
                {todayProjectTasks.length > 3 && (
                  <li className="text-[10px] text-muted-foreground">+ {todayProjectTasks.length - 3} more…</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase 1.4: "Today's Work" guided button — replaces the "navigate 4
          tabs to do today's work" friction. Shows a rest-day message on
          weekends (Phase 1.5) and an "all done!" celebration when complete. */}
      {dailySummary?.isRestDay ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Happy {dailySummary.restDayLabel}! It's a rest day.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Take a break — your consistency score is safe. Come back tomorrow refreshed. You can still
                explore the AI Tutor or review your course outline if you want to.
              </p>
            </div>
            <Button onClick={() => onMode("ai-tutor")} variant="outline" size="sm" className="border-border flex-shrink-0">
              <Bot className="h-4 w-4" /> AI Tutor
            </Button>
          </CardContent>
        </Card>
      ) : dailySummary?.allDone ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Today's work complete — great job!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've finished today's curriculum, practice, project tasks, and check-in.
                Use the rest of your time to review your project plan or explore the AI Tutor.
              </p>
            </div>
            <Button onClick={() => onMode("gantt")} variant="outline" size="sm" className="border-border flex-shrink-0">
              <TrendingUp className="h-4 w-4" /> View Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Today&apos;s Work — {dailySummary?.pendingCount ?? 0} task{(dailySummary?.pendingCount ?? 0) === 1 ? "" : "s"} left
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete these 4 steps to finish today&apos;s work. Click each button to jump to that section.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Step 1: Curriculum */}
              <button
                onClick={() => onMode("checkin")}
                className={`text-left rounded-md p-2.5 border transition-all ${dailySummary?.curriculumCompleted ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {dailySummary?.curriculumCompleted ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">1. Learning</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dailySummary?.curriculumCompleted ? "Done for today" : "Mark today's topic done"}
                </p>
              </button>
              {/* Step 2: Practice */}
              <button
                onClick={() => onMode("question")}
                className={`text-left rounded-md p-2.5 border transition-all ${dailySummary?.hasPracticedToday ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {dailySummary?.hasPracticedToday ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">2. Practice</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dailySummary?.hasPracticedToday ? "Done for today" : "Answer 1 question"}
                </p>
              </button>
              {/* Step 3: Project tasks */}
              <button
                onClick={() => onMode("gantt")}
                className={`text-left rounded-md p-2.5 border transition-all ${s.completedTasksThisWeek >= s.tasksThisWeek && s.tasksThisWeek > 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {s.completedTasksThisWeek >= s.tasksThisWeek && s.tasksThisWeek > 0 ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">3. Project</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {s.tasksThisWeek === 0 ? "No tasks today" :
                   s.completedTasksThisWeek >= s.tasksThisWeek ? "All done" :
                   `${s.completedTasksThisWeek}/${s.tasksThisWeek} done`}
                </p>
              </button>
              {/* Step 4: Check-in */}
              <button
                onClick={() => onMode("checkin")}
                className={`text-left rounded-md p-2.5 border transition-all ${dailySummary?.hasCheckedInToday ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {dailySummary?.hasCheckedInToday ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">4. Check-in</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dailySummary?.hasCheckedInToday ? "Done for today" : "Reflect on today"}
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Wizard preview — always visible, guides students to the Project Plan tab */}
      <CourseWizardPreview stats={stats} onOpenPlan={() => onMode("gantt")} />

      {/* Row 1 — This Week's Tasks (left) + Weekly Test Summary (right, 50% weight) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* This week's tasks — shows empty state when no tasks */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-base text-foreground">This Week&apos;s Tasks</CardTitle>
            <CardDescription className="text-muted-foreground">
              {hasProject ? `${s.completedTasksThisWeek}/${s.tasksThisWeek} completed` : "No tasks yet — visit the Project Plan to add some"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasProject ? (
              <>
                <Progress value={s.progress} className="h-2" />
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {currentWeekTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No tasks for this week yet.</p>
                  ) : (
                    [...currentWeekTasks].sort((a, b) => {
                      const dayA = a.day ?? 99;
                      const dayB = b.day ?? 99;
                      return dayA - dayB;
                    }).map((t) => (
                      <div key={t.id} className="rounded-md bg-muted p-2 text-sm">
                        <div className="flex items-center gap-2">
                          {t.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <span className={t.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}>{t.description}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] capitalize">{t.status}</Badge>
                        </div>
                        <TeacherComments comments={stats.comments} entityId={t.id} field="taskId" />
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-3">
                <ClipboardList className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground mb-2">You haven&apos;t added any tasks yet.</p>
                <Button onClick={() => onMode("gantt")} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                  <GanttChartIcon className="h-3.5 w-3.5" /> Open Project Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Test Summary — 50% weight, shows current week's result + all weeks */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Weekly Test Summary
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary font-semibold">50% weight</Badge>
            </div>
            <CardDescription className="text-muted-foreground">Socratic AI examiner — Week {s.currentWeek}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {(() => {
              const currentWeekTest = stats.weeklyTests.find(t => t.week === s.currentWeek);
              // Include tests that have a score — even if the status field is
              // stuck on "in-progress" (happens when AI completed but status
              // wasn't updated). This ensures the summary always reflects
              // actual completed work.
              const completedTests = stats.weeklyTests.filter(t => t.score !== null);
              const avgScore = completedTests.length > 0
                ? Math.round(completedTests.reduce((a, t) => a + (t.score ?? 0), 0) / completedTests.length)
                : null;
              if (!currentWeekTest) {
                return (
                  <div className="text-center py-2 space-y-1.5">
                    <Brain className="h-6 w-6 text-primary/40 mx-auto" />
                    <p className="text-xs text-foreground font-medium">Week {s.currentWeek} test not started</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.currentWeek === (stats.stats.projectDurationWeeks ?? 6)
                        ? "Final capstone test — open all week, no task lock."
                        : "Complete all this week's tasks to unlock the test."}
                    </p>
                    <Button onClick={() => onMode("weekly-test")} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                      <ClipboardList className="h-3.5 w-3.5" /> Go to Weekly Test
                    </Button>
                  </div>
                );
              }
              return (
                <>
                  {/* Current week's result */}
                  <div className="rounded-md bg-background border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">Week {currentWeekTest.week}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{currentWeekTest.score !== null ? "completed" : currentWeekTest.status}</Badge>
                    </div>
                    {currentWeekTest.score !== null ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-bold ${gradeColor(scoreToGrade(currentWeekTest.score ?? 0))}`}>{currentWeekTest.score}%</span>
                          <span className="text-xs text-muted-foreground">{scoreToGrade(currentWeekTest.score ?? 0)}</span>
                        </div>
                        {currentWeekTest.retakeAllowed && (
                          <Badge variant="outline" className="text-[10px] mt-1 border-amber-500/30 text-amber-600 bg-amber-500/10">Retake available</Badge>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">In progress — continue the conversation.</p>
                    )}
                  </div>
                  {/* Mini history */}
                  {completedTests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1.5">All completed weeks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.weeklyTests.map(t => (
                          <button
                            key={t.week}
                            onClick={() => onMode("weekly-test")}
                            className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                              t.status === "completed"
                                ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20"
                                : t.status === "in-progress"
                                ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                : "border-border text-muted-foreground"
                            }`}
                            title={`Week ${t.week} — ${t.status}`}
                          >
                            W{t.week}{t.status === "completed" && t.score !== null ? ` · ${t.score}%` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {avgScore !== null && (
                    <p className="text-[10px] text-muted-foreground">Average across completed weeks: <strong className="text-foreground">{avgScore}%</strong></p>
                  )}
                  <Button onClick={() => onMode("weekly-test")} size="sm" variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10">
                    {currentWeekTest.score !== null ? "View Full Results" : currentWeekTest.status === "in-progress" ? "Continue Test" : "Start Test"}
                  </Button>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Daily Practice Test (50% weight) + Recent Check-Ins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily Practice Test — recent AI interactions (practice questions), 50% weight */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-secondary-foreground" /> Daily Practice Test
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] bg-secondary text-foreground/70 font-semibold">50% weight</Badge>
            </div>
            <CardDescription className="text-muted-foreground">
              {stats.recentInteractions.length > 0
                ? `Last ${Math.min(stats.recentInteractions.length, 6)} practice questions`
                : "No practice questions yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {(() => {
              // Show the most recent practice questions (regardless of week)
              // so the student always sees their latest activity. The week
              // label on each record makes it clear which week it's from.
              const recentPractice = stats.recentInteractions.slice(0, 6);
              if (recentPractice.length === 0) {
                return (
                  <div className="text-center py-3">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground mb-1">No practice questions yet.</p>
                    <p className="text-[10px] text-muted-foreground/70 mb-2">Answer a question about today&apos;s topic to get started.</p>
                    <Button onClick={() => onMode("question")} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                      <HelpCircle className="h-3.5 w-3.5" /> Get a Question
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {recentPractice.map((i) => (
                    <div key={i.id} className="rounded-md bg-muted p-2 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{i.pillar}</Badge>
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">W{i.week}</Badge>
                        </div>
                        <span className={`font-bold ${gradeColor(scoreToGrade(i.correctness))}`}>{i.correctness}%</span>
                      </div>
                      <p className="text-foreground/80 text-xs">{i.topic}</p>
                      <p className="text-foreground mt-1 line-clamp-2">{i.question}</p>
                      {/* SDT: plagiarism score hidden from student — teacher only */}
                      <TeacherComments comments={stats.comments} entityId={i.id} field="interactionId" />
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Recent Check-Ins — daily logs (most recent, regardless of week) */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-base text-foreground">Recent Check-Ins</CardTitle>
            <CardDescription className="text-muted-foreground">
              {dailyLogs.length > 0
                ? `Last ${Math.min(dailyLogs.length, 5)} check-ins`
                : "No check-ins yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-56 overflow-y-auto px-3 pb-3">
            {(() => {
              // Show the most recent check-ins (regardless of week) so the
              // student always sees their latest activity. The week label
              // on each record makes it clear which week it's from.
              const recentLogs = dailyLogs.slice().reverse().slice(0, 5);
              if (recentLogs.length === 0) {
                return (
                  <div className="text-center py-3">
                    <CalendarCheck className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground mb-2">No check-ins yet.</p>
                    <Button onClick={() => onMode("checkin")} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                      <CalendarCheck className="h-3.5 w-3.5" /> Start First Check-In
                    </Button>
                  </div>
                );
              }
              // Show most recent first, max 5
              return recentLogs.map((log) => (
                <div key={log.id} className="rounded-md bg-muted p-2 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.date).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">W{log.week}</Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Confidence {log.confidence}/5</Badge>
                  </div>
                  <p className="text-foreground">{log.whatDidYouDo}</p>
                  {log.anyErrors && <p className="text-xs text-destructive mt-1">⚠️ {log.anyErrors}</p>}
                  {log.learningReflection && (
                    <p className="text-xs text-primary mt-1"><strong>Learned:</strong> {log.learningReflection}</p>
                  )}
                  {log.confusionNotes && (
                    <p className="text-xs text-amber-600 mt-1"><strong>Confused:</strong> {log.confusionNotes}</p>
                  )}
                  {log.nextQuestion && (
                    <p className="text-xs text-violet-600 mt-1"><strong>Next question:</strong> {log.nextQuestion}</p>
                  )}
                  <TeacherComments comments={stats.comments} entityId={log.id} field="dailyLogId" />
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
