# TraineesAI

**AI-driven training platform for engineering internees.**

AI teaches. AI tests. Human mentors. The training platform that takes the training burden off busy engineers and managers.

## What is this?

TraineesAI is the modernized successor to [ExaminerAI](https://github.com/fccljbplant/ExaminerAI). It's a Next.js SaaS platform designed for a specific problem in industry:

> When a new internee or trainee joins, engineers and management don't have time to train them. This platform shifts the training burden to AI — AI teaches, AI tests, AI tracks progress. The human mentor only steps in when AI flags a student needs help.

## Modernization status — ALL PHASES COMPLETE ✅

| Phase | What | Status |
|---|---|---|
| **Phase 1** | Strip behavioral/psychological surveillance layer (~2,368 lines removed) | ✅ Complete & deployed |
| **Phase 2** | Modern training engine (adaptive difficulty, learning signal, JSON mode, drills, TodayView) | ✅ Complete & deployed |
| **Phase 3** | Slide viewer + proactive AI tutor (on-the-fly slide generation) | ✅ Complete & deployed |
| **Phase 4** | Instructor experience (already adequate after Phase 1 cleanup) | ✅ Complete |
| **Phase 5** | Rename to TraineesAI + final polish | ✅ Complete & deployed |

See **[MODERNIZATION_PLAN.md](./MODERNIZATION_PLAN.md)** for the full execution plan.

## Redesign status (2026-08-14) — W0–W4 learner core shipped

The platform-wide redesign (strangler pattern, feature-flagged) is specified in
[`docs/REDESIGN-P1…P7-2026-08-14.md`](./docs/REDESIGN-P1-INVENTORY-2026-08-14.md):

| Workstream | Scope | Status |
|---|---|---|
| **W0** | Token theme engine (3-layer, WCAG-validated), `modules/ui` kit, adaptive `modules/shell` (top nav / tabs / bottom nav), auth screens, CI gates | ✅ live behind `shell_v2` |
| **W1** | Learner portal routes + v2 endpoints, classroom polish | ✅ behind `portal_learner_v2` |
| **W2** | Floating tutor (vector rig, drag/dock/persist, state machine) | ✅ inside `portal_learner_v2` |
| **W3** | Study-flow engine (6 scenarios), SRS, diagnostic, L12 Study-Flow Center, crons | ✅ behind `study_flow_v2` |
| **W4** | Assignments & projects: registry, submission lifecycle, rubric engine, text-only AI pipeline, L5 list + L6 submission flow, **instructor review center (I3/I4)** | ✅ behind `submissions_v2` |
| **W5** | Exams: unified runner (L9) with autosave/resume + results review (L10), ExamSession model, exam-schedule session CTAs | ✅ learner slice behind `exams_v2` |
| **W6** | Instructor portal: I1 home (queue + at-risk KPIs), I5 students roster, I8 analytics, I10 earnings, More hub; studio (I2) placeholder | ✅ core behind `portal_instructor_v2` |
| **W7** | Org portal (O1 home, O2 people + RBAC-ready, O4 control w/ live brand derivation, O5 audit + CSV) + Platform portal (P1 home, orgs table) | ✅ core behind `portal_org_v2` / `portal_platform_v2` |
| **W8–W10** | Gamification restyle · public restyle · cutover & deletion | 🔲 next |

Every workstream gates behind a portal flag (org override > global) and fails
closed to the legacy `/app` experience until flipped — see
`docs/REDESIGN-P5-CUTOVER-PLAN-2026-08-14.md` for the rollback strategy.
Production flags can be flipped by a platform admin via `POST /api/admin/portal-flags`
(or by inserting `feature_portal_*_v2` Setting rows directly — per-org overrides
are managed in Platform → Tenants).

## SaaS platform expansion (2026-08-17) — one core, two storefronts

- **Multi-tenant core**: `Organization` lifecycle (trial/active/suspended) in
  Platform → Tenants; seat enforcement on invites; per-org feature-flag
  overrides (pilot rollouts); platform/admin guard separation.
- **Creator economy**: course ownership + instructor course studio with
  drafts; Stripe Connect onboarding and a payout ledger; per-instructor
  earnings attribution; coupon engine (validate at checkout, usage tracked);
  refund handling.
- **B2B ops**: departments with auto-assign course rules; CSV roster import;
  compliance expiry matrix with nudges; seat subscriptions ($29/seat/mo) with
  invoices + dunning; org announcements.
- **AI engine**: RAG tutor (course material indexed as cited chunks — Z.ai
  embeddings with keyword fallback), instructor material uploads,
  quiz-from-module generation, roleplay simulator with rubric scoring,
  per-org AI budgets with alerting.
- **SaaS admin (control plane)**: tenants (lifecycle + approval gate at login), revenue & payouts ledger (MRR, fees, sweep, refunds), support login-as (audited, with
  exit), revenue/coupon/payout oversight, AI governance, server-side audit
  export, feature rollout matrix.
- **Schema**: `prisma/schema.prisma` is the single source of truth;
  `schema.prod.prisma` (Postgres) and `prisma/.demo.prisma` (SQLite demo)
  are generated from it (`scripts/generate-derived-schemas.mjs`). All
  changes are additive — `prisma db push` never runs with
  `--accept-data-loss`.

## Key features

### Learn Platform (`/learn`) — AI-guided learning experience
- **Learner-paced progression** — weeks and days organize content for MANAGEMENT (Course Planner); the LEARNER sets the pace. One topic or three in a day — progress is tracked per topic in `LearnProfile.masteryMap`, never by the calendar
- **Test rhythm, in sequence** — every study session ends with a daily test (3 Qs on today's topic + 1 spaced-repetition); the weekly test (10 Qs) for week W unlocks once the learner has REACHED week W's last day (server-enforced). Daily → weekly, always in course order
- **AI Tutor avatar** — sprite player + lip-sync + floating dock, driven by `tutor.say/play/caption` event bus
- **h-screen shell** — no vertical page scroll; status strip + activity bar + slide canvas + chat pane
- **4 panels** — Journey (topic map), Project (create + milestones + hint ladder), Grow (daily test UI + XP + badges), Library (resources + notes)
- **Gamification** — XP ledger (slide +5, probe +10, quiz +15, daily +30, weekly +100, course +500), 7 levels (Rookie → Legend), timezone-safe streaks
- **Daily tests** — 3 conversational questions with AI evaluation + teaching feedback
- **Adaptive difficulty** — question difficulty (1–5: Warm-up → Core → Stretch → Advanced → Expert) adapts to the learner's recent daily/weekly test scores per course (`learner-difficulty.ts`); directives ride in the generation prompt so the token cache shards per level
- **Project guidance** — hint ladder (nudge → clue → scaffold), never gives the full answer first

### For students (trainees)
- **TodayView** — one screen answering "what do I do next?"
- **SlideViewer** — on-the-fly slide generation from course content (video, code, visual, activity, reflection)
- **Adaptive difficulty** — questions scale 1-5 to the learner's demonstrated level (recent test performance + explicit confidence in the legacy path)
- **DrillCard spaced repetition** — wrong answers come back until mastered
- **AI Tutor panel** — persistent right-side chat with proactive bubbles, knows which slide you're on
- **Socratic testing** — daily tests (3 Qs) + weekly tests (10 Qs), not MCQs
- **Project-based learning** — AI-generated capstone tasks, Gantt chart, milestones

### For instructors (mentors)
- **Today tab** — students needing attention, recent submissions
- **Students roster** — sorted by academic attention score (no psych signals)
- **Assignments** — group tasks + peer assessment
- **Insights** — operational analytics
- **Messages** — in-app messaging with students
- **Grade overrides** — human-in-the-loop on AI-graded answers

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Prisma 6 (SQLite dev / Postgres prod)
- **AI**: DeepSeek (primary) + Z.ai GLM (fallback)
- **UI**: Tailwind 4 + shadcn/ui + Radix primitives
- **Auth**: Custom JWT + bcrypt
- **Hosting**: Vercel

## Quick Start (local dev)

Prerequisites: Node.js 20+, Bun (preferred) or npm.

```bash
# 1. Install dependencies
bun install            # or: npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — for local dev, the default SQLite URL works out of the box:
#   DATABASE_URL=file:./db/custom.db

# 3. Initialize the database (SQLite dev schema)
bun run db:generate    # generate Prisma client
bun run db:push        # create/migrate SQLite schema

# 4. (optional) Seed demo data
bun run db:seed

# 5. Start the dev server
bun run dev            # http://localhost:3000
```

For production (Vercel), use Postgres and the production Prisma schema:

```bash
bun run db:generate:prod
bun run db:push:prod
```

See `.env.example` for details on switching DATABASE_URL from SQLite to Postgres.

## License

Proprietary. © fccljbplant.
