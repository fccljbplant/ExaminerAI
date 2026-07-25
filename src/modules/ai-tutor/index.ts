/**
 * AI Tutor Module — Student-facing AI chatbot.
 *
 * SEPARATE from AI Assistant (teacher-facing).
 *
 * The AI Tutor:
 * - Teaches today's topic in a conversational Socratic style
 * - Connects concepts to the student's capstone project
 * - Handles disengaged students with empathy
 * - Adapts to the student's language (Roman English support)
 * - Logs behavioral signals to ChatSession (visible to teachers/admins)
 *
 * The AI Assistant:
 * - Helps teachers with batch analysis, drafting messages, case review
 * - Helps counselors with wellbeing insights
 * - Helps principals with institution-wide analytics
 * - NEVER accessible by students
 *
 * This module re-exports the existing AITutor component + the /api/ai/tutor route
 * as a clean module boundary.
 */

export { default as AITutor } from "@/components/examiner/AITutor";

/** API route path for the student AI Tutor */
export const AI_TUTOR_API = "/api/ai/tutor";

/** Whether the AI Tutor is enabled for a given role */
export function isAITutorEnabled(role: string): boolean {
  // AI Tutor is student-facing (and guardian read-only)
  return role === "student" || role === "guardian";
}
