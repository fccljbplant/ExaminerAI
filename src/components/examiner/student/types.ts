/**
 * Shared types for the Student dashboard.
 *
 * Phase 5.1: Extracted from StudentDashboard.tsx (was 5588 lines, these types
 * were duplicated/inline). Now imported by all student sub-components.
 */

export interface Stats {
  currentWeek: number;
  progress: number;
  streak: number;
  consistencyPercent?: number;
  consistencyDays?: number;
  openBugs: number;
  weakestTopic: string;
  latestScore: number | null;
  interactionsCount: number;
  tasksThisWeek: number;
  completedTasksThisWeek: number;
  projectDurationWeeks?: number;
}

export interface WeeklyTest {
  week: number;
  status: string;
  score: number | null;
  completedAt: string | null;
  retakeAllowed?: boolean;
  plagiarismScore?: number | null;
}

export interface Competency {
  id: string;
  topic: string;
  level: string;
  score: number;
  attempts: number;
}

export interface ReportCardRow {
  week: number;
  grade: string;
  score: number;
  strengths: string;
  weaknesses: string;
  progress: string;
  nextSteps: string;
  date: string;
}

export interface DailyLog {
  id: string;
  date: string;
  week: number;
  whatDidYouDo: string;
  anyErrors: string;
  confidence: number;
  gitCommit: string | null;
  learningReflection?: string;
  confusionNotes?: string;
  nextQuestion?: string;
}

export interface Task {
  id: string;
  description: string;
  status: string;
  week: number;
  day?: number | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  isMilestone?: boolean;
  taskNotes?: string | null;
}


export interface Interaction {
  id: string;
  date: string;
  week: number;
  pillar: string;
  topic: string;
  question: string;
  studentAnswer: string;
  correctness: number;
  feedback: string;
  level: string;
  plagiarismScore?: number | null;
}

export interface CommentRow {
  id: string;
  body: string | null;
  marksOverride: number | null;
  createdAt: string;
  interactionId: string | null;
  taskId: string | null;
  weeklyTestId: string | null;
  dailyLogId: string | null;
  instructor: { name: string; email: string };
}

/** Project + course configuration returned by /api/stats?as=student.
 *  Drives whether the student sees the Project nav item, the project banners,
 *  and what min/max projectDurationWeeks the project setup form should enforce. */
export interface ProjectConfig {
  courseAssigned: boolean;
  courseId: string | null;
  courseName: string | null;
  totalWeeks: number;
  projectEnabled: boolean;
  projectRequired: boolean;
  projectDefaultDurationWeeks: number;
}

export interface StatsResponse {
  role: string;
  stats: Stats;
  weeklyTests?: WeeklyTest[];
  competencies?: Competency[];
  reportCards?: ReportCardRow[];
  dailyLogs?: DailyLog[];
  recentInteractions?: Interaction[];
  tasks?: Task[];
  comments?: CommentRow[];
  /** Optional — only present for student stats responses. */
  projectConfig?: ProjectConfig;
}

export type Mode =
  | "default"
  | "checkin"
  | "report-card"
  | "gantt"
  | "settings"
  | "ai-tutor"
  | "course-outline"
  | "credentials";

/** Journey step shape — used by the (now-removed) JourneyWizard. Kept for
 *  backward-compat with any DB rows that still reference journey steps,
 *  but no UI renders this anymore. Safe to remove in a future cleanup. */
export interface JourneyStep {
  id: string;
  week: number;
  title: string;
  description: string;
  why: string;
  action: { label: string; mode: Mode; topic?: string };
  completedWhen:
    | "manual"
    | "db:tasks"
    | "db:logs"
    | "db:interactions"
    | "db:test"
    | "db:week2"
    | "db:week3"
    | "db:week4"
    | "db:week5"
    | "db:week6";
  aiTutorTopic?: string;
}
