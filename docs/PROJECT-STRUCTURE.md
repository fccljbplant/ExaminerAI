# TraineesAI · Project Structure

> **The definitive directory map — where everything lives and why.**
> Companion to `CODING-STANDARDS.md`.
> Updated: August 2026

---

## 1. Top-level structure

```
src/
├── app/                    ← Next.js App Router (pages + API routes)
│   ├── (public)/           ← Public-facing pages (landing, courses, pricing)
│   ├── (portals)/          ← REDESIGN v2 portals (learner live; instructor/org/platform next)
│   ├── api/                ← API route handlers (thin — call lib, return JSON)
│   │   └── v2/             ← REDESIGN v2 envelope endpoints (see §6)
│   ├── app/                ← Legacy authenticated app shell (/app)
│   ├── globals.css         ← Global styles + theme tokens
│   └── layout.tsx          ← Root layout (providers, fonts, ⌘K, celebrations)
├── components/
│   ├── examiner/           ← Legacy role-specific dashboard components (deleting at cutover)
│   ├── landing/            ← Marketing landing page components
│   ├── shared/             ← Cross-module shared components (legacy kit)
│   └── ui/                 ← shadcn/ui primitives (superseded by modules/ui)
├── content/
│   └── copy.ts             ← Centralized marketing + UI voice constants
├── hooks/                  ← Cross-module React hooks
├── lib/                    ← Cross-module infrastructure (auth, db, logger)
└── modules/                ← Feature modules (the primary code organization)
```

---

## 2. The module pattern (primary organization)

Every feature lives in `src/modules/<feature>/`. A well-formed module has:

```
src/modules/<feature>/
  ├── index.ts              ← Barrel file — the public API
  ├── lib/                  ← Pure logic (no React, no DOM)
  │   ├── <feature>.ts      ← Core logic
  │   └── <feature>-helpers.ts
  └── components/           ← React components (UI only)
      ├── <Component>.tsx
      └── <Component>.test.tsx
```

### Rules
1. `index.ts` re-exports the public API. Consumers import from `@/modules/<feature>`, NEVER from internal paths.
2. `lib/` has NO React imports. Pure TypeScript — testable, tree-shakeable.
3. `components/` has NO business logic. They call `lib/` functions, render UI, handle events.
4. A module NEVER imports from another module's internal files — only from its `index.ts`.
5. API routes in `src/app/api/` call module `lib/` functions. Routes are thin.

---

## 3. Module inventory (24 modules)

| Module | Purpose | Structure |
|---|---|---|
| `admin` | Admin dashboard panels (legacy) | index.ts only |
| `ai-assistant` | Instructor AI assistant (legacy) | index.ts only |
| `ai-tutor` | Student AI tutor (legacy) | index.ts only |
| `assessment` | Test engine, grader, chat UI + **W5 exam runner** (contracts, exam-session state machine, ExamSession DB wrapper, flag) | ✓ lib/ + contracts + __tests__ |
| `auth` | REDESIGN login/signup/reset screens | ✓ lib/ + components/ |
| `b2b` | B2B org management | ✓ components/ |
| `b2c` | B2C learner management | ✓ components/ |
| `communication` | Messages (legacy stub) | index.ts only |
| `comprehensive-report` | Full portfolio report (legacy) | index.ts only |
| `course` | Course CRUD | ✓ lib/ |
| `gamification` | XP + badges + celebrations | ✓ lib/ + components/ |
| `grading` | Unified grader (legacy stub) | index.ts only |
| `learn` | Modern class: classroom, slides/video, voice Q&A, avatar, study-flow engine | ✓ lib/ + components/ + __tests__ |
| `instructor-portal` | REDESIGN instructor portal: review center (I3/I4), I1 home, I5 roster, I8 analytics, I10 earnings, More hub | ✓ components + nav |
| `learner-portal` | REDESIGN learner screens (home, catalog, course detail, exams, progress, assignments, submission flow, exam runner + results) | ✓ components + use-api |
| `project` | Capstone project | ✓ lib/ |
| `self-paced` | Self-paced advancement (legacy) | index.ts only |
| `shared` | Cross-module shared (legacy stub) | index.ts only |
| `shell` | REDESIGN adaptive shell: TopNav, TabRow, BottomNav, ActionBar, mode toggle | ✓ components |
| `student` | Student dashboard panels (legacy) | index.ts only |
| `submission` | REDESIGN W4: submission lifecycle, rubric engine, AI text-only packet, text extraction, registries | ✓ lib/ + contracts + __tests__ |
| `theme` | REDESIGN 3-layer token engine (primitives/semantic/component), brand derivation, validator | ✓ lib/ + tokens/ |
| `tutor` | REDESIGN FloatingTutor: vector rig, dock state machine, chat | ✓ components + lib/ + __tests__ |
| `ui` | REDESIGN component library (moved from components/ui + shared; tokens-only) | ✓ primitives (60+) |
| `user-audit` | Audit trail (legacy) | index.ts only |

