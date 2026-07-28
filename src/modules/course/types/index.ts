/**
 * Course Module — Shared Types
 *
 * Single source of truth for all course-related types. Previously
 * these were duplicated across CoursePlanner.tsx, CourseOutline.tsx,
 * AdminCoursesPanel.tsx, and course-topics.ts.
 */

export interface Course {
  id: string;
  name: string;
  description: string;
  domain: string;
  level: string;
  assessmentType: string;
  subjects: string[];
  toolsUsed: string[];
  deliverableTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDay {
  id: string;
  courseWeekId: string;
  day: number;
  title: string;
  objective: string;
  whyItMatters: string;
  topicsCovered: string[];
  activity: string;
  deliverable: string;
  resources: { label: string; url: string }[];
  instructorNote: string;
}

export interface CourseWeek {
  id: string;
  courseId: string;
  weekNumber: number;
  phase: string;
  days: CourseDay[];
}

export interface CourseConfig {
  id: string;
  name: string;
  domain: string;
  level: string;
  journeyStepsJson: string;
  projectTemplateJson: string;
  aiPromptsJson: string;
  testConfigJson: string;
  reportCardTemplateJson: string;
}

export interface AIPromptsConfig {
  practiceSystemPrompt?: string;
  weeklyTestSystemPrompt?: string;
  evaluationPrompt?: string;
  finalAnalysisPrompt?: string;
}

export interface TestConfig {
  totalQuestions: number;
  maxRepliesPerQuestion: number;
  pillars: string[];
  minScoreFloor: number;
  advanceOnComplete: boolean;
}

export interface ReportCardTemplateConfig {
  sections: string[];
  gradingScale: string;
}

export interface JourneyStepConfig {
  id: string;
  week: number;
  title: string;
  description: string;
  why: string;
  action: { label: string; mode: string };
  completedWhen: string;
}

export interface ProjectTemplateConfig {
  suggestedDuration: number;
  milestones: string[];
  techStack: string[];
}

// Legacy types (kept for backward compat with course-topics.ts)
export interface DailyTopic {
  title: string;
  objective: string;
  resources: { label: string; url: string }[];
  day?: number;
  whyItMatters?: string;
  topicsCovered?: string[];
  activity?: string;
  deliverable?: string;
}

export interface WeekTopic {
  week: number;
  phase: string;
  topics: DailyTopic[];
}
