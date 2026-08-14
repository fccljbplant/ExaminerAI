# REDESIGN P5 — Implementation Order & Migration/Cutover Plan

> Phase 5 (2026-08-14). Executes [P1–P4](./REDESIGN-P4-BACKEND-SPEC-2026-08-14.md). **No big-bang**: strangler pattern via feature flags; old and new coexist per-portal; code is deleted the moment its replacement ships for everyone.

## 1. Principles

1. Every workstream ships behind a flag, meets P2 §1.6 DoD (lint/typecheck/tokens/responsive/states/a11y/README) before merge, and includes its deletion ticket.
2. Data migrations are **additive first, reversible, dry-runnable**, per-org, with diff reports; old tables become read-only archives at cutover and drop after 30 days.
3. One portal flips at a time (learner → instructor → org → platform); public site last.
4. AI/text-pipeline and theme validator are in CI from W0 — every later workstream inherits the gates.

## 2. Workstreams (ordered)

| # | Workstream | Scope (specs) | Flag | Exit criteria |
|---|---|---|---|---|
| W0 | **Foundation** | tokens + theme engine + `validate-theme.ts` + `migrate-org-themes.ts`; move `components/ui`+`shared` → `modules/ui`; add missing primitives (KPI, ListCard, DataTable wrapper, BottomSheet, chart wrappers, SubmissionRenderer shell); `modules/shell` adaptive (top nav/More/TabRow/BottomNav/ActionBar/safe-area); new auth screens; CI gates (hex-ban lint, schema-diff, no-deep-imports) | `shell_v2` | contrast CI green on all modes; shell renders 4 breakpoints on dummy pages; old theme still default |
| W1 | **Learner core** | routes L1–L3, L8, L11, L13, L14 + `v2` learner endpoints; classroom polish (HUD, mini player, captions, preload) L4 | `portal_learner_v2` (org-overridable) | learner home fold OK at 360×640 & 1024×600; resume flow e2e green |
| W2 | **Floating tutor** | `modules/tutor`: vector rig, state machine, drag/dock/persist, context API, full-screen mobile chat, badges | inside `portal_learner_v2` | dock persists across reloads; never overlaps BottomNav (snapshot test) |
| W3 | **Study-flow engine** | sessions, scheduler, plans, SRS replacement, absence/cram detectors, diagnostic, Study-Flow Center L12, crons | `study_flow_v2` | vitest: all 6 scenarios (P7 matrix); old drill cron disabled per-org on flip |
| W4 | **Assignments & projects** | registries, SubmissionRenderer, uploads + extraction pipeline, rubric engine, feedback threads, sign-offs, L5–L7 + review side I3/I4/I7; migrate GroupTask data | `submissions_v2` | HSE/eBay/repair sample configs pass submission→review→resubmit→sign-off e2e with zero code changes |
| W5 | **Exams** | unified assessment engine (old+Learn tests merged), runner L9, results L10, autosave/resume | `exams_v2` | interruption-resume test green on throttled 3G profile |
| W6 | **Instructor portal** | I1, I2 studio, I5, I6, I8, I9, I10 | `portal_instructor_v2` | review SLA flow e2e; studio publish/versioning test |
| W7 | **Org + platform portals** | O1–O7, P1–P7, RBAC matrix, branding (derivation live), registries editors | `portal_org_v2`, `portal_platform_v2` | branding change → AA validator passes server-side; audit rows verified |
| W8 | **Gamification/messaging restyle** | XP/badges/celebrations + messaging onto new kit | with W1/W6 | visual parity, tokens only |
| W9 | **Public restyle (LAST)** | landing/marketing/marketplace/verify onto tokens + shell | `site_v2` | Lighthouse mobile ≥90 perf/a11y/best-practices |
| W10 | **Cutover & deletion** | §5 list; flags default-on; archives scheduled for drop | — | repo grep: zero imports of deleted paths; bundle size drop reported |

Parallelization: W2 can run with W1; W6 starts when W4 review side lands; W7 after W6; W9 only after W10-ready.

## 2a. Execution status (2026-08-14)

| Workstream | Status | Evidence |
|---|---|---|
| W0 Foundation | ✅ merged | tokens + validator + audit gate green (tests 250, lint 0 err, tsc clean, build clean) |
| W1 Learner core | ✅ merged | `/learner/*` pages + v2 learner endpoints behind `portal_learner_v2` |
| W2 Floating tutor | ✅ merged | `modules/tutor` (dock.test 10) — inside `portal_learner_v2` |
| W3 Study-flow engine | ✅ merged | `study-flow.test.ts` 37 (6 scenarios) + crons + L12 page behind `study_flow_v2` |
| W4 Assignments & projects | ✅ learner + review side merged | routes + UI kit + L5/L6 pages behind `submissions_v2`; review center (I3/I4: queue, rubric grading, AI drafts, decisions, sign-offs) on `(portals)/instructor` (68 submission tests); P7 fixtures pending |
| W5 Exams | 🚧 learner slice merged | ExamSession schema (both schemas), runner L9 (autosave/resume/offline queue, nav-hidden) + results L10 + list CTAs behind `exams_v2` (18 tests); AI draft grading + P7 interruption-resume e2e pending |
| W6–W10 | 🔲 | per table above |

## 3. Strangulation mechanics

- `middleware.ts` reads flags (org-level override > global) and routes learner/staff to `/app` (old) or `(portals)` (new); deep links mapped 1:1 (redirect table in runbook).
- v1 API routes untouched until W10; v2 routes are the only consumers of new tables; shared read models (courses, users) read same source of truth.
- Demo accounts get flags last (demo-guard respected in both stacks).

## 4. Data-migration runbook (scripts/, all idempotent + dry-run + per-org)

1. `migrate-content.ts` — CourseWeek/CourseDay → ContentModule/Lesson/LessonBlock (videoUrl→videoRef block; drop `codeExamples`); keeps `publishedVersion` snapshot.
2. `migrate-submissions.ts` — GroupTask→Assignment, GroupTaskSubmission→Submission+Part(text/link), Comment→FeedbackMsg; sets cycle=1.
3. `migrate-assessments.ts` — DailyTest/WeeklyTest + Learn*Tests → unified assessment tables; DrillCard kept (SRS engine adopts).
4. `migrate-orgs.ts` — Institution→Organization backfill + OrgMember roles.
5. `migrate-themes.ts` — P2 §2.5.
Each: dry-run diff report → staged 10% orgs → all; rollback = flag off + services read old tables (dual-read adapter until cutover).

## 5. Deletion list at W10 (verified by grep + build)

`components/examiner/**` (AppShell, LearnerTopNav, StudentDashboard, all student/instructor/admin panels, CoursePlanner, wizards) · old `(public)/learn` redirect pages · `/app` route · v1 duplicate routes (`/api/daily-tasks`, `/api/daily-test`, `/api/learner/xp`, `/api/today/summary` after consumers gone) · skeleton modules (`admin, auth, communication, grading, shared, student, wellbeing` stubs) · `modules/theme/themes/presets.ts` + re-export compat layer (P1 §2.8) · `schema.prod.prisma` duplicate (single schema + provider switch) · `du.exe.stackdump`-grade junk files.

## 6. Rollback strategy

- Per-portal flag off = instant revert (old stack untouched until W10).
- DB: old tables read-only at cutover, dropped at cutover+30d (backup snapshot first).
- Extraction/AI degradation isolated (human-only paths) — never blocks cutover.

## 7. Entry to P6/P7

W0–W5 merged = P6 QA pass runs on learner portal; W4+W3 merged = P7 domain integration begins. P6/P7 repeat per subsequent workstream before its flag goes default-on.
