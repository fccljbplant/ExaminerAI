# ExaminerAI — Full Application Inventory (Audit 2026-07-26, Section 1)

> **Date:** 2026-07-26
> **Section:** 1 of 7 — Inventory
> **Lenses:** Software engineer, PM
> **Status:** Complete — this is the raw map; all subsequent sections depend on it.

---

## Summary

- **API routes:** 122 route files under `src/app/api/`, spanning 13 logical groups
- **AI call sites:** 32 `callAI()` call sites (24 in route handlers, 6 in shared modules, 2 in wrappers)
- **UI components:** 96 app-level components (excluding 51 shadcn/ui primitives), grouped by 8 roles
- **Prisma models:** 47 models, schema.prisma and schema.prod.prisma are IN SYNC (0 field-level differences)
- **Orphan routes:** 11 confirmed (9% orphan rate) — routes with zero UI callers
- **Dead AI code:** 3 callAI sites in dead modules (task-generator.ts ×2, course-generation.ts ×1)

---

## 1. API Route Inventory

**122 route files** under `src/app/api/`. Full table in `docs/API-AND-AI-INVENTORY-2026-07-26.md`.

Key groups:
- Root (1): health check
- `access-grants/` (1): cross-role data scoping
- `admin/` (4): cache, psych-data cleanup, admin cleanup, teacher behavior
- `ai/` (12): tutor, practice, evaluate, weekly-test, daily-test, teacher-tutor, stats, limits, test, debug, key, weekly-test
- `assistant/` (2): action-dialog, escalation/run
- `auth/` (6): login, logout, me, forgot-password, reset-password, change-password, set-security-question
- `batches/` (5): CRUD + teachers + duplicate + question-outliers
- `certificates/` (3): generate, user, verify
- `comments/` (1): teacher comments on student work
- `course-outline/` (1): upload outline
- `courses/` (5): list, create, get/update/delete, seed-default, generate, user/outline, user/week, config
- `crisis-flags/` (1): crisis flag management
- `curriculum/` (1): progress tracking
- `daily-logs/` (2): create + [id] edit/delete
- `daily-motivation/` (1): AI daily motivation
- `daily-test/` (1): daily test chatbot
- `events/` (1): batch events
- `group-tasks/` (2): CRUD + submit
- `growth-reports/` (1): student growth report
- `guardian/` (2): overview + create
- `health/` (1): health check
- `institutions/` (2): CRUD
- `interactions/` (2): list + [id] edit/delete
- `journey/` (1): journey progress
- `mentorship/` (3): touchpoints, touchpoints/parse, case-review
- `messages/` (4): list, [id] read/delete, mark-all-read, teacher, outreach
- `peer-assessment/` (1): peer assessment
- `password-reset-requests/` (2): list + [id]/approve
- `project/` (6): setup, generate-tasks, weeks, plan, reports, suggestions, auto-report
- `psych-evidence/` (1): psych evidence
- `report-cards/` (1): report cards
- `role-nav-config/` (1): nav configuration
- `self-paced/` (1): self-paced advancement
- `settings/` (3): features, ai-key, ai-limits
- `skill-mastery/` (1): skill mastery
- `stats/` (1): aggregated dashboard stats
- `students/` (12): alerts, check-alerts, final-result, [id]/portfolio, [id]/explain, [id]/narrative, [id]/draft-checkin, [id]/rehearse, [id]/comprehensive-report, [id]/generate-report-card, [id]/generate-project-analysis, [id]/allow-retake, [id]/unlock-test, [id]/edit-weekly-test
- `tasks/` (1): project task management
- `teacher/` (3): assistant, load, rules, topic-guidance
- `users/` (7): list/create, [id] get/update/delete, [id]/approve, [id]/block, [id]/role, [id]/batch, [id]/audit, batch-approve
- `wellbeing-state/` (1): wellbeing state
- `confidence-ratings/` (1): confidence ratings
- `seed/` (1): seed demo data

---

## 2. AI Calling Paths

**32 callAI() call sites** across the codebase. Full table in `docs/API-AND-AI-INVENTORY-2026-07-26.md`.

### Rate Limiting Status
- **All user-facing AI routes are rate-limited** via `enforceAIRateLimit` or the legacy `checkUserAILimit` + `isDemoAIBlocked` pair
- **29 of 32** pass `userId:` for per-user attribution
- **3 don't**: `ai/teacher-tutor` (minor gap), `ai/test` + `ai/debug` (admin-only diagnostics, intentional)

### Dead AI Code
- 3 callAI sites in dead modules: `task-generator.ts` (×2) + `course-generation.ts` (×1) — exported but never imported by any route

### Minor Gap
- `project/generate-tasks/route.ts` invokes `generateCourseAlignedPlan()` (which calls callAI) but doesn't call `enforceAIRateLimit` at the route level — the rate limiting happens inside the shared lib, not at the route boundary

---

## 3. UI Components by Role

**96 app-level components** (excluding 51 shadcn/ui primitives). Full table in `docs/UI-AND-PRISMA-INVENTORY-2026-07-26.md`.

### By Role
- **Student:** 24 components (StudentDashboard, GanttPanel, ProjectSettingsCard, ProjectDescriptionCard, CheckInPanel, DailyTestPanel, WeeklyTestPanel, PracticePanel, ReportCardPanel, GrowthReportPanel, ComprehensiveReportView, FinalResultPanel, ProjectReportPanel, ProjectWeekPlan, ProjectProgressChart, CompactGantt, SelfPacedAdvanceButton, SecurityQuestionPanel, ThemePreferenceControl, TeacherComments, PostTestReflection, TeachingFeedbackCard, ProjectSuggestions, CourseOutlineRedirect)
- **Teacher:** 20 components (TeacherDashboard, TodayView, StudentsRoster, AssignmentsTab, MentorshipView, MentorshipTabV2, InsightsView, CaseReviewPanel, VoiceTouchpointLogger, PeerAssessmentTeacherView, StudentPortfolioPage, TeacherCourseProgressView, TeacherRulesPanel, SpatialBatchMap, CalibrationScatterCard, StatCard, TeacherLoadPanel, CertificateApprovals, GuardianCreationPanel, AssignmentsTab AI sub-components)
- **Counselor:** 1 component (CounselorDashboard — purpose-built, 668 lines)
- **Course Coordinator:** shares Course Planner with teachers
- **Principal:** 1 component (PrincipalDashboard)
- **Administrator:** 9 components (AdminDashboard + 9 sub-panels: Overview, Users, Courses, Features, System, Passwords, Coordinator, PM, AuditLog, AccessGrants, AILimits, LayoutDashboard, QuickAction, OverviewStat)
- **Guardian:** 2 components (GuardianDashboard, GuardianReportCards)
- **Shared:** 5 components (AppShell, Login, ForgotPassword, SettingsPanel, Messages, ErrorBoundary, AskMyTeacher, DailyTaskReminder, CourseOutline, CoursePlanner, AITutor, TeacherAITutor, MarkdownRenderer, ThemeToggle)

### Loading/Error/Empty State Coverage
- Most top-level dashboards have all 3 states (loading, error, empty)
- ~14 smaller panels are missing one or more states
- `src/components/ui/empty-state.tsx` exists but is underused — most components roll their own inline empty UI

