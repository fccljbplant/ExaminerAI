// Teacher dashboard shared types — extracted from TeacherDashboard.tsx

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
  // Phase 3.1: Attention flags from the stats route
  attentionScore?: number;
  attentionReasons?: string[];
  needsAttention?: boolean;
  // H16 fix: wellbeing tier + crisis flag — now returned by /api/stats so the
  // Students tab "Struggling (Psych)" and "Flagged" filters actually work.
  wellbeingTier?: string | null;
  hasFlag?: boolean;
}

export interface PortfolioData {
  student: { id: string; name: string; email: string; currentWeek: number; createdAt: string; lastLogin: string | null };
  hasProject: boolean;
  progress: number;
  // All collection/trend fields are guaranteed present by the API (empty array
  // or zero-summary object when filtered out by dataScope). The client can
  // use them directly without null checks.
  taskSummary: { total: number; completed: number; inProgress: number; planned: number; blocked: number };
  tasks: { id: string; description: string; status: string; week: number; dueDate: string | null }[];
  dailyLogs: { id: string; date: string; week: number; whatDidYouDo: string; anyErrors: string; confidence: number }[];
  interactions: { id: string; date: string; week: number; pillar: string; topic: string; question: string; studentAnswer: string; correctness: number; feedback: string; level: string }[];
  comments: { id: string; body: string | null; marksOverride: number | null; createdAt: string; interactionId: string | null; taskId: string | null; weeklyTestId: string | null; dailyLogId: string | null; teacher: { name: string; email: string } }[];
  weeklyTests: { id: string; week: number; status: string; score: number | null; completedAt: string | null; psychAnalysis?: string | null; examinerComment?: string | null; retakeAllowed?: boolean }[];
  psychObs: { id: string; week: number; date: string; confidence: string; communication: string; learningCurve: string; engagement: string; cognitiveLoad: string; metacognitive: string; remarks: string }[];
  psychTrend: {
    weeks: { week: number; confidence: string; cognitiveLoad: string; metacognitive: string; engagement: string }[];
    latest?: { confidence: string; cognitiveLoad: string; metacognitive: string; engagement: string };
    trajectory: "improving" | "stable" | "declining" | "insufficient-data";
    needsAttention: boolean;
    attentionReasons: string[];
  };
  reportCards: { week: number; grade: string; score: number; strengths: string; weaknesses: string; workHabits: string; progress: string; nextSteps: string; examinerObservations: string; date: string }[];
  dataScope?: string | null;
}

/**
 * TeacherView — type for the teacher dashboard's sub-navigation tabs.
 *
 * (Extracted from TeacherShell.tsx which was deleted as dead code — the
 * AppShell sidebar handles the main nav, and TeacherDashboard renders its
 * own inline sub-nav tabs instead of using TeacherShell.)
 */

export type TeacherView =
  | "today"
  | "students"
  | "batch"
  | "mentorship"
  | "assignments"
  | "messages"
  | "myload"
  | "settings";
