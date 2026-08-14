/**
 * AI Assistant Module — Staff-facing AI helper.
 *
 * SEPARATE from AI Tutor (student-facing).
 *
 * The AI Assistant:
 * - Helps teachers analyze their batch, draft messages, generate report cards
 * - Provides the Action Dialog content generation (Section 4)
 * - NEVER accessible by students
 *
 * This module re-exports all AI Assistant components + lib functions.
 */

// Components
export { default as InstructorAITutor } from "@/components/examiner/InstructorAITutor";
export { AIAssistantBox } from "@/components/examiner/instructor/ai/AIAssistantBox";
export { ActionDialog, type ActionDialogData } from "@/modules/ui/action-dialog";

/** API route paths for the AI Assistant */
export const AI_ASSISTANT_API = {
  query: "/api/instructor/assistant",
  actionDialog: "/api/assistant/action-dialog",
  escalation: "/api/assistant/escalation/run",
} as const;

/** Whether the AI Assistant is enabled for a given role */
export function isAIAssistantEnabled(role: string): boolean {
  const staffRoles = ["instructor", "coordinator", "administrator", "demo", "admin"];
  return staffRoles.includes(role);
}
