"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export function CompactGantt({ stats }: { stats: StatsResponse }) {
  const currentWeek = stats.stats.currentWeek;
  const projectDurationWeeks = stats.stats.projectDurationWeeks ?? 6;
  const maxWeek = Math.max(projectDurationWeeks, ...(stats.tasks || []).map(t => t.week), 1);

  // Fetch the student's custom ProjectWeek rows for week titles
  const [projectWeeks, setProjectWeeks] = useState<{ weekNumber: number; title: string }[]>([]);
  useEffect(() => {
    api.get<{ weeks: { weekNumber: number; title: string }[] }>("/api/project/weeks")
      .then((res) => setProjectWeeks(res.weeks || []))
      .catch(() => {});
  }, []);
  const weekTitleMap = new Map<number, string>();
  for (const pw of projectWeeks) weekTitleMap.set(pw.weekNumber, pw.title);

  // Calculate task spans: a task starts at its `week` and extends to its
  // `dueDate` week (if set), otherwise just occupies 1 week.
  type TaskSpan = { task: Task; startWeek: number; endWeek: number };
  const taskSpans: TaskSpan[] = (stats.tasks || []).map(t => {
    let endWeek = t.week;
    if (t.dueDate) {
      const due = new Date(t.dueDate);
      const projectStart = (stats.tasks || []).length > 0 ? null : null; // We don't have projectStartDate in stats
      // Calculate week from due date: approximate by comparing to task's week
      // If due date is more than 7 days after the task's week start, extend
      // We'll estimate: each week ≈ 7 days. Due date week = task.week + ceil(daysDiff / 7)
      // But we don't have the project start date here, so we use a simpler heuristic:
      // If dueDate exists and is > 7 days from now (or in the future beyond the task's week),
      // calculate how many weeks it spans.
      // For now, we use: endWeek = max(t.week, week number from dueDate relative to project)
      // Since we don't have projectStartDate, we'll use a simpler approach:
      // Parse dueDate and if it's further in the future than the task's week would suggest,
      // extend the bar.
      // Better approach: use the task week + estimated days from dueDate
      const now = new Date();
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue > 7) {
        // Extend by 1 week per 7 days
        endWeek = t.week + Math.ceil(daysUntilDue / 7) - 1;
      }
    }
    return { task: t, startWeek: t.week, endWeek: Math.max(endWeek, t.week) };
  });

  // Group task spans by start week for row display
  const spansByStartWeek = new Map<number, TaskSpan[]>();
  for (const ts of taskSpans) {
    if (!spansByStartWeek.has(ts.startWeek)) spansByStartWeek.set(ts.startWeek, []);
    spansByStartWeek.get(ts.startWeek)!.push(ts);
  }

  // All week numbers that have task spans (start or extend into)
  const allRelevantWeeks = new Set<number>();
  for (const ts of taskSpans) {
    for (let w = ts.startWeek; w <= ts.endWeek; w++) allRelevantWeeks.add(w);
  }

  const statusColors: Record<string, string> = {
    "planned": "bg-muted-foreground/40",
    "in-progress": "bg-blue-500/70",
    "completed": "bg-growth-sage/80",
    "blocked": "bg-growth-amber/70",
  };

  // Column width: each week gets equal share of the bar area
  const weekColumnWidth = 100 / maxWeek;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Project Timeline
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-growth-sage" /> Done</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> Active</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /> Planned</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-growth-amber" /> Blocked</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Today</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Phase 6.2: Mobile-responsive Gantt. On small screens the timeline
            area is too narrow for a 6+ week bar chart. Wrap the whole thing
            in an overflow-x-auto container with a min-width so it scrolls
            horizontally on phones instead of squishing into an unreadable
            mess. Label column shrinks from 140px to 90px on mobile. */}
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="min-w-[480px] space-y-0">
            {/* Week header row */}
            <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center pb-1.5 border-b border-border mb-1.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Week</div>
              <div className="relative h-4">
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map(weekNum => (
                  <div
                    key={weekNum}
                    className={`absolute top-0 text-[9px] font-medium ${weekNum === currentWeek ? "text-destructive" : "text-muted-foreground"}`}
                    style={{ left: `${(weekNum - 1) * weekColumnWidth}%`, width: `${weekColumnWidth}%` }}
                  >
                    W{weekNum}
                  </div>
                ))}
              </div>
            </div>

            {/* Task bars — each task is a row with a bar spanning from startWeek to endWeek */}
            {taskSpans.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No tasks to display in the timeline.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Add tasks with due dates to see them as bars spanning weeks.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {taskSpans
                  .sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek)
                  .map(({ task, startWeek, endWeek }) => {
                    const barLeft = (startWeek - 1) * weekColumnWidth;
                    const barWidth = Math.max((endWeek - startWeek + 1) * weekColumnWidth, weekColumnWidth * 0.8);
                    const color = statusColors[task.status] || statusColors["planned"];
                    const spansMultipleWeeks = endWeek > startWeek;
                    const title = weekTitleMap.get(task.week) ?? `Week ${task.week}`;

                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-[90px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center rounded hover:bg-muted/20 p-0.5"
                      >
                    {/* Label column */}
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1">
                        {task.status === "completed"
                          ? <CheckCircle2 className="h-3 w-3 text-growth-sage flex-shrink-0" />
                          : task.status === "in-progress"
                          ? <Loader2 className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          : <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        <span className="text-[10px] text-foreground truncate" title={task.description}>
                          {task.description}
                        </span>
                      </div>
                      {task.isMilestone && (
                        <span className="text-[8px] text-primary font-semibold">★ Milestone</span>
                      )}
                    </div>
                    {/* Bar area */}
                    <div className="relative h-5 bg-muted/30 rounded">
                      {/* Current week marker */}
                      {currentWeek >= 1 && currentWeek <= maxWeek && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-red-500/60 z-10"
                          style={{ left: `${(currentWeek - 1) * weekColumnWidth + weekColumnWidth / 2}%` }}
                        />
                      )}
                      {/* The task bar */}
                      <div
                        className={`absolute inset-y-0.5 rounded ${color} flex items-center px-1 group cursor-pointer transition-opacity hover:opacity-80`}
                        style={{
                          left: `${barLeft}%`,
                          width: `${barWidth}%`,
                        }}
                        title={`${task.description} — Week ${startWeek}${spansMultipleWeeks ? ` → Week ${endWeek}` : ""} (${task.status})${task.dueDate ? `\nDue: ${new Date(task.dueDate).toLocaleDateString()}` : ""}`}
                      >
                        {spansMultipleWeeks && (
                          <span className="text-[8px] text-white font-medium truncate">
                            W{startWeek}→W{endWeek}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Summary row at the bottom */}
        <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center pt-2 border-t border-border mt-2">
          <div className="text-[10px] font-bold text-muted-foreground">
            {taskSpans.length} task{taskSpans.length !== 1 ? "s" : ""}
          </div>
          <div className="relative h-3">
            {Array.from({ length: maxWeek }, (_, i) => i + 1).map(weekNum => {
              const weekSpans = taskSpans.filter(ts => weekNum >= ts.startWeek && weekNum <= ts.endWeek);
              const completed = weekSpans.filter(ts => ts.task.status === "completed").length;
              return (
                <div
                  key={weekNum}
                  className={`absolute top-0 text-[8px] ${weekNum === currentWeek ? "text-destructive font-bold" : "text-muted-foreground"}`}
                  style={{ left: `${(weekNum - 1) * weekColumnWidth}%`, width: `${weekColumnWidth}%` }}
                  title={`Week ${weekNum}: ${weekSpans.length} active task${weekSpans.length !== 1 ? "s" : ""}, ${completed} done`}
                >
                  {weekSpans.length > 0 ? `${completed}/${weekSpans.length}` : ""}
                </div>
              );
            })}
          </div>
        </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
