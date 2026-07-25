/** Assessment Module — public API
 *
 * This module owns all test/grading/AI logic:
 *   - Weekly test (Socratic 10-15 question exam)
 *   - Daily test (3-question check-in)
 *   - Practice conversation (3-exchange Socratic)
 *   - AI evaluation + tutoring
 *   - Unified grading with teaching feedback
 *   - Plagiarism scoring
 *   - Analysis pipeline (psych evidence, engagement, etc.)
 *
 * Other modules should import from here, not from the internal lib/
 * or components/ directories. The API routes in src/app/api/ai/ are
 * thin HTTP wrappers that call into this module's library functions.
 *
 * Example:
 *   import { gradeTest, TeachingFeedbackCard } from "@/modules/assessment";
 */

// Library — grading, AI, analysis
export { gradeTest, fallbackGrade, parseQuestionExplanations } from "./lib/unified-grader";
export type { GradeResult, GradeTestInput, TeachingFeedback, QuestionExplanation, TestKind } from "./lib/unified-grader";

export { callAI, TOKEN_BUDGET } from "./lib/ai-provider";
export type { AIResult } from "./lib/ai-provider";

// Token cache — opt-in response cache for cacheable AI calls (tutor, question gen, etc.)
export { getCachedResponse, setCachedResponse, clearTokenCache, getCacheStats, resetCacheStats } from "./lib/token-cache";

export { weeklyTestSystemPrompt, finalAnalysisPrompt, GLOBAL_AI_RULES, connectionTestPrompt, questionGenPrompt } from "./lib/ai-prompts";

export { runAnalysisPipeline } from "./lib/analysis-pipeline";

export { applyPlagiarismDeduction } from "./lib/plagiarism-scoring";

// Components — test panels + feedback cards
export { WeeklyTestPanel } from "./components/WeeklyTestPanel";
export { DailyTestPanel } from "./components/DailyTestPanel";
export { QuestionPanel as PracticePanel } from "./components/PracticePanel";
export { PostTestReflection } from "./components/PostTestReflection";
export { TeachingFeedbackCard } from "./components/TeachingFeedbackCard";
