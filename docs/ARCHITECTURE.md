# TraineesAI · Architecture

> Module map, API inventory, data model, AI provider chain, cron jobs.
> Updated every audit cycle. Source of truth for "how is this built?"

---

## 1. High-level design

TraineesAI is a **single Next.js 16 App Router project**. Frontend, API, and
AI orchestration all live in one repo. Data is Prisma-managed SQLite (dev) or
PostgreSQL (prod). The AI provider is DeepSeek (default) with a provider
abstraction in `src/lib/ai-provider.ts` so other models can be swapped in.

```
┌────────────────────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js 16 App Router)                  │
│                                                                    │
│  src/app/page.tsx                                                  │
│    └── ErrorBoundary → AppShell (SPA shell, role-gated sidebar)    │
│          ├── student:  TodayView → Study → Project → Progress      │
│          ├── instructor: Cohort dashboard → Portfolio view         │
│          ├── org_admin: Org dashboard → Marketplace admin          │
│          └── platform_admin: Admin dashboard → System settings     │
│                                                                    │
│  UI standards enforced via:                                        │
│    - PageHeader (96px sticky, breadcrumbs, chips, actions)         │
│    - CompactCourseHeader (course view, expandable meta drawer)     │
│    - DueTodayCard (inline due list, no popup)                      │
│    - states.tsx (SkeletonPanel / EmptyState / ErrorState)          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                       API ROUTES (src/app/api)                     │
│                                                                    │
│  /api/today/summary      — TodayView data (one round-trip)         │
│  /api/daily-tasks        — legacy reminder data (deprecating)      │
│  /api/ai/practice        — practice question generation            │
│  /api/ai/daily-test      — daily test (3 Qs, Socratic)             │
│  /api/ai/weekly-test     — weekly test (10 Qs, Socratic)           │
│  /api/ai/tutor           — free-form tutor chat (planned stream)   │
│  /api/ai/grader          — unified grader endpoint                 │
│  /api/health/cron        — cron heartbeat (must ping on success)   │
│  /api/enrollments        — B2B + B2C enrollment management         │
│  /api/marketplace/*      — course catalog + checkout               │
│  ...76 total route files (see `scripts/ui-backend-audit.sh` G)     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                    LIBRARIES (src/lib)                             │
│                                                                    │
│  ai-provider.ts     — callAI() + TOKEN_BUDGET + provider chain     │
│  ai-rate-limits.ts  — per-user daily + RPM/RPD + demo gating       │
│  ai-prompts.ts      — every system prompt (one file)               │
│  unified-grader.ts  — gradeOneQuestion + gradeTest + explanations  │
│  learning-signal.ts — transparent 0-100 score (formula)            │
│  plagiarism-scoring.ts — plagiarism detection + deduction          │
│  course-db.ts       — course / week / topic / phase lookups        │
│  course-config.ts   — per-course test config + AI prompt overrides │
│  rbac.ts            — role definitions + can() helper              │
│  auth.ts            — custom JWT auth (no next-auth)               │
│  audit-log.ts       — privileged action audit trail                │
│  logger.ts          — structured logger (warn/error/info)          │
│  constants.ts       — TEST_QUESTION_COUNT, GRADING, PILLARS,       │
│                       MARKETPLACE_CATEGORIES (single source)       │
│  feature-flags.ts   — runtime feature toggles                      │
│  demo-guard.ts      — demo-account write protection                │
│  learner-xp.ts      — Evidence-Locked XP system (awards, levels)   │
│  use-streaming-ai.ts — React hook for SSE AI streaming             │
│  use-pwa.ts         — PWA hook (SW registration, install prompt)   │
│  content/copy.ts    — Centralized marketing + UI voice constants   │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                    DATA LAYER (Prisma + DB)                        │
│                                                                    │
│  prisma/schema.prisma       — dev schema (SQLite)                  │
│  prisma/schema.prod.prisma  — prod schema (PostgreSQL)             │
│  ⚠ drift risk — CI schema-diff check planned                       │
│                                                                    │
│  Key tables: User · Enrollment · DailyTest · WeeklyTest ·          │
│  DrillCard · ProjectTask · Message · AuditLog · FeatureFlag ·      │
│  AICache · CronHeartbeat (planned)                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module map

### `src/components/ui/`

Shadcn/ui primitives + the new standards kit. Every panel must use these —
no bespoke hero sections, no ad-hoc padding.

- `PageHeader.tsx` — 96 px sticky header (the standard).
- `states.tsx` — `SkeletonPanel`, `EmptyState`, `ErrorState`.
- `skeleton.tsx`, `empty-state.tsx` — older shadcn versions, kept for compat.
- `alert-dialog.tsx` — used for destructive-action confirmations.

### `src/components/examiner/`

Role-specific top-level components.

- `AppShell.tsx` — SPA shell, sidebar, theme provider, ⌘K + `?` shortcuts.
- `StudentDashboard.tsx` — 4 views (Today, Study, Project, Progress) +
  Credentials + My Courses.
- `InstructorDashboard.tsx` — 5 tabs (Today, Students, Assignments, Insights,
  Earnings). Insights + Analytics merged. Certificates as own nav entry.
- `AdminDashboard.tsx`, `OrgAdminDashboard.tsx`, `EmployerDashboard.tsx`
  (now wired as "Sponsor ROI" sidebar entry for org_admin).
- `AITutor.tsx` — streaming AI tutor (uses `useStreamingAI()` hook).
- `ErrorBoundary.tsx` — top-level error catch.

### `src/components/shared/`

Shared modernization components — the "modern SaaS baseline" kit.

- `dashboard-shell.tsx` — `DashboardHeader`, `DashboardShell`, `DashboardLoading`,
  `DashboardError`. Every role dashboard uses these for the 96px sticky header +
  consistent loading/error states.
- `stat-card.tsx` — `StatCard` + `StatStrip`. The standard stat card with tone
  (default/success/warning/danger/info), icon, progress bar, optional onClick.
- `command-registry.tsx` + `command-palette.tsx` — global ⌘K palette. Pages
  register commands via `useRegisterCommands()`.
- `keyboard-shortcuts-help.tsx` — press `?` anywhere to see the cheat sheet.
- `typing-indicator.tsx` — three bouncing dots for streaming AI responses.
- `learner-xp-bar.tsx` — Evidence-Locked XP bar (learners only).
- `prominent-tabs.tsx` — the standard tab bar (pill + underline variants).
- `action-dialog.tsx` — confirmation dialog for destructive actions.
- `collapsible-card.tsx` — collapsible card with localStorage persistence.

### `src/components/examiner/student/`

The student-facing panels — consolidated around TodayView.

- `TodayView.tsx` — the home view. Mounts `DueTodayCard` + `LearnerXPBar` +
  `StreakCalendar` + learning signal + drill count.
- `DueTodayCard.tsx` — inline due list (replaces DailyTaskReminder popup).
- `OnboardingGuide.tsx` — first-run guide.
- `PracticePanel.tsx`, `DailyTestPanel.tsx`, `WeeklyTestPanel.tsx` — tests.
- `CheckInPanel.tsx` — daily standup.
- `GanttPanel.tsx`, `CompactGantt.tsx` — project view (consolidation planned).
- `ReportCardPanel.tsx`, `GrowthReportPanel.tsx` — progress view.
- `ComprehensiveReportView.tsx` — full portfolio report.

### `src/components/examiner/course/`

Course-view standards. Currently:

- `CompactCourseHeader.tsx` — the 96 px course header (replaces oversized
  hero).

### `src/modules/`

Domain-organised modules. Each module groups related logic + components + lib.

- `src/modules/assessment/` — test engine, grader, chat UI.
  - `lib/unified-test-engine.ts` — `PRACTICE_CONFIG`, `DAILY_TEST_CONFIG`,
    `WEEKLY_TEST_CONFIG` (uses `TEST_QUESTION_COUNT`).
  - `lib/unified-grader.ts` — `gradeOneQuestion`, `gradeTest`, explanations.
  - `components/TestChatUI.tsx` — shared chat UI for all test types.
  - `components/WeeklyTestPanel.tsx` — weekly test wrapper.
- `src/modules/project/` — capstone project module.
- `src/modules/marketplace/` — course catalog + checkout.

### `src/lib/`

Pure logic, no React. Documented in section 1 above.

### `src/app/api/`

76 route files. The audit script (section G) lists routes that take `userId`
vs routes that have an `assertCanAccessStudent` IDOR guard. The gap (76 vs 23)
is tracked as a security-debt line item.

---

## 3. API route inventory

Run `scripts/ui-backend-audit.sh` for the live count. The full inventory is
auto-generated into this section by the audit script when it runs in
`--inventory` mode (planned). For now, the categories are:

| Prefix | Purpose | Auth | Rate-limited |
|---|---|---|---|
| `/api/ai/*` | AI calls (practice, daily, weekly, tutor, grader) | JWT | yes (per-user daily + RPM/RPD) |
| `/api/today/*` | Today view data | JWT (student) | no |
| `/api/daily-tasks` | Legacy reminder data | JWT (student) | no |
| `/api/enrollments` | B2B + B2C enrollments | JWT | no |
| `/api/marketplace/*` | Course catalog + checkout | JWT (public read) | yes (checkout) |
| `/api/stripe/checkout` | Stripe Checkout session creation | JWT | no |
| `/api/stripe/webhook` | Stripe webhook (enroll after payment) | Stripe signature | no |
| `/api/admin/*` | Admin operations | JWT (admin) | no |
| `/api/health/cron` | Cron heartbeat | cron secret | no |
| `/api/users/*` | User management | JWT + IDOR guard | no |
| `/api/courses/*` | Course CRUD | JWT (org_admin) | no |
| `/api/ai/tutor/stream` | Streaming AI tutor (SSE) | JWT (student) | yes (per-user daily) |
| `/api/offline/sync` | Offline evidence queue sync | JWT (student) | no |
| `/api/learner/xp` | Learner XP total + level + progress | JWT (learner) | no |
| `/api/today/summary` | Today view data (due items + signal) | JWT (student) | no |

Every `?userId=` route must run `assertCanAccessStudent` (IDOR guard). The
audit script flags files in list 1 that don't have a guard.

---

## 4. Data model (key tables)

```
User
 ├─ Enrollment ─── Course ─── CourseWeek ─── CourseTopic
 │                                              │
 ├─ DailyTest ── DailyTestReply                 │
 ├─ WeeklyTest ── WeeklyTestReply               │
 ├─ DrillCard (spaced repetition)               │
 ├─ ProjectTask ── ProjectTaskComment           │
 ├─ Message (mentor ↔ learner)                  │
 ├─ DailyLog (streak data)                      │
 ├─ AICache (per-prompt cache, 1h TTL)          │
 └─ AuditLog (privileged actions)               │
                                                │
Org ─── OrgMember ─── Cohort ──────────────────┘
 │
 └─ FeatureFlag (per-org overrides)
```

### Schema drift

`prisma/schema.prisma` (dev, SQLite) and `prisma/schema.prod.prisma` (prod,
PostgreSQL) can drift. Mitigations:

- CI check: `prisma migrate diff` runs on every PR.
- Long-term: single schema + provider switch (planned).

Until then, every model change must be applied to both schemas.

---

## 5. AI provider chain

```
Component (e.g. WeeklyTestPanel)
  │
  ▼
api-client.ts — fetch with timeout + JSON parse
  │
  ▼
/api/ai/weekly-test/route.ts
  │
  ├─ demoWriteBlock()  — demo accounts blocked from AI writes
  ├─ isFeatureEnabled("ai_enabled")
  ├─ isDemoAIBlocked()  — admin can disable AI for demo users
  ├─ checkUserAILimit() — per-user daily + RPM/RPD
  │
  ▼
ai-provider.ts · callAI()
  │
  ├─ prompt template (from ai-prompts.ts or course-config.ts)
  ├─ TOKEN_BUDGET enforcement
  ├─ AICache lookup (1h TTL, per-prompt key)
  │
  ▼
DeepSeek API (or fallback provider)
  │
  ▼
Response → sanitizeExaminerText() → caller
```

Failures return `{ degraded: true, error: "..." }` to the UI — never a canned
reply. The UI shows an `ErrorState` with a Retry button (planned: streaming +
typing indicator for the test chat).

---

## 6. Cron jobs

Scheduled via Vercel Cron (see `vercel.json`). Each cron must:

1. Run its job.
2. POST to `/api/health/cron` with the job name + status.
3. The health endpoint records a `CronHeartbeat` row.
4. A separate alert cron checks for missed heartbeats (> 2 cycles late) and
   pings the platform admin.

Current crons:

| Cron | Schedule | Purpose |
|---|---|---|
| `daily-test-gen` | 02:00 daily | Pre-generate today's daily test topics |
| `drill-scheduler` | 03:00 daily | Mark drill cards due for spaced repetition |
| `alert-check` | every 30 min | Scan for red-tier learners, notify mentors |
| `escalation` | 09:00 daily | Escalate unaddressed alerts to coordinators |
| `heartbeat-check` | every 15 min | Detect missed cron heartbeats |

The `CronHeartbeat` table is planned (currently crons fail silently — see
`ERROR-HANDLING.md`).

---

## 7. Build & deploy

- **Dev**: `npm run dev` (Next.js on port 3000, SQLite).
- **Build**: `npm run build` — must pass `tsc --noEmit`, `lint`, `test`,
  `build` (the four gates in the audit script section H).
- **Deploy**: Vercel. `scripts/vercel-build.sh` handles Prisma generate +
  schema push + build.
- **DB push (prod)**: `npm run db:push:prod` — uses `schema.prod.prisma`.
- **DB migrate (prod)**: `npm run db:migrate:prod` — deploy mode.

`ignoreBuildErrors: false` and `reactStrictMode: true` are enforced. Any
PR that flips either is rejected in review.
