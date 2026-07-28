"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";
import { TeacherComments } from "@/components/examiner/student/TeacherComments";

export function CheckInPanel({ currentWeek, onSaved, stats, onMode, courseId }: { currentWeek: number; onSaved: () => void; stats: StatsResponse; onMode?: (m: Mode) => void; courseId?: string }) {
  // Form state for the daily check-in
  const [what, setWhat] = useState("");
  const [errors, setErrors] = useState("");
  const [confidence, setConfidence] = useState("3");
  const [git, setGit] = useState("");
  const [learningReflection, setLearningReflection] = useState("");
  const [confusionNotes, setConfusionNotes] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showReflection, setShowReflection] = useState(false);
  // Editing state — when set, the form PATCHes instead of POSTs
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Curriculum state (separate from project tasks)
  const [curriculum, setCurriculum] = useState<{
    weeks: {
      week: number; phase: string;
      days: { day: number; title: string; objective: string; resources: { label: string; url: string }[]; isCompleted: boolean }[];
    }[];
    completionByWeek: Record<number, { completed: number; total: number; percent: number }>;
    overallCompletion: { completed: number; total: number; percent: number };
    todayDay: number;
    todayTopic: { title: string; objective: string; resources: { label: string; url: string }[] } | null;
  } | null>(null);

  // Course + project config — drives whether the "Today's Curriculum" card
  // shows (only when course assigned), and whether the check-in form mentions
  // the project (only when project is enabled).
  const projectConfig = stats.projectConfig;
  const hasCourse = projectConfig?.courseAssigned ?? false;
  const projectEnabled = projectConfig?.projectEnabled ?? false;
  const projectRequired = projectConfig?.projectRequired ?? false;

  // Today's project task — fetched from /api/daily-tasks (same shape the
  // DailyTaskReminder uses). Surfaces here so the student can see today's
  // course daily topic + today's project task side-by-side, and mark either
  // complete from the check-in flow.
  const [todayProjectTasks, setTodayProjectTasks] = useState<{
    id: string;
    description: string;
    status: string;
    isMilestone?: boolean;
    courseTopicLink?: string | null;
  }[]>([]);
  const [projectTaskError, setProjectTaskError] = useState("");
  const loadTodayProjectTasks = useCallback(async () => {
    if (!projectEnabled) {
      setTodayProjectTasks([]);
      return;
    }
    try {
      const res = await api.get<{
        projectTasks: {
          id: string;
          description: string;
          status: string;
          isMilestone?: boolean;
          courseTopicLink?: string | null;
        }[];
      }>("/api/daily-tasks");
      setTodayProjectTasks(res.projectTasks || []);
    } catch {
      // silent — non-critical
    }
  }, [projectEnabled]);

  useEffect(() => { loadTodayProjectTasks(); }, [loadTodayProjectTasks]);

  const markProjectTaskDone = async (taskId: string) => {
    setProjectTaskError("");
    try {
      await api.patch("/api/tasks", { id: taskId, status: "completed" });
      await loadTodayProjectTasks();
      onSaved();
    } catch (e) {
      setProjectTaskError(e instanceof Error ? e.message : "Failed to mark task done — please retry");
    }
  };

  const c = useChartColors();

  // Fetch curriculum progress (separate from project tasks)
  const loadCurriculum = useCallback(async () => {
    try {
      const res = await api.get<{
        weeks: {
          week: number; phase: string;
          days: { day: number; title: string; objective: string; resources: { label: string; url: string }[]; isCompleted: boolean }[];
        }[];
        completionByWeek: Record<number, { completed: number; total: number; percent: number }>;
        overallCompletion: { completed: number; total: number; percent: number };
        todayDay: number;
        todayTopic: { title: string; objective: string; resources: { label: string; url: string }[] } | null;
      }>("/api/curriculum/progress");
      setCurriculum(res);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCurriculum(); }, [loadCurriculum]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!what.trim()) return;
    setBusy(true);
    try {
      if (editingLogId) {
        // Editing an existing check-in — PATCH instead of POST
        await api.patch(`/api/daily-logs/${editingLogId}`, {
          whatDidYouDo: what,
          anyErrors: errors,
          confidence: Number(confidence),
          gitCommit: git,
          week: currentWeek,
          learningReflection: showReflection ? learningReflection : undefined,
          confusionNotes: showReflection ? confusionNotes : undefined,
          nextQuestion: showReflection ? nextQuestion : undefined,
        });
        setMsg("✓ Check-in updated!");
        setEditingLogId(null);
      } else {
        // Creating a new check-in
        await api.post("/api/daily-logs", {
          whatDidYouDo: what,
          anyErrors: errors,
          confidence: Number(confidence),
          gitCommit: git,
          week: currentWeek,
          learningReflection: showReflection ? learningReflection : undefined,
          confusionNotes: showReflection ? confusionNotes : undefined,
          nextQuestion: showReflection ? nextQuestion : undefined,
        });
        setMsg("✓ Check-in saved — consistency building!");
      }
      setWhat(""); setErrors(""); setConfidence("3"); setGit("");
      setLearningReflection(""); setConfusionNotes(""); setNextQuestion("");
      onSaved();
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  /** Load a log into the form for editing. Scrolls to the form so the student
   *  can see + modify the fields. */
  const handleEditLog = (log: { id: string; whatDidYouDo: string; anyErrors?: string | null; confidence: number; gitCommit?: string | null; learningReflection?: string | null; confusionNotes?: string | null; nextQuestion?: string | null }) => {
    setEditingLogId(log.id);
    setWhat(log.whatDidYouDo);
    setErrors(log.anyErrors || "");
    setConfidence(String(log.confidence));
    setGit(log.gitCommit || "");
    setLearningReflection(log.learningReflection || "");
    setConfusionNotes(log.confusionNotes || "");
    setNextQuestion(log.nextQuestion || "");
    if (log.learningReflection || log.confusionNotes || log.nextQuestion) {
      setShowReflection(true);
    }
    setMsg("Editing check-in — make your changes and save.");
    // Scroll to the form
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /** Delete a check-in with confirmation. Calls DELETE /api/daily-logs/[id]. */
  const handleDeleteLog = async (logId: string) => {
    if (!confirm("Delete this check-in? This cannot be undone.")) return;
    try {
      await api.del(`/api/daily-logs/${logId}`);
      setMsg("✓ Check-in deleted.");
      onSaved();
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  /** Cancel editing — clears the form + exits edit mode. */
  const cancelEdit = () => {
    setEditingLogId(null);
    setWhat(""); setErrors(""); setConfidence("3"); setGit("");
    setLearningReflection(""); setConfusionNotes(""); setNextQuestion("");
    setMsg("");
  };

  // Toggle a curriculum day's completion
  const [toggleError, setToggleError] = useState("");
  const toggleDay = async (week: number, day: number, isCompleted: boolean) => {
    setToggleError("");
    try {
      if (isCompleted) {
        // api.del now accepts an optional body
        await api.del("/api/curriculum/progress", { week, day });
      } else {
        await api.post("/api/curriculum/progress", { week, day });
      }
      await loadCurriculum();
      onSaved(); // refresh parent stats so the dashboard chart updates
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : "Failed to update — please retry");
      // Reload to revert the optimistic UI state
      await loadCurriculum();
    }
  };

  // All check-ins (most recent first)
  const recentLogs = stats.dailyLogs.slice().reverse();

  // Curriculum chart data: completion percent per week
  const curriculumChartData = curriculum
    ? curriculum.weeks.map(w => ({
        week: `W${w.week}`,
        completed: curriculum.completionByWeek[w.week]?.completed ?? 0,
        total: curriculum.completionByWeek[w.week]?.total ?? 0,
        percent: curriculum.completionByWeek[w.week]?.percent ?? 0,
      }))
    : [];

  // Current week's curriculum (5 daily topics)
  const currentWeekCurriculum = curriculum?.weeks.find(w => w.week === currentWeek);
  const todayDay = curriculum?.todayDay ?? 1;
  const todayTopic = curriculum?.todayTopic;

  return (
    <div className="space-y-4">
      {/* ===== NO-COURSE NOTICE =====
          When the student has no course assigned (or the course has no weekly
          outline yet), the "Today's Curriculum" card doesn't render — show a
          friendly notice explaining what to do instead. The student can still
          fill in the daily check-in form below. */}
      {!hasCourse && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">No course assigned yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your daily curriculum (topics, objectives, and resources) will appear here once your teacher assigns you to a course. In the meantime, you can still log today&apos;s work in the check-in form below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== TOP: Today's Curriculum Topic ===== */}
      {hasCourse && todayTopic && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Today&apos;s Curriculum
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Week {currentWeek} · Day {todayDay} · {curriculum?.weeks.find(w => w.week === currentWeek)?.phase}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs"
                onClick={() => onMode ? onMode("checkin") : (() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("view", "checkin");
                  window.location.href = url.toString();
                })()}
              >
                <HelpCircle className="h-3 w-3" /> Practice this
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="rounded-md bg-background/70 border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Topic</p>
              <p className="text-sm font-medium text-foreground leading-snug">{todayTopic.title}</p>
            </div>
            <div className="rounded-md bg-background/70 border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Learning Objective</p>
              <p className="text-xs text-foreground/80 leading-snug">{todayTopic.objective}</p>
            </div>
            {todayTopic.resources && todayTopic.resources.length > 0 && (
              <div className="rounded-md bg-background/70 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Learning Resources</p>
                <div className="flex flex-wrap gap-1.5">
                  {todayTopic.resources.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-1 text-[10px] text-primary font-medium transition-colors"
                    >
                      <BookOpen className="h-3 w-3" /> {r.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant={currentWeekCurriculum?.days.find(d => d.day === todayDay)?.isCompleted ? "outline" : "default"}
                className={
                  currentWeekCurriculum?.days.find(d => d.day === todayDay)?.isCompleted
                    ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 h-7 text-xs"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs"
                }
                onClick={() => toggleDay(currentWeek, todayDay, !!currentWeekCurriculum?.days.find(d => d.day === todayDay)?.isCompleted)}
              >
                {currentWeekCurriculum?.days.find(d => d.day === todayDay)?.isCompleted
                  ? <><CheckCircle2 className="h-3 w-3" /> Completed</>
                  : <><Circle className="h-3 w-3" /> Mark as complete</>}
              </Button>
              {currentWeekCurriculum?.days.find(d => d.day === todayDay)?.isCompleted && (
                <span className="text-[10px] text-emerald-600">Great job! You can still practice this topic.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== LEARNING PROGRESS CHART ===== */}
      {hasCourse && curriculum && (
        <CollapsibleCard
          title="Learning Progress"
          description={`Curriculum completion by week — ${curriculum.overallCompletion.completed} of ${curriculum.overallCompletion.total} days done (${curriculum.overallCompletion.percent}%)`}
          icon={TrendingUp}
          badge={`${curriculum.overallCompletion.percent}%`}
          storageKey="student-checkin-learning-progress"
          defaultOpen={false}
        >
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={curriculumChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
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
                  const item = curriculumChartData.find(d => d.week === String(label));
                  return item ? `${label} — ${item.completed}/${item.total} days (${item.percent}%)` : String(label);
                }}
              />
              <Bar dataKey="completed" name="completed" fill={c.chart2} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CollapsibleCard>
      )}

      {/* ===== WEEKLY CURRICULUM OVERVIEW ===== */}
      {toggleError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {toggleError}
        </div>
      )}
      {hasCourse && currentWeekCurriculum && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" /> This Week&apos;s Curriculum
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Week {currentWeek} · {currentWeekCurriculum.phase} — click any day to mark it complete
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {currentWeekCurriculum.days.map(d => (
              <button
                key={d.day}
                onClick={() => toggleDay(currentWeek, d.day, d.isCompleted)}
                className={`w-full text-left rounded-md border p-2.5 transition-all ${
                  d.isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : d.day === todayDay
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {d.isCompleted
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    : <Circle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${d.day === todayDay ? "text-primary" : "text-muted-foreground"}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[9px]">Day {d.day}</Badge>
                      {d.day === todayDay && <Badge variant="secondary" className="text-[9px] bg-primary/15 text-primary">Today</Badge>}
                      {d.isCompleted && <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/30">Done</Badge>}
                    </div>
                    <p className={`text-xs font-medium ${d.isCompleted ? "text-muted-foreground line-through" : "text-foreground"} leading-snug`}>
                      {d.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d.objective}</p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===== TODAY'S PROJECT TASK (course-aligned) =====
          Only renders when the student's course has projects enabled.
          Surfaces today's project task(s) — these are AI-generated and aligned
          with today's course daily topic, so the student can see the bridge
          between what they're learning and what they're building. */}
      {projectEnabled && (
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-background to-background">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" /> Today&apos;s Project Task
                  {projectRequired && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 ml-1">
                      Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Apply today&apos;s course concept to your capstone project
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 h-7 text-xs"
                onClick={() => onMode ? onMode("gantt") : (() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("view", "gantt");
                  window.location.href = url.toString();
                })()}
              >
                Open Project →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {projectTaskError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                {projectTaskError}
              </div>
            )}
            {todayProjectTasks.length === 0 ? (
              <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  No pending project tasks for today — you&apos;re all caught up, or no task is scheduled for today&apos;s day.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {todayProjectTasks.map((task) => (
                  <li key={task.id} className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-start gap-2">
                      <Circle className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground font-medium leading-snug">{task.description}</p>
                        {task.courseTopicLink && (
                          <p className="text-[10px] text-primary mt-1 italic leading-snug">
                            🔗 {task.courseTopicLink}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px] capitalize">{task.status}</Badge>
                          {task.isMilestone && (
                            <Badge variant="outline" className="text-[9px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                              Milestone
                            </Badge>
                          )}
                          <button
                            onClick={() => markProjectTaskDone(task.id)}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline ml-auto"
                          >
                            Mark done →
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== DAILY CHECK-IN FORM (with optional reflection) ===== */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" /> Daily Check-In
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            2-minute habit. Track what you did, blockers, and your confidence. Reflection questions are optional but recommended.
            {projectEnabled && projectRequired && (
              <span className="block mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                Your course requires a capstone project — mention what you worked on for it today (if anything).
              </span>
            )}
            {projectEnabled && !projectRequired && (
              <span className="block mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                Your course offers an optional capstone project — feel free to log project work here too.
              </span>
            )}
            {!hasCourse && (
              <span className="block mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                You don&apos;t have a course assigned yet — log any learning you did today (reading, practice, side projects, etc.).
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">What did you do today?</Label>
              <Textarea value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Describe your work today..." className="bg-muted border-border min-h-24" required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Any errors or blockers?</Label>
              <Textarea value={errors} onChange={(e) => setErrors(e.target.value)} placeholder="What went wrong? What did you learn?" className="bg-muted border-border min-h-16" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Confidence (1-5)</Label>
                <Select value={confidence} onValueChange={setConfidence}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} — {["Very Low", "Low", "Medium", "High", "Very High"][n - 1]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Git Commit (optional)</Label>
                <Input value={git} onChange={(e) => setGit(e.target.value)} placeholder="abc1234" className="bg-muted border-border" />
              </div>
            </div>

            {/* Reflection questions — collapsible */}
            <div className="rounded-md border border-primary/20 bg-primary/5">
              <button
                type="button"
                onClick={() => setShowReflection(!showReflection)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Learning Reflection (recommended)</p>
                    <p className="text-[10px] text-muted-foreground">3 quick questions that sharpen your thinking</p>
                  </div>
                </div>
                <span className="text-[10px] text-primary font-medium">{showReflection ? "Hide" : "Show"}</span>
              </button>
              {showReflection && (
                <div className="px-3 pb-3 space-y-3 animate-fade-in-up">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">What did you LEARN today? (not just what you did)</Label>
                    <Textarea value={learningReflection} onChange={(e) => setLearningReflection(e.target.value)} placeholder="e.g. I learned that REST APIs use HTTP methods to represent actions — GET reads, POST creates, etc." className="bg-background border-border min-h-12 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">What CONFUSED you? What&apos;s still unclear?</Label>
                    <Textarea value={confusionNotes} onChange={(e) => setConfusionNotes(e.target.value)} placeholder="e.g. I'm confused about when to use PUT vs PATCH — they seem similar." className="bg-background border-border min-h-12 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">What&apos;s your NEXT question to explore?</Label>
                    <Textarea value={nextQuestion} onChange={(e) => setNextQuestion(e.target.value)} placeholder="e.g. How do I handle authentication in a REST API?" className="bg-background border-border min-h-12 text-xs" />
                  </div>
                </div>
              )}
            </div>

            {msg && <p className="text-sm text-primary">{msg}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-gradient-to-r from-primary to-secondary-foreground text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {editingLogId ? "Update Check-In" : "Save Check-In"}
              </Button>
              {editingLogId && (
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ===== RECENT CHECK-INS (with reflections) — collapsible ===== */}
      <CollapsibleCard
        title="Recent Check-Ins"
        description={recentLogs.length > 0 ? `${recentLogs.length} check-in${recentLogs.length === 1 ? "" : "s"}` : "No check-ins yet"}
        icon={FileText}
        badge={recentLogs.length > 0 ? `${recentLogs.length}` : undefined}
        storageKey="student-checkin-recent-logs"
        defaultOpen={false}
      >
        {recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Your check-ins will appear here after you save one above.</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="rounded-md bg-muted p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{new Date(log.date).toLocaleDateString()}</span>
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">W{log.week}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">Confidence {log.confidence}/5</Badge>
                    {/* Edit/delete buttons — students can edit their own check-ins.
                        Calls PATCH/DELETE /api/daily-logs/[id] which now allows
                        student self-service (was staff-only before). */}
                    <button
                      onClick={() => handleEditLog(log)}
                      className="text-[9px] text-muted-foreground hover:text-primary px-1"
                      title="Edit this check-in"
                      aria-label="Edit check-in"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-[9px] text-muted-foreground hover:text-destructive px-1"
                      title="Delete this check-in"
                      aria-label="Delete check-in"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-foreground"><strong>What I did:</strong> {log.whatDidYouDo}</p>
                {log.anyErrors && <p className="text-xs text-destructive mt-1"><strong>Errors:</strong> ⚠️ {log.anyErrors}</p>}
                {log.gitCommit && <p className="text-xs text-muted-foreground mt-1"><strong>Git:</strong> {log.gitCommit}</p>}
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
            ))
          )}
      </CollapsibleCard>
    </div>
  );
}
