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
│                                                                    │
│  /api/v2/*  (REDESIGN strangulation surface, envelope {ok,data})   │
│    learner/home|progress · courses(+tabs) · study-plan · srs/queue │
│    srs/[cardId]/review · diagnostic/start|answer · exams(+[id]/    │
│    start|resume|answer|complete|results) · tutor/ask (SSE) ·       │
│    events · assignments(+draft|submit) ·                           │
│    submissions/[id]/resubmit|feedback · uploads (docx/pdf→text)    │
│  /api/cron/* (W3): study-plan-refresh 06:00 · absence-scan 07:00 · │
│    srs-due 03:00 — all verify via src/lib/cron-auth.ts             │
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

- `AppShell.tsx` — SPA shell. Learners get a horizontal top bar
  (`LearnerTopNav.tsx`); staff roles keep the sidebar. Theme provider,
  ⌘K + `?` shortcuts.
- `LearnerTopNav.tsx` — Star Admin-style top bar for learners: course
  switcher, horizontal nav, ⌘K search box, theme toggle, notifications,
  view-as-role, profile menu.
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
- `widget-card.tsx` — `WidgetCard`. Panel with title bar, optional subtitle,
  "…" menu, `actions`, padded or `flush` body. The standard dashboard panel.
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

- `src/modules/assessment/` (legacy engine, kept) — test engine, grader, chat UI.
  - `lib/unified-test-engine.ts` — `PRACTICE_CONFIG`, `DAILY_TEST_CONFIG`,
    `WEEKLY_TEST_CONFIG` (uses `TEST_QUESTION_COUNT`).
  - `lib/unified-grader.ts` — `gradeOneQuestion`, `gradeTest`, explanations.
  - `components/TestChatUI.tsx` — shared chat UI for all test types.
  - `components/WeeklyTestPanel.tsx` — weekly test wrapper.
- `src/modules/project/` — capstone project module.
- `src/modules/marketplace/` — course catalog + checkout.

### REDESIGN modules (W0–W4, strangulation surface)

The redesign rebuilds modules under `src/modules/` (specs:
`docs/REDESIGN-P1…P7-2026-08-14.md`). Old `components/examiner/**` is deleted
at cutover (W10).

- `src/modules/ui/` — the component library (moved from `components/ui` +
  `shared`, tokens-only). New W4 primitives: `media-capture.tsx`,
  `submission-renderer.tsx` (renders ANY part type, text-only AI law),
  `rubric-grader.tsx` (AI-draft "verify" chip), `feedback-thread.tsx`
  (text/audio/annotation), `sign-off-card.tsx` (ordered chain).
- `src/modules/theme/` — 3-layer token engine (`tokens/primitives.css`,
  `semantic.css`, `component.css`), org-brand derivation in OKLCH,
  `lib/validate.ts` WCAG validator, `lib/brand.ts` deriveBrandPalette.
- `src/modules/shell/` — adaptive shell: `TopNav` / `TabRow` / `BottomNav`
  (5 slots) / `ActionBar` / `ModeToggle`, keyed by `use-breakpoint.ts`.
- `src/modules/tutor/` — FloatingTutor: `vector-rig.tsx`, `floating-tutor.tsx`,
  `tutor-store.ts` (zustand persist), `lib/dock.ts` (drag/dock state machine).
- `src/modules/learn/` — classroom + study-flow engine:
  `lib/study-flow.ts` (detectAbsence/Cram, generatePlan, srsSchedule — pure),
  `lib/study-flow-db.ts`, `components/study-flow/*` (StudyFlowCenter etc.).
- `src/modules/submission/` — W4: `contracts.ts` (zod, shared route↔client),
  `lib/lifecycle.ts` (status machine + sign-off chains), `lib/rubric-engine.ts`
  (weighted grading, human-beats-AI), `lib/ai-packet.ts` (text-only packet),
  `lib/text-extract.ts` (mammoth/pdfjs in-house), `lib/submission-db.ts` (the
  ONLY file importing `db`), `lib/submission-flag.ts` (single flag source),
  `__tests__/` (58 tests).
- `src/modules/assessment/` — test engine + **W5 exam runner**:
  `contracts.ts` (slug helpers + zod), `lib/exam-session.ts` (pure state
  machine: upsertAnswer, computeScore, completion guards — 13 tests),
  `lib/exam-session-db.ts` (ONLY db file: lazy weekly question generation,
  graded autosave, complete→XP+notification+Learn-row sync),
  `lib/exam-flag.ts` (`exams_v2`), `lib/http.ts`; reuses
  `unified-test-engine.ts` gradeOneQuestion + `ai-json.ts` callAIJson.
- `src/modules/learner-portal/` — W1 screens composing the kit: home, catalog,
  course-detail, exams, progress, profile, help, assignments (L5),
  submission-flow (L6), exam-runner (L9: autosave/resume/offline queue,
  nav-hidden via body[data-exam]), exam-results (L10: ring + review accordion),
  `use-api.ts` hook.

Every v2 surface gates through a per-workstream flag helper
(`lib/feature-flags.ts` `isPortalEnabled`) and fails closed to `/app`.

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

---

## 8. Learn Platform (`/learn`)

The Learn Platform is a **separate AI-guided learning experience** that lives
alongside the old `/app` dashboard. The old platform keeps working unchanged;
the learn platform extends the codebase with new routes, models, and UI.

### 8.1 Routes

| Route | Description |
|---|---|
| `/learn` | Learner home — "Continue Learning" hero + stats chips + catalog |
| `/learn/[courseId]` | h-screen session shell (slides + avatar + chat + panels) |
| `/dashboard` | 301 redirect → `/learn` |
| `/login` | 301 redirect → `/app` |
| `/register` | 301 redirect → `/app` |

### 8.2 Module structure

```
src/modules/learn/
  ├── index.ts                    ← Barrel re-exports (mixes server/db code —
  │                                   client components import specific paths,
  │                                   never the barrel root)
  ├── types/index.ts              ← Shared types + constants
  ├── lib/
  │   ├── today-topic.ts          ← Topic progression (30 topics, 4 slides each)
  │   ├── xp-ledger.ts            ← Append-only XP ledger + level calculation
  │   ├── learner-profile.ts      ← Profile CRUD + streak management
  │   ├── tts-filter.ts           ← TTS text preparation (strips code/URLs/tables)
  │   ├── lesson-media.ts         ← Resolves slide/video media for a topic
  │   ├── voice-input.ts          ← Web Speech API wrapper (barge-in, text fallback)
  │   └── youtube-player.ts       ← YouTube id parsing + embed URL builder
  └── components/
      ├── classroom/              ← Modern Class stage: ClassroomShell,
      │                             LessonStage, VideoStage, AvatarStage, VoiceBar
      ├── avatar/                 ← Avatar rig + expressions
      └── dashboard/              ← LearnerHome (stat tiles, assignments,
                                      coverage, project, activity)
```

### 8.3 API endpoints (16 routes under `/api/learn/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/learn/enroll` | POST | Atomic create: profile + journey + project |
| `/api/learn/now` | GET | Aggregated NOW data (next step + stats) |
| `/api/learn/today` | GET | Today's topic + slide progress |
| `/api/learn/today/next-slide` | POST | AI on-the-go slide generation |
| `/api/learn/today/complete` | POST | Mark topic done + advance |
| `/api/learn/sessions/[id]/ask` | POST | RAG-grounded tutor Q&A |
| `/api/learn/daily-test/[date]/start` | POST | Start 3-Q daily test |
| `/api/learn/daily-test/[date]/answer` | POST | Evaluate answer |
| `/api/learn/projects` | GET/POST | List + create projects |
| `/api/learn/projects/[id]/help` | POST | Hint ladder (nudge → clue → scaffold) |
| `/api/learn/projects/[id]/milestones/complete` | POST | Mark milestone done + 15 XP |
| `/api/learn/me/xp` | GET | XP history |
| `/api/learn/me/badges` | GET | User badges |
| `/api/learn/me/journey` | GET | Journey map |
| `/api/learn/notes` | GET/POST | Notes CRUD |
| `/api/learn/resources` | GET | Resources for a slide |

### 8.4 Data models (15 new Prisma models)

`LearnProfile`, `JourneyPlan`, `JourneyStep`, `LearnSlide`, `LearnNarration`,
`TutorSession`, `TutorMessage`, `LearnDailyTest`, `LearnWeeklyTest`,
`LearnProject`, `ProjectMilestone`, `ProjectHelpSession`, `XPLedger`,
`BadgeDefinition`, `UserBadge`, `LearnNote`, `EngagementEvent`.

### 8.5 Avatar system

`src/components/learn/TutorAvatar.tsx` — a complete in-house avatar system:
- Sprite-strip player (15 gestures + 3 talk loops)
- Amplitude lip-sync (real audio analysis, simulated fallback)
- Event bus: `tutor.say()`, `tutor.play()`, `tutor.caption()`, `tutor.bindAudio()`
- Non-intrusive floating dock (full/mini/dot, drag+snap, position memory)
- Procedural placeholder (zero assets needed — works today)

### 8.6 UI Shell v2

`src/components/learn/LearnShell.tsx` — `h-screen overflow-hidden` shell:
- Status strip (12px): breadcrumb chip + XP chip + streak chip + focus toggle
- Activity bar (72px): Journey / Project / Grow / Library
- Slide canvas (center): today's topic banner + progress dots + slide content
- Quick bar: contextual CTA (Next Slide / View Resources / Complete & Next Topic)
- Chat pane (right): transcript + input
- Panel drawers: slide-over left 40% desktop, full-screen mobile

### 8.7 Modern Class (Classroom stage)

The classroom rebuilds the lesson experience as a "modern class": the AI
teacher presents slides or curated videos beside a teaching avatar, and the
learner asks questions by voice or text.

| Component | File | Role |
|---|---|---|
| `ClassroomShell` | `components/classroom/ClassroomShell.tsx` | `h-screen` frame: stage + avatar + chat rail |
| `LessonStage` | `components/classroom/LessonStage.tsx` | Slide renderer + media switcher (slides ↔ video) |
| `VideoStage` | `components/classroom/VideoStage.tsx` | YouTube embed wrapper with avatar intro/recap hooks |
| `AvatarStage` | `components/classroom/AvatarStage.tsx` | Teaching avatar beside the stage |
| `VoiceBar` | `components/classroom/VoiceBar.tsx` | Push-to-talk voice Q&A (Web Speech API) with text fallback |

Flows:

- **Media resolution**: `getLessonMedia(topic)` picks the first YouTube
  resource for the topic (label → video title); topics without one render
  slides only.
- **Voice**: `voice-input.ts` accumulates final transcripts, emits one
  utterance on end, fires `onSpeechStart` for barge-in, and degrades to the
  text input when SpeechRecognition is unavailable or permission is denied.
- **Learner home**: `LearnerHome` mounts below `TodayView` in
  `StudentDashboard` using the shared widget kit (`StatCard` strip,
  `WidgetCard` panels for assignments, course coverage, project progress,
  activity). Course switching refetches via `onSelectCourse`.

## 9. Living Portrait Tutor Badge (`TutorBadge.tsx`)

The avatar system was redesigned from baked-3D sprites to a "Living Portrait" approach:
ONE locked face photo + 100% code-driven animation. The face never changes; the code
does the acting via SVG overlays, FX particles, mood rings, and props.

### 9.1 Architecture

```
public/assets/avatar/v1/
  ├── face.png              ← ONE locked face photo (never regenerated)
  ├── face-config.json      ← Calibration data (eye/mouth/brow positions, crop)
  ├── expressions.json      ← 20 expression recipes (brows, eyes, mouth, FX, ring, motion)
  └── calibration.html      ← Drag-reticle tool for calibrating any face photo
```

### 9.2 Layer Anatomy (back → front)

| Layer | Purpose | Implementation |
|---|---|---|
| 0 | Circle frame + mood ring | CSS border (emotion color) |
| 1 | Inner backdrop | CSS radial gradient |
| 2 | Face photo | `<img>` circular crop, breathing scale, micro-nod |
| 3 | Brows overlay | Inline SVG (6 shapes: neutral/raised/furrowed/one-up/empathetic/in-down) |
| 4 | Eyes overlay | Inline SVG (10 shapes: open/blink/happy-arc/wide/wink/closed-arc/gaze variants) |
| 5 | Mouth overlay | Inline SVG (9 shapes: hidden/closed/smile/mid/wide/laugh/o/soft-smile/closed-firm) |
| 6 | FX layer | Emoji + CSS particles (sparkle/confetti/heart/star/fire/blush) |
| 7 | Props layer | Emoji hands/objects (wave/fist) sliding from circle edge |
| 8 | Shine layer | CSS gradient sweep for glasses glint on "idea" moments |
| 9 | Outside circle | Caption bubble + CSS sphere shadow |

### 9.3 Event Wiring

The `tutor` event bus maps tutor engine events to expression recipes:

| Event | Recipe | Description |
|---|---|---|
| `session:start` | hello | Greeting with wave prop |
| `tts:start` | talk | Amplitude-synced mouth + micro-nod |
| `tts:end` | idle | Return to breathing idle |
| `student:input` | listen | Tilt + gaze toward learner |
| `tutor:thinking` | think | Gaze up-left + question FX |
| `slide:highlight` | idea | Glasses glint + scale-pop |
| `answer:correct` | praise | Happy eyes + sparkle FX |
| `answer:wrong` | comfort | Empathetic brows + heart FX |
| `badge` / `xp` | celebrate | Confetti + bounce |
| `motivate` | determined | Fist prop + orange-red ring |
| `level:up` | levelup | Gold ring burst + confetti + jump |
| `streak:day` | streak | Fire orbiting FX |
| `session:end` | bye | Slow wave + fade-tilt |

### 9.4 Calibration

The `calibration.html` tool lets institutions plug in ANY real teacher photo:
1. Replace `face.png` with the teacher's photo
2. Open `calibration.html` — drag 6 reticles (2 eyes, 2 brows, mouth center, mouth width)
3. Adjust crop circle sliders
4. Click SAVE → generates `face-config.json`
5. The badge reads the config — zero code changes needed

### 9.5 Consistency Guarantee

The face is 100% real and 100% identical every session/device/year because:
- The photo is a single locked asset (checksummed)
- All animation is code-driven (SVG overlays, CSS, emoji)
- Zero AI regeneration at runtime
- Zero raster assets beyond the one face photo