**Legend**: ✓ = has that subdirectory. — = doesn't need it (module is a re-export only).

### REDESIGN module map (P2 §1.1 — target structure)

```
src/modules/
├── ui/                    ← THE component library (tokens only, no business logic)
│   ├── kpi.tsx list-card.tsx data-table.tsx bottom-sheet.tsx states.tsx …
│   ├── media-capture.tsx  ← W4 registry-driven file/photo/video picker
│   ├── submission-renderer.tsx ← W4 renders ANY part type (text-only AI law)
│   ├── rubric-grader.tsx  ← W4 level picker + "AI draft — verify" chip
│   ├── feedback-thread.tsx ← W4 text/audio/annotation thread
│   └── sign-off-card.tsx  ← W4 ordered multi-signer chain
├── shell/                 ← adaptive shell (TopNav / TabRow / BottomNav / ActionBar)
│                            + use-scroll-direction (hide-on-scroll nav, unit-tested)
├── theme/                 ← token engine, mode switching, org-brand derivation,
│                            captions-store (Bed captions default ON, P6 §3)
├── tutor/                 ← FloatingTutor (FAB, drag/dock/persist, vector rig)
├── learn/                 ← classroom, journey, SRS, study-flow engine (lib/study-flow.ts)
├── course/                ← content-model services (legacy lib kept)
├── assessment/            ← exam engine, grader, AI provider chain (kept)
├── submission/            ← W4: contracts, lifecycle, rubric-engine, ai-packet,
│                            text-extract, submission-db, registries, __tests__
├── learner-portal/        ← W1 screens composing the kit (use-api hook)
├── auth/                  ← login/register/reset screens
└── theme/…                ← tokens/ (primitives.css, semantic.css, component.css)
```

### `learn` module layout (Modern Class + study flow)

```
src/modules/learn/
  ├── index.ts              ← Barrel (NOTE: mixes server/db code — client
  │                             components import specific paths, never the root)
  ├── contracts.ts          ← zod contracts for v2 study-flow endpoints
  ├── lib/
  │   ├── study-flow.ts     ← W3 engine: detectAbsence/Cram, generatePlan, srsSchedule
  │   ├── study-flow-db.ts  ← DB-backed plan + scenario services
  │   ├── study-flow-flag.ts← W3 single flag source
  │   ├── lesson-media.ts   ← Resolves slide/video media for a topic
  │   ├── voice-input.ts    ← Web Speech API wrapper (barge-in, fallback)
  │   ├── today-topic.ts    ← 6×5 topic scheduler
  │   └── youtube-player.ts ← YouTube id parsing + embed URL builder
  ├── __tests__/            ← study-flow.test.ts (6 scenarios), lesson-media, voice-input, today-topic
  └── components/
      ├── classroom/        ← ClassroomShell, LessonStage, VideoStage, VoiceBar
      ├── avatar/           ← Avatar rig + expressions
      ├── dashboard/        ← LearnerHome
      └── study-flow/       ← StudyFlowCenter, CatchUpCard, CramCard, SrsQueueCard,
                              DiagnosticBanner, WeeklyPlanCard, BudgetSelector, PlanPreviewDialog
```

---

## 4. What lives in `src/lib/` (cross-module infrastructure ONLY)

These files are used by 2+ modules and don't belong to any single feature:

