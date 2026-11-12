# CURRENT LIVE UPDATE — 12 November 2026 (Learner Today fixation)

- Current live `main`: `d62076da989b2a1e8bf725e87f1f6264a6b1b8ed`.
- UI-first Learner Today daily check-in slice committed. Check-in writes verify learner/course enrollment; history is filtered by selected course and authenticated learner; history failure is visible with retry; confidence controls are native radios; note input is labeled and bounded.
- Targeted Vitest: 3 files / 5 tests passed. Changed-file ESLint passed. Reduced-memory TypeScript with `skipLibCheck` passed; full TypeScript check exceeded sandbox heap. No full build, browser or manual WCAG sign-off.
- GitHub Actions run `43142609752` was still in progress on this SHA at last inspection.
- Vercel auto Git deployments are disabled by `vercel.json`. Post-commit Vercel listing showed zero queued/building deployments and no deployment for this SHA. Existing production deployment was not changed.
- A fresh frozen Bun install is blocked by pre-existing `package.json` / `bun.lock` Prisma dependency-group mismatch; no dependency or lockfile edits were made.
- Next: continue the Learner Today home-level data/UX pass; current remaining findings include profile count versus course enrollment count and continue-card course selection. Support processing remains blocked pending approvals.

---

# CURRENT LIVE UPDATE — 12 November 2026 (main-only fixation)

- Verified live `main` HEAD before this update: `e9fc682f5233332cc8e10c3c09c1849455ce070c`. Live branch inventory returned only `main`; open PR inventory returned none; repository rulesets endpoint returned an empty list. The branch-protection endpoint was not accessible to the GitHub integration, but the branch object reports `protected: false`.
- Latest inspected GitHub Actions run `43140023300` succeeded on the current main SHA. Its configured checks include lint, tests, TypeScript, build, route smoke and role screenshots. This is automated CI evidence, not manual WCAG sign-off.
- Latest Vercel production-target deployment for `e9fc682` is `CANCELED`; current deployment listing returned zero `QUEUED` and zero `BUILDING` deployments.
- Owner approved direct commits to `main` and instructed that Vercel deployments stop. Commit `9f104e90855a8953483300da70202e6c06786206` sets `git.deploymentEnabled: false` in `vercel.json`, disabling automatic Git deployments across branches while retaining manual Vercel deployment capability.
- Daily Test first-pass work is already on main across `6c0f36d`, `a9fcb70` and `e9fc682`. The older workspace contained stale/diverged edits; a point-in-time snapshot `snap_9LzNZJHfbxob30FRC4oohjkMLoHS` was created and successfully resumed. A fresh clean checkout of main is being used for further changes.
- Next component: Learner Today home. Revalidate the visual composition, continue-learning source, check-in course scope and history behavior, and all loading/empty/error states before implementation. Learner-support processing remains blocked pending consent, legal/data and professional review.
- No production database, migration, schema, dependency or paid service changes. No manual deployment or production-domain change.

---

# LATEST LIVE UPDATE — 11 November 2026 (mainline reset status)

- Live main HEAD verified immediately before this documentation refresh: `b70cfa719e338d4397e369ecc0a31b71ac5ebd63`. This refresh is documentation-only and will create a new main commit.
- Active programme: `docs/UPGRADE-2026-11/START-HERE.md` and `MASTER-PLAN.md`; the reset-first mainline plan replaces the former branch-consolidation queue.
- Pre-reset inventory still shows 20 remote branch refs including main (19 non-main refs). Open PRs #3 and #6 remain open/draft. No branches have been deleted and no PR has been closed in this milestone.
- A secure private archive and restore rehearsal have not been completed. Do not delete refs until both are verified.
- Vercel combined status on `b70cfa719e338d4397e369ecc0a31b71ac5ebd63` reports failure due to the project's build-rate limit. The connected GitHub Actions query returned no PR-triggered workflow runs for this exact main SHA; do not claim CI passed or failed from that empty result.
- Direct documentation commits to main automatically queued production-target deployments. Two in-progress deployments were canceled: `dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ` (commit `2b0badf...`) and `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK` (commit `9d2178c...`). A follow-up list matched all docs commits in the initial batch and confirmed both CANCELED; no other deployments from that set were found.
- No application source, Prisma schema, dependency, production data, production setting or migration was changed. No tests, lint, typecheck, build, browser or accessibility checks were run for this documentation-only work.
- The new plan marks already-integrated PR #2, #7–#9, #11 and selective PR #17/#19 work as items to verify, not tasks to rebuild.
- Next: complete secure private archive/restore and execute branch/PR reset in a Git-capable owner-controlled workspace; then run the read-only mainline audit. Before any further main writes, resolve automatic production deployment behavior and require separate release approval.

---

# LATEST LIVE UPDATE — 11 November 2026 (reset programme docs reconciled)

- Current live main HEAD: `777f3131fefcb4878973237e1e4ad4e0003ad824`.
- Active programme: `docs/UPGRADE-2026-11/START-HERE.md` and `MASTER-PLAN.md`; the reset-first mainline plan replaces the former branch-consolidation queue.
- Pre-reset inventory still shows 20 remote branch refs including main (19 non-main refs). Open PRs #3 and #6 remain open/draft. No branches have been deleted and no PR has been closed in this milestone.
- A secure private archive and restore rehearsal have not been completed. Do not delete refs until both are verified.
- Vercel combined status on current main reports failure due to the project's build-rate limit. The connected GitHub Actions query returned no PR-triggered workflow runs for this exact main SHA; do not claim CI passed or failed from that empty result.
- Direct documentation commits to main automatically queued production-target deployments. Two in-progress deployments were canceled to prevent an unapproved release: `dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ` (commit `2b0badf...`) and `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK` (commit `9d2178c...`). A follow-up deployment listing confirmed both are CANCELED and no other deployments from this docs commit set were found.
- No application source, Prisma schema, dependency, production data, production setting or migration was changed. No tests, lint, typecheck, build, browser or accessibility checks were run for this documentation-only work.
- The new plan marks already-integrated work from PRs #2, #7–#9, #11 and selective PR #17/#19 ports as implemented candidates to verify, not tasks to rebuild.
- Next: complete a secure private archive/restore and execute the branch/PR reset in a Git-capable, owner-controlled workspace; then run the read-only mainline audit. Before any further main writes, resolve the automatic production deployment behavior and require separate release approval.

---

# CURRENT PROJECT STATUS — 11 November 2026

**Active programme:** Mainline Reset & Evidence-Led Product Upgrade  
**Main HEAD at this update:** 4377fa40854622ca4cc0ad5f7b6f55b48f303404  
**Latest commit purpose:** docs-only creation of the new reset, product roadmap, UX research, AI/data strategy, pre-reset baseline and owner-decision register.

## Current reset state

- New programme files are saved under docs/UPGRADE-2026-11/.
- Root AGENTS.md and legacy instruction/queue documents are being reconciled to the new owner direction.
- The reset itself has NOT yet been executed.
- At the pre-reset snapshot, 20 branch refs existed including main; 19 non-main refs are to be removed after the private archive is verified.
- PR #3 and PR #6 remain open/draft at the time of this update. They must be closed before their source branches are deleted.
- Main is the only branch to retain. Do not merge the old branches as part of this reset.
- Current Vercel status on the docs-only main HEAD reports failure due to the project's build-rate limit. No PR-triggered GitHub Actions run was returned for that exact main SHA; recheck workflow history. Do not claim the docs update passed CI or that a new deployment is ready.
- No application source, schema, dependency, production data, production setting or migration was changed in this documentation milestone.
- No branch was deleted and no PR was closed in this milestone.

## Next required action

Follow docs/UPGRADE-2026-11/START-HERE.md Stage 0: fresh inventory, safe private archive, archive restore verification, close retired open PRs, delete all remote branches except main, verify exactly one branch remains. Then run the full read-only mainline audit before implementation.

---

## Latest live update — 2026-11-10 (PR #3 continuation / SQLite permission)

- PR #3 branch: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; live application head inspected: `f768d9a954071c8ea9cab5aa71b9ee53ac1af2e5`; PR open/draft/unmerged/mergeable; `main` unchanged at `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head Actions run [42868179073](https://github.com/fccljbplant/ExaminerAI/actions/runs/42868179073) passed all configured steps: install, isolated SQLite setup, lint, unit tests, typecheck, production build, app-page route smoke checks, authenticated role screenshots and artifact upload. Exact-head Vercel status success. No inline review threads.
- WeeklyTest edit and ReportCard concurrency review observations are verified fixed in current source and regression tests. Schema rollout remains a release gate; no executable/verified production migration or owner production approval.
- Owner authorised local SQLite development DB use for non-production migration prototyping/tests. Current execution container has no local checkout or local SQLite DB; no `.git` repo was found and network access to GitHub from container is unavailable. No local command/DB operation performed.
- `AGENTS.md`, upgrade task queue and safe logged runner remain absent. Uploaded Agent Pack runner must not be used because it changes branches and reads `.env*`. Comprehensive-report course/evidence/privacy correction remains blocked pending approved task card/workflow and actual renderer identification.
- See `docs/UPGRADE-2026-10/QUESTIONS.md` for exact blocker and safe next step. Docs-only continuity commits require exact-head CI recheck. Keep PR #3 draft/unmerged/undeployed.


## Latest live update — 2026-11-10 (PR #3 review follow-up exact-head validation)

- Live repository: `fccljbplant/ExaminerAI`; base `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft and unmerged on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Code/schema/rollout-plan head `dd69eb46906d664a860fdb43f613986783066eb3` is mergeable.
- Exact-head GitHub Actions run [42867410267](https://github.com/fccljbplant/ExaminerAI/actions/runs/42867410267) passed every configured step: dependency installation, isolated DB initialization, lint, unit tests, TypeScript, production build, app-page route smoke tests, authenticated role screenshot capture and artifact upload.
- Exact-head Vercel combined status is success. Screenshot capture is automated evidence only; no manual visual or accessibility sign-off is claimed.
- Review observation 1 is corrected: staff weekly-test score edits require selected authorised `courseId`, validate course/week, and select by learner/course/week plus explicit attempt or latest attempt. Route tests cover latest attempt and cross-course denial.
- Review observation 2 is corrected: report-card updates compare-and-swap on `id + version`; concurrent losers return `REPORT_CARD_VERSION_CONFLICT` without creating a snapshot. Regression test added.
- Review observation 3: added `docs/UPGRADE-2026-10/PR3-SCHEMA-ROLLOUT.md` with preflight, backup/restore, controlled migration, legacy NULL-course preservation, baseline version snapshots and conditional rollback. Removed production `prisma db push` from the Vercel build script. Production/demo derived Prisma model bodies now match canonical `prisma/schema.prisma`.
- **Release gate remains:** no production database inspection or migration is authorised; no executable production migration is included/validated, actual production schema/migration history is unknown, and explicit owner approval of exact target/migration/backup/restore window is outstanding. Confirm the ReportCardVersion parent delete policy before migration.
- PR discussion response updated with fixes and exact-head validation evidence. No unresolved inline review threads were returned.
- Continuity updates after the validated code/schema head: `proj_progress.md` commit `52f815f73e9de9785c4184b47eac9cf8ea7da791`; `docs/SESSION-LOG.md` commit `4a7172f0bf184459bd71f71cbc855f66b4bcb299`. Recheck checks for the final docs-only head.
- Keep PR #3 draft, unmerged and undeployed. No production data/schema operation, merge, deployment, branch switch, dependency change or main-branch write.

## Latest live update — 2026-11-10 (PR #3 review follow-up / schema safety)

- Live repository: `fccljbplant/ExaminerAI`; base `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft, unmerged on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. The code/schema/plan head before continuity updates was `c3ba33dfdcf2e2d5e48c88849a4e16eb88adc4c1`; PR metadata reported mergeable.
- Review observation 1 is corrected: staff weekly-test score edits require selected authorised `courseId`, validate course/week, and select by learner/course/week plus explicit attempt or latest attempt. Route tests cover latest attempt and cross-course denial.
- Review observation 2 is corrected: report-card updates compare-and-swap on `id + version`; concurrent losers return `REPORT_CARD_VERSION_CONFLICT` without creating a snapshot. Regression test added.
- Review observation 3: added `docs/UPGRADE-2026-10/PR3-SCHEMA-ROLLOUT.md` with preflight, backup/restore, controlled migration, legacy NULL-course preservation, baseline version snapshots, and conditional rollback. Removed production `prisma db push` from the Vercel build script.
- Regenerated production and demo derived Prisma schemas from canonical `prisma/schema.prisma`; model bodies now match byte-for-byte.
- Exact-head Actions run `42867165869` was pending at the last refresh; Vercel status pending. Recheck the final docs head and all checks before reporting green.
- **Release gate remains:** no production database inspection or migration is authorised; no executable production migration is included/validated, actual production schema/migration history is unknown, and explicit owner approval of exact target/migration/backup/restore window is outstanding. Confirm the ReportCardVersion parent delete policy before migration.
- Keep PR #3 draft, unmerged and undeployed. No production data/schema operation, merge, deployment, branch switch, dependency change or main-branch write. No local or manual browser/accessibility validation.