---

## 4. Prisma Models (47 models)

Full inventory in `docs/UI-AND-PRISMA-INVENTORY-2026-07-26.md`. Key models:

- **User** — central user record (students, teachers, admins, etc.)
- **Course / CourseWeek / CourseDay** — course outline structure
- **Batch / BatchTeacher** — student groups + multi-teacher junction
- **Institution** — multi-tenant institution
- **DailyLog / Interaction / WeeklyTest / DailyTest** — student activity records
- **ProjectTask / ProjectWeek / ProjectReport** — capstone project
- **PsychEvidence / WellbeingState / CrisisFlag / StudentAlert** — psychological pipeline
- **SkillMastery / Competency / ConfidenceRating** — learning assessment
- **MentorshipTouchpoint / ReportCard / GrowthReport / Certificate** — mentorship + completion
- **Message / Comment / AuditLog / AccessGrant** — communication + audit
- **GroupTask / GroupTaskSubmission / Event / PeerAssessment** — group activities
- **ChatSession / StudentHealthSummary / RoleNavConfig / Setting** — system infrastructure
- **GuardianLink / PasswordResetRequest / CurriculumProgress** — auxiliary

### Schema Sync
✅ **schema.prisma and schema.prod.prisma are IN SYNC** — 0 field-level differences. The only differences are cosmetic (datasource provider sqlite vs postgresql by design, comment richness, field ordering).

---

## 5. Orphan Routes (11 confirmed)

Routes with zero UI callers anywhere outside `src/app/api/`:

| # | Route | Reason |
|---|-------|--------|
| 1 | `ai/debug` | Admin diagnostic, no UI link — intentional |
| 2 | `ai/limits` | User usage widget was never built |
| 3 | `batches/[id]/teachers` (GET/POST) | No batch-teacher management UI |
| 4 | `batches/[id]/teachers/[teacherId]` (DELETE) | Same — no UI |
| 5 | `batches/question-outliers` | InsightsView never wired to it |
| 6 | `certificates/verify` | Replaced by `/verify/[token]` server-component page |
| 7 | `courses/upload-outline` | No upload UI |
| 8 | `messages/outreach` | Last-contacted column never built |
| 9 | `project/auto-report` | ProjectReportPanel only does manual create |
| 10 | `students/[id]/generate-project-analysis` | Referenced in code comment but never called |
| 11 | `teacher/topic-guidance` | No "Add Guidance" button in teacher UI |

---

## 6. AppShell Navigation Map

**25 nav items** in `ALL_NAV` + 3 legacy ViewKey values. Full table in `docs/UI-AND-PRISMA-INVENTORY-2026-07-26.md`.

Key nav structure:
- Student: Home, Study, Project, Progress + AI Tutor, Course, Messages, Settings
- Teacher: Today, Students, Mentorship, Assignments, Insights + Course Planner, AI Assistant, Course, Messages, Settings
- Counselor: Command Center + Messages, Settings
- Course Coordinator: Course Planner, Students + AI Assistant, Course, Messages, Settings
- Guardian: Overview, Report Cards + AI Tutor, Course, Messages, Settings
- Principal: Institution + Dashboard, Users, Courses, Features, Passwords, System + Messages, Settings
- Administrator: Dashboard, Users, Courses, Features, Passwords, System + Messages
- Demo: Same as administrator + AI Assistant + role switcher (7 options)

---

## 7. Notable Findings

1. **5 legacy re-export shims** in `student/` directory (DailyTestPanel, PracticePanel, PostTestReflection, TeachingFeedbackCard, WeeklyTestPanel) — safe to delete
2. **`teaching_assistant` role is dead code** — defined in UserRole/STAFF_ROLES but excluded from STAFF_NAV_ROLES
3. **Demo role visibility quirk** — in ADMIN_ROLES but deliberately excluded from ADMIN_NAV_ROLES; uses role switcher instead
4. **`src/components/ui/empty-state.tsx` is underused** — most components roll their own inline empty UI
5. **3 dead AI code paths** in task-generator.ts and course-generation.ts — exported but never imported
6. **11 orphan routes** (9% orphan rate) — see Section 5 above

---

## Cross-Reference Files

- `docs/API-AND-AI-INVENTORY-2026-07-26.md` — full 519-line API route + AI call site table
- `docs/UI-AND-PRISMA-INVENTORY-2026-07-26.md` — full 443-line UI component + Prisma model table

---

# Section 6 — Code Quality Audit (2026-07-26)

> **Date:** 2026-07-26
> **Section:** 6 of 7 — Code Quality & Maintainability
> **Lens:** Software engineer
> **Status:** Complete. Findings only — no code changes made (audit-only mandate).

---

## 6.1 File Sizes — Files Over ~800 Lines

4 files exceed 800 lines (whole codebase: 368 source files, 62,515 LOC):

| # | File | Lines | Concern | Recommended Split |
|---|------|-------|---------|-------------------|
| 1 | `src/components/landing/modern-landing.tsx` | **1,614** | Landing page — purely presentational marketing page | Split into sections: Hero, Features, Pricing, FAQ, CTA — each as a separate sub-component. Low priority (no business logic). |
| 2 | `src/components/examiner/teacher/StudentPortfolioPage.tsx` | **1,341** | Teacher's student-portfolio view — mixes data fetching, AI calls, charts, tabs | Extract data hooks → `useStudentPortfolio()`, separate tab components (EducationalTab, PsychologicalTab, BehavioralTab, MentorTab) |
| 3 | `src/app/api/ai/weekly-test/route.ts` | **1,166** | Route handler — contains Socratic question generation, grading, psych analysis, persistence | Move business logic to `src/modules/assessment/lib/weekly-test-runner.ts`. Route should be a thin HTTP wrapper (~100 lines). |
| 4 | `src/components/examiner/CoursePlanner.tsx` | **1,065** | Course outline editor + NotebookLM URL config + project toggle + AI generation trigger | Split into `<CourseBasicInfoForm>`, `<CourseOutlineEditor>`, `<CourseProjectConfig>`, `<CourseAIGenerate>` |

Files in the 600-800 range that should also be watched (next-tier split candidates):
- `src/components/examiner/AppShell.tsx` (734) — nav + role guard
- `src/components/ui/sidebar.tsx` (726) — shadcn primitive, third-party — leave as-is
- `src/components/examiner/CounselorDashboard.tsx` (704)
- `src/components/examiner/AdminDashboard.tsx` (661)
- `src/modules/assessment/components/WeeklyTestPanel.tsx` (654)
- `src/components/examiner/admin/SystemPanel.tsx` (642)
- `src/app/api/daily-test/route.ts` (622) — same route-bloat pattern as weekly-test
- `src/components/examiner/student/CheckInPanel.tsx` (610)

---

## 6.2 Test Coverage

### 6.2.1 Current State

- **Test runner:** vitest (`vitest.config.ts`)
- **Test files:** 9 (all under `src/lib/__tests__/` + `src/lib/ai-assistant/`)
- **Test cases:** 147 total → 142 pass, 5 skipped
- **Coverage scope:** `src/lib/*.ts` only (configured in `vitest.config.ts:8`) — does NOT include `src/app/api/`, `src/components/`, or `src/modules/`
- **Coverage ratio:** 0.4 tests per source file; 1 test per 425 LOC

