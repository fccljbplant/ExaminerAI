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
