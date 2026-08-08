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
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";

export function ProjectWeekPlan({ stats, onReload }: { stats: StatsResponse; onReload?: () => void }) {
  const currentWeek = stats.stats.currentWeek;
  const [weeks, setWeeks] = useState<{ id: string; weekNumber: number; title: string; summary: string; milestones: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([currentWeek]));
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [busy, setBusy] = useState(false);

  // Task form state (shared — opened within a specific week)
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskWeek, setTaskWeek] = useState(String(currentWeek));
  const [taskDay, setTaskDay] = useState<string>("");
  const [taskStatus, setTaskStatus] = useState("planned");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskEstimatedMinutes, setTaskEstimatedMinutes] = useState("");
  const [taskIsMilestone, setTaskIsMilestone] = useState(false);
  const [taskNotes, setTaskNotes] = useState("");
  const [taskMsg, setTaskMsg] = useState("");
  const [taskMsgType, setTaskMsgType] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ weeks: { id: string; weekNumber: number; title: string; summary: string; milestones: string }[] }>(
        "/api/project/weeks"
      );
      setWeeks(res.weeks || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group tasks by week
  const tasksByWeek = new Map<number, Task[]>();
  for (const t of (stats.tasks || [])) {
    if (!tasksByWeek.has(t.week)) tasksByWeek.set(t.week, []);
    tasksByWeek.get(t.week)!.push(t);
  }

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

  const saveWeekEdit = async (id: string) => {
    setBusy(true);
    try {
      await api.patch("/api/project/weeks", { id, title: editTitle, summary: editSummary });
      setWeeks(weeks.map(w => w.id === id ? { ...w, title: editTitle, summary: editSummary } : w));
      setEditingWeekId(null);
      onReload?.();
    } catch { /* ignore */ }
    setBusy(false);
  };

  const resetTaskForm = () => {
    setTaskDescription(""); setTaskDay(""); setTaskStatus("planned");
    setTaskDueDate(""); setTaskEstimatedMinutes(""); setTaskIsMilestone(false);
    setTaskNotes(""); setEditingTaskId(null); setShowTaskForm(false);
  };

  const openAddTaskForm = (weekNum: number) => {
    setTaskWeek(String(weekNum));
    setEditingTaskId(null);
    resetTaskForm();
    setTaskWeek(String(weekNum));
    setShowTaskForm(true);
  };

  const openEditTaskForm = (t: Task) => {
    setEditingTaskId(t.id);
    setTaskDescription(t.description);
    setTaskWeek(String(t.week));
    setTaskDay(t.day ? String(t.day) : "");
    setTaskStatus(t.status);
    setTaskDueDate(t.dueDate || "");
    setTaskEstimatedMinutes(t.estimatedMinutes ? String(t.estimatedMinutes) : "");
    setTaskIsMilestone(!!t.isMilestone);
    setTaskNotes(t.taskNotes || "");
    setShowTaskForm(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDescription.trim()) return;
    setBusy(true); setTaskMsg(""); setTaskMsgType("success");
    try {
      const payload = {
        description: taskDescription.trim(),
        week: Number(taskWeek),
        day: taskDay === "" ? null : Number(taskDay),
        status: taskStatus,
        dueDate: taskDueDate || null,
        estimatedMinutes: taskEstimatedMinutes ? Number(taskEstimatedMinutes) : null,
        isMilestone: taskIsMilestone,
        taskNotes: taskNotes.trim() || null,
      };
      if (editingTaskId) {
        await api.patch("/api/tasks", { id: editingTaskId, ...payload });
        setTaskMsg("✓ Task updated");
      } else {
        await api.post("/api/tasks", payload);
        setTaskMsg("✓ Task added");
      }
      resetTaskForm();
      onReload?.();
      setTimeout(() => setTaskMsg(""), 3000);
    } catch (e) {
      setTaskMsgType("error");
      const err = e as { message?: string };
      setTaskMsg(err?.message || "Failed to save task.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (id: string, newStatus: string) => {
    setBusy(true);
    try {
      await api.patch("/api/tasks", { id, status: newStatus });
      onReload?.();
    } catch (e) {
      setTaskMsgType("error");
      const err = e as { message?: string };
      setTaskMsg(err?.message || "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await api.del(`/api/tasks?id=${id}`);
      setTaskMsg("✓ Task deleted");
      onReload?.();
      setTimeout(() => setTaskMsg(""), 2000);
    } catch (e) {
      setTaskMsgType("error");
      const err = e as { message?: string };
      setTaskMsg(err?.message || "Failed to delete task.");
    } finally {
      setBusy(false);
    }
  };

  const statusColors: Record<string, string> = {
    "planned": "bg-muted text-muted-foreground border-border",
    "in-progress": "bg-blue-500/10 text-blue-600 border-blue-500/30",
    "completed": "bg-growth-sage-soft text-growth-sage border-growth-sage",
    "blocked": "bg-growth-amber-soft text-growth-amber border-growth-amber",
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // If no project weeks AND no tasks, show the old task manager as fallback
  if (weeks.length === 0 && (stats.tasks || []).length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> My Tasks
          </CardTitle>
          <CardDescription className="text-muted-foreground">No tasks yet. Generate tasks with AI or add manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">Click "Generate Tasks" above to create AI-tailored tasks, or use the button below.</p>
            <Button onClick={() => openAddTaskForm(currentWeek)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground mt-3">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
            {showTaskForm && renderTaskForm()}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine the full list of weeks to show: project weeks + any weeks that have tasks
  const allWeekNumbers = new Set<number>([
    ...weeks.map(w => w.weekNumber),
    ...(stats.tasks || []).map(t => t.week),
  ]);
  const sortedWeeks = Array.from(allWeekNumbers).sort((a, b) => a - b);

  // Helper to render the task form (reused in multiple places)
  function renderTaskForm() {
    return (
      <form onSubmit={submitTask} className="rounded-md border border-border bg-muted/30 p-3 space-y-2.5 mt-2">
        <div className="space-y-1.5">
          <Label className="text-foreground text-xs">Task description</Label>
          <Textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="e.g. Build homepage with WordPress blocks"
            className="bg-background border-border min-h-12 text-xs"
            required autoFocus
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Week</Label>
            <Select value={taskWeek} onValueChange={setTaskWeek}>
              <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* Clamp to course duration (was hardcoded to 26 weeks —
                    a 6-week course showed 20 unreachable week options). */}
                {Array.from({ length: stats.projectConfig?.totalWeeks || 26 }, (_, i) => i + 1).map(w => <SelectItem key={w} value={String(w)}>W{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Day</Label>
            <Select value={taskDay || "none"} onValueChange={(v) => setTaskDay(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unscheduled</SelectItem>
                <SelectItem value="1">Mon</SelectItem>
                <SelectItem value="2">Tue</SelectItem>
                <SelectItem value="3">Wed</SelectItem>
                <SelectItem value="4">Thu</SelectItem>
                <SelectItem value="5">Fri</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Status</Label>
            <Select value={taskStatus} onValueChange={setTaskStatus}>
              <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Est. min</Label>
            <Input type="number" min={1} max={600} value={taskEstimatedMinutes} onChange={(e) => setTaskEstimatedMinutes(e.target.value)} placeholder="60" className="bg-background border-border h-8 text-xs" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={taskIsMilestone} onChange={(e) => setTaskIsMilestone(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
            <span className="text-[10px] text-muted-foreground">★ Milestone</span>
          </label>
          <div className="flex-1">
            <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="bg-background border-border h-8 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Course topic link (optional)</Label>
          <Input value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} placeholder="e.g. Builds on course topic: REST APIs" className="bg-background border-border h-8 text-xs" />
          <p className="text-[9px] text-muted-foreground mt-0.5">Note how this task connects to a course daily topic. The AI generator fills this in automatically; you can edit it.</p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {editingTaskId ? "Update" : "Add Task"}
          </Button>
          <Button type="button" onClick={resetTaskForm} variant="ghost" className="h-7 text-xs">Cancel</Button>
        </div>
        {taskMsg && <p className={`text-[10px] ${taskMsgType === "error" ? "text-destructive" : "text-primary"}`}>{taskMsg}</p>}
      </form>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" /> Project Week Plan
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              AI-generated week titles + summaries. Click any title to edit. Click a week to expand/collapse its tasks.
            </CardDescription>
          </div>
          {!showTaskForm && (
            <Button onClick={() => openAddTaskForm(currentWeek)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {taskMsg && !showTaskForm && (
          <p className={`text-xs ${taskMsgType === "error" ? "text-destructive" : "text-primary"}`}>{taskMsg}</p>
        )}

        {/* Task form (shown when adding/editing) */}
        {showTaskForm && renderTaskForm()}

        {/* Collapsible weeks with tasks */}
        {sortedWeeks.map(weekNum => {
          const weekInfo = weeks.find(w => w.weekNumber === weekNum);
          const weekTasks = (tasksByWeek.get(weekNum) ?? []).sort((a, b) => {
            const dayA = a.day ?? 99;
            const dayB = b.day ?? 99;
            return dayA - dayB;
          });
          const completedCount = weekTasks.filter(t => t.status === "completed").length;
          const isExpanded = expandedWeeks.has(weekNum);
          const isCurrent = weekNum === currentWeek;
          const isEditing = editingWeekId === weekInfo?.id;
          let milestones: string[] = [];
          try { milestones = JSON.parse(weekInfo?.milestones || "[]"); } catch { /* ignore */ }

          // If no week info AND no tasks, skip
          if (!weekInfo && weekTasks.length === 0) return null;

          return (
            <div
              key={weekNum}
              className={`rounded-lg border transition-all ${
                isCurrent ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
              } ${isExpanded ? "bg-background/50" : "bg-background/30"}`}
            >
              {/* Week header (click to expand/collapse) */}
              <div
                className={`p-2.5 ${isEditing ? "" : "cursor-pointer hover:bg-muted/30"}`}
                onClick={() => !isEditing && toggleWeek(weekNum)}
              >
                {isEditing && weekInfo ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-background border-border text-sm font-medium" autoFocus />
                    <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} className="bg-background border-border text-xs min-h-12" placeholder="Week summary..." />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs" disabled={busy} onClick={() => saveWeekEdit(weekInfo.id)}>
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingWeekId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {/* Expand/collapse chevron */}
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] ${isCurrent ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground"}`}>
                          Week {weekNum}
                        </Badge>
                        {isCurrent && <Badge variant="secondary" className="text-[8px] bg-primary/15 text-primary">You are here</Badge>}
                        <p className="text-xs font-semibold text-foreground flex-1 truncate">
                          {weekInfo?.title ?? `Week ${weekNum}`}
                        </p>
                        {/* Task count badge */}
                        {weekTasks.length > 0 && (
                          <Badge variant="outline" className="text-[8px] text-muted-foreground">
                            {completedCount}/{weekTasks.length} done
                          </Badge>
                        )}
                        {/* Edit button (appears on hover) */}
                        {weekInfo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingWeekId(weekInfo.id); setEditTitle(weekInfo.title); setEditSummary(weekInfo.summary); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            <Edit3 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>
                      {/* Summary (only show when collapsed) */}
                      {!isExpanded && weekInfo?.summary && (
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 truncate">{weekInfo.summary}</p>
                      )}
                      {/* Milestones (only show when collapsed) */}
                      {!isExpanded && milestones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {milestones.slice(0, 3).map((m, i) => (
                            <span key={i} className="text-[8px] text-growth-sage">★ {m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded content: summary + milestones + tasks */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 animate-fade-in-up">
                  {/* Full summary + milestones */}
                  {weekInfo?.summary && (
                    <p className="text-[11px] text-muted-foreground leading-snug pl-6">{weekInfo.summary}</p>
                  )}
                  {milestones.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-6">
                      {milestones.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-[8px] text-growth-sage border-growth-sage bg-growth-sage-soft">
                          <CheckCircle2 className="h-2 w-2 mr-0.5" /> {m}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Tasks for this week */}
                  {weekTasks.length > 0 ? (
                    <div className="space-y-1 pl-6">
                      {weekTasks.map(t => (
                        <div key={t.id} className={`rounded-md border bg-background p-2 ${t.isMilestone ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <Badge variant="outline" className={`text-[9px] ${statusColors[t.status] || statusColors["planned"]}`}>
                                  {t.status}
                                </Badge>
                                {t.day && (
                                  <Badge variant="outline" className="text-[9px] text-cyan-600 border-cyan-500/30 bg-cyan-500/10">
                                    Day {t.day}
                                  </Badge>
                                )}
                                {t.isMilestone && (
                                  <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/10 font-semibold">
                                    ★ Milestone
                                  </Badge>
                                )}
                                {t.dueDate && (
                                  <Badge variant="outline" className="text-[9px] text-growth-amber">
                                    Due {new Date(t.dueDate).toLocaleDateString()}
                                  </Badge>
                                )}
                                {t.estimatedMinutes && (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                    ~{t.estimatedMinutes}m
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-xs text-foreground ${t.status === "completed" ? "line-through opacity-60" : ""}`}>
                                {t.description}
                              </p>
                              {t.taskNotes && (
                                <p className="text-[10px] text-primary mt-0.5 italic leading-snug flex items-center gap-1">
                                  <span aria-hidden>🔗</span> {t.taskNotes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Select value={t.status} onValueChange={(s) => changeStatus(t.id, s)} disabled={busy}>
                                <SelectTrigger className="h-6 w-20 text-[9px] bg-muted border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planned">Planned</SelectItem>
                                  <SelectItem value="in-progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="blocked">Blocked</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="ghost" onClick={() => openEditTaskForm(t)} disabled={busy} className="h-6 w-6 p-0">
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteTask(t.id)} disabled={busy} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic pl-6">No tasks for this week yet.</p>
                  )}

                  {/* Add task button (within this week) */}
                  <div className="pl-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => openAddTaskForm(weekNum)}
                    >
                      <Plus className="h-3 w-3" /> Add task to Week {weekNum}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