| File | Purpose |
|---|---|
| `auth.ts` | JWT, password hashing, getCurrentUser, getAuthUser |
| `db.ts` | Prisma client singleton |
| `logger.ts` | Structured logger (warn/error/info) |
| `rbac.ts` | Role definitions, hasRole(), normalizeRole() |
| `client-rbac.ts` | Browser-safe RBAC (no Prisma) |
| `utils.ts` | cn(), formatters, misc utilities |
| `constants.ts` | TEST_QUESTION_COUNT, GRADING, PILLARS, MARKETPLACE_CATEGORIES |
| `api-client.ts` | Fetch wrapper with timeout + JSON parse |
| `api-response.ts` | Standardized API response helpers |
| `rate-limiter.ts` | In-memory rate limiter |
| `feature-flags.ts` | Runtime feature toggles |
| `demo-guard.ts` | Demo-account write protection |
| `demo-fetch.ts` | Demo-mode fetch interceptor |
| `audit-log.ts` | Privileged action audit trail |
| `format.ts` | Price, date, relative-time formatters |
| `chart-theme.ts` | Recharts theme config |
| `email.ts` | Email sending (placeholder) |
| `stripe.ts` | Stripe checkout session creation |
| `toast-helpers.ts` | Sonner toast wrappers |
| `use-streaming-ai.ts` | React hook for SSE AI streaming |

### What does NOT belong in `src/lib/`

Feature-specific logic belongs in its module's `lib/`:

| Wrong (in src/lib/) | Right (in module) |
|---|---|
| `course-config.ts` | `modules/course/lib/course-config.ts` |
| `course-db.ts` | `modules/course/lib/course-db.ts` |
| `ai-provider.ts` | `modules/assessment/lib/ai-provider.ts` |
| `certificate.ts` | `modules/course/lib/certificate.ts` |
| `org.ts` | `modules/b2b/lib/org.ts` |
| `marketplace.ts` | `modules/course/lib/marketplace.ts` |

---

## 5. What lives in `src/components/`

| Directory | What | Rules |
|---|---|---|
| `ui/` | shadcn/ui primitives | Never import business logic. Pure presentation. |
| `shared/` | Cross-module components (2+ modules use them) | `widget-card.tsx`, `stat-card.tsx`, `dashboard-shell.tsx`, `command-palette.tsx`, etc. |
| `examiner/` | Role-specific dashboards | `StudentDashboard.tsx`, `InstructorDashboard.tsx`, `AdminDashboard.tsx`, `AppShell.tsx`, `LearnerTopNav.tsx` |
| `examiner/student/` | Student-facing panels | `TodayView.tsx`, `DueTodayCard.tsx`, `WeeklyTestPanel.tsx`, etc. |
| `examiner/admin/` | Admin sub-panels | `SystemPanel.tsx`, `FeaturesPanel.tsx`, `AuditLogPanel.tsx`, etc. |
| `examiner/instructor/` | Instructor sub-panels | `StudentsRoster.tsx`, `AssignmentsTab.tsx`, etc. |
| `landing/` | Marketing page components | `modern-landing.tsx` |

---

## 6. API route structure

```
src/app/api/
├── v2/                     ← REDESIGN v2 endpoints (envelope { ok, data } / { ok, error, code })
│   ├── learner/home|progress/
│   ├── courses/  courses/[id]/overview|syllabus/
│   ├── study-plan/  srs/queue/  srs/[cardId]/review/  diagnostic/start|answer/
│   ├── exams/  exams/[id]/start|resume|answer|complete|results/
│   ├── tutor/ask/           ← streaming tutor (text-only AI packet)
│   ├── assignments/  assignments/[id]/  assignments/[id]/draft|submit/
│   ├── submissions/[id]/resubmit|feedback|grade|decision|ai-draft/
│   ├── review/queue/             ← instructor grading queue (I3)
│   ├── instructor/home|students|analytics|earnings/  ← W6 instructor portal
│   ├── uploads/             ← docx/pdf→text extraction (in-house)
│   └── events/              ← typed engagement event union
├── cron/                    ← study-plan-refresh 06:00 · absence-scan 07:00 · srs-due 03:00
├── ai/                     ← AI endpoints (tutor, daily-test, weekly-test, practice)
│   ├── tutor/
│   │   ├── route.ts        ← Non-streaming tutor
│   │   └── stream/route.ts ← Streaming tutor (SSE)
│   ├── daily-test/
│   ├── weekly-test/
│   └── practice/
├── auth/                   ← Auth (login, logout, signup, password reset)
├── admin/                  ← Admin-only (orgs, b2c-stats, cache, cleanup)
├── org/                    ← Org management (signup, members, assign-course)
├── courses/                ← Course CRUD
├── marketplace/            ← Public marketplace (courses, paths, instructors)
├── learner/                ← Learner-facing (xp, badges)
├── users/                  ← User management
├── enrollments/            ← Enrollment management
├── stripe/                 ← Stripe checkout + webhook
├── health/                 ← Health check
└── ...
```