## Latest live update — 2026-11-10 (WeeklyTest test-fixture and attempt-selection coverage)

- Live repository: `fccljbplant/ExaminerAI`; base `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft and unmerged on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Test-change head: `788cad5987ccd869556ea6553c252b61dbfcce4e`; PR metadata reported mergeable.
- Fixed the weekly-answer route test fixture by adding its stored `week: 1`, matching the route week so the test reaches the intended AI-unavailable path and asserts no fallback grade is persisted.
- Added a staff edit-weekly-test regression test for omitted `attempt`: verifies selected learner/course/week scoping, descending attempt order and that the latest returned attempt is updated.
- Exact-code-head GitHub Actions run `42763242665` was in progress at this status update. Do not mark CI green until the completed run and any subsequent docs-head run are checked.
- Changes are test-only; no runtime code, schema, migration, dependency, production data, merge or deployment change. No local checkout or local tests/browser/a11y review were available.
- Keep PR #3 draft/unmerged. Production schema rollout remains gated on additive migration/rollback review and explicit production approval.

## Latest live update — 2026-11-10 (comment write scope and audit trail)

- Live repository: `fccljbplant/ExaminerAI`; `main` HEAD remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Validated application-code head: `b12017d0a5dd4d26da0fcad3726b2b9c9cacffa7` (399 commits / 123 changed files at refresh). No reviews or inline review threads returned.
- Staff comment POST requires an authorised selected course and at least one activity link. Every supplied activity must belong to the same learner and course. PATCH/DELETE require `courseId` and revalidate all existing linked records. Unassigned/general and mixed-course legacy comments remain read-only through staff writes; learner self-history remains cross-course.
- Comment create/edit/delete now emit `AuditLog` events (`comment_created`, `comment_updated`, `comment_deleted`). Audit metadata is minimised to course ID, activity types and changed field names; it excludes comment text, learner ID and activity IDs. The existing audit helper's webhook sink may receive these minimised events when configured.
- Instructor Comments composer remains unavailable; no UI write surface was restored. A future composer must attach feedback to a selected activity in the selected course.
- Exact-head GitHub Actions run `42741613904` passed all configured steps: install, isolated DB setup, lint (0 errors / 7 warnings), unit tests (438 passed across 41 files), TypeScript, production build, 83/83 app-page route smoke checks, authenticated screenshots for four roles across seven viewport sizes, and artifact upload `13729682267`.
- Vercel status remains failed due to the project build-rate limit; no Ready preview is verified. No local checkout/tests or manual browser/axe/keyboard/screen-reader/zoom/reflow review were available.
- No schema/migration/dependency/production-data change, merge, deployment or main-branch write. PR #3 remains draft.
- Next: coordinated course-specific WeeklyTest/ReportCard identity and APIs, preserving legacy null-course rows and report-card version history. The Agent Pack `AGENTS.md`, queue and logged runner remain absent from this branch; do not invent a task card or bypass that prerequisite.

## Latest live update — 2026-11-10 (course-scoped comment write safeguards)

- Live repository: `fccljbplant/ExaminerAI`; `main` HEAD remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Current validated application-code head: `c4a63e5c0779aa48150c8405e019e7546549983d` (387 commits / 121 changed files at refresh). No reviews or inline review threads returned.
- Comment write endpoints are now course-scoped: staff POST requires `studentId`, an authorised `courseId`, and at least one activity link; every supplied link must resolve to that learner and course. PATCH/DELETE require the selected course and verify every existing linked record against it. General, unassigned and mixed-course comments cannot be created or mutated through these routes. Learner self-history remains cross-course.
- The comment composer remains unavailable in the instructor profile. No UI composer was restored; the API contract is ready for an activity-linked UI only after that UI is implemented and tested.
- Exact-head GitHub Actions run `42740191410` passed: install, isolated DB setup, lint (0 errors; 7 existing warnings), unit tests (436/436 across 41 files), TypeScript, production build, 83/83 app-page route smoke checks, authenticated screenshots for four roles across seven viewport sizes, and artifact upload (`13729306143`).
- Vercel status remains failed because the project build-rate limit is reached; no Ready preview is verified. No local checkout or local tests were available; no manual browser, axe, keyboard, screen-reader, zoom or reflow review was performed.
- No schema/migration/dependency/production-data change, merge, deployment or main-branch write. PR #3 remains draft.
- Next: prepare the coordinated course-specific WeeklyTest/ReportCard schema and API slice with legacy null-course preservation, versioning, concurrency/idempotency tests and rollback notes. The Agent Pack `AGENTS.md`, queue and logged runner are absent from this branch, so no Agent Pack task card can be executed or invented; keep that prerequisite explicit.

## Latest live update — 2026-11-10 (course-specific learner-detail APIs and write safeguards)

- Live repository: `fccljbplant/ExaminerAI`; `main` HEAD remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Validated application-code head: `a5e1ad903d8da5f39d455f297cbf3e94df7e2589` (379 commits / 121 changed files at refresh). No PR reviews or inline review threads returned.
- Exact-head GitHub Actions PR run `42737212881` passed install, isolated DB setup, lint, unit tests, typecheck, production build, app-page route smoke tests, authenticated role screenshots and artifact upload.
- Vercel combined status remains failure due to the project build-rate limit. No Ready preview is confirmed.
- Instructor learner-detail selection remains course-specific: one shared course auto-selects; multiple shared courses require explicit selection; invalid course IDs are denied; all course-bearing drill-down queries are filtered to the selected course.
- Added shared server-side staff/learner course-scope resolution. Growth report, comment reads and mentor briefing now require an authorised selected course for staff and filter source records to that course. Missing growth evidence is null/unavailable; a measured zero remains valid. Mentor briefing no longer uses global login/current-week values and returns `insufficient_data` when there is no evidence.
- Growth panel is restored with the selected course query. Competency/mastery remains clearly learner-level because the schema has no courseId. Comments composer remains unavailable because comment writes are not yet course-scoped.
- Weekly-test retake/unlock and report-card generation controls are withheld in the course-specific view. Existing APIs use learner/week identity and report-card generation aggregates cross-course evidence; re-enabling would risk cross-course mutation and false reporting. Existing course-linked rows remain viewable.
- Added helper and route tests for staff course intersections, growth course filtering/missing evidence, comments same-course linked-record filtering, mentor briefing course filtering/no-data status, plus earlier course-selector route tests.
- No schema, migration, dependency, production-data, main-branch, merge or deployment change. No local browser/axe/manual accessibility validation.
- Next: course-specific WeeklyTest/ReportCard composite identity and CRUD/generation, with legacy null-course preservation and additive migration/rollback plan; then scope comment write endpoints and provide an activity-linked composer. Keep PR #3 draft/unmerged.


# TraineesAI project status

## Latest live update — 2026-11-10 (instructor learner-detail course isolation)

- Live repository: `fccljbplant/ExaminerAI`; `main` HEAD `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Code head after this slice: `01bb794544bfabb6beca10abd32a1ad97a094ec1` (350 commits / 112 changed files). No reviews or inline review threads returned.
- Fixed the instructor learner-detail multi-course labelling/aggregation defect. Exactly one shared course is auto-selected; multiple shared courses return a course chooser and no academic/activity records until the instructor selects one. Every course-bearing query is filtered to that selected course, and the server rejects course IDs outside the authorised staff/learner intersection.
- The profile UI includes an accessible course selector, displays the selected course name, and avoids showing stale prior-course data while a switch request is pending. Course-less SkillMastery is labelled learner-level and separated from course results.
- Learner-wide growth summaries, general comments and global mentor briefing are withheld from this course-specific screen pending course-scoped API support. Their separate APIs have not been changed; do not restore those panels until that follow-up is implemented and tested.
- Added unit tests for one-course auto-selection, multi-course explicit selection, authorised/invalid selection and empty scope. No route-level integration test was added in this slice.
- Previous exact-head Actions run `42731168978` passed install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke, authenticated role screenshots and artifact upload on prior head `a00590da6e21c1c25ba4502bef8956bc7a1ea32e`. No Actions run yet returned for implementation head `01bb794...`; this change is not yet CI-validated. Vercel combined status remains failure due to build-rate limit.
- No local test/typecheck/lint/build/browser/axe validation was available. No schema/migration/dependency/production-data changes, merge, deployment or main-branch write.
- Next: obtain exact-head CI; inspect failures; add route-level tests for course selection and selected-course query isolation; separately scope Growth/Comments APIs before restoring those panels. Keep PR #3 draft/unmerged.


