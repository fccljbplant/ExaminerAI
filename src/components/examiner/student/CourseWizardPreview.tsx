"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { StatSquareCard, GanttChartIcon, GithubIcon, safeParse } from "@/components/examiner/student/shared";

export function CourseWizardPreview({ stats, onOpenPlan }: { stats: StatsResponse; onOpenPlan: () => void }) {
  const currentWeek = stats.stats.currentWeek;
  const projectDurationWeeks = stats.stats.projectDurationWeeks ?? 6;
  const tasksByWeek = new Map<number, Task[]>();
  for (const t of stats.tasks) {
    if (!tasksByWeek.has(t.week)) tasksByWeek.set(t.week, []);
    tasksByWeek.get(t.week)!.push(t);
  }

  // Fetch the student's custom ProjectWeek rows for the correct week titles
  const [projectWeeks, setProjectWeeks] = useState<{ weekNumber: number; title: string }[]>([]);
  useEffect(() => {
    api.get<{ weeks: { weekNumber: number; title: string }[] }>("/api/project/weeks")
      .then((res) => setProjectWeeks(res.weeks || []))
      .catch(() => {});
  }, []);
  const weekTitleMap = new Map<number, string>();
  for (const pw of projectWeeks) weekTitleMap.set(pw.weekNumber, pw.title);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Your {projectDurationWeeks}-Week Project
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              You are in Week {currentWeek}. Click any week to plan tasks.
            </CardDescription>
          </div>
          <Button onClick={onOpenPlan} size="sm" variant="outline" className="border-border">
            Open Project Plan <GanttChartIcon className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Array.from({ length: projectDurationWeeks }, (_, i) => i + 1).map(weekNum => {
            const weekTasks = tasksByWeek.get(weekNum) ?? [];
            const completed = weekTasks.filter(t => t.status === "completed").length;
            const total = weekTasks.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isCurrent = weekNum === currentWeek;
            const isPast = weekNum < currentWeek;
            const phaseLabel = weekTitleMap.get(weekNum) ?? `Week ${weekNum}`;
            return (
              <button
                key={weekNum}
                onClick={onOpenPlan}
                className={`text-left rounded-lg border p-2.5 transition-all ${
                  isCurrent
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
                    : isPast
                    ? "border-border bg-muted/30 opacity-70"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[10px] font-bold ${isCurrent ? "text-primary" : "text-foreground"}`}>W{weekNum}</span>
                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                  {isPast && progress === 100 && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
                </div>
                <p className={`text-[10px] font-medium leading-tight mb-1 ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                  {phaseLabel}
                </p>
                <Progress value={progress} className="h-1" />
                <p className="text-[9px] text-muted-foreground mt-0.5">{progress}%</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