v2 conventions (REDESIGN-P4 §1): stable error codes
(`UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, AI_DEGRADED,
EXTRACTION_FAILED, VALIDATION`), zod contracts shared route↔client, cursor
pagination + field selection on lists, demo-write block on every mutation,
IDOR guards in the module service layer (never in routes).

### API route rules
1. **Thin handlers** — validate input, call lib function, return JSON. No business logic.
2. **Auth first** — every route (except public marketplace + auth + health + verify) starts with `getCurrentUser()`.
3. **Rate limit public endpoints** — signup, login, password reset.
4. **Return structured errors** — `{ error: "...", code: "NOT_FOUND" }` with proper HTTP status.

---

## 7. Public page structure

```
src/app/(public)/
├── page.tsx                ← Marketing landing (hero, stats, dual CTA)
├── for-business/           ← B2B landing (ROI calculator, pricing, demo CTA)
│   ├── page.tsx
│   └── ROICalculator.tsx
├── for-learners/           ← B2C landing (features, daily routine, signup CTA)
├── courses/                ← Marketplace course catalog
│   ├── page.tsx
│   ├── [id]/               ← Course detail page
│   └── category/[category]/
├── paths/                  ← Learning paths
├── pricing/                ← B2B + B2C pricing tiers
├── support/                ← Help center + contact + FAQ
├── signup/b2b/             ← B2B org registration
├── verify/[credentialId]/  ← Public certificate verification
└── instructors/            ← Instructor profiles
```

---

## 8. The data flow

```
User action (click, submit)
  ↓
React component (src/modules/<feature>/components/)
  ↓
API route (src/app/api/<route>/route.ts) — thin, validates + auths
  ↓
Module lib function (src/modules/<feature>/lib/) — business logic
  ↓
Prisma (src/lib/db.ts) — database
  ↓
Response → JSON → React state → re-render
```

**Never** call Prisma directly from a React component. Always go through an API route → lib function.

---

## 9. Gap analysis (what still needs fixing)

### High priority
1. **Move course lib files** → `modules/course/lib/` (5 files: course-config, course-db, course-defaults, course-topics, course-validation)
2. **Move AI lib files** → `modules/assessment/lib/` (4 files: ai-json, ai-prompts, ai-provider, ai-rate-limits)
3. **Move other feature lib files** → correct modules (certificate, org, marketplace, etc.)
4. **Fix 14 console.log** → use logger

### Medium priority
5. **114 `any` types** → replace with proper TypeScript types
6. **Move auth components** → `modules/auth/components/` (Login, ForgotPassword)
7. **Move course components** → `modules/course/components/` (CoursePlanner, CourseCreationWizard, etc.)

### Low priority
8. **Add JSDoc** to exported functions missing it
9. **Add unit tests** for module lib functions
10. **Move examiner/student/ panels** → `modules/student/components/`

---

## 10. How to add a new feature

1. **Create the module**: `src/modules/<feature>/` with `index.ts`, `lib/`, `components/`
2. **Write the lib**: pure TypeScript, no React. Export from `index.ts`.
3. **Write the API route**: `src/app/api/<feature>/route.ts` — thin handler that calls lib.
4. **Write the component**: `src/modules/<feature>/components/<Component>.tsx` — calls API, renders UI.
5. **Mount the component**: in the appropriate dashboard (StudentDashboard, AdminDashboard, etc.)
6. **Update the audit script** if the feature introduces new red lines.
7. **Run `bash scripts/ui-backend-audit.sh`** — must pass before merge.
