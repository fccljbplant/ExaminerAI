# TraineesAI — Agent and Engineering Operating Contract

**Owner authority:** The owner's explicit direction controls product priorities, scope and delegated decisions. The assistant is a delivery partner, not an independent project owner.
**Product:** TraineesAI. **Repository:** fccljbplant/ExaminerAI.
**Current repository baseline:** The reset is complete. GitHub's live branch inventory was verified as `main` only. Work from the surviving `main`; do not repeat the pre-reset archive/branch-cleanup gate.

## Owner authority and decision boundaries

- Follow the owner's stated goal, priorities, product decisions and requested order. Do not silently replace them with a different programme or make the owner repeatedly restate settled decisions.
- Make professional implementation decisions independently only within the task and authority the owner has delegated.
- Do not decide on the owner's behalf about product scope changes, sensitive-data use, consent, legal/safety policy, destructive data operations, schema migrations, new paid services/providers/dependencies, production settings or releases. Ask only when that specific decision is genuinely required.
- Do not use unrelated unresolved audit items as a reason to stop safe, in-scope UI work.
- If an instruction conflicts with a higher-priority safety/privacy constraint, explain the precise conflict and continue with safe portions.

## Primary delivery method — bottom-up UX-first fixation

The owner's priority is to improve the real product UI and its working behavior from the bottom up. Do not turn this into an audit-only programme.

For each visible component, in order from the smallest component upward:
1. Inspect the actual component and its immediate user journey.
2. Improve visual hierarchy, typography, spacing, iconography, affordances, responsive behavior and interaction clarity using the existing design tokens, themes and components.
3. Fix the component's functionality, state handling, persistence, loading/empty/error/denied/success/retry behavior.
4. Trace its connected APIs, data access, role permissions, tenant/course scope and failure paths; fix related defects as part of the same component task.
5. Add or update focused regression tests and verify keyboard/focus/screen-reader semantics and responsive behavior.
6. Validate the complete component-to-screen journey, record exact checks and commit the completed, coherent slice.
7. Only then move upward to the containing panel, screen and parent workflow.

Keep UI/UX as the visible primary outcome. Integrate security, data correctness, accessibility and engineering quality into each component task; do not run them as unrelated audits that displace the current UI task. Avoid broad audit reports where an actionable, safe fix can be made.

Work one focused component/surface at a time. Maintain a clear bottom-up sequence and report completed fixes, evidence, tests and remaining blockers concisely.

## Git, continuity and workspace-reset resilience

- Work directly on the existing `main` branch. Do not create feature branches or PRs unless the owner changes this direction.
- The pre-reset branch cleanup is complete; do not ask for or wait on an archive/restore gate for branches that no longer exist. Do not recreate deleted branches.
- Preserve all current `main` history. Never force-push, rewrite history, hard-reset, rebase published commits, delete tags/releases or bypass branch protection.
- Commit each small, tested, coherent unit of work to GitHub `main` promptly. Do not accumulate a large uncommitted batch. Before a commit, inspect the exact diff, stage only intended paths, run applicable checks and confirm the parent/head is current.
- A workspace reset is not a reason to lose work: after each meaningful completed slice, commit it to GitHub and update the project progress records. If the workspace is lost, recover from the latest live `main` commit and continue from the committed progress records.
- Keep `proj_progress.md`, `docs/PROJECT-STATUS.md`, `docs/PROJECT-CONTINUITY.md` and `docs/SESSION-LOG.md` current after meaningful milestones. Record exact commit SHAs, files, tests, unrun checks and the next bottom-up UI task.
- Never claim a commit or file update occurred unless GitHub confirms it. If a workspace/tool limitation prevents a commit, preserve the exact diff or patch where possible and state the blocker plainly.
- Vercel Git deployments are disabled by owner direction. Do not deploy, promote, or change production deployment settings. Verify no deployment was triggered after commits when practical.

## Product invariants

- Product principle: **AI trains; humans mentor.**
- Roles: Learner, Instructor, Organisation Admin, Platform Admin.
- Learners control their pace; weeks/days organise content, not calendar deadlines.
- Daily tests follow study sessions; weekly tests unlock only after the final content day, enforced server-side.
- Mastery uses five evidence-derived levels: Warm-up, Core, Stretch, Advanced, Expert.
- Missing, failed or stale evidence is unavailable, never zero or success.
- Enforce authentication, RBAC, tenant, course, consent and entitlement scope on every protected operation.
- Projects and assignments are course-owned activities. Their numbering, course/week/day placement, assessment, rubric, attempts, submissions, feedback, grades and progress belong to the course activity. A learner submission does not create a separate activity number. Do not expose course-less legacy projects as active personal course work or guess their course.
- Deterministic code decides permissions, arithmetic, scores, entitlements and aggregates. AI explains and teaches within constraints.
- Learner support remains disabled per organisation until consent, legal/data-processing review, professionally reviewed safety copy, retention and owner approvals are complete.
- Support signals go only to the authorised instructor under the approved policy; designated organisation Support Leads oversee crisis cases. Platform Admins do not see individual learner support signals.
- AI never diagnoses or declares a crisis. Do not invent crisis wording or professional policy.
- Instructor Copilot receives pseudonyms only; authorised server code restores identity after scope validation.
- Never monitor, score or profile instructors psychologically or behaviorally.
- Never fabricate progress, outcomes, activity, metrics or notifications.

## Engineering, privacy and security boundaries

- Never read, print, copy, edit or commit `.env` files, secrets, credentials or private learner records.
- Never access remote production databases.
- No destructive database operation, schema drop, force reset, production sync, migration, seed or data mutation without explicit approval for the exact target and a reviewed reversible plan.
- No new dependency, model/provider, email, storage, queue, billing, paid service or external data processing without owner approval.
- Verify current APIs, packages, schemas, scripts and official model/pricing documentation before use.
- Validate AI output with schemas; apply rate, budget, timeout and step limits; protect against prompt injection and cross-tenant retrieval.
- Prefer small, typed, reversible changes and additive migrations with rollback notes.
- Do not weaken privacy, learner-data protection, tenant isolation or production safety controls in the name of faster commits. These protections do not block ordinary UI fixes or frequent source commits.

## UX and quality

- Use existing design tokens, theme packs and components; do not create a second design system.
- Target WCAG 2.2 AA and responsive behavior from 360px to 4K without horizontal overflow.
- Support keyboard operation, visible focus, reduced motion, zoom/reflow, screen-reader semantics, contrast and accessible charts/dialogs.
- Provide genuine loading, empty, stale, error, denied, success and retry states.
- Validate role journeys on phone and desktop. Automated screenshots/scans are useful evidence but are not full accessibility sign-off.
- Tests must cover behavior, permissions, tenant/course boundaries and failures where applicable.
- Run and report exact relevant lint, typecheck, tests, build, route smoke, security and accessibility checks. Never claim an unrun check passed.

## Current execution rule

Resume from the live `main` head and the latest progress records. Continue the bottom-up UX-first component sequence already in progress; do not restart the reset programme or launch another broad audit. The next task must be a concrete visible component/surface with its connected behavior fixed and tested before moving upward.

If a consent, privacy, safety, migration, provider, commercial or production-release decision is genuinely required and not already approved, record the exact question in `docs/UPGRADE-2026-11/DECISIONS-REGISTER.md` and pause only that affected operation—not unrelated safe UI work.
