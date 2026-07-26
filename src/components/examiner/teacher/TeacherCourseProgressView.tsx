"use client";

import { Progress } from "@/components/ui/progress";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import type { PortfolioData, StudentRow } from "@/components/examiner/teacher/types";

const TEACHER_BOOTCAMP_PLAN = [
  { week: 1, phase: "Planning & Dev Environment", accent: "emerald" as const },
  { week: 2, phase: "Website & Database Fundamentals", accent: "cyan" as const },
  { week: 3, phase: "APIs, Automation & AI Agents", accent: "warning" as const },
  { week: 4, phase: "Prompt Engineering & AI", accent: "violet" as const },
  { week: 5, phase: "Testing, Security & Deployment", accent: "rose" as const },
  { week: 6, phase: "Career Prep & Capstone", accent: "sky" as const },
];

const TEACHER_PHASE_ACCENTS: Record<string, { text: string; bg: string; bar: string }> = {
  emerald: { text: "text-emerald-600", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
  cyan:    { text: "text-blue-600",    bg: "bg-blue-500/10",    bar: "bg-blue-500" },
  amber:   { text: "text-amber-600",   bg: "bg-amber-500/10",   bar: "bg-amber-500" },
  violet:  { text: "text-violet-600",  bg: "bg-violet-500/10",  bar: "bg-violet-500" },
  rose:    { text: "text-rose-600",    bg: "bg-rose-500/10",    bar: "bg-rose-500" },
  sky:     { text: "text-cyan-600",    bg: "bg-cyan-500/10",    bar: "bg-cyan-500" },
};

export function TeacherCourseProgressView({ portfolio, student }: { portfolio: PortfolioData; student: StudentRow }) {
  const tasksByWeek = new Map<number, typeof portfolio.tasks>();
  for (const t of portfolio.tasks) {
    if (!tasksByWeek.has(t.week)) tasksByWeek.set(t.week, []);
    tasksByWeek.get(t.week)!.push(t);
  }
  const currentWeek = student.currentWeek;

  return (
    <div className="space-y-4">
      {/* 6-week stepper */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {TEACHER_BOOTCAMP_PLAN.map((plan) => {
          const weekTasks = tasksByWeek.get(plan.week) ?? [];
          const completed = weekTasks.filter(t => t.status === "completed").length;
          const total = weekTasks.length;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          const isCurrent = plan.week === currentWeek;
          const isPast = plan.week < currentWeek;
          const acc = TEACHER_PHASE_ACCENTS[plan.accent];
          return (
            <div
              key={plan.week}
              className={`rounded-lg border p-2.5 ${
                isCurrent ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" :
                isPast ? "border-border bg-muted/30" :
                "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-[10px] font-bold ${isCurrent ? "text-primary" : acc.text}`}>W{plan.week}</span>
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                {isPast && progress === 100 && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
              </div>
              <p className="text-[10px] font-medium text-foreground leading-tight mb-1">{plan.phase}</p>
              <Progress value={progress} className="h-1" />
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {total > 0 ? `${completed}/${total} tasks` : "no tasks"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Compact Gantt — visual progress per week */}
      <div className="rounded-md border border-border p-3 space-y-1.5">
        <p className="text-xs font-medium text-foreground mb-2">Timeline</p>
        {TEACHER_BOOTCAMP_PLAN.map((plan) => {
          const weekTasks = tasksByWeek.get(plan.week) ?? [];
          const completed = weekTasks.filter(t => t.status === "completed").length;
          const inProgress = weekTasks.filter(t => t.status === "in-progress").length;
          const total = Math.max(weekTasks.length, 1);
          const completedWidth = (completed / total) * 100;
          const inProgressWidth = (inProgress / total) * 100;
          const acc = TEACHER_PHASE_ACCENTS[plan.accent];
          const isCurrent = plan.week === currentWeek;
          return (
            <div key={plan.week} className="grid grid-cols-[120px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center">
              <div className="min-w-0">
                <span className={`text-[10px] font-bold ${acc.text}`}>W{plan.week}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-1 truncate">{plan.phase}</span>
              </div>
              <div className="relative h-4 rounded bg-muted overflow-hidden">
                {completedWidth > 0 && <div className={`absolute inset-y-0 left-0 ${acc.bar} opacity-80`} style={{ width: `${completedWidth}%` }} />}
                {inProgressWidth > 0 && <div className="absolute inset-y-0 bg-blue-500/50" style={{ left: `${completedWidth}%`, width: `${inProgressWidth}%` }} />}
                {isCurrent && <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: "50%" }} />}
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-foreground/70">
                  {completed}/{weekTasks.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {portfolio.tasks.length === 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700">
          This student hasn&apos;t added any project tasks yet. Consider messaging them to start with the Course Wizard in the Project Plan tab.
        </div>
      )}
    </div>
  );
}