| Test file | Tests | What it covers |
|-----------|------:|----------------|
| `lib/__tests__/grading-and-topics.test.ts` | 41 | `scoreToGrade`, `gradeColor`, `getBootcampDayNumber`, `WEEKLY_TOPICS`, rest-day helpers |
| `lib/__tests__/course-validation.test.ts` | 26 | `validateCourseName`, `validateCourseWeeks`, `COURSE_LIMITS` |
| `lib/__tests__/course-normalization.test.ts` | 20 | AI course JSON normalization — **re-implements the function in the test file itself** (production function in `/api/courses/route.ts:25` is NOT exported, so test copies it). Drift risk. |
| `lib/__tests__/ai-provider.test.ts` | 15 | `translateBehavioralSignals`, `getConfidenceMismatchLabel`, `TOKEN_BUDGET` — pure functions only |
| `lib/__tests__/behavioral-signals.test.ts` | 15 | Behavioral signal categorization |
| `lib/__tests__/logger.test.ts` | 9 | Logger redaction + levels |
| `lib/__tests__/auth.test.ts` | 8 | `signToken`/`verifyToken` round-trip, `hashPassword`/`comparePassword` — pure crypto only |
| `lib/ai-assistant/escalation.test.ts` | 8 | `shouldEscalate()` pure function — does NOT cover `runEscalationEngine()` pipeline |
| `lib/ai-assistant/scope.test.ts` | 5 (FAILING) | Integration tests requiring a seeded DB — `beforeAll` throws `Cannot read properties of null` when no teacher/principal/counselor/coordinator users exist. All 5 tests register as "skipped" in CI. |

### 6.2.2 Critical Paths With Tests

| Path | Coverage status | Gap |
|------|-----------------|-----|
| **Auth — JWT + passwords** | 8 tests on pure functions | Cookie/session handling (`getAuthUser`, `getCurrentUser`) NOT tested — the comment in `auth.test.ts:9` says these are "integration-tested via the API routes in the e2e suite", but no e2e suite exists. |
| **Scoring — grade conversion** | 41 tests on `scoreToGrade` + topic calendar | The actual `gradeTest()` function (unified-grader.ts) is NOT directly tested. |
| **AI Assistant scope resolver** | 5 tests registered, ALL FAILING | Tests require a seeded DB (teacher + principal + counselor + coordinator rows). In a clean test environment, the suite crashes in `beforeAll`. Effectively 0% reliable coverage. |
| **AI Assistant escalation** | 8 tests on `shouldEscalate()` only | `runEscalationEngine()`, `countRepeatOccurrences()`, `checkOnWriteEscalation()` are NOT tested. |

### 6.2.3 Critical Paths With ZERO Test Coverage

- **All 122 API routes** — no route tests at all. No `supertest`/`fetch` mocks. The most security-critical routes (login, password reset, role changes, AI rate-limit enforcement) have no automated tests.
- **All 96 UI components** — no component tests. No React Testing Library, no Playwright component tests.
- **`generateCourseAlignedPlan`** (`src/modules/project/lib/course-aligned-planner.ts`, 401 lines) — the LIVE project task generator that replaces the dead `generateTasks` — NO TESTS. This is the AI call that creates every student's daily project tasks.
- **Self-paced advancement** (`src/modules/self-paced/index.ts`, 202 lines) — pure logic for `canAdvanceDay`, `advanceDay`, anti-cheat flagging — NO TESTS. Anti-cheat logic is high-stakes and untested.
- **Comprehensive report generation** (`src/modules/comprehensive-report/index.ts`, 457 lines) — AI prompt construction + JSON parsing + cache layer — NO TESTS.
- **Plagiarism scoring** (`src/modules/assessment/lib/plagiarism-scoring.ts`) — NO TESTS.
- **Safeguarding analyzer** (`src/lib/ai-assistant/safeguarding.ts`) — NO TESTS. Categorizes student messages for child-protection escalation.
- **Teacher load calculator** (`src/lib/ai-assistant/teacher-load.ts`) — NO TESTS.
- **Project setup/weeks/reports** libraries — NO TESTS.
- **AI provider fallback chain in production** — only pure-function helpers tested. The actual `callAI()` 4-step fallback (DeepSeek → Z.ai → z-ai-sdk → empty) is NOT tested. A silent break in the fallback wiring would surface only as empty AI responses.

### 6.2.4 Test Infrastructure Gaps

- `vitest.config.ts` only includes `src/**/*.test.ts` — `.tsx` test files would not be picked up. No component test capability is configured.
- Coverage `include: ["src/lib/*.ts"]` — covers 0 of the 4 modules with real implementations.
- No test database setup/teardown — the scope.test.ts suite assumes a seeded dev DB, which doesn't exist in CI.
- No mocks for `db` (Prisma client) — integration tests cannot run in isolation.

---

## 6.3 TODO/FIXME Markers in src/

Only **3 real TODO markers** remain in the entire codebase (excellent hygiene):

| # | File:Line | Marker | Content | Action |
|---|-----------|--------|---------|--------|
| 1 | `src/modules/comprehensive-report/index.ts:404` | `TODO` | `trend: "stable", // TODO: compute trend from multiple evidence entries` | Psychological dimension trends are hardcoded to "stable". Should compute from chronological `psychEvidence` rows. |
| 2 | `src/modules/comprehensive-report/index.ts:415` | `TODO` | `daysAheadOfSchedule: 0, // TODO: compute from self-paced status` | Behavioral section hardcodes 0. Should call `getSelfPacedStatus()` from `@/modules/self-paced`. |
| 3 | `src/lib/teacher-batch-summary.ts:8` | `TODO` (comment, not actionable) | `Existing Psych/Educational tabs (migration TODO — they currently use the old batch-summary endpoint)` | Documentation marker for a future tab migration. |

**Excluded from this list** (false positive — string match only):
- `src/app/api/project/suggestions/route.ts:86` — matches because the AI prompt contains the literal string `"not 'Todo App'"` (an example project name to avoid).

---

## 6.4 Dead Code

### 6.4.1 Confirmed Dead Library Files

#### `src/modules/project/lib/task-generator.ts` (174 lines) — DEAD

- Exports `generateTasks()` and `generateWeekPlan()`.
- Re-exported through `src/modules/project/index.ts:55` (barrel only).
- **No production importer** outside the barrel file. The API route `/api/project/generate-tasks/route.ts` uses `generateCourseAlignedPlan` from `src/modules/project/lib/course-aligned-planner.ts` (a different file, 401 lines, LIVE) — it does NOT call `generateTasks` or `generateWeekPlan`.
- The `generateTasks` docstring says it was "extracted from `src/app/api/project/generate-tasks/route.ts`" but the route was later rewritten to use the course-aligned planner. The extraction is stale.
- **Recommended action:** Delete `task-generator.ts`, remove its re-exports from `project/index.ts:51-55`. This also removes 2 dead `callAI()` sites (confirmed in Section 1, item 2 of original audit).

