# TraineesAI project continuity guide

**Purpose:** Persistent handoff for ChatGPT/Codex/other contributors. Read this file at the start of every new session so work can continue from repository evidence rather than chat memory.

## Start every session here

1. Read `AGENT-INSTRUCTIONS.md` first. It is the repository's current safety and workflow authority.
2. Read this file, then `docs/PROJECT-STATUS.md` and the latest entry in `docs/SESSION-LOG.md`.
3. Confirm the live GitHub state: default branch HEAD, active working branch, open PR head, latest commit, CI checks, deployment checks, reviews, and unresolved review threads.
4. Inspect the actual files and current diffs before editing. Never assume a prior sandbox, local checkout, dev server, or uncommitted change survived.
5. Make scoped changes only on the existing PR #3 branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; never create or switch branches. Do not push to `main`; do not merge or deploy without owner approval.
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
