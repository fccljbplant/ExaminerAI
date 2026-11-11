> **Current owner decision (2026-11-11):** The previous blanket no-merge rule is superseded. Consolidate all useful existing branches into `main`, then stabilise the application. Follow the current rules in [`AGENTS.md`](./AGENTS.md) and [`docs/agent-pack/SAFETY.md`](./docs/agent-pack/SAFETY.md): inventory first, merge unique useful work only, avoid duplicate ancestry, preserve source branches, do not force-push, and keep production DB operations/deployment separately gated. Historical text below is retained as context, not current merge authority.

# Agent Instructions — READ THIS FIRST at the start of every session

> Maintained repository agent pack: read [`AGENTS.md`](./AGENTS.md) and [`docs/agent-pack/README.md`](./docs/agent-pack/README.md) after this file. These canonical files replace any need to maintain a local agent archive.

> **CRITICAL:** This file exists because the sandbox environment can reset
> between sessions, wiping the working directory and rolling back git.
> This file is committed to GitHub and survives resets. Read it FIRST.

## The Problem

The sandbox environment resets between sessions:
- Working directory gets wiped (all source files disappear)
- Git gets rolled back to old commits
- Uncommitted changes are lost
- The agent forgets its own workflow rules

This has caused code destruction, old+new code mixing, and lost work.

## The Workflow (FOLLOW STRICTLY)

### 1. Establish repository state before editing

- Confirm the repository, branch, current commit, and working-tree state.
- Never assume a local workspace or dev server survived between sessions.
- Inspect the current source before applying a patch; do not restore or reset blindly.

### 2. Protect data and credentials

- Never run destructive database commands (including force resets, schema drops, or production syncs) without explicit owner approval for the exact target and operation.
- Never put access tokens, passwords, or credentials in source files, documentation, Git remotes, shell history, logs, or chat messages.
- Use the platform's approved secret manager or environment-variable mechanism.
- Treat demo credentials as sensitive unless they are confirmed to be synthetic and intentionally public.

### 3. Make changes on a dedicated branch

- Do not push directly to `main`.
- Use a descriptive feature/fix branch and keep changes scoped.
- After each coherent change, review the diff and run the relevant checks.
- Open a pull request with a summary, test evidence, risks, and any manual verification still required.
- Do not merge or deploy without the repository owner's approval.

### 4. Verify before reporting completion

- Run the available typecheck, lint, unit tests, and production build.
- Run browser and accessibility checks when the environment supports them.
- Clearly distinguish checks that passed from checks that could not be run.
- Do not claim a page was visually inspected unless it was actually opened and tested in a browser.

## Project: ExaminerAI

- **GitHub:** https://github.com/fccljbplant/ExaminerAI
- **Vercel:** examiner-ai-tau.vercel.app (stable URL)
- **Operator:** Inzet Enterprises · inzet.enterprises@gmail.com
- **Tech stack:** Next.js 16, Prisma, PostgreSQL (Neon on Vercel), shadcn/ui

## Learn Course Model (do not misdocument — user-confirmed 2026-09)

- **Weeks/days are a MANAGEMENT structure**, not a calendar. CourseWeek/CourseDay
  (e.g. 6 weeks × 5 days) exist so management can organize content in the Course
  Planner. The LEARNER sets the pace: finishing three days' topics in one day is
  normal. Progression is tracked per topic in `LearnProfile.masteryMap`
  (`current` / `history` / `furthest`) — never by calendar dates.
- **Test rhythm is IN SEQUENCE (already implemented):**
  1. Every study session ends with a **daily test** (3 Socratic questions:
     2 on today's topic + 1 spaced-repetition) → `/api/learn/daily-test/[date]/*`.
  2. The **weekly test** (10 questions covering the week's days) for week W
     unlocks when the learner has REACHED the last day of week W — the classroom
     offers it at the week's final day (`weeklyDue` in ClassroomShell) and the
     API enforces it server-side (`learnerReachedTopic` guard in
     `/api/learn/weekly-test/[week]/start`, error code `OUT_OF_SEQUENCE`).
  - "Test after 5 or 6 days" = after the week's 5–6 days of CONTENT are done
    (learner-paced), NOT after 5–6 calendar days.
- **Question difficulty adapts to the learner** (1–5: Warm-up / Core / Stretch /
  Advanced / Expert) from their recent daily+weekly test scores per course —
  `src/modules/learn/lib/learner-difficulty.ts`. The level directive is injected
  into question-generation prompts; because the directive is part of the prompt,
  the token cache shards per (course, day/week, level) — same-level learners
  still share cached generations.
- **AI does the processing** (`ai-json.ts` zod-validated JSON + repair loop),
  token caching per `token-cache.ts` policy (question generation cacheable 6h,
  grading never cached).

## Key Architecture

- `src/components/examiner/AppShell.tsx` — main app shell with sidebar nav + role switcher
- `src/components/examiner/TeacherDashboard.tsx` — teacher dashboard with 5 views
- `src/components/examiner/teacher/` — teacher sub-components (TodayView, MentorshipView, InsightsView, etc.)
- `src/modules/theme/` — global theme system (4 presets: Modern Slate, Ocean Blue, Forest Sage, Sunset Rose)
- `src/lib/demo-guard.ts` — server-side demo write-block (blocks all writes for demo@examiner.ai)
- `src/lib/api-client.ts` — client-side demo write-block
- `scripts/seed-demo.ts` — comprehensive demo data seed (50 students, 2 courses, alerts, mentorship, psych data)

## Teacher Dashboard — 5 Views (in sidebar nav)

| Nav Item | View Key | Tab | Purpose |
|----------|----------|-----|---------|
| Today | `batch` | `today` | Triage queue + batch health pulse + wins |
| Students | `batch-students` | `students` | Searchable roster with attention flags |
| Mentorship | `batch-mentorship` | `mentorship` | GROW coaching queue + follow-ups |
| Assignments | `batch-assignments` | `assignments` | Group tasks + peer assessment |
| Insights | `batch-insights` | `insights` | Batch analytics + AI Assistant |

## Known Issues (as of last session)

- All teacher dashboard views have defensive guards (Array.isArray checks)
- Demo account has `developer` role (not admin) — all writes blocked
- AccessGrants seeded for demo → all students (so portfolio loads)
- PsychEvidence values match what PsychologicalTab.tsx expects
- Cache-busting headers added to next.config.ts (no-cache on HTML pages)

