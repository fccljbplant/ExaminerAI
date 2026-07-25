# Module Structure

ExaminerAI uses a **modular monolith** architecture. Each domain has its
own module under `src/modules/` with a public API (`index.ts`), `lib/`
(business logic), and `components/` (UI).

The module layer is the canonical import path. Old import paths
(`@/lib/course-*`, `@/components/examiner/student/*`) are kept as
re-exports for backward compatibility — new code should import from
`@/modules/<name>`.

## Current modules

```
src/modules/
├── assessment/     ← Full module (libs + components moved in)
│   ├── index.ts                — public API
│   ├── lib/
│   │   ├── ai-prompts.ts       — all AI prompt templates
│   │   ├── ai-provider.ts      — AI client (Z.ai primary, DeepSeek fallback, z-ai-web-dev-sdk sandbox)
│   │   ├── unified-grader.ts   — shared grading contract for all test types
│   │   ├── analysis-pipeline.ts — psych evidence + 7-dimensions pipeline
│   │   └── plagiarism-scoring.ts
│   └── components/
│       ├── TestChatUI.tsx          — shared professional chat UI
│       ├── WeeklyTestPanel.tsx
│       ├── DailyTestPanel.tsx
│       ├── PracticePanel.tsx
│       ├── PostTestReflection.tsx
│       └── TeachingFeedbackCard.tsx
│
├── course/         ← Full module (libs moved in, components stay in src/components/examiner/)
│   ├── index.ts                — public API (30+ exports)
│   ├── types/index.ts          — Course, CourseWeek, CourseDay, etc.
│   └── lib/
│       ├── course-db.ts        — DB loaders (getCourseTopics, getCourseMetadata, etc.)
│       ├── course-config.ts    — config loaders (getAIPrompts, getTestConfig, etc.)
│       ├── course-defaults.ts  — default values (DEFAULT_AI_PROMPTS, etc.)
│       ├── course-topics.ts    — calendar helpers + WEEKLY_TOPICS
│       ├── course-validation.ts — validation (validateCourseName, validateCourseWeeks)
│       └── course-generation.ts — AI course generation (generateCourse, computeFormHash, etc.)
│
├── project/        ← Full module (libs moved in, components stay in src/components/examiner/)
│   ├── index.ts                — public API
│   ├── types/index.ts          — ProjectTask, ProjectWeek, ProjectReport, GroupTask
│   └── lib/
│       ├── project-setup.ts    — project initialization + config
│       ├── task-generator.ts   — AI-powered task generation
│       ├── project-reports.ts  — project report management
│       └── project-weeks.ts    — weekly plan management
│
├── admin/          ← Skeleton (re-exports from src/lib/seed.ts)
├── auth/           ← Skeleton (re-exports from src/lib/auth.ts + rbac.ts)
├── communication/  ← Skeleton (re-exports)
├── grading/        ← Skeleton (re-exports csv-export)
├── shared/         ← Skeleton (re-exports api-response, chart-theme, feature-flags)
├── student/        ← Skeleton (placeholder)
└── wellbeing/      ← Skeleton (placeholder)
```

## Module boundaries

Each module exposes its public API through `index.ts`. Internal files
under `lib/` and `components/` should be imported via the module root,
not directly. This keeps refactoring contained.

**Example:**

```ts
// Good — stable public API
import { getCourseTopics, generateCourse } from "@/modules/course";

// Acceptable for now — backward-compat re-export
import { getCourseTopics } from "@/lib/course-db";

// Avoid — deep import into internal file
import { getCourseTopics } from "@/modules/course/lib/course-db";
```

## Why some modules are still skeletons

The assessment, course, and project modules were extracted first because
they had the most cross-cutting logic. The remaining modules (admin,
auth, communication, grading, shared, student, wellbeing) are smaller
and their code is currently consumed directly from `src/lib/`. They'll
be promoted to full modules as the codebase grows.

The skeleton `index.ts` files exist so that other modules have a stable
import path (`@/modules/<name>`) they can use today, even when the
implementation hasn't been moved yet.

## API route ownership

API routes under `src/app/api/` are thin HTTP wrappers. They:

1. Authenticate + authorize the caller (via `requireRole` / `assertCanAccessStudent`)
2. Validate input
3. Delegate to module library functions for business logic
4. Format the response

Routes do **not** contain business logic themselves. This keeps them
short and testable — the module library functions can be reused by
other routes, background jobs, or scripts without an HTTP context.

## Re-export compatibility layer

Old import paths still work:

| Old path | New canonical path |
|---|---|
| `@/lib/course-db` | `@/modules/course` |
| `@/lib/course-config` | `@/modules/course` |
| `@/lib/course-defaults` | `@/modules/course` |
| `@/lib/course-topics` | `@/modules/course` |
| `@/lib/course-validation` | `@/modules/course` |
| `@/lib/ai-provider` | `@/modules/assessment` |
| `@/lib/ai-prompts` | `@/modules/assessment` |
| `@/lib/unified-grader` | `@/modules/assessment` |
| `@/lib/analysis-pipeline` | `@/modules/assessment` |
| `@/lib/plagiarism-scoring` | `@/modules/assessment` |
| `@/components/examiner/student/WeeklyTestPanel` | `@/modules/assessment/components/WeeklyTestPanel` |
| `@/components/examiner/student/DailyTestPanel` | `@/modules/assessment/components/DailyTestPanel` |
| `@/components/examiner/student/PracticePanel` | `@/modules/assessment/components/PracticePanel` |
| `@/components/examiner/student/PostTestReflection` | `@/modules/assessment/components/PostTestReflection` |
| `@/components/examiner/student/TeachingFeedbackCard` | `@/modules/assessment/components/TeachingFeedbackCard` |

Migrate imports gradually — the re-exports will not be removed until
all callers point at the new paths.
