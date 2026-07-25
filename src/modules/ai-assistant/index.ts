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
  getCachedSummary,
  setCachedSummary,
  isCacheCurrentWeek,
  getAggregateSummary,
  getNarrowedEntityData,
  checkQueryBudget,
  logAIUsage,
  MAX_ENTITY_RECORDS_PER_CALL,
} from "@/lib/ai-assistant/data-efficiency";

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

export {
  calculateTeacherLoad,
  getInstitutionTeacherLoadRoster,
  suggestCoTeacher,
  type TeacherLoadResult,
} from "@/lib/ai-assistant/teacher-load";

export {
  getGuidanceForFlagType,
  buildGuidancePromptSection,
  type FlagGuidance,
} from "@/lib/ai-assistant/teaching-guidance";

/** API route paths for the AI Assistant */
export const AI_ASSISTANT_API = {
  query: "/api/teacher/assistant",
  actionDialog: "/api/assistant/action-dialog",
  escalation: "/api/assistant/escalation/run",
} as const;

/** Whether the AI Assistant is enabled for a given role */
export function isAIAssistantEnabled(role: string): boolean {
  const staffRoles = ["teacher", "teaching_assistant", "course_coordinator", "counselor", "principal", "administrator", "demo", "admin"];
  return staffRoles.includes(role);
}