**Snapshot date:** 2026-11-10 (live PR #3 code head c4a63e5c0779aa48150c8405e019e7546549983d)  
**Repository:** [fccljbplant/ExaminerAI](https://github.com/fccljbplant/ExaminerAI)  
**Active UX baseline PR:** [#3 — UX audit: fix dashboard KPI accuracy and safer failure states](https://github.com/fccljbplant/ExaminerAI/pull/3)

## Latest live update — 2026-11-10 (course-specific report-card/certificate decision)

- PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; live head at refresh: `ffe5abff4d5c8edecd677743141c769c901be237` (312 commits, 111 changed files).
- Exact-head GitHub Actions run [42725583405](https://github.com/fccljbplant/ExaminerAI/actions/runs/42725583405) passed all configured quality steps: dependency installation, isolated test DB, lint, unit tests, TypeScript, production build, app-page route smoke tests, authenticated role screenshots and artifact upload.
- Vercel combined status remains failure due to the project build-rate limit; no Ready preview is verified.
- Owner decision recorded: **each course has its own report card and course certificate**.
- Source review confirms the current schema/API does not yet implement that decision: ReportCard and WeeklyTest are both unique by `(userId, week)` despite nullable courseId; report-card generation and manual CRUD are learner/week scoped; certificate request/approval/retrieval is learner-global and selects the first student enrollment on issue.
- The report-card/certificate findings and a coordinated course-scoping plan are recorded in `docs/UPGRADE-2026-10/QUESTIONS.md`. Historical null-course records must not be assigned to an arbitrary course. No schema or application code changed in this review.
- Project analysis remains separately blocked: it combines learner-global legacy User.project* fields with course-bearing project records. Comprehensive-report `managementAttitude` visibility remains owner-blocked.
- No local checks or browser/axe checks were run. No production data/schema migration, deployment, merge, branch switch or main-branch write occurred.

### Next actions

1. Plan the coordinated course-specific report-card, WeeklyTest identity, report-card CRUD, and certificate request/approval/retrieval changes with additive migration and rollback notes.
2. Preserve historical null-course records without guessed backfills; define how legacy records are displayed.
3. Add route/model tests for same-week records across two courses, tenant/course access, and per-course certificate idempotency.
4. Continue the remaining scoped endpoint review on PR #3; keep the PR draft and do not merge/deploy without owner approval.

## Latest live update — 2026-11-10

- PR #3 is open, draft, unmerged and mergeable on ux-audit/fix-dashboard-truthfulness-and-agent-safety; latest head 6fe426c2cbd571fd1f77569b6421f6cc4f81ef83.
- The staff portfolio route now applies authorised-course intersection to ProjectTask, DailyLog, Interaction, WeeklyTest and ReportCard. Instructor, org-admin, platform-admin and explicit student-grant paths retain their respective access rules; grant dataScope is enforced and the route fails closed if a grant disappears during scope resolution.
- Instructor comments are scoped through linked academic records and exclude unlinked/mixed-course references. Learner support/reflection fields remain off.
- Route tests cover instructor course isolation, org-admin linked-course scope, grant fallback, restricted wellbeing grants, grant disappearance and denied access.
- Competency remains course-less and unchanged; CourseEnrollment.expiresAt treatment remains unresolved and unchanged.
- Exact latest-head Actions are pending/not returned. Earlier run 42721835502 on a preceding head was cancelled before tests started after subsequent branch updates. Vercel is pending. No local checks or browser/axe validation were available.
- The owner-requested organisation assignment/reassignment and instructor course-access removal approval requirements have been appended to the end of the product-wide blueprint and Issue #4, mapped to future Workstream J. They are not part of PR #3.
- No schema/dependency/production-data/merge/deploy change; no branch switch.

### Next actions
1. Verify the latest-head Actions run and address failures.
2. Review the final diff and all portfolio route regression tests.
3. Continue the remaining PR #3 plan in sequence after this slice is green.
4. Keep support/crisis off, and preserve the open Competency/expiry decisions.

## Previous live update — 2026-11-10

- PR #3 remains open, draft, unmerged and mergeable on ux-audit/fix-dashboard-truthfulness-and-agent-safety; live head 9a02b6567282da5a4604b7237a2d48e5e4354a8c (278 commits, 110 changed files).
- Portfolio course-scope correction is committed in src/app/api/students/[id]/portfolio/route.ts; route tests are in src/app/api/students/[id]/portfolio/route.test.ts.
- Course-bearing portfolio queries (tasks, daily logs, interactions, weekly tests, report cards) now use the intersection of staff-authorised courses and learner enrolments. Org-admin scope uses active same-org membership plus OrgCourse links. Instructor explicit-grant fallback remains bounded to the learner's course enrolments and respects grant dataScope.
- Comments are scoped through the authorised academic records they annotate. Unlinked comments are omitted. Learner support fields remain off; restricted wellbeing/crisis grants do not receive academic records.
- Competency remains learner-level/course-less in the schema and is unchanged. Expired CourseEnrollment semantics remain unchanged pending clarification; no expiry filter was added.
- Exact-head Actions run has not yet been returned; Vercel status is pending. Previous green CI on 43aa359 predates this implementation and is not validation of this head. No local tests/lint/typecheck/build/browser/axe checks were run.
- Agent Pack queue/runner is still absent and was not used. All work remained on the existing PR #3 branch. No schema/dependency/production-data/merge/deploy change.

### Next actions
1. Recheck exact-head Actions and fix any failures on this branch.
2. Review the full diff and test output for route-level tenant/course/grant boundaries.
3. Preserve the open decisions on course-less Competency and expired-enrolment treatment; keep support/crisis features default-off.
4. Continue the remaining PR #3 work plan in sequence; keep PR draft and do not merge/deploy without approval.

## Historical live update — 2026-11-09

- PR #3 remains **open, draft, unmerged**, on the existing branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; current head `b4f937c098fda0b6f7aa78f2d1ad31944b9c71f6` (250 commits, 109 changed files).
- Actions run `42658325358` completed successfully on the immediately preceding head `875e80c6bca63654dd88ab245612ab49f614b382`. All configured steps passed: install, isolated DB, lint, unit tests, typecheck, production build, route smoke, authenticated screenshots and artifact upload.
- Two commits were added after that green run: `98c4b328` (marketplace filter accessibility + Featured-only control) and `b4f937c0` (reject non-learner targets in the v2 instructor student-detail endpoint). No workflow run has yet been returned for the current head; do not claim those changes passed CI.
- Vercel combined status is still failure due to the project build-rate limit. No current Ready preview is confirmed.
- No local tests/build, browser, axe or manual accessibility checks were available.
- Learner-support consent/gating/audit workflow remains off and incomplete. Comprehensive-report `managementAttitude` classification remains blocked pending owner decision in `docs/UPGRADE-2026-10/QUESTIONS.md`.
- Next: verify CI on current head; add route-level regression coverage for learner-target rejection and org/instructor scope; continue remaining `assertCanAccessStudent` response-field review; continue marketplace/catalogue and role journey slices without paid checkout or support-data expansion.

## Live Git and PR state

| Ref | Commit | State |
|---|---|---|
| `main` | `fc70a296b28334ff45e8b081a0f8fe9a070be3a4` | PR base SHA; no changes made to main. |
| PR #3 branch | `b4f937c098fda0b6f7aa78f2d1ad31944b9c71f6` | Latest live PR head after marketplace and learner-target fixes. |

PR #3 live metadata:
- State: **open**
- Draft: **yes**
- Merged: **no**
- Mergeable: **yes**
- Base: `main` (`fc70a296b28334ff45e8b081a0f8fe9a070be3a4`)
- Head branch: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`
- Head SHA: `b4f937c098fda0b6f7aa78f2d1ad31944b9c71f6`
- Commits: **250**
- Changed files: **109**
- No submitted PR reviews or inline review threads were returned.

## Current CI and preview status

- Workflow run [42654213454](https://github.com/fccljbplant/ExaminerAI/actions/runs/42654213454) completed successfully on commit `ee6dc635`. All quality-job steps passed: dependency installation, isolated DB initialization, lint, unit tests, typecheck, production build, route smoke tests, authenticated role screenshots and artifact upload.
- That successful run predates the latest three UI commits (`11f928f5`, `e79977d3`, `0cdbb5ac`). Do not treat it as validation of the latest head.
- Workflow run [42655501293](https://github.com/fccljbplant/ExaminerAI/actions/runs/42655501293) is running on the latest UI-fix head. At last refresh, checkout and Node setup passed; dependency installation was in progress; lint, tests, typecheck, build, smoke and screenshots were pending.
- Vercel combined status remains **failure** due to the project build-rate limit. No Ready preview is confirmed.
- No local checkout, local test/build or manual browser/axe run was available.

## Latest work in this session

- Learner dashboard: session-duration chips and the Projects 'See all' action now meet a 44px touch target and have visible keyboard focus styling.
- Instructor dashboard: primary header links have 44px minimum height; at-risk learner rows have 48px minimum height and visible keyboard focus.
- Organisation dashboard: announcement title input is 44px high; announcement retry control and both top-level action links have 44px minimum targets and visible keyboard focus.
- Added `docs/UPGRADE-2026-10/QUESTIONS.md` to record the unresolved comprehensive-report field-classification mismatch. No report fields were changed pending owner decision.

## PR #3 scope

- Accurate instructor queue and in-review KPIs from complete database aggregates.
- Correct roster activity/latest scored test/at-risk calculations with regression tests.
- Retryable learner dashboard failure state; generic platform dashboard failure response with server-side logging.
- Safer agent instructions and credential/database handling.
- 44px navigation targets, responsive platform-admin navigation, and instructor active-route corrections.
- Theme contrast validation across 12 effective theme states, including generated brand palettes.
- 83-route structural inventory and CI for lint, tests, typecheck, build, route smoke tests and authenticated role screenshots.
- Baseline screenshots for four roles across seven viewport sizes (28 screenshots plus manifest).
- UXPeak research, screenshot audit, scorecard, role design decisions and expanded UX plan.

## Review observations and risks

1. **Final-result response:** staff access remains scoped through `assertCanAccessStudent(..., "content_only")`. Individual behavioural analysis is now generated and returned only for the learner viewing their own result; staff views retain academic metrics, areas to improve, readiness and project/course data without the behavioural-pattern field.
2. **Organisation-admin scope:** `src/lib/auth.ts` now requires an active org-admin membership, active learner membership in the same organisation, and learner enrolment in a course linked to that organisation via `OrgCourse`. Explicit grants cannot widen an org admin beyond that organisation/course boundary. The v2 instructor student-detail route applies the same organisation/course checks.
3. **Support-data privacy:** org admins and platform admins are denied explicit `wellbeing_only` and `crisis_only` scopes. The v2 student-detail route does not return confidence or `psychWeekly` by default; the visibility helper requires both consent and a feature gate, and its defaults are false. The portfolio route forces staff views to `content_only` and queries daily logs as dates only; support reflections/confidence are not loaded into the response. Staff access grants alone do not activate support data.
4. **Portfolio field contract:** staff portfolio `content_only` includes academic/course content (tasks, report cards, interactions, weekly tests and competencies) but excludes daily reflections. Instructor feedback comments remain visible to the instructor; they are not exposed to org/platform admins through this route.
5. **Remaining gap:** the per-organisation consent workflow, owner-approved consent wording, `learner_support_v1` setting and audit logging for support/case views are not implemented/verified. No support-signal feature is enabled. A designated Learner Support Lead crisis-case capability and handling-record access remain future work.
6. **Testing gap:** pure unit tests were added for support-signal consent/feature gating and final-result behavioural-analysis visibility. Route-level integration tests for tenant/course access, grant revocation, and response filtering are still required.
7. Instructor queue counts use full database counts rather than the five-row preview. Roster risk count is derived from the full risk-filtered roster response; latest scored test selection is deterministic by week.
8. Platform dashboard aggregation errors are logged server-side and returned as a generic service error. Learner profile lookup failure returns service-unavailable rather than a false empty dashboard.
9. No PR reviews or inline review threads were found. Owner review remains outstanding.

## UX evidence and remaining validation

- The baseline screenshot matrix covers 4 roles × 7 viewports: 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080 and 2560×1440.
- The recorded manifest reported no horizontal document overflow in those 28 captures.
- Screenshots use synthetic CI-only accounts and an isolated SQLite database; they represent empty/light baseline states, not production/customer data.
- This is **not final UX/accessibility sign-off**. Still required: populated/high-volume, error, permission-denied and stale-data fixtures; core interaction walkthroughs; axe checks; manual keyboard/focus and screen-reader checks; reduced-motion validation; zoom/reflow; console/network review; performance budgets; and user task testing.
- The screenshot artifact was documented as retained through 2026-11-15.

## Continuity and wider programme

- `docs/PROJECT-CONTINUITY.md` is the session-start guide.
- `docs/PROJECT-STATUS.md` is this current snapshot.
- `docs/SESSION-LOG.md` is append-only.
- Wider role redesign remains tracked under [Issue #4](https://github.com/fccljbplant/ExaminerAI/issues/4) and [the UX role-experience redesign plan](./UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md).
- Workstreams A–L remain roadmap scope; Workstream M is mandatory for future UI work.
- The Agent Pack's `AGENTS.md`, task queue, decision/progress files and `scripts/agent/*` runner/evidence tooling were reported missing in the PR description. Do not claim task-card/off-peak enforcement is active until verified.

## Next actions

1. Continue fixes on the existing PR #3 branch, not `main`. Keep the PR draft.
2. Resolve the Agent Pack prerequisite: `AGENTS.md`, `docs/UPGRADE-2026-10/START-HERE.md`, `docs/UPGRADE-2026-10/QUEUE.md`, `scripts/agent/run-logged.mjs`, `scripts/agent/section.mjs`, `scripts/agent/check-evidence.mjs` and `docs/UPGRADE-2026-10/QUESTIONS.md` were not found on the PR #3 branch. The earlier `fix/ui-simplification-safe` branch also lacks these files and is not the PR #3 head.
3. Once the approved task card and runner are present, map final-result fields by audience, align `content_only` filtering, restrict support indicators to learner/in-scope instructor, and add route-level regression tests. Preserve required functionality.
4. Confirm owner-approved consent text, the per-org `learner_support_v1` default-off gate, audit logging and the designated Learner Support Lead capability before enabling/expanding support data.
5. Re-fetch live PR head and CI after any changes. Keep PR #3 in draft; do not mark ready, merge, or deploy without explicit owner approval.

---

**Update discipline:** This is a dated snapshot, not live status. Re-check GitHub before every session and update this file when branch head, PR state, checks, deployment, reviews, or next actions change.

## 2026-11-09 owner clarification — organisation-admin oversight

The owner has clarified that organisation admins **must be able to view organisation-scoped student academic data and instructor–student teaching activity for legitimate oversight of instructors**. This includes the student/course context needed to review enrolment, learning progress, attendance or participation, assessments, assigned work, feedback, and recorded teaching/mentoring interactions.

This is not unrestricted access to every learner field. Enforce the following boundaries server-side:
- Scope every view to the organisation and courses the admin is authorised to oversee; no cross-tenant access.
- Preserve learner self-service and the instructor's legitimate own-course learner views.
- Do not expose individual learner-support/psychological indicators, private counselling content, or crisis signals to ordinary org admins. Designated Learner Support Leads retain only the separately specified crisis-case and handling-record access.
- Do not create psychological or behavioural profiles/scores of instructors. Org oversight is about auditable teaching work and recorded course interactions, not inferred instructor psychology.
- Keep academic outcomes and teaching-activity records distinct from learner-support data; field-level classification and explicit response schemas are required.

This owner direction clarifies the org-admin academic/operational oversight audience; it does not approve broad access to support-signal data or cross-tenant records.

## Agent Pack received — installation safety review

- agent-pack.zip was uploaded in this ChatGPT conversation and inspected.
- The pack's queue runner scripts/agent/run-queue.mjs automatically switches to or creates upgrade/phase-<N> branches. That conflicts with the owner's explicit instruction to work only on existing PR #3 branch ux-audit/fix-dashboard-truthfulness-and-agent-safety.
- The bundled OpenCode plugin .opencode/plugins/offpeak-guard.js reads repository .env, .env.local, and .env.production files to detect remote database configuration. Project rules prohibit reading any .env* files.
- Therefore the pack has **not** been installed or activated on the repository branch. Preserve the original upload; adapt/review its branch and secret-safety behaviour before activation. No source-code changes or agent-runner checks were performed in this step.
- ChatGPT's Project Files library cannot be written directly from this chat. The uploaded archive remains attached to this conversation; add it through the Project's Files UI if it must be available to every Project chat.


## 2026-11-09 — PR #3 access-control implementation update

- Live PR #3 remains open, draft, unmerged, based on `main`, and on the existing branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Latest branch head at this update: `02ecbc28a1400610c333aa6f8099679a7c0fa4dc`.
- Updated `src/app/api/v2/instructor/students/[id]/route.ts` so instructors remain limited to learners in courses they teach, while org admins are limited to learners with active membership in the same organisation and courses explicitly linked through `OrgCourse`.
- The same endpoint now omits daily confidence values and skips `computePsychWeekly` for org admins. Instructors retain those fields through the existing instructor path. The response still includes academic/course and operational activity data for authorised org admins.
- Added `src/modules/instructor-portal/student-detail-visibility.ts` and unit tests covering role eligibility and the daily-log response projection.
- CI run `42643245325` on intermediate commit `f5dcef6ead89a267624002ba72444f5e18fb20cb` was cancelled during lint after a later branch update superseded it. No completed lint/test/typecheck/build result exists yet for the latest head. Re-trigger/verify CI before treating this change as validated.
- No local checkout or local test runner was available in this session. No production data, merge, or deployment action was performed.
- Remaining security work: review and correct final-result/portfolio field-level access, verify consent/default-off and audit requirements before enabling learner-support signals, and add route-level tenant/course access tests. Do not broaden `content_only` or expose learner-support data to ordinary org admins.


## 2026-11-09 — Continued PR #3 access/privacy fixes

- Live PR #3 remains open, draft, unmerged, based on `main`, and on the existing branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Latest head: `fea1683ef68245fdbedd8a9b397b529fa183bcff` (207 commits, 105 changed files).
- `src/lib/auth.ts`: org-admin access now requires active same-org admin/learner memberships and learner enrolment in an `OrgCourse`-linked course. Org-admin access grants cannot bypass that boundary. Platform/org admins are denied explicit wellbeing/crisis scopes; instructor course membership does not implicitly grant those scopes.
- `src/app/api/students/final-result/route.ts`: staff views no longer trigger AI behavioural-pattern generation or receive `behavioralPattern`; learners retain their own result field.
- `src/app/api/students/[id]/portfolio/route.ts`: all staff portfolio responses are clamped to academic `content_only`; daily reflections are not loaded (date-only query), and private instructor comments are returned only to instructors.
- `src/app/api/v2/instructor/students/[id]/route.ts`: confidence/`psychWeekly` data remains off by default because the helper requires both explicit consent and a feature gate, both defaulting false. Org admins remain limited to org-linked course enrolments.
- Added/updated unit tests for default-off support visibility and learner-only behavioural analysis.
- CI run `42643565316` passed on earlier head `d850ff0dc13fd910976136e894360c687aa9c1d2`. Run `42644831199` on intermediate head `84dfef671abdbd8650b12f1b06067e776715b884` was cancelled during dependency installation. No completed Actions run is verified on latest head. Latest Vercel status is a build-rate-limit failure.
- No local checkout/tests, production data changes, merge, or deployment. PR remains draft.


## 2026-11-09 follow-up — minimise check-in data in staff report cards

- Live PR #3 remains open, draft, unmerged, based on `main`, on the existing branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Application fix commit: `fe2a700c363cea57a99b96807d11a9008cb69c32`.
- In `src/app/api/students/[id]/generate-report-card/route.ts`, the staff-facing academic report-card route now selects only `dailyLog.date`. It uses the count of check-ins; it does not need or load private reflection text, confidence ratings, or error notes.
- Existing report-card behaviour and check-in counts are unchanged.
- Workflow run `42654057660` was triggered for this commit and is in progress. At the last job refresh, checkout and Node setup passed; dependency installation was in progress; database setup, lint, tests, typecheck, build, route smoke and screenshot capture had not yet run.
- The prior run `42645275411` was cancelled during Node setup; all quality steps were skipped. It provides no validation evidence.
- Vercel status for the application fix commit was pending at the last check. No Ready preview is confirmed.
- No local test/build, browser or accessibility run was available. No production data, merge, or deployment action was performed.


Latest UI follow-up: organisation dashboard Manage people / Full audit links and learner dashboard Projects See all link also have 44px minimum target size and visible keyboard focus. Latest head `5eafaa9e`; recheck Actions because the previous run `42655501293` was on an earlier UI head and does not validate these final changes.


## 2026-11-09 — UXPeak Workstream M dashboard follow-up

- Latest branch head: `6d90c757a2273c3d6a49677d8766d50d2176f094`; PR #3 remains open, draft and unmerged on the existing branch.
- Learner and staff dashboard errors now use safe recovery guidance instead of raw request error text.
- Instructor “View all students” now has a 44px target and visible focus. Organisation members receive an actionable empty state; announcement body has visible focus. Platform organisation/audit empty states include relevant navigation, and the skeleton now matches eight KPI cards.
- The UI work follows the UXPeak role redesign / Workstream M principles while retaining existing tokens and components. No new dependencies or parallel design system.
- CI run `42655880066` passed on prior head `94869a6e`; it does not validate the new changes. No workflow run had yet been returned for `6d90c757`.
- No local build/test or post-change browser/screenshot/axe review was available. The UX scorecard remains provisional; do not claim visual sign-off.
- Vercel remains blocked by the daily deployment API quota. No deployment or merge was performed.
- Next: verify current-head CI, inspect before/after screenshots at the required viewports, and continue route-level RBAC/privacy tests in parallel.


## 2026-11-09 — UXPeak Pro product-wide scope clarification

Owner clarified that UXPeak must cover gamification, product UI, role dashboards, catalogue/marketplace, course discovery/enrolment, tutorials, AI assistance and helpdesk—not just dashboard polish. Added `docs/UXPEAK-PRO-PRODUCT-WIDE-BLUEPRINT.md` as the product-wide experience inventory and acceptance plan. It distinguishes marketplace course preview from paid commerce (not approved), and ordinary product help from consent-gated learner support/crisis handling. Gamification remains phase-gated per the Master Upgrade Prompt. Continue incremental PR #3 dashboard work in parallel with privacy/security; do not expand into unapproved provider, payment, support-data or production changes.


## 2026-11-09 — Instructor course-scope privacy hardening

- Latest PR #3 application head: `d78ec3e7589edd9c3e907de9a6707f3848bb6384`; PR remains open, draft and unmerged.
- Fixed cross-course learner-data exposure in the v2 instructor drill-down. The route now intersects staff-authorised course IDs with the learner's enrolments and scopes weekly tests, report cards, daily logs, project tasks, certificates and engagement events to that intersection.
- Fixed the instructor roster's daily-log aggregate and project-task progress queries to use taught course IDs rather than learner IDs alone.
- Added unit coverage for the course-ID intersection helper (overlap, no overlap and duplicate IDs).
- GitHub Actions run [42661008830](https://github.com/fccljbplant/ExaminerAI/actions/runs/42661008830) passed all configured steps on this exact head: install, isolated DB init, lint, unit tests, TypeScript, production build, app route smoke tests, authenticated role screenshots and artifact upload.
- The screenshot artifact is available as `role-dashboard-screenshots` until 2026-11-16. This validates screenshot capture, not a manual visual/accessibility review.
- Vercel check remains failed due to the daily build-rate limit; no current preview is confirmed. No production deployment, merge, main-branch write or production-data operation occurred.
- Residual: `SkillMastery` and legacy `Competency` lack `courseId` in the current Prisma schema and remain learner-level profile data. Their cross-course semantics need an explicit data-model decision before partitioning. Comprehensive-report `managementAttitude` visibility remains blocked in `docs/UPGRADE-2026-10/QUESTIONS.md`.
- An interactive Vercel sandbox was unavailable (403); verification used the GitHub-hosted Actions runner. Continue only on the existing PR #3 branch.


## 2026-11-09 — PR #3 portfolio course-scope review (latest head)

- Live PR #3: open, draft, unmerged, mergeable; branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; head `9ac14c13069bbe91b8a1fca54d305514f66590e3`; base `main`; 262 commits / 109 changed files.
- Exact-head GitHub Actions run [42661692753](https://github.com/fccljbplant/ExaminerAI/actions/runs/42661692753) completed successfully. Its quality job passed dependency installation, isolated DB initialization, lint, unit tests, TypeScript, production build, app-page route smoke tests, authenticated role screenshots and artifact upload.
- Exact-head combined status: Vercel failure due to the build-rate limit. No current Ready preview is confirmed.
- Reviews and inline review threads: none returned.
- Read-only review found a remaining course-scope issue in `src/app/api/students/[id]/portfolio/route.ts`: after `assertCanAccessStudent(..., "portfolio")` verifies at least one shared course, the endpoint queries `ProjectTask`, `Interaction`, `WeeklyTest` and `ReportCard` by learner ID only. All four models have `courseId` in `prisma/schema.prisma`. A multi-course learner can therefore expose academic records from courses outside the instructor's authorised courses or the org admin's linked courses. The staff response's `content_only` clamp excludes daily-log support data but does not scope those academic records by course.
- `Competency` remains learner-level in the schema (no `courseId`); its semantics are not changed. The v2 instructor student-detail helper's support-signal predicate defaults false and is instructor-only; the route calls it without consent/gate values, so those support fields remain omitted by default.
- Agent Pack prerequisite remains blocked: `AGENTS.md`, `docs/UPGRADE-2026-10/QUEUE.md` and `scripts/agent/run-logged.mjs` are absent (404). The uploaded pack was not installed because its runner switches/creates branches and its guard reads `.env*` files, both conflicting with project safety rules.
- **No application code changed.** The portfolio fix is blocked until an approved task card and safe runner/execution path are available. No branch switch, merge, deployment, production-data change, or main-branch write.
- Next: restore/adapt the Agent Pack safely on this existing branch; then implement authorised-course intersection in the staff portfolio endpoint and route-level tests, including instructor multi-course isolation, org-admin tenant/OrgCourse boundaries, no shared course and grant revocation. Clarify expired enrollment handling and leave course-less competency semantics untouched pending owner decision.


## Live refresh — 2026-11-10

- PR #3 remains **open, draft, unmerged and mergeable** on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; live head `43aa35909b85275432619303baddf845f852e5df` (266 commits, 109 changed files).
- Exact-head Actions run [42663209736](https://github.com/fccljbplant/ExaminerAI/actions/runs/42663209736) passed all configured quality steps: dependency install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke tests, authenticated role screenshots and artifact upload.
- Exact-head Vercel status is **failure** due to the build-rate limit; no current Ready preview is verified.
- The staff portfolio cross-course finding remains open. The current endpoint calls `assertCanAccessStudent`, but then fetches ProjectTask, Interaction, WeeklyTest and ReportCard by `userId` without restricting `courseId` to the caller's authorised courses intersected with learner enrolments. Existing helper tests cover set intersection, but not the endpoint's authorisation derivation or response boundary.
- Agent Pack `AGENTS.md`, task queue and logged runner are not present on the branch. The uploaded runner's branch-switching behaviour conflicts with the repository's existing-branch-only rule. Do not run it unchanged; do not edit application code until an approved task card and safe runner/equivalent are available.
- No application code or schema changed in this refresh. No local tests, browser, axe or manual accessibility checks were run. CI success is GitHub-hosted evidence for the current head only.
- Separate Issue #4 work: org-admin assignment/reassignment of trainees within their organisation, plus instructor course-access removal with org-admin approval for organisation instructors, self-approval for independent instructors, and explicit confirmation. Not included in PR #3.

### Next actions
1. Resolve the branch-preserving task-card/logged-runner prerequisite without reading `.env*` or switching branches.
2. Implement the portfolio authorised-course intersection and route-level regression tests only after that prerequisite is satisfied.
3. Preserve the current support-data default-off policy; do not alter course-less competency semantics or expired-enrolment treatment without verified rules.
4. Keep PR #3 draft; no merge, deployment or production-data changes without explicit approval.


## Latest PR #3 continuation note — 2026-11-10

- Latest branch head at this note: 4d394819e074f528b12b821d6d69d54a45c5739f; PR #3 remains open, draft, unmerged and mergeable.
- Portfolio course-scope correction and route regression tests are committed. Exact-head Actions remain unverified; the previous run was cancelled before quality checks. Vercel is rate-limited. No local checks were available.
- Next planned PR #3 slice identified by source review: scope the course-bearing relations in src/app/api/students/final-result/route.ts (weekly tests, interactions, report cards, project reports and tasks) to the same authorised course boundary. Preserve learner self-view and required academic/career fields; behavioralPattern remains learner-self only. See QUESTIONS.md for field classification and the comprehensive-report blocker.
- Org-admin assignment/reassignment and instructor course-access approval requirements have been appended to the end of the product-wide blueprint and Issue #4 as future Workstream J scope.


## 2026-11-10 — Final-result course-scope correction

- On the existing PR #3 branch, `src/app/api/students/final-result/route.ts` now scopes staff result data to authorised course IDs intersected with the learner's enrolments.
- Instructor scope: teaching enrolments, with explicit active `full`/`content_only` student-grant fallback only when no shared course exists. Org-admin scope: active admin and learner memberships in the same org, linked OrgCourse rows, then learner-enrolment intersection. Platform admins are bounded to learner enrolments; demo/other staff require an active explicit grant.
- `weeklyTests`, `interactions`, `reportCards`, `projectReports` and `tasks` are all course-filtered. Empty/revoked scope fails closed before loading report records; staff targets must be learners.
- Learner self-view remains cross-course. Required academic/career fields and project/task outputs remain; `behavioralPattern` remains learner-self only.
- Added route-level tests for instructor, org-admin, explicit-grant, empty/revoked scope, denied access, platform-admin and learner-self paths.
- Code head: `0edeed1f22b7e7274ed3f05b9ce3982aee7f43b8`. No Actions run was returned for that head at the time of this update; previous-head run `42722331613` passed but does not validate this change. Vercel remains failed by build-rate limit. No local tests/build/browser/axe checks were run.
- Multi-course duration/phase semantics and existing relation query limits remain unchanged. Comprehensive-report `managementAttitude` classification remains owner-blocked; learner-support/crisis features remain off.
- PR #3 remains open and draft. No schema/dependency/production-data change, merge, deployment or branch switch.


## Institutional academic policy decisions — 2026-11-10

Owner delegated resolution of the open academic policy questions. The adopted direction is recorded in full in `docs/UPGRADE-2026-10/QUESTIONS.md`.

- Course is the independent academic record: report cards and weekly tests keyed by learner + course + week; certificates by learner + course-completion instance.
- Course-specific published grading/pass/retake/certificate rules; no universal threshold. Missing evidence is unavailable, never zero/default/fabricated.
- Report cards are evidence-based, reviewable and versioned. Weekly test sequencing remains learner-paced and server-enforced.
- Course-specific project analysis; never combine learner-global legacy project fields with a different course's project data.
- Remove subjective automated “management attitude/manager readiness” personality labels; use observable rubric-based competencies and human review.
- Plagiarism indicators trigger fair human academic-integrity review, never automatic penalty. Learner notice, response and appeal are required.
- Org-admin instructor assignment is restricted to active same-org instructors with valid course scope and is audited.
- Organisation-course instructor removal requests require independent org-admin approval; independent instructors can confirm their own. Pending requests do not revoke access. All revocation preserves academic history.
- Learner-support safeguards remain as specified: signals to the learner's instructor; crisis oversight by designated org Learner Support Leads; no individual support signals for platform admins.
- Historical null-course records remain legacy/unassigned unless reliable provenance exists. No guessed backfill or production migration.

These are approved planning decisions, not implementation claims. No application code, schema or production data changed in this policy session. Implementation must remain coordinated and additive, with tests and rollback notes.


## 2026-11-10 — Comprehensive-report policy clarification and live PR refresh

- Owner clarified that comprehensive reports must retain the AI-generated personality/management-style assessment sections (productivity, professionalism, leadership-potential observations, manager-readiness observations and focus areas). The earlier recommendation to remove those fields is superseded.
- The retained section must display a prominent AI-reliability limitation notice: it is based solely on learner interactions with the AI, is not a validated psychometric or comprehensive professional assessment, and its reliability/completeness are limited. Management should conduct a structured comprehensive interview and consider work samples, observed performance, references and other appropriate evidence before consequential decisions. Qualified humans remain accountable.
- The notice must remain adjacent to the assessment and be included in the report/API contract. A human-reviewed flag does not imply psychometric validation and must not remove the notice. The report must not be the sole basis for hiring, placement, promotion, discipline, certification or other consequential decisions.
- The existing comprehensive-report module gathers learner-global records. Do not use that data as a course-specific staff evaluation until course attribution, authorised course scope, tenant boundaries and evidence provenance are corrected. The policy decision is not implementation evidence.
- Live PR #3 at session start: open, draft, unmerged, mergeable; branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; head `08073be20037f21f5e52ffa9bead0dcd1f8bd6d6`; 319 commits / 111 changed files. Exact-head GitHub Actions run `42728018598` completed successfully. Combined Vercel status remains failure due to project build-rate limit. No PR reviews or inline review threads returned.
- Agent Pack prerequisites remain absent from the branch: `AGENTS.md`, task queue and logged runner. `AGENT-INSTRUCTIONS.md` is present. No local repository checkout or local validation was available.
- This session changed policy documentation only. No application code, tests, schema, dependency, migration, production data, deployment or merge changed. PR #3 remains draft.

### Next
1. Continue the existing PR #3 review on its current branch; keep it open/draft/unmerged.
2. Treat the comprehensive-report disclaimer, rendering, course scoping and regression coverage as one coherent follow-up; do not add a warning to an API-only path and claim the user-facing report is fixed when no rendering consumer has been verified.
3. Do not make a partial cross-course report change: first establish the course selection and authorised evidence set, then apply the disclaimer to every cached/new report and its actual display surface.
4. Keep course-specific report-card/weekly-test/certificate schema work additive, coordinated and migration-reviewed; no production migration without separate approval.


## 2026-11-10 — Standing institutional decision-maker delegation

- Owner confirmed the assistant should continue acting as the delegated institutional decision-maker across course coordination, student counselling, examinations and university leadership for routine academic/product policy. Do not repeatedly ask the owner to resolve questions already covered by this delegation; decide professionally, document rationale and safeguards, and report the decision.
- Maintain a cumulative decision ledger in QUESTIONS.md and the project/session handoff documents. Owner intends to compile all decisions into a polished consolidated policy document later; the running ledger is not that final document.
- Owner-reserved approvals remain required for production data/settings, destructive or production migrations, spending/provider changes, protected-branch pushes, merge and deployment. Escalate materially ambiguous legal/safety matters rather than guessing.
- Live PR #3 refresh: open, draft, unmerged, mergeable; branch ux-audit/fix-dashboard-truthfulness-and-agent-safety; head d202b14623d34b4e1ea689f277756e1c03d7bddc; 323 commits / 111 changed files. Exact-head Actions run 42729780661 passed install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke, authenticated role screenshots and artifact upload. Vercel combined status remains failure due to project build-rate limit. No PR reviews or inline threads returned.
- Comprehensive report code review confirms the generator still uses learner-global academic records, treats missing scores as zero and computes an F grade when no completed test score exists; no UI consumer for this endpoint was found in the branch tree. Do not expose it as a course-specific staff evaluation until course selection, evidence attribution and access scope are implemented together. Retain management-style fields with the approved AI reliability notice.
- This update records governance and implementation findings only. No application code, tests, schema, dependency, migration, production data, merge or deployment changed. No local checks/browser/axe validation were run.


## 2026-11-10 — Instructor learner-detail metric truthfulness fix

- Implemented in PR #3: no assigned tasks now yields null/unavailable progress rather than 0%; no activity dates and no scored tests yields null/unavailable attention score rather than 0. A genuine evidence-backed zero remains zero. The instructor UI renders unavailable values as an em dash, uses a muted style and does not raise a risk banner from missing evidence. Project task progress uses the same unavailable semantics.
- Added unit coverage for no-task/no-evidence cases, evidence-backed zero, positive progress, inactivity-only, test-only, low-score and declining-score attention signals.
- Changed files: src/modules/instructor-portal/student-detail-visibility.ts, src/modules/instructor-portal/student-detail-visibility.test.ts, src/app/api/v2/instructor/students/[id]/route.ts, src/modules/instructor-portal/student-profile.tsx.
- Separate issue discovered and not yet fixed: the detail API queries all courses shared by the instructor and learner, but returns only the first courseId. This can label a multi-course aggregate as a single course. Decision recorded in QUESTIONS.md: auto-select only when exactly one shared course exists; otherwise require explicit course selection; do not infer course attribution for learner-level mastery data.
- Latest code head at this update: 48bc189c48012d62da5dd7582145398fd19293ec. GitHub Actions run 42730939202 was pending on previous code head 2fc96787c36cce2d6a2cd3c785b63b590b0248ec; latest commit needs its own exact-head run. Vercel remains failed due to build-rate limit.
- No local test/typecheck/build/browser/axe checks were available. No production data, migration, dependency, merge or deployment changed. PR #3 remains draft.


### CI refresh after learner-detail metric fix — 2026-11-10

- Latest code commit: 48bc189c48012d62da5dd7582145398fd19293ec. Its Actions run 42730976622 was cancelled during dependency installation; database setup, lint, unit tests, typecheck, build, route smoke and screenshot steps were skipped. This is not a pass.
- Documentation commits advanced the PR head to f332108143ff6f48e99b6f195452e42bd4e8b41a (337 commits / 112 changed files). No Actions run was returned for that docs-only head.
- Combined Vercel status remains failure due to project build-rate limit. PR remains open, draft, unmerged and mergeable. No local checks were run.


### Test coverage update — 2026-11-10

- Added route-level tests in `src/app/api/v2/instructor/students/[id]/route.test.ts` for selection-required/no-query behaviour, selected-course isolation, invalid-course denial and single-course auto-selection.
- Current implementation head: `f26de0c15cdecb541792066c3d2b34d72914c0b3`. No Actions run was returned for this exact head at refresh; the prior implementation-head run `42734322946` was cancelled during dependency installation, with lint/tests/typecheck/build and later steps skipped. No exact-head CI pass is available yet.



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

## 2026-11-10 — Live verification and next-slice execution blocker

- Live PR #3: open, draft, unmerged, mergeable; branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; head at refresh `8a32ecf5ad07a11881187fe4b2fb3ab774d67cb4` (409 commits / 123 changed files). `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head GitHub Actions run [42748384196](https://github.com/fccljbplant/ExaminerAI/actions/runs/42748384196) passed: dependency install, isolated DB setup, lint (0 errors / 7 warnings), unit tests (438 passed across 41 files), TypeScript, production build, 83/83 app-page route smoke requests, authenticated role screenshots (four roles × seven viewport sizes), and artifact upload `13732063282`.
- Exact-head combined Vercel status is success; PR bot reports a Ready preview at [examiner-ai preview](https://examiner-ai-git-ux-audit-fix-dashb-bd75fe-fccljbplants-projects.vercel.app). No manual browser inspection or accessibility sign-off is implied.
- No PR reviews or inline review threads returned. No local checkout/tests/browser/axe/keyboard/screen-reader/reduced-motion/zoom/reflow checks were available.
- Reconfirmed the existing multi-course instructor learner-detail fix: one authorised course auto-selects; multiple require an explicit selected course; all course-bearing records are filtered to that course; unscoped Growth/Comments/mentor briefing are withheld pending safe APIs; SkillMastery is learner-level because it has no courseId.
- Next substantive privacy/evidence slice identified: comprehensive-report endpoint and generator. Current handler gives staff `content_only` access but calls a learner-global generator with no course context. The generator queries learner-global Interaction, WeeklyTest, ProjectTask, ProjectReport and Certificate records, includes course-less SkillMastery, uses legacy learner-global project/current-week fields, coerces missing weekly-test scores to zero, and returns an F grade when there is no completed test evidence. No verified user-facing report renderer was found in the current repository tree.
- Policy direction already recorded: retain owner-requested management-style assessment fields with the approved AI-only reliability limitation; course-specific report must use only selected-course evidence; SkillMastery must be labelled learner-level or excluded from course-specific conclusions; legacy global project fields must not be mixed into a course project; missing evidence remains unavailable. The warning must be adjacent to the actual report display; an API-only string is not a completed UX fix.
- **Execution blocker:** the current branch has no `AGENTS.md`, `docs/UPGRADE-2026-10/QUEUE.md` or `scripts/agent/run-logged.mjs` (verified from the recursive Git tree). The uploaded Agent Pack contains a queue and runner, but its `run-queue.mjs` automatically switches/creates `upgrade/phase-<N>`, contrary to the repository continuity rule to remain on the existing PR branch; Agent Pack instructions also prohibit modifying its runner. No local repository checkout is available to run its required gates. Do not invent a task card, run the unsafe queue runner, or make a partial high-risk report patch outside the required task workflow.
- No application code/tests/schema/dependency/migration/production-data change, branch switch, merge, deployment or main-branch write in this continuation. Documentation only.
- Next safe action: restore a branch-preserving, no-`.env*` task-card/logged-check workflow (or an owner-approved equivalent) on the existing PR branch, then take one bounded comprehensive-report task covering course context, evidence truthfulness, cache/review semantics, route tests and the actual rendering consumer. Keep PR #3 draft/unmerged.


## 2026-11-10 — Live continuation refresh (03:57 UTC)

- Live PR #3 remains open, draft, unmerged and mergeable on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. Verified PR head: `69a1fbf65a723badc28bb6a4699ad3a50ddb4382`; base `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head GitHub Actions run [42752208726](https://github.com/fccljbplant/ExaminerAI/actions/runs/42752208726) passed: 438 tests across 41 files; lint 0 errors / 7 warnings; TypeScript; production build; 83/83 app-page route smoke checks; authenticated role screenshots (four roles × seven viewports); artifact upload [13734421184](https://github.com/fccljbplant/ExaminerAI/actions/runs/42752208726/artifacts/13734421184). Screenshots were captured, not manually inspected.
- Combined Vercel status on this head is failure with the project build-rate-limit URL. No Ready preview is verified. No PR reviews or inline threads were returned.
- Re-read live PR metadata, latest commit, workflow job steps/logs, current report route/generator, comment route/audit helper, and the handoff documents. Course-scoped comment writes and privacy-minimised audit events remain in the branch.
- The comprehensive-report privacy/evidence findings remain open: staff access is checked with `content_only`, but generation is learner-global; report inputs include cross-course activity and certificates, course-less mastery and legacy global project/current-week fields; missing weekly-test scores are coerced to zero and no-test evidence can produce an F grade. Retain owner-approved management-style fields with the required adjacent AI-reliability limitation. No verified report rendering consumer has yet been established.
- **Execution blocker remains:** the branch has no `AGENTS.md`, task queue or logged runner. The uploaded Agent Pack queue has no card for this follow-up; its runner switches to `upgrade/phase-<N>`, and its OpenCode off-peak guard reads `.env`, `.env.local` and `.env.production` to inspect database configuration. Both conflict with the project's existing-branch and no-`.env*` constraints. Do not run it, invent a card, or make a partial high-risk report patch. No local checkout is available.
- No application code, tests, schema, dependency, migration, production data, merge, deployment, branch switch or `main` write was made in this refresh. No local or manual browser/axe/keyboard/screen-reader/reduced-motion/zoom/reflow validation was performed.
- Next: establish an owner-approved, branch-preserving task-card/logged-check workflow (or provide a compatible approved task card and tooling), then complete the comprehensive-report course-context, evidence-truthfulness, cache/review, route-test and actual-renderer slice as one coherent task. Keep PR #3 draft/unmerged.


## 2026-11-10 — Post-refresh GitHub metadata correction

- Documentation-only handoff commits advanced the PR branch from the application/code head `69a1fbf65a723badc28bb6a4699ad3a50ddb4382` to `28b4da846b8a5ad9629332e8f8a8ca125b9a9835`; no source files changed in those commits.
- Actions run `42752208726` is a successful exact-head run for `69a1fbf...`; no PR-triggered workflow run was returned for documentation-only head `28b4da8...`. Do not describe the final docs-only head as having a new CI run.
- The combined Vercel status for `28b4da8...` is failure with the build-rate-limit URL. No Ready preview is verified.
- Latest PR metadata still says open, draft and unmerged. One live metadata read reported `mergeable: false`; a separate compare reports the branch is 416 commits ahead and 0 behind `main`. Treat mergeability as unconfirmed and refresh it before any release decision.
- Next task remains blocked on the missing safe task-card/logged-check workflow; no code patch, merge or deployment is authorised by this status refresh.


## 2026-11-10 — Course-specific assessments and concurrency hardening (PR #3)

- Owner decision is implemented in the active PR branch: legacy `WeeklyTest` identity is learner + course + week + attempt; `ReportCard` identity is learner + course + week. Existing nullable `courseId = null` rows remain preserved; no backfill, merge, deletion or reassignment was performed.
- Course-specific weekly-test start/read/answer flows now require or resolve an explicitly enrolled course, bind answers to the attempt's course/week, validate the week against the selected course outline, preserve completed attempts, and scope retake permission to the selected course attempt. Learner-facing missing scores remain unavailable rather than coerced to zero.
- Staff report-card generation and manual GET/POST now require a selected course and authorised learner-course intersection, use selected-course evidence, enforce course grading policy, and preserve version history. Staff score correction requires a selected authorised course, completed attempt, bounded score and reason; the original AI score is retained and correction events are audited.
- Instructor portfolio data preserves course + attempt identity. Added regression coverage for course selection, cross-course denial, course-scoped answer/correction behaviour, missing evidence and report-card versioning.
- Fixed report-card optimistic concurrency: updates now compare-and-swap on both report-card ID and the previously read version. A lost race returns `REPORT_CARD_VERSION_CONFLICT`; no version snapshot is written for a failed compare-and-swap. Added a concurrency regression test.
- Regenerated tracked `prisma/schema.prod.prisma` and `prisma/.demo.prisma` from `prisma/schema.prisma` using the exact repository generator transformation. Verified both derived schemas now contain `ReportCardVersion` and course-specific report-card uniqueness.
- Live PR #3 branch: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; application/docs head before this log refresh: `f2a6eea5289623cb53e07db50df23757dbc8137c`; base main remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`. PR remains open/draft/unmerged.
- Exact-head GitHub Actions quality run `42757128556` was queued at the time of this update; no pass is claimed. Combined Vercel status remains failure due to the build-rate limit. No Ready preview verified.
- No local checkout was available, so no local tests, lint, typecheck, build, browser, axe, keyboard, screen-reader, reduced-motion, zoom/reflow or manual UX validation was run. Await exact-head Actions evidence.
- No production database operation, migration deployment, merge, deployment, branch switch, dependency change or main-branch write occurred. Production schema rollout and rollback review remain release gates; keep PR #3 draft.
- UXPeak remains the standing UI reference. Recent instructor portfolio changes are role- and course-contextual; manual visual/a11y review is still outstanding.


## 2026-11-10 — PR #3 follow-up: nullable certificate eligibility

- Live PR head before fix: `a10b93029dc192b3aef08b564840946f3e43d7f3`. Run [42763366450](https://github.com/fccljbplant/ExaminerAI/actions/runs/42763366450) passed lint and tests but failed TypeScript because `checkEligibility(user.id, courseId)` can return null while the certificate-user route dereferenced `eligibility.eligible` and `eligibility.avgScore`.
- Fixed `src/app/api/certificates/user/route.ts` to preserve unavailable evidence as nullable response fields: `eligible: null`, `averageScore: null`. This avoids both the type error and a misleading false eligibility value.
- Fix commit: `6e7ea3a8000ae7a59e838c43c3e76d00df8cf138`.
- Exact-head Actions run [42865683017](https://github.com/fccljbplant/ExaminerAI/actions/runs/42865683017) was in progress at the time of this update; only Node setup had completed and dependency installation was running. Recheck before claiming validation.
- Vercel status pending; no Ready preview confirmed. PR #3 remains draft/unmerged. No schema, migration, production data, merge or deployment operation.


## 2026-11-10 — Branch integration inventory and draft PRs

- Rechecked live refs via GitHub: `main` = `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`; PR #3 head = `1fde49d7ad453ccffed955db003ff5b13916570d`; PR #2 head = `350278996da3b6efea200356ba49a1ef02a72dd2`.
- Current branch inventory: `backup/v3-ui` and `master` both point to `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (identical refs); `fix/ui-simplification-safe` = `f075dc632c891ecdf819592e84afd8eaaae2a126`; `vercel/vercel-web-analytics-integrati-flq88k` = `350278996da3b6efea200356ba49a1ef02a72dd2`.
- PR #3 compares 547 commits ahead / 0 behind, 159 changed files; remains draft/open/unmerged. Exact-head Actions run `42869512850` and Vercel status both succeeded. Comprehensive-report privacy/evidence and schema rollout owner gates remain unresolved; do not merge solely on CI success.
- PR #2 is clean/mergeable and has a successful Vercel status, but adds `@vercel/analytics@^2.0.1` and a lockfile with substantial metadata churn; only Vercel Preview Comments is reported as a check. Run/verify the full relevant test/build suite before merge.
- `backup/v3-ui` / `master` compare 17 commits ahead / 7 behind main and are exactly the same commit. Diff includes `prisma/db/custom.db` and shared classroom, portal layout/navigation, feature-flag, theme-token and UI-v3 changes. The DB binary must be excluded; merge only once, not once per ref.
- `fix/ui-simplification-safe` compares 1 commit ahead / 7 behind main; overlaps `src/app/(classroom)/learn/page.tsx` with PR #3 and includes role-aware home resolution plus tests.
- Created draft PR #5 for `fix/ui-simplification-safe` and draft PR #6 for `backup/v3-ui` (also represents identical `master`). GitHub reports both currently not mergeable. PR #6 explicitly records the local DB binary and shared-surface review gates.
- No merge, branch deletion, force-push, production operation or deployment occurred. The supplied ZIP has no `.git` history; this environment has no local clone/merge engine, and GitHub connector actions available here do not provide a safe conflict-resolution workflow. Do not synthesize merges by blindly copying branch files.
- Next: obtain a Git-capable checkout of the current refs (or an owner-provided repo workspace) with protected-secret and DB exclusions; merge main into a disposable integration branch, resolve conflicts with three-way Git, run CI and visual/accessibility checks, then merge one reviewed PR at a time. Keep PR #3 draft until its owner decisions are resolved.


## 2026-11-11 — Mainline branch consolidation update

- Main now includes PR #2 (Vercel Analytics), PR #7 (safe UI simplification and role-aware home routing), PR #8 (protected-layout learner courses compatibility redirect), and PR #9 (learner-home project-query failures return 503 instead of a fabricated empty success). Current main commit: `dc683ec9652317f23aa7233625c0ad5ecccfc8f1`.
- Exact-head GitHub Actions quality workflows passed for PR #7 (`42909814324`), PR #8 (`42910567097`), and PR #9 (`42911198601`): dependency install, isolated DB init, lint, unit tests, typecheck, production build, all-route smoke, authenticated role screenshots and screenshot artifact upload. Mainline workflow after PR #8 also passed (`42911131106`); mainline run after PR #9 is pending/completing.
- Production deployments automatically queued by the four main merges were cancelled before release: `dpl_3URq5XvyHVWPBWiu8hYGRxS1xm5g`, `dpl_4e5eUTDbNSTXkxjVgsF4p454mh`, `dpl_AJpCKyBgpLeC8u6YS3PFBqDSxskP`, and `dpl_DCi7jADZ6f9f1FfteiXYyfMn6B4g`. No production deployment was allowed to complete and no production database was read or changed.
- PR #3 remains draft/unmerged pending the explicit schema transition gate: reviewed additive PostgreSQL migration, legacy NULL-course handling, backup/restore and staging rehearsal, plus owner approval of the exact production target and execution window. Its latest exact-head CI (`42908979890`) passed, including production build and browser evidence, but its branch is behind the newly merged mainline work and needs a conflict-aware update after the schema gate is resolved.
- PR #6 (V3 UI) remains draft/held. The V3 tree still carries a tracked local SQLite database, replaces current portal shells and role/feature-flag behaviour, removes regression tests, and conflicts with the unresolved learner navigation contract. Do not merge wholesale.
- V3 is the only remaining named branch intentionally excluded. The safe UI, analytics, learner catalog alias, and learner-home truthfulness changes are merged.


## 2026-11-11 — Vercel build write-safety hardening (PR #11)

- Source audit identified that main's Vercel build executed a production schema push, admin-account bootstrap/password reset, and marketplace seeding. These are unsafe deployment side effects.
- Draft PR #11 (`fix/vercel-build-readonly`) changes the build to Prisma client generation and Next.js build only. Admin bootstrap now requires explicit secret-manager environment variables and never updates an existing account.
- Exact head `8066af94ae87e6c9c7dc8ef8e49fed37a94babc0`; Actions run `42938312216` is still running at dependency installation and Vercel preview `DC6oshqfcbsywZudqnjDtYcMd5UG` is still building. No passing result is claimed.
- No database operation, migration, seed, merge, production deployment or branch deletion performed. Continue after exact-head CI and preview finish.


## 2026-11-11 — PR #11 merged: deployment build safety

- PR #11 is merged to main as `24b69fbf716d0c4fa3d7fd9f278db4b85163ece8`.
- Vercel build is now read-only with respect to application data: Prisma client generation plus Next.js build only. Automatic `prisma db push`, account bootstrap and marketplace seeding were removed from deployment.
- Administrator bootstrap now requires secret-manager supplied `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` (minimum 16 characters), skips existing accounts without mutation and has no hardcoded reusable credential.
- Added deployment safety regression tests. Exact PR head Actions run `42938561279` passed all configured steps, including lint, unit tests, typecheck, production build, route smoke and authenticated screenshot capture/upload. Vercel preview `dpl_EDusyC3RNBZPuHwt2wE655Fa9vHS` reached READY.
- Main's production-target deployment `dpl_2tHWh3SjhiXajjCWQ1cmsfwjAdHj` was BUILDING at this update; verify completion and runtime/database health before declaring release complete.
- No database/schema operation or seed was executed. PR #3 and PR #6 remain unmerged under their separate safety gates.


## 2026-11-11 — Screenshot QA follow-up

- Reviewed all 28 authenticated role screenshots from Actions run `42938561279` across seven viewport sizes. No horizontal overflow was reported. Heuristic checks reported no unnamed controls, unlabeled fields, missing image alt text, missing document language or missing main landmark; these checks are not a WCAG conformance audit.
- Found learner empty-state heading gap: all seven learner-home screenshots report zero primary headings. `src/modules/learner-portal/home.tsx` routes zero-enrollment users to `NoEnrollment()`, which renders “Start your first course” as a paragraph, not an `h1`. Enrolled state has an `h1`.
- Next UI accessibility task: add a meaningful single page-level heading to the no-enrollment state and regression coverage, then repeat screenshots. Manual keyboard/screen-reader/zoom/reflow and axe review remain required. No code change made in this session for this issue.


## 2026-11-11 — Final deployment verification

- Main HEAD: `e390031cbf6eb0203c046947fcd3bd4c260014c7`.
- Latest READY production deployment observed: `dpl_AS4D5wBkdubVHXEaXfQmumDSoahQ` from commit `1c2af3e962290ea20634229dc506e3a71bb51ada`, with stable alias `examiner-ai-tau.vercel.app`. This deployment includes all application-code changes from PR #11. PR #13 added docs only.
- Vercel could not create a new deployment for docs-only main commit `e390031` because the free-plan build-rate limit was reached. The already READY application deployment remains the deployed application version; no application source changed in PR #13.
- Production error/fatal runtime-log query for the inspected 15-minute window returned no entries. This does not replace a real authenticated smoke test against production or database health verification.
- Remaining open PRs are #3 (schema/privacy/task workflow gates) and #6 (V3 held for selective salvage). Branch deletion has not been performed; the connected GitHub actions do not expose a delete-branch operation and some refs retain unmerged commits.
- No DB migration or seed was run. Development demo data remains unseeded pending a safe, explicit development database target and review of the existing psychological-data seeder against consent/privacy invariants.


## 2026-11-11 — Live consolidation refresh and Agent Pack reconciliation

- Refreshed live `main`: `aa64d6aa7d4813c3f3b6b3738216de73375b7a1c`. Exact-head GitHub Actions quality check `42976216079` completed successfully. This verifies configured CI for this docs-only main commit; it is not manual accessibility or production validation.
- PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 11 behind). PR #6 remains open/draft/non-mergeable at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 19 behind); its branch contains tracked `prisma/db/custom.db` and broad shared-shell changes.
- The branch inventory was refreshed: 13 refs. `backup/v3-ui` and `master` are identical. UI simplification branches overlap. Learner courses and learner-home error-handling branches contain small unique file sets. Documentation branches overlap continuity files. Analytics and build-safety branches require duplicate-commit checks against already merged PRs before any integration.
- The repository Agent Pack is being reconciled onto a dedicated PR from current `main`. The proposed `scripts/agent/run-logged.mjs` was deliberately excluded because its hard-coded PR #3 branch guard is incompatible with the current consolidation workflow; GitHub Actions remains the validation source.
- Confirmed PR #11 build-safety work is already represented in `main`; do not re-integrate the older branch wholesale. PR #14 is docs-only and merged.
- No app source, database, schema, dependency, production setting or deployment was changed. No source branch was deleted and no force update/history rewrite occurred.
- Next: complete the docs-only Agent Pack PR and CI, then continue P0-03 by verifying commit equivalence and integrating the small learner compatibility/error-handling changes only once. Hold PR #3 until schema/privacy gates are resolved; hold V3 pending selective salvage and DB artifact exclusion.


## 2026-11-11 — Branch equivalence verification

- Verified by Git blob SHA that all 7 files in `fix/ui-simplification-safe` match `main`; all 2 files in `ux-audit/learner-courses-compatibility` match; all 2 files in `ux-audit/learner-home-error-handling` match; all 3 application/package files in `vercel/vercel-web-analytics-integrati-flq88k` match; and all 3 reviewed deployment-safety source/test files in `fix/vercel-build-readonly` match. These branches do not require another code merge.
- PRs #2, #7, #8, #9 and #11 are already merged. Avoid duplicate integration. Documentation-only branches overlap historical status/session/progress updates and need no wholesale merge.
- PR #3 remains the principal large code integration requiring selective three-way review; PR #6 remains held because of the tracked SQLite DB and broad UI/role/theme changes.


## 2026-11-11 — Agent Pack merged; consolidation inventory deepened

- PR #15 (`docs: align repository agent pack with consolidation workflow`) was marked ready only after exact-head CI passed, then merged using expected head `07196bd61d2464106b5d9279c72dae8b93dfc843`. Merge commit and current `main`: `930dcdbcdeec9f48b2ffa5f0f3c7697d46f4b9b1`.
- PR #15 Actions run `42978335750`, retry attempt 2, passed dependency install, isolated test DB setup, lint, unit tests, TypeScript, production build, all app-page route smoke tests, authenticated role screenshots and artifact upload. First attempt failed screenshot capture; retry passed. Vercel status on the new docs-only main commit was pending at verification; no deployment was requested or performed.
- Root `AGENTS.md` and `docs/agent-pack/{README,SAFETY,QUEUE,DECISIONS}.md` are now on `main`. The proposed `scripts/agent/run-logged.mjs` remains excluded because its hard-coded PR #3 branch restriction is incompatible with consolidation.
- Verified branch content by Git blob SHA: all changed application files from `fix/ui-simplification-safe`, `ux-audit/learner-courses-compatibility`, `ux-audit/learner-home-error-handling`, Vercel Analytics and the Vercel build-safety branch are already identical to `main`. Do not merge duplicate code again; older documentation-only differences are historical records, not code gaps.
- Compared full recursive Git trees: PR #3 differs from `main` in 167 blobs and omits 6 files present on `main`; PR #6 differs in 88 blobs and omits 17 files present on `main`. PR #6 additionally includes tracked `prisma/db/custom.db`. Neither branch is safe for wholesale merge.
- No application source, DB/schema, dependency, production setting or deployment changed in PR #15. No source branch deleted, no force update/history rewrite, and no production DB access.
- Next: use a Git-capable three-way merge workflow to selectively salvage PR #3 changes after schema/privacy/task sequencing review; separately assess V3 components from PR #6 without the database artifact or removed tests. Then stabilise `main` with role-based tests and accessibility review.


## 2026-11-11 — PR #3 selective dashboard/roster fixes ported

- Current `main` is `b8fa2529cd4bc6c91bb1ada017123ed9058c5561` after PR #16. PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 16 behind); no wholesale merge was attempted.
- A current-main-based selective branch ports the learner-home failure correction and instructor roster/KPI fixes from PR #3: no false empty-enrolment success on profile lookup failure; database aggregation for latest daily activity without the 200-row cap; instructor activity/task data restricted to taught courses; deterministic latest scored weekly test; and full at-risk KPI count separate from the five-item preview.
- Added learner-home and instructor-roster route regression coverage plus roster-metric tests. Full Vitest: 35 files / 384 tests passed against disposable local SQLite. Full ESLint exited 0 with existing warnings; standalone TypeScript and `git diff --check` passed.
- Local Next.js compilation succeeded, but the 2 GB sandbox killed the build worker during Next.js TypeScript validation (1024 MB heap OOM; 1536 MB attempt SIGKILL). Standalone TypeScript passed; exact-head GitHub Actions production build remains required.
- No schema/dependency change and no Neon/production database access, migration, seed, deployment, force update or source-branch deletion.


## 2026-11-11 — PR #17 merged; selective PR #3 consolidation continues

- PR #17 (selective learner/instructor dashboard port from PR #3) merged into `main` at `f3323587722b349cc14fbf0e88f9c445fbf9a326`. Exact PR head: `08701613fe438b237f16d52986be868377b8ff2f`.
- GitHub Actions run `43061463558` passed on the exact head: dependency install, isolated test DB setup, lint, unit tests, TypeScript, production build, every app-page route smoke test, authenticated role screenshots and artifact upload. The earlier run `43061193897` exposed a regression caused by taking an old PR #3 learner-home route wholesale; the route was corrected from current main with only the profile-lookup failure behavior applied, preserving the existing project-query failure safeguard. The corrected exact-head run passed.
- Existing Vercel project preview deployment `dpl_7GGs2wZPkhCx5rch4Kt9ADa3GRKH` reached `READY` for the corrected PR head. Git integration automatically created production-target deployment `dpl_4jcJQoasD3uHQJry9zWZQcuHjkQz` from merge commit `f3323587`; the build completed and was still in Vercel's deployment-output phase at the time of this log. No manual deployment or production-setting change was made.
- PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 commits ahead / 29 behind current main). PR #6 remains held at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 37 behind). No wholesale PR #3 or PR #6 merge.
- PR #17 changed no Prisma schema, migration, dependency, provider, billing, learner-support or crisis-handling behavior. No Neon/production database was accessed, and no production data/schema operation, seed, manual deployment, force update or source-branch deletion occurred.
- Next selective PR #3 review: weekly-test course identity/enrollment checks and AI-unavailable no-grade behavior; verify the existing server-side weekly sequencing guard and add direct regression coverage. Keep portfolio expiry semantics, comprehensive-report field/scope policy and PR #3 schema changes on hold pending their required decisions.


## 2026-11-11 — PR #3 weekly-test course and grading safety port prepared

- Based on current `main` `c8fdc2ac58ff500ff38720689c3cd350a655d4dc` after PR #18. This is a selective port from PR #3, not a wholesale merge.
- Weekly-test start now checks active course enrolment, enforces the final content-day gate before returning even an existing in-progress test, uses the actual final outline day, preserves the legacy topic ladder only when a course has no outline, rejects missing weeks in a published custom outline, and returns `503 SERVICE_UNAVAILABLE` on outline lookup errors rather than silently falling back.
- Weekly-test answers are bound to the route week, stored test course and current enrolment. AI evaluation failure returns a degraded 503 without persisting a fallback 0.5 grade or awarding XP. The learner panel now sends `courseId` (the previous caller omitted it) and treats incomplete/invalid saved scores as unavailable; genuine zero scores remain valid.
- Added route and pure score-helper tests. Full Vitest: **38 files / 400 tests passed** against disposable local SQLite. Full ESLint exited 0 with existing repository warnings; TypeScript `tsc --noEmit` passed; `git diff --check` passed. Local production build not run in this 2 GB sandbox; exact-head GitHub Actions production build remains required.
- No schema, migration, dependency, provider or billing changes. No Neon/production database access, production data changes, manual deployment, force update or source-branch deletion.
- Next: exact-head GitHub Actions and existing Vercel preview checks; only merge after both required gates pass. PR #3 remains open/draft/non-mergeable; its report/privacy/schema and portfolio-expiry changes remain blocked for separate owner decisions.


## 2026-11-11 — PR #19 merged; remaining PR #3 work blocked on owner decisions

- PR #19 (weekly-test course access and grading truthfulness) merged into `main` at `24f304c4fb326410ae604e337b452c96952df9f3`. Exact PR head: `d8e8ce1f95b9d1573b055aa4d4196b46a12ef22d`.
- GitHub Actions run `43065448723` passed on the exact head: dependency install, isolated test DB, lint, 400 tests, TypeScript, production build, route smoke tests, authenticated role screenshots and artifact upload. Vercel preview `dpl_4D6k8CYUZRRDRgPtakP8crMf3qiD` and automatic production deployment `dpl_6c77u9Rf3GCUjocV56Qy8uYUUf3n` both reached `READY` in the existing Vercel project.
- Current branch audit: PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 commits ahead / 46 behind); PR #6 remains held at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 54 behind). No wholesale merge of either branch.
- Safe selective PR #3 ports now merged: learner-home failure truthfulness, instructor roster course scoping and accurate aggregation/KPI counts (#17); weekly-test course enrolment, last-content-day sequencing, answer/test identity, AI-unavailable no-grade handling, learner client courseId and unavailable-score presentation (#19).
- Remaining PR #3 items are not safe to merge without owner decisions: comprehensive-report field/evidence/course-scope policy; learner-support/psychological signal visibility and consent/role policy; staff final-result access semantics for `content_only` grants; portfolio `CourseEnrollment.expiresAt` semantics; and the additive PostgreSQL migration/legacy NULL-course rollout described in `PR3-SCHEMA-ROLLOUT.md`.
- No Neon/production database access or modification, schema migration, seed, manual deployment, dependency/provider/billing change, force update, history rewrite or source-branch deletion. Vercel production deployment was Git-integration automatic; no manual deployment action was taken.
- Next: stop broad PR #3 integration at these gates. Obtain owner answers in `docs/UPGRADE-2026-10/QUESTIONS.md` before any further report/privacy/portfolio/schema changes. Continue app stabilisation and inspect remaining PR #3 UI-only changes only where they do not depend on those policies.


## 2026-11-12 — Consolidated audit and fixation plan

- Live main before this documentation update: `43d85da7465c9ad51819ad0f525efe575ad65c62`.
- Added `docs/UPGRADE-2026-11/COMBINED-AUDIT-AND-FIXATION-PLAN.md` (commit `9e16504ea416d71773a909dc7b0cd27d91209e08`).
- The document combines the audited security/privacy, assessment, tenant scope, AI governance, data truthfulness, operational, UI and accessibility findings into a bottom-up remediation programme.
- Audit observations must be revalidated against current source/tests before implementation; this commit changes documentation only. No app code, schema, migration, dependency or production data changed.
- No test, lint, typecheck, build, browser or accessibility run was performed for this docs-only update.

## 2026-11-12 — UI-first Daily Test work and integrated fixes

- Owner priority clarified: UI/UX is the primary delivery focus. Work is organised by visible screen/component, with functional, security, data-scope, responsive and accessibility checks performed alongside each UI enhancement.
- Daily Test first pass is in progress: updated check-in header/context, topic badge, question progress semantics, conversation surface and answer composer. Shared chat presentation also affects Practice and Weekly Test; optional progress total keeps other consumers from showing an invented meter.
- Added UI markup regression tests and closed two known legacy portfolio gaps: organisation admins receive only daily-log dates, and course-less global competency records are not exposed through course-scoped instructor/org-admin views.
- The recovered worktree started from 18b2b95011b0480f4176a0d2881788070ddf74c2 with only main present in the live branch search. Application changes are not yet committed at this entry.
- Full test suite (466/466 across 155 files), full lint, TypeScript and diff whitespace checks passed on a disposable local SQLite database. Tutor-context seeded assertions skipped due missing optional socratic.test seed.
- Build compiled but could not complete because the sandbox build worker exceeded available memory (1 GB heap OOM; 1.8 GB retry SIGKILL). No browser screenshots/manual WCAG pass was possible because Chrome/Chromium was unavailable.
- Remaining blockers: AI evaluation/scoring still needs an owner-approved deterministic rubric; learner-support/psychology processing remains gated on consent/legal/professional review; full cross-tenant review and manual responsive/accessibility validation remain open. No production DB, production migration or deployment was touched.
