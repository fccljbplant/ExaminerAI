// instructor dashboard shared types — extracted from TeacherDashboard.tsx

export interface StudentRow {
  id: string;
  email: string;
  name: string;
  currentWeek: number;
  progress: number;
  latestScore: number | null;
  interactions: number;
  lastActive: string | null;
  hasProject: boolean;
  taskCount: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  // Phase 3.1: Attention flags from the stats route (academic only)
  attentionScore?: number;
  attentionReasons?: string[];
  needsAttention?: boolean;
}

export interface PortfolioData {
  student: { id: string; name: string; email: string; currentWeek: number; createdAt: string; lastLogin: string | null; projectDurationWeeks?: number | null };
  hasProject: boolean;
  progress: number;
  // All collection/trend fields are guaranteed present by the API (empty array
  // or zero-summary object when filtered out by dataScope). The client can
  // use them directly without null checks.
  taskSummary: { total: number; completed: number; inProgress: number; planned: number; blocked: number };
  tasks: { id: string; description: string; status: string; week: number; dueDate: string | null }[];
  dailyLogs: { id: string; date: string; week: number; whatDidYouDo: string; anyErrors: string; confidence: number }[];
  interactions: { id: string; date: string; week: number; pillar: string; topic: string; question: string; studentAnswer: string; correctness: number; feedback: string; level: string }[];
  comments: { id: string; body: string | null; marksOverride: number | null; createdAt: string; interactionId: string | null; taskId: string | null; weeklyTestId: string | null; dailyLogId: string | null; instructor: { name: string; email: string } }[];
  weeklyTests: { id: string; week: number; status: string; score: number | null; completedAt: string | null; retakeAllowed?: boolean }[];
  reportCards: { week: number; grade: string; score: number; strengths: string; weaknesses: string; progress: string; nextSteps: string; date: string }[];
  dataScope?: string | null;
}

/**
 * InstructorView — sub-navigation tabs for the instructor dashboard.
 */

export type InstructorView =
  | "today"
  | "students"
  | "assignments"
  | "messages"
  | "myload"
  | "settings";
