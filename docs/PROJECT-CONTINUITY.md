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
