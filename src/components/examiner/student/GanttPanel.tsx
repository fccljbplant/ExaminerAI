"use client";

import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";
import { ProjectDescriptionCard } from "@/components/examiner/student/ProjectDescriptionCard";
import { ProjectProgressChart } from "@/components/examiner/student/ProjectProgressChart";
import { CompactGantt } from "@/components/examiner/student/CompactGantt";
import { ProjectWeekPlan } from "@/components/examiner/student/ProjectWeekPlan";

export function GanttPanel({ stats, onReload, onMode, courseId }: { stats: StatsResponse; onReload?: () => void; onMode?: (m: Mode) => void; courseId?: string }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <ProjectDescriptionCard
        onMode={onMode}
        hasTasks={stats.tasks.length > 0}
        onTasksGenerated={onReload}
      />
      <ProjectProgressChart stats={stats} />
      <CompactGantt stats={stats} />
      <ProjectWeekPlan stats={stats} onReload={onReload} />
    </div>
  );
}
