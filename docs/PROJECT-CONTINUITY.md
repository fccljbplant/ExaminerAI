## 2026-11-12 — Learner Today home data and UI fixation

- Application commit: `2171c98e41fcb80dfdafd8f19a46d13d31acbac5` (`fix: align learner home with enrolled courses`); baseline was `9382e71ec90e0e97f21793f69ea79a20a72345af`.
- The learner home previously used `LearnProfile` row count as enrolled-course count, included progress totals without validating current student enrolment, and could label a missing progress profile as a completed course.
- Home API now uses student `CourseEnrollment` rows as the canonical course-count/access source, restricts progress profiles and daily-test cards to those course IDs, and offers a truthful “Start your first study session” action when a learner has enrolled but no progress profile yet.
- Learner Today UI now has a clearer heading/subheading, a stronger next-step hero with start/resume/review/complete states, “Ready to practice” wording instead of deadline-style “Due today”, and a calmer empty state aligned with learner-controlled pacing. Check-in copy no longer makes an unsupported 20-second promise.
- Regression coverage includes canonical enrolment count, course-scoped progress/daily tests, missing-profile start state, no-enrolment state, and enrollment/profile lookup failures.
- Local checks: 8 targeted tests passed across 2 files; ESLint passed on all 4 changed source/test files; `git diff --check` passed; TypeScript `--noEmit --skipLibCheck` passed with 1.5 GB heap. Declaration-file checking was skipped. Full production build, browser visual review and manual WCAG sign-off were not run locally.
- Tests used existing installed dependencies from the preserved workspace via a temporary local `node_modules` symlink. A fresh frozen Bun install remains blocked by the previously recorded `package.json`/`bun.lock` Prisma dependency-group mismatch; no dependency or lockfile changes were made.
- Vercel Git auto-deployment remains disabled in `vercel.json` (`git.deploymentEnabled: false`, saved in commit `9f104e90855a8953483300da70202e6c06786206`). No manual deployment or production DB operation. Exact-head GitHub Actions and Vercel status for the application commit must be verified.
- Next: complete exact-head CI verification, then perform responsive screenshots and keyboard/screen-reader review before moving to the next screen. Keep learner-support processing off pending consent/legal/professional approvals.

## 2026-11-12 — Learner Today check-in slice committed

- Current main: `d62076da989b2a1e8bf725e87f1f6264a6b1b8ed`.
- The daily check-in API now requires an enrollment row matching learner, course and student role before writing. The daily-log history endpoint applies the selected course filter in addition to the authenticated user ID.
- The CheckInCard now shows a distinct retryable history error instead of presenting fetch failures as an empty list; confidence uses native radio controls; note input is labeled and length-bounded.
- Tests: 5 targeted tests passed; ESLint passed; reduced-memory TypeScript with `skipLibCheck` passed. Full TypeScript check OOMed under sandbox heap; production build and manual browser/WCAG review remain outstanding.
- Frozen Bun install revealed a pre-existing Prisma dependency-group mismatch between package.json and bun.lock. No lockfile changes were made.
- Vercel Git auto-deployment remains disabled in vercel.json; no queued/building deployment or deployment for this SHA was present after commit. GitHub Actions run `43142609752` was in progress at last check.
- Next: finish the rest of Learner Today home; revalidate course enrollment count and continue-card source before implementation.

## 2026-11-12 — Main-only fixation and deployment pause

- Owner approved direct commits to `main` and asked to stop Vercel deployments. Commit `9f104e90855a8953483300da70202e6c06786206` sets `git.deploymentEnabled: false` in `vercel.json` to prevent automatic Git-triggered deployments on all branches. Manual deployments remain possible only by explicit action; no manual deployment was initiated.
- Before this change, live main was `e9fc682f5233332cc8e10c3c09c1849455ce070c`; branch inventory showed only `main`, no open PRs, no repository rulesets, and branch metadata `protected: false`. The GitHub integration could not read the dedicated branch-protection endpoint (403).
- Latest inspected GitHub Actions run `43140023300` succeeded on the exact pre-change main SHA. Latest Vercel production-target deployment `dpl_8xUPE6hHFghQv4GaTAQW9nsXT5C9` was `CANCELED`; live listing showed no queued/building deployments.
- The older working directory was diverged (one local commit ahead/four behind) and had stale local edits. It was preserved in a resumable snapshot `snap_9LzNZJHfbxob30FRC4oohjkMLoHS`, which was successfully restored. A separate clean clone of current `main` is the active implementation checkout; no hard reset, branch rewrite or deletion was used.
- Daily Test first-pass code is already committed on main (`6c0f36d`, `a9fcb70`, `e9fc682`). Next UI-first screen is Learner Today. Revalidate the existing home API and check-in flow before changing it.
- No production DB access, schema/migration changes, dependency/provider changes or manual deployment.

