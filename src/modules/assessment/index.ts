/** Assessment Module — public API (CLIENT-SAFE barrel)
 *
 * This module owns all test/grading/AI logic:
 *   - Weekly test (Socratic 10-15 question exam)
 *   - Daily test (3-question check-in)
 *   - Practice conversation (3-exchange Socratic)
 *   - AI evaluation + tutoring
 *   - Unified grading with teaching feedback
 *
 * Only the CLIENT-SAFE pieces are re-exported here (test panels and
 * feedback cards). Server-only libraries (AI provider, token cache,
 * prompts, graders) are imported via their deep paths by API routes —
 * they must never reach client bundles, so they stay out of this
 * barrel.
 *
 * Example:
 *   import { TeachingFeedbackCard } from "@/modules/assessment";
 */

// Components — test panels + feedback cards
export { WeeklyTestPanel } from "./components/WeeklyTestPanel";
export { DailyTestPanel } from "./components/DailyTestPanel";
export { QuestionPanel as PracticePanel } from "./components/PracticePanel";
export { SocraticPractice } from "./socratic-practice";
export { SocraticWeeklyTest } from "./socratic-weekly";
export { SocraticDaily } from "./socratic-daily";
export { PostTestReflection } from "./components/PostTestReflection";
export { TeachingFeedbackCard } from "./components/TeachingFeedbackCard";
