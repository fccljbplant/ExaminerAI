"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
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

export function ProjectProgressChart({ stats }: { stats: StatsResponse }) {
  const c = useChartColors();
  // Respect the student's configured project duration (default 6).
  const projectDurationWeeks = stats.stats.projectDurationWeeks ?? 6;
  const maxWeek = Math.max(projectDurationWeeks, ...stats.tasks.map(t => t.week), 1);

  const projectChartData = Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => {
    const weekTasks = stats.tasks.filter(t => t.week === w);
    const completed = weekTasks.filter(t => t.status === "completed").length;
    const total = weekTasks.length;
    return {
      week: `W${w}`,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  const totalTasks = stats.tasks.length;
  const completedTasks = stats.tasks.filter(t => t.status === "completed").length;
  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Project Progress
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {completedTasks} of {totalTasks} tasks completed ({overallPercent}%)
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">
            {overallPercent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center h-[120px] text-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground/40 mb-1" />
            <p className="text-[10px] text-muted-foreground">No project tasks yet.</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Add tasks below to see your progress.</p>
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
  );
}