#### `src/modules/course/lib/course-generation.ts` (236 lines) — DEAD

- Exports `computeFormHash`, `getCachedGeneration`, `saveCachedGeneration`, `normalizeAiCourseData`, `buildCourseGenPrompt`, `generateCourse`, `CACHE_TTL_MS`.
- Re-exported through `src/modules/course/index.ts:99-103` (barrel only).
- **No production importer** outside the barrel file. The API route `/api/courses/generate/route.ts` (382 lines) has its OWN inline `computeFormHash` function (line 36) and its OWN inline prompt + batching logic — it does NOT call any function from `course-generation.ts`.
- The existing test file `src/lib/__tests__/course-normalization.test.ts` (20 tests) re-implements `normalizeAiCourseData` from scratch in the test file itself (comment at line 49: *"In production it lives in /api/courses/route.ts but isn't exported. This is an exact copy"*). It does NOT import from `course-generation.ts`. So the test does not keep the dead file alive.
- **Recommended action:** Delete `course-generation.ts`, remove its re-exports from `course/index.ts:98-103`. Removes 1 dead `callAI()` site (the original audit's third dead-AI-code entry). Note: `/api/courses/route.ts` ALSO has its own inline `normalizeAiCourseData` (line 25) — that one IS live. Consider extracting it to `course/lib/course-normalization.ts` and importing it from both the test and the route to kill the "exact copy" drift risk.

### 6.4.2 Confirmed Dead Prisma Models

#### `CaseReviewResponse` — DEAD MODEL

- Defined in `prisma/schema.prisma:1023` and `prisma/schema.prod.prisma:872`.
- Relations: `caseReview CaseReview @relation(...)`, `responder User @relation("CaseReviewResponder", ...)`.
- **`db.caseReviewResponse` is called in 0 files** under `src/`.
- The parent `CaseReview` model IS used (`db.caseReview` appears in 3 files), but the response/reply model is never written or read.
- **Recommended action:** Drop the model in a migration. Update both schema files. The CaseReview UI (`src/components/examiner/teacher/CaseReviewPanel.tsx`) does not surface a reply feature.

#### `DailyTestAnswer` — DEAD MODEL

- Defined in `prisma/schema.prisma:836` and `prisma/schema.prod.prisma:715`.
- Relations: `dailyTest DailyTest @relation(...)`.
- Designed to store per-question answers (question text, answer text, score, time taken, confidence rating, topic) for fine-grained `SkillMastery`.
- **`db.dailyTestAnswer` is called in 0 files** under `src/`. Daily test scoring is done inline in `/api/daily-test/route.ts` without persisting per-question answers — only the parent `DailyTest` row stores the aggregate.
- This means per-question confidence ratings + topics (defined as `confidenceRating String?` and `topic String?` on the model) are never collected — `SkillMastery` granularity for daily tests is silently disabled.
- **Recommended action:** Either (a) drop the model and remove the dangling relation from `DailyTest`, OR (b) wire up the per-answer persistence in `/api/daily-test/route.ts` to actually use the model (it was designed but never implemented). Decision should be a product call.

### 6.4.3 Partially Dead — `teaching_assistant` Role (Zombie Role)

Not pure dead code, but functionally inert. **9 call sites** reference the role:

| # | File:Line | Usage | Status |
|---|-----------|-------|--------|
| 1 | `src/lib/rbac.ts:55` | `UserRole.TEACHING_ASSISTANT: "teaching_assistant"` enum value | Defined |
| 2 | `src/lib/rbac.ts:86` | Listed in `STAFF_ROLES` array | Granted staff privileges |
| 3 | `src/lib/rbac.ts:113` | Listed in `ROLE_LABELS` map ("Teaching Assistant") | Display label |
| 4 | `src/lib/rbac.ts:129` | `case "teaching_assistant":` in `normalizeRole()` switch | Role normalization |
| 5 | `src/lib/client-rbac.ts:31` | Listed in client-side `STAFF_ROLES` | Client RBAC mirror |
| 6 | `src/lib/ai-assistant/data-efficiency.ts:31` | `teaching_assistant: 30,` in `ROLE_QUERY_BUDGETS` | Per-role AI budget |
| 7 | `src/modules/ai-assistant/index.ts:85` | Listed in `isAIAssistantEnabled()` staffRoles | AI Assistant gate |
| 8 | `src/app/api/batches/[id]/teachers/route.ts:38` | Listed in `staffRoles` for batch-teacher assignment | Can be assigned to a batch |
| 9 | `src/components/examiner/admin/RoleNavConfigPanel.tsx:51` | Listed in admin role-config UI | Visible in admin dropdown |

**But the role is explicitly disabled for navigation:**
- `src/components/examiner/AppShell.tsx:107` — `STAFF_NAV_ROLES` does NOT include `teaching_assistant`. Comment on line 105: *"teaching_assistant role removed — teachers now handle all teaching duties directly."*
- Result: any user with `role = "teaching_assistant"` logs in and sees a blank dashboard (no nav items render). They could still call staff-scoped APIs, but there's no UI.
- No users are seeded with this role in `src/lib/seed.ts`.
- No role-change endpoint specifically assigns it.

**Verdict:** Zombie role. Recommended action: delete all 9 references. ~9 sites. No users, no UI, no functional benefit. The `batches/[id]/teachers/route.ts` line is the only place that would surface a behavior change — TAs would no longer be assignable as batch teachers, but since none exist, this is a no-op.

### 6.4.4 Legacy Re-export Shims — NOT Dead (Correction to Section 1 Audit)

The original Section 1 audit (item 7.1) flagged 5 re-export shims as "safe to delete". **They are NOT safe to delete yet** — they have active importers:

| Shim | Active importers |
|------|------------------|
| `src/components/examiner/student/DailyTestPanel.tsx` | `StudentDashboard.tsx:46` |
| `src/components/examiner/student/PracticePanel.tsx` | `StudentDashboard.tsx:39` |
| `src/components/examiner/student/WeeklyTestPanel.tsx` | `StudentDashboard.tsx:38` |
| `src/components/examiner/student/PostTestReflection.tsx` | `WeeklyTestPanel.tsx:14`, `PracticePanel.tsx:25`, `DailyTestPanel.tsx:18` (cross-imports WITHIN the assessment module — these should be relative imports like `./PostTestReflection`) |
| `src/components/examiner/student/TeachingFeedbackCard.tsx` | `WeeklyTestPanel.tsx:15`, `PracticePanel.tsx:26`, `DailyTestPanel.tsx:19` (same cross-import pattern) |

**Recommended action:**
1. Migrate the 3 cross-imports inside the assessment module to relative imports (`./PostTestReflection`, `./TeachingFeedbackCard`).
2. Migrate the 3 `StudentDashboard.tsx` imports to `@/modules/assessment`.
3. Then delete the 5 shim files.

---

## 6.5 External Dependency Inventory

Full external surface — the app is remarkably self-contained:

| # | Dependency | Type | Where configured | Where called | Status |
|---|-----------|------|------------------|--------------|--------|
| 1 | **DeepSeek API** | External HTTP API (OpenAI-compatible) | `src/modules/assessment/lib/ai-provider.ts:57-58` — `DEEPSEEK_API_KEY` env var, `https://api.deepseek.com/v1`, model `deepseek-v4-flash` (default) | `callDeepSeek()` in `ai-provider.ts` (called by `callAI()`) | **PRIMARY** AI provider. Real, in production. |
| 2 | **Z.ai API** | External HTTP API (OpenAI-compatible) | `src/modules/assessment/lib/ai-provider.ts:50` — `ZAI_API_KEY` env var (or DB setting `zai_api_key`), `https://api.z.ai/api/paas/v4`, model `glm-4.6` | `getZAIClient()` in `ai-provider.ts` | **FALLBACK** AI provider. Real, in production. Keep. |
| 3 | **z-ai-web-dev-sdk** | npm package (`^0.0.18` in `package.json`) | `src/modules/assessment/lib/ai-provider.ts:416` — dynamically `import("z-ai-web-dev-sdk")` only when both DeepSeek AND Z.ai fail | `callAI()` line 414-438 — calls `ZAI.create()` then `zai.chat.completions.create()` | **SANDBOX-ONLY** fallback. Comment at line 8: *"only works in Z.ai sandbox"*. When it fires, logs `provider: "z-ai"` to `AIUsageLog`. **To verify whether it has ever fired in production: query `SELECT COUNT(*) FROM AIUsageLog WHERE provider = 'z-ai';`** — if 0, this entire fallback branch can be removed along with the npm dep. Candidate for removal. Also referenced in marketing copy at `src/components/landing/modern-landing.tsx:275`. |
| 4 | **NotebookLM URL** | Hardcoded URL string (not a runtime dependency) | **NOT in `constants.ts`** (audit task description was wrong about location). Actually hardcoded in 4 places: `src/app/api/courses/route.ts:198-199` (URL validator), `src/components/examiner/CoursePlanner.tsx:462,597` (input placeholders), `src/components/examiner/admin/RoleNavConfigPanel.tsx:42` (UI label "AI Tutor (NotebookLM)"). Stored per-course as `Course.notebooklmUrl`. | **NOT used at runtime** — comment in `src/app/api/ai/tutor/route.ts:19`: *"Replaces the old NotebookLM iframe (which required a Chrome extension to work)"*. The AI Tutor was migrated to a chat-based interface (`/api/ai/tutor`), but the URL field is still stored + validated. | **DEAD CONFIG FIELD.** The notebooklmUrl field on Course is collected but never rendered. Either remove the field + UI inputs, or restore the iframe (unlikely — the chat interface is better). Recommended: remove. |
| 5 | **OpenAI npm package** | npm package (`^6.46.0`) | `package.json` | Used ONLY as an HTTP client wrapper for DeepSeek + Z.ai endpoints (`new OpenAI({ apiKey, baseURL })`) in `ai-provider.ts:18` | Indirect dependency — not a separate external API. Safe to keep. |

**No other external HTTP APIs detected.** The app does not call:
- Stripe / payment processors
- SendGrid / email providers
- Twilio / SMS providers
- S3 / file storage APIs
- Sentry / Datadog / external observability
- Any third-party auth providers (Google, GitHub, etc.)

The entire external surface is 2 AI providers + 1 sandbox SDK + 1 dead URL config field.

---

## 6.6 Modularity Review — `src/modules/`

The `src/modules/` directory has **16 modules**. **0 of 16** modules has its own `permissions.ts` file — permission enforcement lives in `src/lib/rbac.ts` and is invoked from API routes, not from module boundaries.

Modules fall into 3 categories:

### Category A — Genuine Modules (real implementation in module dir) — 6 of 16

| Module | Index size | Subdirs | Notes |
|--------|-----------:|---------|-------|
| `assessment/` | 41 lines | `lib/` (5 files), `components/` (5 files) | Owns grading + AI + analysis pipeline. Real module. |
| `course/` | 109 lines | `lib/` (6 files), `types/` | Owns course DB loaders, config, defaults, topics, validation, AI generation. Real module — but `lib/course-generation.ts` is dead code (see 6.4.1). |
| `project/` | 74 lines | `lib/` (4 files), `types/` | Owns project setup, weeks, reports. Real module — but `lib/task-generator.ts` is dead code (see 6.4.1). |
| `comprehensive-report/` | 457 lines | (none — index.ts IS the implementation) | Single-file module. 457 lines in `index.ts` is a code smell — should be split into `lib/gather.ts`, `lib/generate.ts`, `lib/cache.ts`, `types.ts`. Has 2 TODOs (see 6.3). |
| `self-paced/` | 202 lines | (none) | Single-file module. Pure advancement + anti-cheat logic. NO TESTS (see 6.2.3). |
| `user-audit/` | 266 lines | (none) | Single-file module. Audit trail + activity summary + AI usage breakdown. |

### Category B — Skeleton Barrel Modules (self-identified as "skeleton") — 8 of 16

Each module's `index.ts` header comment explicitly says: *"This module is a skeleton — the actual code still lives in `src/lib/` and `src/components/examiner/`. The re-exports below provide a stable import path."*

| Module | Index size | Re-exports from | Boundary value |
|--------|-----------:|-----------------|----------------|
| `admin/` | 16 lines | `@/lib/audit-log`, `@/lib/seed` | Barrel only |
| `auth/` | 16 lines | `@/lib/auth`, `@/lib/rbac` | Barrel only |
| `communication/` | 20 lines | `@/components/examiner/Messages`, `@/components/examiner/AskMyTeacher` | Barrel only |
| `grading/` | 15 lines | `@/lib/csv-export` | Barrel only — single export |
| `shared/` | 23 lines | 9 `@/lib/*` files (db, logger, utils, api-client, api-response, feature-flags, constants, chart-theme, toast-helpers) | Barrel only — uses `export *` (risk: name collisions) |
| `student/` | 14 lines | **EMPTY** — comment only, zero exports | Pure placeholder |
| `wellbeing/` | 14 lines | **EMPTY** — comment only, zero exports | Pure placeholder |
| `theme/` | 11 lines | Own subdirs (`theme-context.tsx`, `themes/presets.ts`, `unified-theme-toggle.tsx`) — actually a real module | Miscounted as skeleton — it's real. See Category C. |

### Category C — Re-export from `src/components/examiner/` (semi-real) — 2 of 16

| Module | Index size | Re-exports | Boundary value |
|--------|-----------:|------------|----------------|
| `ai-assistant/` | 87 lines | 6 lib functions from `@/lib/ai-assistant/*` (scope, data-efficiency, escalation, safeguarding, teacher-load, teaching-guidance) + 3 components from `@/components/examiner/teacher/ai/*` + ActionDialog from `@/components/shared/action-dialog` + `AI_ASSISTANT_API` const + `isAIAssistantEnabled()` helper | Real value — the const + helper are defined in the index. But the heavy lifting lives in `@/lib/ai-assistant/`, not in the module dir. |
| `ai-tutor/` | 32 lines | `AITutor` component + `AI_TUTOR_API` const + `isAITutorEnabled()` helper | Same pattern — re-export + 2 trivial helpers. |

### 6.6.1 Modularity Findings

1. **`student/` and `wellbeing/` are pure empty shells** (14 lines each, zero exports). They exist only as directory placeholders. Either fill them (move `src/lib/wellbeing-*` and `src/lib/student-*` files in) or delete them.
2. **`grading/` re-exports exactly 1 file** (`csv-export`). A 15-line module for 1 export is over-engineered — either expand it (move `unified-grader`, `plagiarism-scoring`, report-card logic in) or delete the wrapper.
3. **`shared/` uses `export *`** for 9 lib files — high risk of name collisions (e.g., `db` from `@/lib/db` vs any future `db` export). Should be explicit named exports.
4. **`theme/` is misclassified** — it has real subdirs with real implementation (`theme-context.tsx`, `themes/presets.ts`, `unified-theme-toggle.tsx`), not a skeleton. Should be moved to Category A.
5. **0 of 16 modules has `permissions.ts`** — permission enforcement is centralized in `src/lib/rbac.ts` + invoked from each API route. This is a reasonable design choice (avoids duplication) but means module boundaries are not enforced — any route can import any module's exports and bypass intended access control. Documenting access expectations per module would harden this.
6. **The "modularization" migration stalled.** 8 of 16 modules are still empty skeletons. The 6 real modules (`assessment`, `course`, `project`, `comprehensive-report`, `self-paced`, `user-audit`) cover ~40% of the domain surface. The remaining 60% (admin, auth, communication, grading, shared, student, wellbeing) still lives in `src/lib/` and `src/components/examiner/`.

---

## 6.7 Section 6 Summary — Actionable Findings

| # | Severity | Finding | Effort | Impact |
|---|----------|---------|--------|--------|
| 6.1 | Medium | 4 files over 800 lines; `weekly-test/route.ts` (1,166) and `StudentPortfolioPage.tsx` (1,341) are highest priority splits | 1-2 days each | Maintainability |
| 6.2 | **High** | AI Assistant scope resolver tests FAIL in CI (require seeded DB) — 0% reliable coverage on the security-critical scope function | 0.5 day (mock the db) | Security |
| 6.2 | **High** | Zero tests for `generateCourseAlignedPlan` (401 lines, AI task generation for every student) | 1 day | Correctness |
| 6.2 | **High** | Zero tests for `self-paced/index.ts` anti-cheat logic (202 lines) | 0.5 day | Integrity |
| 6.2 | Medium | Zero route tests — 122 API routes untested | 5+ days | Regression risk |
| 6.3 | Low | 3 real TODOs; 2 in `comprehensive-report/index.ts` (trend + daysAheadOfSchedule hardcoded) | 0.5 day | Correctness |
| 6.4.1 | Medium | `task-generator.ts` (174 lines) + `course-generation.ts` (236 lines) confirmed dead — delete + remove barrel re-exports | 0.5 day | -410 LOC, -3 dead AI call sites |
| 6.4.2 | Medium | `CaseReviewResponse` + `DailyTestAnswer` Prisma models never queried — drop or wire up | 1 day (migration) | Schema cleanup |
| 6.4.3 | Low | `teaching_assistant` zombie role — 9 call sites, no users, no UI | 0.5 day | -9 references |
| 6.4.4 | Low | 5 legacy re-export shims still have importers (correction to Section 1) — migrate imports first, then delete | 0.5 day | -5 files |
| 6.5 | Medium | `z-ai-web-dev-sdk` (npm) is sandbox-only — verify `AIUsageLog.provider = 'z-ai'` count is 0 in prod, then remove | 0.5 day | -1 npm dep, -25 lines |
| 6.5 | Low | `Course.notebooklmUrl` field is collected + validated but never rendered (NotebookLM iframe was removed) | 0.5 day | -1 schema field, -4 hardcoded refs |
| 6.6 | Low | 2 empty module shells (`student/`, `wellbeing/`), 1 single-export module (`grading/`), `shared/` uses `export *` | 1 day | Modularization cleanup |

**Total dead code identified for removal:** ~650 LOC + 2 Prisma models + 1 npm dependency + 1 dead schema field + 9 zombie-role references.

**Total untested critical-path LOC identified:** ~1,500 LOC across `course-aligned-planner.ts` (401), `self-paced/index.ts` (202), `comprehensive-report/index.ts` (457), `plagiarism-scoring.ts`, `safeguarding.ts`, `teacher-load.ts`, `weekly-test/route.ts` business logic (~1,000 of 1,166 lines).

---

## Section 6b — Cleanup Actions Executed (2026-07-26)

This section documents confirmed dead code removals performed by the Section 6b sub-agent. Each removal was verified with `npx tsc --noEmit` (0 errors in `src/`) and `npx next build` (Compiled successfully).

### 6b.1 Removed: `src/modules/project/lib/task-generator.ts` (174 LOC)

**Status:** DELETED.

**Pre-removal verification:**
- `grep` for `task-generator` in `src/` → only 2 hits in `src/modules/project/index.ts` (the barrel re-export + doc comment). No route, component, or other lib imports it.
- `grep` for `generateTasks` / `generateWeekPlan` (the 2 exported functions) → the local `generateTasks` symbol in `ProjectSettingsCard.tsx` and `ProjectDescriptionCard.tsx` is an UNRELATED component-local function that POSTs to `/api/project/generate-tasks` (which uses `course-aligned-planner.ts`, not `task-generator.ts`).
- `/api/project/generate-tasks/route.ts` imports `generateCourseAlignedPlan` from `./course-aligned-planner` — confirmed in Section 6 audit (Task 8) and re-verified.
- `/api/project/plan/route.ts` is a GET-only DB read; no POST exists in that directory. The `generateWeekPlan` lib function (which used to be called from a POST there) is no longer called from anywhere.

**Edits made:**
1. Deleted `src/modules/project/lib/task-generator.ts`.
2. Edited `src/modules/project/index.ts`:
   - Removed the `// === Task Generation (AI) ===` export block (3 lines: `export { generateTasks, generateWeekPlan } from "./lib/task-generator";`).
   - Updated the JSDoc tree comment: `task-generator.ts ← AI-powered task generation` → `course-aligned-planner.ts ← AI-powered course-aligned task generation`.

**Side effect:** Also removes 2 dead `callAI()` call sites (`"task-gen"` + `"week-plan-gen"` features), confirmed in Section 1 (item 2) and Section 6 (item 6.4.1) audits.

### 6b.2 Removed: `src/modules/course/lib/course-generation.ts` (237 LOC)

**Status:** DELETED.

**Pre-removal verification:**
- `grep` for `course-generation` in `src/` → only 2 hits in `src/modules/course/index.ts` (the barrel re-export + doc comment). No route or component imports it.
- `grep` for `generateCourse` (one of the 3 exports) → 1 hit in `CoursePlanner.tsx:126` is an UNRELATED component-local function. The lib `generateCourse` is only re-exported by the barrel.
- `grep` for `normalizeAiCourseData` (second export) → 0 importers in `src/`. The test file `src/lib/__tests__/course-normalization.test.ts` has its OWN LOCAL re-implementation (lines 52–97). The route `src/app/api/courses/route.ts` also has its OWN LOCAL copy (line 25). The library version is unused.
- `grep` for `computeFormHash` (third export) → 0 importers in `src/`. The route `src/app/api/courses/generate/route.ts` has its OWN LOCAL copy (line 36).
- The Section 6 audit (Task 8) confirmed: "`/api/courses/generate/route.ts` has its OWN inline `computeFormHash` + prompt + batching logic. The `course-normalization.test.ts` re-implements `normalizeAiCourseData` in the test file itself."

**Edits made:**
1. Deleted `src/modules/course/lib/course-generation.ts`.
2. Edited `src/modules/course/index.ts`:
   - Removed the `// === AI Course Generation ===` export block (5 lines: `export { generateCourse, normalizeAiCourseData, computeFormHash } from "./lib/course-generation";`).
   - Updated the JSDoc tree comment: `course-generation.ts ← AI course generation` line removed; added a "Note: AI course generation lives inline in src/app/api/courses/generate/route.ts" line below the structure block.

**Side effect:** Also removes 1 dead `callAI()` call site (`"course-gen"` feature), confirmed in Section 1 (item 2) and Section 6 (item 6.4.1) audits.

### 6b.3 Removed: `z-ai-web-dev-sdk` (npm package + import branch)

**Status:** DELETED from `package.json` + `node_modules` + the import branch in `ai-provider.ts`.

**Pre-removal verification:**
- `grep` for `z-ai-web-dev-sdk` in `src/` → 5 hits:
  - `ai-provider.ts:8` (top doc comment listing it as provider #3)
  - `ai-provider.ts:263` (callAI JSDoc comment listing it)
  - `ai-provider.ts:414` (the `// ---- 3. Try z-ai-web-dev-sdk` comment)
  - `ai-provider.ts:416` (the dynamic `import("z-ai-web-dev-sdk")` statement — the only actual import)
  - `ai-provider.ts:437` (error log message string)
  - `modern-landing.tsx:275` (marketing text)
- The package's own source comment (per Section 6 audit): "z-ai-web-dev-sdk is sandbox-only — only works in Z.ai sandbox." This is SEPARATE from the production Z.ai API fallback (ZAI_API_KEY-based, OpenAI-compatible), which is configured at `ai-provider.ts:48-50` and used at lines 382–411.
- The Section 6 audit verified: "candidate for removal — verify AIUsageLog.provider='z-ai' count in prod."

**Decision:** Per task instructions, the ZAI_API_KEY-based Z.ai API fallback (lines 119–144 client getter + lines 382–411 main call path) STAYS UNTOUCHED. Only the `import("z-ai-web-dev-sdk")` branch (lines 414–438) was removed.

**Edits made:**
1. `src/modules/assessment/lib/ai-provider.ts`:
   - Removed the entire `// ---- 3. Try z-ai-web-dev-sdk (sandbox fallback) ----` block (lines 414–438, ~25 LOC).
   - Renumbered the empty-fallback comment from `// ---- 4. Empty fallback ----` to `// ---- 3. Empty fallback ----`.
   - Updated the file top JSDoc: removed provider #3 line; renumbered empty fallback from #4 to #3.
   - Updated the `callAI()` JSDoc: removed `z-ai-web-dev-sdk (sandbox)` from the priority list.
   - Updated the Z.ai-fail error log message: `"Z.ai failed, trying z-ai-sdk"` → `"Z.ai failed, returning empty fallback"`.
2. `src/components/landing/modern-landing.tsx:275`: updated marketing feature description from `"DeepSeek V4 Flash (primary, cheap + fast), Z.ai (fallback), z-ai-web-dev-sdk (sandbox). Automatic failover."` to `"DeepSeek V4 Flash (primary, cheap + fast), Z.ai (fallback). Automatic failover."`.
3. `package.json`: removed `"z-ai-web-dev-sdk": "^0.0.18"` from `dependencies`.
4. Ran `npm uninstall z-ai-web-dev-sdk` to prune `node_modules/z-ai-web-dev-sdk` + update `package-lock.json`.

**What was KEPT (per task instructions):**
- The ZAI_API_KEY-based Z.ai API fallback in `ai-provider.ts` (lines 48–50 env config, lines 119–144 client getter, lines 382–411 main call path). This is the OpenAI-compatible Z.ai REST API, completely separate from the sandbox SDK.
- The `"z-ai"` literal in the `AIResult.provider` union type (`ai-provider.ts:29`). After the removal, no live code path produces `"z-ai"`, but historical `AIUsageLog` DB rows may still have `provider="z-ai"` from past sandbox calls. `SystemPanel.tsx:392` renders provider badges with a color-coded check for `provider === "z-ai"` (amber) — leaving the union literal in place preserves the type-level documentation of historical records and keeps the SystemPanel rendering path type-safe.

### 6b.4 NotebookLM URL cleanup — findings (NO removal — user decision required)

**Task description stated:** "The NotebookLM URL is NOT in constants.ts as the task description suggested. It's a per-course field (Course.notebooklmUrl) with a fallback to a global default in constants.ts."

**Actual findings — the situation is MORE dead than the task description implied:**

1. **The global `NOTEBOOKLM_URL` constant DOES NOT EXIST in `src/lib/constants.ts`.**
   - `src/lib/constants.ts` is now 28 lines total and exports only `PILLARS`, `scoreToGrade()`, and `gradeColor()`.
   - An older audit (`docs/AUDIT-INVENTORY-2026-07-26.md:969`) noted that the URL was previously a BARE STRING LITERAL on line 5 of `constants.ts` — `"https://notebooklm.google.com/notebook/f13b0673-42aa-40d1-a5e9-510f889b8bcd";` — with no `export const NOTEBOOKLM_URL =` prefix. That bare literal has since been deleted entirely. The "global default" no longer exists in code at all.
   - `grep` for `NOTEBOOKLM_URL` in `src/` → 0 matches. The only mentions of `NOTEBOOKLM_URL` in the repo are: 1 schema comment in `prisma/schema.prisma:115` and 3 references in older audit docs.

2. **The `prisma/schema.prisma` comment (lines 113–117) is STALE.** It reads: "When null, falls back to the global NOTEBOOKLM_URL constant in src/lib/constants.ts (the original bootcamp notebook)." This fallback path was removed at some point (the AI Tutor chatbot replaced the NotebookLM iframe — see `AITutor.tsx:6` and `/api/ai/tutor/route.ts:19`), but the schema comment was not updated.

3. **The `Course.notebooklmUrl` per-course field is COLLECTED + VALIDATED + PERSISTED + DISPLAYED in the admin UI but NEVER RENDERED for students.**
   - Written by `/api/courses` POST (line 235) and `/api/courses/[id]` PATCH (line 170).
   - Read by `/api/courses` GET (line 109) → consumed only by the admin `CoursePlanner.tsx` for display + editing.
   - The student-facing `AITutor.tsx` component is a chatbot that POSTs to `/api/ai/tutor` — it does NOT render an iframe and does NOT read `notebooklmUrl` at all.
   - `CoursePlanner.tsx` UI labels (lines 457, 467, 590, 607) still claim "empty = global default" and "AI Tutor tab loads this NotebookLM notebook in an iframe for students in this course" — both claims are FALSE as of the current code.

4. **No `notebooklmUrl` value is ever read for student UX.** Grep confirms: 0 student-facing reads of `course.notebooklmUrl`. The field is write-only/display-only at this point.

**Per task instructions, I did NOT remove anything.** Asking the user to decide between these options:

- **Option A (recommended): Delete the dead field.** Drop `notebooklmUrl` from the Prisma `Course` model, delete the 4 CoursePlanner UI labels/inputs, delete the 4 route-handler persist/validate lines, delete the stale schema comment. The AI Tutor chatbot is the actual student UX; the iframe launcher was already removed. ~30 LOC + 1 schema field + 1 Prisma migration.
- **Option B: Restore the global default + iframe.** If the institution actually wants the NotebookLM iframe back as a per-course UX element, restore `NOTEBOOKLM_URL` as a real `export const` in `src/lib/constants.ts`, re-add the iframe component to `AITutor.tsx` (or a new `NotebookLMFrame.tsx`), and wire it to read `course.notebooklmUrl` with fallback to the constant. ~80 LOC + 1 new component + UI wiring.
- **Option C: Leave as-is.** The status quo is a "ghost config" — admins can set a URL per course, nothing renders it, no student sees it. Low harm but misleading UI.

### 6b.5 Module barrel inventory — boundary status

Reviewed all 16 modules under `src/modules/`. For each, counted importers of `@/modules/<name>` (barrel) and `@/modules/<name>/*` (subpath) in `src/`:

| Module | Files | LOC | Barrel importers | Subpath importers | Real boundary? |
|---|---|---|---|---|---|
| `assessment/` | 16 | 4,839 | 0 | 22 | YES — real lib + components. But barrel itself unused (callers import subpaths directly). |
| `course/` | 7 | 1,448 | 0 | 6 | PARTIAL — real lib. Barrel unused; legacy `@/lib/course-*` re-export shims (36 sites) are the de-facto public API. |
| `project/` | 6 | 770 | 0 | 1 | PARTIAL — real lib. Barrel unused (1 subpath import). |
| `theme/` | 4 | 664 | 3 | 0 | YES — real lib + components + used via barrel. |
| `user-audit/` | 1 | 266 | 1 | 0 | YES — single-file module, used via barrel. |
| `comprehensive-report/` | 1 | 457 | 1 | 0 | YES — single-file module, used via barrel. |
| `self-paced/` | 1 | 202 | 1 | 0 | YES — single-file module, used via barrel. |
| `ai-assistant/` | 1 | 87 | 1 | 0 | YES — re-export shim + small helpers. |
| `ai-tutor/` | 1 | 32 | 1 | 0 | SEMI-REAL — re-exports `AITutor` component + `AI_TUTOR_API` constant + `isAITutorEnabled()` helper. Used. |
| `admin/` | 1 | 16 | 0 | 0 | NO — skeleton barrel, re-exports `@/lib/audit-log` + `@/lib/seed`. Unused. |
| `auth/` | 1 | 16 | 0 | 0 | NO — skeleton barrel, re-exports `@/lib/auth` + `@/lib/rbac`. Unused. |
| `communication/` | 1 | 20 | 0 | 0 | NO — skeleton barrel, re-exports 2 components. Unused. |
| `grading/` | 1 | 15 | 0 | 0 | NO — skeleton barrel, re-exports `@/lib/csv-export`. Unused. |
| `shared/` | 1 | 23 | 0 | 0 | NO — skeleton barrel, `export *` from 9 `@/lib/*` files. Unused. |
| `student/` | 1 | 14 | 0 | 0 | NO — empty shell (comment-only, no exports). |
| `wellbeing/` | 1 | 14 | 0 | 0 | NO — empty shell (comment-only, no exports). |

**Modules with NO real boundary (8):** `admin`, `auth`, `communication`, `grading`, `shared`, `student`, `wellbeing`, `ai-tutor`. Of these, `student/` and `wellbeing/` are completely empty (comment-only). The other 6 are pure re-export shims with 0 importers — their "public API" path (`@/modules/<name>`) is never actually used; callers import from `@/lib/*` or `@/components/examiner/*` directly.

**Modules with a real boundary but UNUSED barrel (3):** `assessment`, `course`, `project`. The actual code is used heavily; the `index.ts` barrel is documentation-only. Callers import via subpaths (`@/modules/<name>/lib/*`) or via legacy `@/lib/*` re-export shims.

**Modules with a real boundary AND active barrel (5):** `theme`, `user-audit`, `comprehensive-report`, `self-paced`, `ai-assistant`. These are the only modules whose barrel is the actual import path used by callers.

**No code changes made in this subsection** (per task: "Don't force changes — just document"). Suggest a future cleanup pass: delete the 8 skeleton barrels (especially the 2 empty shells), or migrate callers to use them, OR add `// @deprecated` headers pointing to the real paths.

### 6b.6 Verification results

| Step | Command | Result |
|---|---|---|
| Baseline (before any changes) | `npx tsc --noEmit` | 0 errors in `src/` (only pre-existing errors in `examples/` + `skills/` outside the project scope). |
| After `task-generator.ts` removal | `npx tsc --noEmit` | 0 errors in `src/`. |
| After `course-generation.ts` removal | `npx tsc --noEmit` | 0 errors in `src/`. |
| After `ai-provider.ts` z-ai-web-dev-sdk branch removal | `npx tsc --noEmit` | 0 errors in `src/`. |
| After `package.json` removal + `npm uninstall` | `npx tsc --noEmit` | 0 errors in `src/`. |
| Final build verification | `npx next build` | ✓ Compiled successfully in 27.9s. All 121 routes built. |

### 6b.7 Summary — what was removed vs. kept

**REMOVED (3 confirmed-dead items):**
| Item | LOC/files | Confirmation |
|---|---|---|
| `src/modules/project/lib/task-generator.ts` | 174 LOC + 1 file | Section 6 audit + grep verification: 0 importers in `src/`. Superseded by `course-aligned-planner.ts`. |
| `src/modules/course/lib/course-generation.ts` | 237 LOC + 1 file | Section 6 audit + grep verification: 0 importers in `src/`. Routes have inline copies. |
| `z-ai-web-dev-sdk` npm package + import branch | 1 dep + ~25 LOC | Section 6 audit verified sandbox-only. Removed dynamic `import()` + package.json entry + `node_modules`. Production ZAI_API_KEY fallback UNTOUCHED. |

**Total removed:** ~436 LOC + 1 npm dependency + 3 dead `callAI()` sites (`task-gen`, `week-plan-gen`, `course-gen`).

**KEPT (per task instructions):**
- All other dead code identified in Section 6 audit (2 dead Prisma models `CaseReviewResponse` + `DailyTestAnswer`, `teaching_assistant` zombie role, 5 legacy re-export shims in `src/lib/`) — explicitly out of scope.
- The `Course.notebooklmUrl` field + its UI + routes — pending user decision (Options A/B/C in §6b.4 above).
- The 8 skeleton barrels under `src/modules/` — documented in §6b.5, no changes forced.
- The ZAI_API_KEY-based Z.ai API fallback in `ai-provider.ts` — explicitly preserved per task instructions.
- The `"z-ai"` literal in the `AIResult.provider` union type — preserved for SystemPanel.tsx historical-log rendering compatibility.

---