> **Reset-programme execution note — 11 November 2026:** The docs-only programme and instruction refresh are saved on main. The last checked main HEAD before the final status/log commit was `b70cfa719e338d4397e369ecc0a31b71ac5ebd63`. The owner-directed branch reset is not executed: 19 non-main refs remain, PR #3 and #6 remain open, and no verified private archive exists yet. Do not delete refs until the private archive restore is verified. Two automatic production-target Vercel deployments from the first documentation commits were canceled (`dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ`, `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK)); Vercel status on the checked main SHA fails due to build-rate limit. Inspect deployment automation before any future source-code commit to main.

---

> **Reset-programme execution note — 11 November 2026:** The new docs have been added to main at `777f3131fefcb4878973237e1e4ad4e0003ad824`. The owner-directed branch reset is not yet executed: 19 non-main refs remain, PR #3 and #6 remain open, and no verified private archive exists yet. Do not delete refs until private archive restore is verified. Two automatic production-target Vercel deployments caused by documentation commits were canceled (`dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ`, `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK)); Vercel status on current main is failing due to build-rate limit. Inspect deployment automation before any future source-code commit to main.

---

> **CURRENT OWNER DIRECTION — 11 November 2026 (supersedes older consolidation instructions):** Start the Mainline Reset & Evidence-Led Product Upgrade in [docs/UPGRADE-2026-11/START-HERE.md](./UPGRADE-2026-11/START-HERE.md). Archive the complete pre-reset branch/PR state privately and verify restore; close retired open PRs (including #3/#6); delete every remote branch except main; then audit main read-only and implement approved gaps directly on main in small commits. Do not merge old branch tips as part of this reset. GitHub PR records remain historical records after closure. Check automatic Vercel production deployment behavior before main source commits. See [MASTER-PLAN.md](./UPGRADE-2026-11/MASTER-PLAN.md), [RESET-BASELINE.md](./UPGRADE-2026-11/RESET-BASELINE.md), [DECISIONS-REGISTER.md](./UPGRADE-2026-11/DECISIONS-REGISTER.md). Historical text below is preserved but is not current operating authority.

---

> **Current owner decision (2026-11-11):** The previous blanket no-merge rule is superseded. Consolidate all useful existing branches into `main`, then stabilise the application. Follow the current rules in [`AGENTS.md`](./AGENTS.md) and [`docs/agent-pack/SAFETY.md`](./docs/agent-pack/SAFETY.md): inventory first, merge unique useful work only, avoid duplicate ancestry, preserve source branches, do not force-push, and keep production DB operations/deployment separately gated. Historical text below is retained as context, not current merge authority.

# TraineesAI project continuity guide

**Purpose:** Persistent handoff for ChatGPT/Codex/other contributors. Read this file at the start of every new session so work can continue from repository evidence rather than chat memory.

## Start every session here

0. Read the repository-hosted [`AGENTS.md`](../AGENTS.md) and [`docs/agent-pack/README.md`](./agent-pack/README.md); the maintained Agent Pack lives in GitHub and must not depend on a local archive.

1. Read `AGENT-INSTRUCTIONS.md` first. It is the repository's current safety and workflow authority.
2. Read this file, then `docs/PROJECT-STATUS.md` and the latest entry in `docs/SESSION-LOG.md`.
3. Confirm the live GitHub state: default branch HEAD, active working branch, open PR head, latest commit, CI checks, deployment checks, reviews, and unresolved review threads.
4. Inspect the actual files and current diffs before editing. Never assume a prior sandbox, local checkout, dev server, or uncommitted change survived.
5. Follow the active approved task card. For P0-03, use a dedicated integration PR/branch where required; integrate unique work only, preserve source refs, and never force-push or rewrite history. The owner has authorised consolidation merges, but not production DB changes or deployment.
6. After a coherent change, record what changed, exact commit/PR, checks run and not run, and the next safe action in `docs/SESSION-LOG.md` and update `docs/PROJECT-STATUS.md`.

## Repository identity

- Repository: [fccljbplant/ExaminerAI](https://github.com/fccljbplant/ExaminerAI)
- Product name: TraineesAI (repository remains named ExaminerAI)
- Default branch: `main`
- Main product: AI-guided training platform for engineering trainees/internees; AI teaches and tests, human mentors support learners.
- Primary stack (from repository docs): Next.js 16, Prisma 6, SQLite for development and PostgreSQL/Neon for production, Tailwind CSS 4, shadcn/ui, custom JWT authentication, DeepSeek primary AI with Z.ai fallback, Vercel hosting.

## Current workstream

The active baseline UX work is tracked by [PR #3](https://github.com/fccljbplant/ExaminerAI/pull/3), **UX audit: fix dashboard KPI accuracy and safer failure states**. The broader role-based redesign continues separately in [Issue #4](https://github.com/fccljbplant/ExaminerAI/issues/4) and is specified in [UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md](./UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md).

PR #3 is a foundation, not completion of all product workstreams. Workstreams A–L remain in the roadmap; Workstream M (UXPeak-informed product-design quality) is mandatory across UI work. Use the route inventory, UX reference log, screenshot audit, scorecard, and role design decisions as supporting evidence:
- [83-route inventory](./UX-ROUTE-INVENTORY.md)
- [UXPeak research log](./UPGRADE-2026-10/design/UX-REFERENCE-RESEARCH.md)
- [UX baseline audit](./UPGRADE-2026-10/design/UX-AUDIT.md)
- [UX baseline scorecard](./UPGRADE-2026-10/design/UX-SCORECARD.md)
- [Role design decisions](./UPGRADE-2026-10/design/ROLE-DESIGN-DECISIONS.md)

## Product rules that must not drift

### Learn course model

- Course weeks/days organize content for management; they are not calendar deadlines. Learners set their own pace and can complete multiple topics in one day.
- Progress is tracked per topic in `LearnProfile.masteryMap`, not by elapsed calendar days.
- The test order is daily test after each study session, then the weekly test once the learner has reached the final content day of that week. The API enforces the weekly sequence with `OUT_OF_SEQUENCE`.
- Learn question difficulty adapts from recent completed daily/weekly test performance: Warm-up, Core, Stretch, Advanced, Expert. Cold start and failure fallback are Core. Question generation is cached by prompt/level; grading is per learner and not cached.

### UX, privacy, and trust

- Metrics must use complete aggregates, not preview lengths; errors must not be shown as zero.
- Make metric scope, definitions, source and freshness clear.
- Distinguish AI suggestions from verified facts.
- Preserve explicit loading, empty, stale, permission, validation, success, error and retry states.
- Keep interactive targets at least 44px where required, support keyboard/focus, and validate WCAG AA contrast.
- Learner support signals may be handled only for the learner's in-scope instructor through an approved, consented, organisation-enabled pathway; keep support/crisis features off until owner approval and required safeguards exist. Ordinary org admins and platform admins must not receive individual learner-support/psychological signals. Follow field-level privacy, retention, access-grant and RBAC rules.

## Safety and change discipline

- Never expose or commit credentials, tokens, passwords, private learner data, or production records.
- Never run destructive database operations, force resets, schema drops, or production syncs without explicit owner approval for the exact target and operation.
- Do not touch production data, deploy, merge, or push to `main` without owner approval.
- Work only on the existing PR #3 branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; never create or switch to another branch. Review the diff. Verify typecheck, lint, tests, build, and browser/accessibility checks where available. Report unavailable checks honestly.
- Do not claim a screenshot, browser test, deployment, or code verification that was not actually performed.
- If a required safety/tooling prerequisite is missing, record the blocker and stop rather than inventing a workflow.

## Parallel UI and security delivery

- Continue UI quality fixes in parallel with access/privacy work on the existing PR #3 branch; do not defer all UI work until security is complete.
- Prioritise role-specific dashboard usability, 44px minimum interactive targets, visible keyboard focus, responsive layouts, truthful loading/empty/error states, and accessible semantics. Keep changes within the existing design tokens and components.
- Keep the broader role-based redesign aligned to `docs/UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md`; Workstream M is a cross-cutting quality gate, not a separate blocker.
- Current session added touch-target/focus improvements to Learner, Instructor and Organisation dashboards. Latest head and CI are recorded in `docs/PROJECT-STATUS.md`.

## Progress recording contract

- `docs/PROJECT-STATUS.md` is the latest concise snapshot. Update its date, branch/commit, PR state, CI/deployment state, completed work, blockers, and next steps after meaningful work.
- `docs/SESSION-LOG.md` is append-only. Add a dated entry for each substantial work session; do not rewrite history.
- This guide is an index and stable project context, not a substitute for reading current source code, PR diffs, and `AGENT-INSTRUCTIONS.md`.
- Chat attachments are not automatically repository files. If a future session needs a prompt/specification, ensure its canonical version is committed in the repository or re-uploaded; never assume a previous chat attachment is available.

## Owner clarification — organisation-admin academic oversight (2026-11-09)

Organisation admins may inspect student academic and course-operational records within their own organisation to oversee teaching delivery and instructor–student activity: enrolment, progress, attendance/participation, assessments, assigned work, feedback, and recorded teaching/mentoring interactions. This is not permission to view individual learner-support/psychological indicators, private counselling content, or crisis signals (except the separately authorised crisis-case/handling view for designated org Learner Support Leads). Do not profile instructors psychologically or behaviourally. Enforce tenant, course, role and field-level scope on every server operation.


## Current delivery snapshot — 2026-11-09

- PR #3 remains open, draft and unmerged on the only permitted working branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Latest verified head: `6d90c757a2273c3d6a49677d8766d50d2176f094` (235 commits, 107 changed files).
- Workflow run `42655880066` passed on prior head `94869a6e`; no run had yet been returned for the latest dashboard changes. Do not treat the older pass as latest-head validation.
- Parallel UXPeak / Workstream M dashboard improvements now include safe recovery copy, actionable organisation/platform empty states, corrected platform skeleton geometry, 44px instructor navigation target and visible focus on the organisation announcement textarea.
- These changes are code-reviewed only at this point; visual before/after screenshots and interaction/accessibility QA remain open.
- Vercel is blocked by the daily deployment quota. No deployment, merge, production-data change or main-branch write occurred.


## UXPeak Pro scope — 2026-11-09

Owner requested the full UXPeak product concept set: gamification, role dashboards, course discovery/marketplace, enrolment “shopping” journey, tutorials/onboarding, AI assistance, helpdesk, classroom and shared UI system. The implementation inventory and approval gates are in `docs/UXPEAK-PRO-PRODUCT-WIDE-BLUEPRINT.md`. Paid commerce is not authorised; marketplace first-lesson preview is the current specified scope. Gamification is phase-gated (Phase 8 in the Master Prompt). Helpdesk is separated from sensitive learner support/crisis workflows. Continue small UX fixes in parallel with access/privacy work.


## Latest delivery update — 2026-11-09

- Continue exclusively on PR #3 branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; latest head at this update is tracked in `docs/PROJECT-STATUS.md`.
- Marketplace filter work: Featured-only is now exposed as a user-facing filter; search and select controls have accessible names; filter controls and clear action meet the 44px minimum target guidance.
- Student drill-down hardening: `/api/v2/instructor/students/[id]` now confirms the requested account normalizes to the learner role before proceeding with org/course scope and returning learner records.
- Latest-head validation remains pending. Run `42658325358` passed on the prior head, not the subsequent marketplace/route commits. Vercel is blocked by the build-rate limit. No local/browser/axe checks were run.
- Keep the comprehensive-report field classification blocked pending owner decision. Keep learner-support consent, feature gate and crisis workflow disabled until approvals and controls are implemented.


## Latest delivery update — 2026-11-09 course-scope hardening

- On the existing PR #3 branch, instructor student drill-down and roster queries now scope course-bearing learner activity to courses shared by the staff member and learner.
- Drill-down scope is computed as the intersection of staff-authorised course IDs and learner enrolments. Weekly tests, report cards, daily logs, project tasks, certificates and engagement events use that intersection. Roster daily-log aggregation and project-task progress use the instructor's taught course IDs.
- Added unit tests for course intersection and denial of non-overlapping courses.
- Latest code head at verification: `d78ec3e7589edd9c3e907de9a6707f3848bb6384`. GitHub Actions run `42661008830` passed lint, unit tests, typecheck, production build, route smoke, authenticated screenshot capture and artifact upload.
- Vercel preview remains blocked by the project build-rate limit. No deploy or merge. The interactive Vercel sandbox endpoint was not authorised (403); GitHub-hosted Actions runner supplied CI verification.
- Schema limitation to remember: `SkillMastery` and `Competency` do not have `courseId`; they remain learner-level profile data until their intended global/course semantics are decided. Do not silently alter their visibility or schema.


## Latest delivery update — 2026-11-10 final-result course scope

- Continued only on PR #3 branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Staff final-result relation queries are now bounded to authorised course IDs intersected with learner enrolments. Instructor, org-admin, platform-admin and explicit-grant paths retain their role/tenant boundaries; empty or revoked scope fails closed.
- All course-bearing relations in the endpoint are filtered: weekly tests, interactions, report cards, project reports and tasks. Staff targets are verified as learners. Learner self-view remains cross-course.
- Academic performance, participation, areasToImprove, overallAssessment, careerReadiness, project reports and task stats are preserved within scope. behavioralPattern remains learner-self only; no support/crisis data was added.
- Added route tests for instructor isolation, org-admin linked-course scope, explicit grants, empty/revoked scope, denied access, platform-admin bounds and learner self-view.
- Code implementation head: `0edeed1f22b7e7274ed3f05b9ce3982aee7f43b8`. Exact-head Actions had not yet been returned; previous-head run `42722331613` passed but is not validation of this implementation. Vercel is build-rate limited. No local checks were run.
- Existing multi-course duration/phase semantics and query limits are unchanged. Comprehensive-report `managementAttitude` classification remains owner-blocked. PR #3 remains draft; no merge/deploy.


## Latest delivery update — 2026-11-10 course-scoped comment writes

- PR #3 current validated code head: `c4a63e5c0779aa48150c8405e019e7546549983d`; branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; open/draft/unmerged/mergeable. `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Comment staff POST/PATCH/DELETE now require an authorised selected course and validate every linked activity against the same learner/course. Unassigned and mixed-course legacy comments are not writable. Learners retain own cross-course history; instructor Comments composer remains unavailable.
- Exact-head Actions run `42740191410` passed 436 tests, lint (0 errors / 7 warnings), typecheck, build, 83/83 page-route smoke checks, role screenshots and artifact upload.
- Vercel remains blocked by build-rate limit. No local/manual browser/axe/a11y checks, merge, deployment, production data/schema change or main write.
- Next academic scope is course-specific WeeklyTest/ReportCard identity and APIs. Agent Pack task card/queue/runner prerequisites are absent on this branch; do not bypass them.


## Latest delivery update — 2026-11-10 comment audit trail

- Validated application-code head: `b12017d0a5dd4d26da0fcad3726b2b9c9cacffa7`; PR #3 remains open/draft/unmerged/mergeable; `main` unchanged.
- Staff comment writes are selected-course and activity-link scoped; successful create/edit/delete mutations now create audit events. Audit metadata excludes comment text, learner ID and activity IDs.
- Exact-head Actions run `42741613904` passed 438 tests / 41 files, lint (0 errors / 7 warnings), typecheck, build, 83/83 route smoke, four-role screenshots and artifact upload.
- Vercel remains blocked by build-rate limit; no Ready preview or manual accessibility review.
- Next academic task: course-specific WeeklyTest/ReportCard identity and APIs. Agent Pack task queue/runner remains absent; do not invent a card or bypass the prerequisite.


## 2026-11-10 — Privacy boundary continuation and live-state refresh

- Repository/PR rechecked live: `fccljbplant/ExaminerAI`; PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Current PR head: `5d8459ed389ea67ba0fd93047ca47a1ee8d8b4f6`; `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`. PR metadata reports 405 commits and 123 changed files.
- Exact-head GitHub Actions run [42742116553](https://github.com/fccljbplant/ExaminerAI/actions/runs/42742116553) completed successfully. The single quality job completed dependency installation, isolated test DB initialization, lint, unit tests, TypeScript, production build, 83-route smoke checks, authenticated role screenshot capture and screenshot artifact upload.
- The current commit's combined GitHub status still reports Vercel failure with the project build-rate-limit URL. However, a later Vercel bot PR comment reports a Ready deployment updated 2026-11-10 02:14:27 UTC for preview `https://examiner-ai-git-ux-audit-fix-dashb-bd75fe-fccljbplants-projects.vercel.app`. Treat the combined Vercel status as stale/conflicting until its deployment SHA is independently confirmed; do not claim the latest check is fully green.
- No submitted PR reviews or inline review threads were returned. The PR remains draft.
- Re-read repository `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, `docs/SESSION-LOG.md`, `proj_progress.md`, `docs/UPGRADE-2026-10/QUESTIONS.md` and the applicable upgrade specifications. `AGENTS.md`, `docs/UPGRADE-2026-10/QUEUE.md` and `scripts/agent/run-logged.mjs` remain absent (404) on this branch. The uploaded Agent Pack runner remains unsuitable unchanged because it switches/creates branches and reads `.env*`; do not invoke it.
- Read-only privacy inspection confirms the comprehensive-report endpoint still grants staff `content_only` access at `src/app/api/students/[id]/comprehensive-report/route.ts` and passes learner ID to a generator that queries cross-course interactions, weekly tests, project tasks/reports and certificates in `src/modules/comprehensive-report/index.ts`. The generator also still coerces missing test evidence to zero and emits a default F-grade path when no tests exist. It returns AI-generated `managementAttitude` observations. The owner-approved direction is to retain those sections with a prominent adjacent AI-reliability limitation; never imply psychometric validity or sole-decision suitability. No verified user-facing report consumer was identified in the available repository handoff; do not treat an API-only disclaimer as complete.
- The exact-head CI success validates configured automated checks but not manual screenshot inspection, axe, keyboard/screen-reader, reduced-motion, zoom/reflow or end-user task testing. No local checkout or local checks were available.
- No application code, tests, schema, dependency, migration, production data, merge, deployment, branch switch or `main` write changed in this refresh. This is a documentation/handoff refresh only.
- Next safe work: resolve the task-card/logged-runner prerequisite without reading `.env*` or switching branches; then take one approved, narrow task. The comprehensive-report consumer, course-context/evidence contract, missing-evidence semantics, cached-report notice and route tests must be handled as one coherent slice. Preserve owner-approved management-style content with the AI-only reliability notice. Keep PR #3 draft/unmerged.


> **Audit-plan update — 12 November 2026:** Added `docs/UPGRADE-2026-11/COMBINED-AUDIT-AND-FIXATION-PLAN.md` in commit `9e16504ea416d71773a909dc7b0cd27d91209e08`. It consolidates the recent audit into a bottom-up sequence and integrated component work-card format. Treat findings as observations to revalidate against current main before implementation; no application fixes were made in this documentation update.

## 2026-11-12 — Current continuation point: screen-first delivery

- Working base: main at 18b2b95011b0480f4176a0d2881788070ddf74c2; recovered worktree contained the uncommitted audit/fix batch and was aligned with origin/main.
- Owner's explicit priority: improve UI first. For every screen, combine the visual redesign with behavior, permissions/data scope, security, responsive states and accessibility. Do not drift into a security-only audit phase.
- First screen: Daily Test. DailyTestPanel.tsx and shared TestChatUI.tsx now have a clearer check-in header/context, topic badge, optional accessible question-progress meter, clearer message surface, labeled answer composer and mobile-friendly action layout. TestChatUI.test.ts checks progress and accessible composer markup.
- Shared chat component is used by Practice and Weekly Test. Verify those consumers in later visual passes; no progress meter is shown unless a real question total is supplied.
- Portfolio API scope hardening: org-admin daily logs select only date; global competencies without course ownership are hidden from course-scoped instructor/org-admin results. Tests added.
- Validation: full Vitest suite, full ESLint, tsc --noEmit, and git diff --check passed on a disposable local SQLite DB. Tutor-context seeded assertions skipped because the optional seed was missing. Build compile succeeded, but build worker was killed by sandbox memory limits; no successful production build claim. Browser screenshots/manual WCAG checks remain unrun because Chrome/Chromium is unavailable.
- Known unresolved decisions: approved deterministic scoring rubric for AI evaluation; consent/legal/professional review for learner support/psychology; global SkillMastery/Competency ownership semantics; full cross-tenant audit. Do not guess or unblock these.
- Next: final diff review, commit/push the validated work to main, then continue with the next learner-facing screen after Daily Test. Do not deploy or touch production settings/DB.

## 2026-11-12 — Learner Today empty-state heading correction

- Fixation commit: `8e3686203b7035f864ed9dd08bb5341e73ac2bcf`, parent `82d6cc85ac20019e8bdb38d778a371ba42b4d56e`. The branch inventory remains main-only with no open PRs.
- Inspected the screenshot manifest for all four roles at 360, 390, 768, 1024, 1366, 1920 and 2560 widths. No horizontal overflow; heuristic counts for unnamed controls, unlabeled fields, missing image alt and missing page language were zero. Learner no-enrolment state had zero H1 headings at all captured sizes; this is a confirmed semantic UX gap, not a layout overflow.
- Corrected the learner no-enrolment card title to an H1 without changing its visual styling or adding a nested main landmark. Added an SSR regression test for the primary heading and course-catalog link.
- Local checks: targeted Vitest 1/1 passed; ESLint on both changed files passed; TypeScript `--noEmit --skipLibCheck` passed; `git diff --check` passed. Exact-head Actions run `43147226589` passed every step: install, isolated SQLite, lint, unit tests, TypeScript, production build, 84/84 route smoke, authenticated screenshots and artifact upload. A prior screenshot attempt on the preceding documentation head had a transient Chrome DevTools startup failure; the retry and this exact-head run both passed.
- Re-inspected the exact-head screenshot artifact `role-dashboard-screenshots`: learner no-enrolment state now has one H1 at 360x800, 390x844 and 1366x768; all role/viewport captures report no horizontal overflow. Aggregate heuristic findings remain zero for unnamed controls, unlabeled fields, missing image alt and missing page language. This is not a full WCAG or manual screen-reader sign-off.
- Vercel Git deployments are disabled in `vercel.json`; no deployment was created or manually triggered. No production DB, schema, migration, dependency or provider changes.
- Next: verify exact-head CI and inspect the refreshed learner screenshot/manifest; then complete manual keyboard and screen-reader review before closing Learner Today. Do not advance to the next screen until this card is signed off.

## 2026-11-12 — Learner Today keyboard-focus polish

- Follow-up source fix: the new-learner H1 remains in place, and the primary course-catalog action plus all five onboarding links now declare visible `focus-visible` outlines using the existing focus token. No new design system or dependency.
- Added SSR regression coverage asserting all six learner empty-state links expose the focus outline utility. Local validation: targeted Vitest 1/1 passed, ESLint passed on both changed files, TypeScript `--noEmit --skipLibCheck` passed, and `git diff --check` passed.
- Prior source commit `8e3686203b7035f864ed9dd08bb5341e73ac2bcf` has exact-head CI success (run `43147226589`) and screenshots verified one H1 at mobile/desktop widths with no horizontal overflow. This follow-up source change still needs exact-head CI and screenshot verification.
- This markup-level focus affordance is not a manual keyboard or screen-reader sign-off. Manual interaction review remains open; do not close Learner Today or advance screens until it is completed.
- Vercel Git deployment is disabled; no production deployment, DB, schema, migration, dependency or provider change.

## 2026-11-12 — Learner Today focus-fix CI and visual evidence

- Follow-up fixation commit `af49103232e6eb6c1788cd250dca262aa6617b2b` passed exact-head GitHub Actions run `43148181536`: install, isolated SQLite setup, lint, unit tests, TypeScript, production build, 84/84 route smoke, authenticated role screenshots and artifact upload.
- The screenshot artifact `13912034306` confirms the no-enrolment card heading is visible in the 360px screenshot and remains present at wider captures; no horizontal overflow is reported at the sampled learner viewports. The first 360px manifest DOM sample reports zero H1 while the screenshot visibly contains it, indicating a timing/instrumentation inconsistency; do not treat that single manifest count as a confirmed UI regression or claim the heuristic is a full accessibility scan.
- The SSR regression test checks the heading, course catalog destination and visible focus-outline utility on all six links (one CTA plus five onboarding links). Local targeted test, ESLint, TypeScript `--noEmit --skipLibCheck` and `git diff --check` passed.
- The focus treatment is now present in markup, but manual Tab/Shift+Tab verification, actual focus-ring contrast review and screen-reader testing remain outstanding. Learner Today is not yet signed off; do not advance to the next screen.
- Vercel Git deployments remain disabled; no deployment for the source commit, and no production DB, schema, migration, dependency or provider changes.
