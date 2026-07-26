/**
 * Course Module — Public API
 *
 * Owns: course creation, configuration, generation, outlines, curriculum
 * progress, and all course-related business logic.
 *
 * Structure:
 *   src/modules/course/
 *   ├── index.ts              ← public API (this file)
 *   ├── types/
 *   │   └── index.ts          ← shared types (Course, CourseWeek, CourseDay, etc.)
 *   ├── lib/
 *   │   ├── course-db.ts      ← DB loaders (getCourseTopics, getCourseMetadata, etc.)
 *   │   ├── course-config.ts  ← config loaders (getAIPrompts, getTestConfig, etc.)
 *   │   ├── course-defaults.ts← default values (DEFAULT_AI_PROMPTS, etc.)
 *   │   ├── course-topics.ts  ← calendar helpers + WEEKLY_TOPICS
 *   │   └── course-validation.ts ← validation (validateCourseName, validateCourseWeeks)
 *   └── (UI components stay in src/components/examiner/ — see CoursePlanner.tsx, CourseOutline.tsx)
 *   Note: AI course generation lives inline in src/app/api/courses/generate/route.ts.
 *
 * API routes (thin HTTP wrappers, stay under src/app/api/):
 *   - POST/GET/PUT/DELETE /api/courses
 *   - POST /api/courses/generate (AI course generation)
 *   - POST /api/courses/seed-default
 *   - GET /api/courses/user/outline
 *   - GET /api/courses/user/week
 *   - GET/POST /api/course/config
 *   - GET/POST/DELETE /api/curriculum/progress
 *   - GET/PUT/DELETE /api/course-outline
 */

// === Types ===
export type {
  Course,
  CourseWeek,
  CourseDay,
  CourseConfig,
  AIPromptsConfig,
  TestConfig,
  ReportCardTemplateConfig,
  JourneyStepConfig,
  ProjectTemplateConfig,
} from "./types";

// === DB loaders (student-facing) ===
export {
  getCourseTopics,
  getCourseWeekTopics,
  getCourseWeekTopicTitles,
  getCourseWeekPhase,
  getCourseDurationWeeks,
  getCourseMetadata,
  getCourseTodayTopic,
  getCourseWeekTopicContext,
  getBootcampDayNumber,
} from "./lib/course-db";

// === Config loaders (student-facing) — note: getCourseInfo + loadCourseConfig live in course-config.ts ===
export {
  getAIPrompts,
  getTestConfig,
  getJourneySteps,
  getProjectTemplate,
  getReportCardTemplate,
  getCourseInfo,
} from "./lib/course-config";

// === Defaults (admin-facing + fallbacks) ===
export {
  DEFAULT_JOURNEY_STEPS,
  DEFAULT_CAPSTONE_IDEAS,
  DEFAULT_TEST_CONFIG,
  DEFAULT_REPORT_CARD_TEMPLATE,
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_AI_PROMPTS,
} from "./lib/course-defaults";

// === Calendar helpers + WEEKLY_TOPICS (from course-topics.ts) ===
export {
  WEEKLY_TOPICS,
  getBootcampDayNumber as getBootcampDayNumberFromTopics,
  getBootcampDayLabel,
  isRestDay,
  getRestDayLabel,
  getWeekTopics,
  getWeekTopicContext,
  getWeekTopicTitles,
  getWeekPhase,
} from "./lib/course-topics";

// === Validation (admin-facing) ===
export {
  validateCourseName,
  validateCourseWeeks,
  COURSE_LIMITS,
} from "./lib/course-validation";

// === UI Components (re-exported from src/components/examiner/ for convenience) ===
// CoursePlanner and CourseOutline still live in src/components/examiner/ — they
// depend on too many shared UI primitives to move cleanly. Import directly:
//   import { CoursePlanner } from "@/components/examiner/CoursePlanner";
//   import { CourseOutline } from "@/components/examiner/CourseOutline";
