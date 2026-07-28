/**
 * AI Assistant Module — Staff-facing AI helper.
 *
 * SEPARATE from AI Tutor (student-facing).
 *
 * The AI Assistant:
 * - Helps teachers analyze their batch, draft messages, generate report cards
 * - Helps counselors understand wellbeing patterns
 * - Helps principals with institution-wide analytics
 * - Provides the Action Dialog content generation (Section 4)
 * - Implements scope resolution (Section 1), data efficiency (Section 2),
 *   escalation engine (Section 3), safeguarding (Section 5),
 *   teacher load (Section 6), in-action teaching (Section 7)
 * - NEVER accessible by students
 *
 * This module re-exports all AI Assistant components + lib functions.
 */

// Components
export { default as TeacherAITutor } from "@/components/examiner/TeacherAITutor";
export { AIAssistantBox } from "@/components/examiner/teacher/ai/AIAssistantBox";
export { ActionDialog, type ActionDialogData } from "@/components/shared/action-dialog";

// Lib functions
export {
  resolveAssistantScope,
  assertStudentInScope,
  filterToScope,
  type ScopeResult,
} from "@/lib/ai-assistant/scope";

export {
  shouldEscalate,
  countRepeatOccurrences,
  escalateFlag,
  runEscalationEngine,
  checkOnWriteEscalation,
  type FlagTier,
  type EscalatableFlag,
  type EscalationResult,
} from "@/lib/ai-assistant/escalation";

export {
  analyzeMessageForSafeguarding,
  createSafeguardingFlag,
  getSafeguardingFlagsForPrincipal,
  dismissSafeguardingFlag,
  type SafeguardingCategory,
  type SafeguardingSignal,
} from "@/lib/ai-assistant/safeguarding";

// HI-5 fix: teacher-load.ts removed — was dead code with a different formula
// than /api/teacher/load/route.ts. The route is the single source of truth.
// HI-6 fix: teaching-guidance.ts removed — was dead code. The action-dialog
// route generates guidance inline via the AI prompt.
// HI-6 fix: data-efficiency.ts exports removed from barrel — the functions
// are dead code (never imported by any route). The file itself is kept because
// it contains the CR-4 security fix (null-scope guard) which would be needed
// if the functions are wired up in the future.

/** API route paths for the AI Assistant */
export const AI_ASSISTANT_API = {
  query: "/api/teacher/assistant",
  actionDialog: "/api/assistant/action-dialog",
  escalation: "/api/assistant/escalation/run",
} as const;

/** Whether the AI Assistant is enabled for a given role */
export function isAIAssistantEnabled(role: string): boolean {
  const staffRoles = ["instructor", "course_coordinator", "counselor", "principal", "administrator", "demo", "admin"];
  return staffRoles.includes(role);
}
