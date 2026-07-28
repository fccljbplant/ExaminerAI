/**
 * Project Module — Shared Types
 *
 * Single source of truth for all project-related types.
 */

export interface ProjectTask {
  id: string;
  userId: string;
  description: string;
  status: "planned" | "in-progress" | "completed" | "blocked";
  week: number;
  isMilestone: boolean;
  day: number | null;
  timeEstimate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWeek {
  id: string;
  userId: string;
  week: number;
  title: string;
  summary: string;
  milestone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReport {
  id: string;
  userId: string;
  week: number;
  reportType: string;
  reportText: string;
  aiAnalysis: {
    score: number;
    projectUnderstanding: number;
    technicalDepth: number;
    progress: number;
    clarity: number;
    strengths: string[];
    weaknesses: string[];
    feedback: string;
  } | null;
  createdAt: string;
}

export interface GroupTask {
  id: string;
  batchId: string;
  courseId: string | null;
  instructorId: string;
  title: string;
  description: string;
  type: string;
  dueDate: string | null;
  week: number | null;
  status: string;
  maxScore: number;
  createdAt: string;
}

export interface GroupTaskSubmission {
  id: string;
  groupTaskId: string;
  userId: string;
  content: string;
  link: string | null;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
}
