/**
 * Course-specific configuration loader.
 *
 * Each course in the DB can have its own:
 * - Journey steps (custom onboarding flow)
 * - Project template (default project definition for new students)
 * - AI prompts (custom system prompts for practice, weekly test, evaluation)
 * - Test config (number of questions, max replies, pillars, min score)
 * - Report card template (grading rubric)
 *
 * ALL functions take a userId, look up the user's batch → course, and return
 * the course-specific config. If no course is assigned (or a field is null),
 * they fall back to built-in defaults from the hardcoded files.
 */

import { db } from "@/lib/db";
import {
  DEFAULT_JOURNEY_STEPS,
  DEFAULT_CAPSTONE_IDEAS,
  DEFAULT_TEST_CONFIG,
  DEFAULT_REPORT_CARD_TEMPLATE,
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_AI_PROMPTS,
} from "./course-defaults";

// ---- Types ----

export interface JourneyStepConfig {
  id: string;
  week: number;
  title: string;
  description: string;
  why: string;
  action: { label: string; mode: string; topic?: string };
  completedWhen: string;
  aiTutorTopic?: string;
}

export interface ProjectTemplateConfig {
  projectName?: string;
  projectScope?: string;
  projectObjectives?: string;
  projectRequirements?: string;
  projectBusinessCase?: string;
  projectDurationWeeks?: number;
  capstoneIdeas?: { name: string; desc: string; ai: string }[];
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
  gradingScale: { grade: string; min: number; max: number }[];
  weights: { weeklyTest: number; practice: number };
  sections: string[];
}

// ---- Defaults are imported from course-defaults.ts (single source of truth) ----
// Re-export for convenience
export { DEFAULT_TEST_CONFIG, DEFAULT_REPORT_CARD_TEMPLATE, DEFAULT_PROJECT_TEMPLATE, DEFAULT_JOURNEY_STEPS, DEFAULT_CAPSTONE_IDEAS, DEFAULT_AI_PROMPTS };

// ---- Loader ----

async function loadCourseConfig<T>(userId: string, field: string, fallback: T): Promise<T> {
  try {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId, role: "student" },
      select: { courseId: true },
    });
    if (!enrollment) return fallback;

    const course = await db.course.findUnique({
      where: { id: enrollment.courseId, isActive: true },
      select: { [field]: true },
    });

    const raw = (course as Record<string, unknown> | null)?.[field];
    if (!raw || typeof raw !== "string") return fallback;

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---- Public API ----

export async function getJourneySteps(userId: string): Promise<JourneyStepConfig[]> {
  return loadCourseConfig<JourneyStepConfig[]>(userId, "journeyStepsJson", DEFAULT_JOURNEY_STEPS as JourneyStepConfig[]);
}

export async function getProjectTemplate(userId: string): Promise<ProjectTemplateConfig> {
  return loadCourseConfig<ProjectTemplateConfig>(userId, "projectTemplateJson", DEFAULT_PROJECT_TEMPLATE);
}

export async function getAIPrompts(userId: string): Promise<AIPromptsConfig> {
  return loadCourseConfig<AIPromptsConfig>(userId, "aiPromptsJson", DEFAULT_AI_PROMPTS);
}

export async function getTestConfig(userId: string): Promise<TestConfig> {
  return loadCourseConfig<TestConfig>(userId, "testConfigJson", DEFAULT_TEST_CONFIG);
}

export async function getReportCardTemplate(userId: string): Promise<ReportCardTemplateConfig> {
  return loadCourseConfig<ReportCardTemplateConfig>(userId, "reportCardTemplateJson", DEFAULT_REPORT_CARD_TEMPLATE);
}

export async function getCourseInfo(userId: string): Promise<{ courseId: string | null; courseName: string | null }> {
  try {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId, role: "student" },
      select: { courseId: true },
    });
    if (!enrollment) return { courseId: null, courseName: null };

    const course = await db.course.findUnique({
      where: { id: enrollment.courseId },
      select: { id: true, name: true },
    });

    return {
      courseId: course?.id ?? null,
      courseName: course?.name ?? null,
    };
  } catch {
    return { courseId: null, courseName: null };
  }
}

// (Defaults are re-exported above — no duplicate declarations needed here)
