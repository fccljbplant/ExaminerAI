## 2026-11-12 — Learner project list/create course boundary

- Starting live main: e7c86e979c744c1bdd1a8b9b3251589fb017872f. Re-fetched origin/main before editing; worktree clean and HEAD matched. Remote inventory: main only, no open PRs.
- The standalone /api/learn/projects GET previously listed all projects owned by the signed-in user regardless of current student course enrolment; optional courseId was not validated. POST required a course ID but did not verify that the authenticated user had a student enrolment in that course.
- GET and POST now enforce learner/student/demo role access. GET loads the caller's student enrolments first, returns course-linked projects only for those enrolled course IDs (plus legacy course-less personal projects), and rejects a requested course outside that set. POST trims and validates courseId, confirms the caller's student enrolment before idempotency lookup or project creation, and uses the validated ID for writes and instructor notifications.
- Added eight route regression tests covering unauthenticated/non-learner denial, all-project list scope, selected-course denial/success, create denial for staff and unenrolled learners, and creation after confirmed enrolment.
- Validation: full Vitest suite excluding DB-backed src/modules/learn/lib/__tests__/tutor-context.test.ts: 56 files / 495 tests passed. ESLint passed on both changed files; git diff --check passed. TypeScript --noEmit --skipLibCheck attempted with a 1.4 GB heap and exited on sandbox heap exhaustion; no typecheck pass is claimed.
- Production build and browser/manual responsive, keyboard and screen-reader checks not run. This is an API scope slice, not project-surface or Learner Today sign-off.
- No production DB access, schema/migration, dependency/provider, production data, Vercel setting, or deployment changes. vercel.json keeps Git deployments disabled.
- Follow-up audit remains: inspect the v2 project detail/tasks/generation and legacy milestone/help endpoints for current-enrolment checks as a single coherent authorization review. Do not assume home/list filtering secures direct-ID routes.

## 2026-11-12 — Learner Today project-card course scope

- Starting live main: f27f0b3a463a4a95a787c12485a6723b6444ae33. Re-fetched origin/main before editing; local HEAD matched exactly and worktree was clean. Remote inventory: main only, no open PRs.
- Bottom-up UI/API audit found that the Learner Today projects panel queried the learner's latest four LearnProject rows by userId only. A project linked to a course from which the learner was no longer enrolled could therefore remain visible on the home feed.
- Scoped course-linked project cards to the learner's current student CourseEnrollment IDs. Explicitly course-less personal projects remain visible; no schema or migration change was needed. The query continues to be learner-owned (userId) and the four most recently updated visible projects.
- Added a route regression test asserting both the current-enrolment filter and preservation of course-less projects. Existing empty-project and project-query failure coverage remains.
- Validation: focused learner home/check-in tests, 3 files / 14 tests passed; full Vitest suite passed excluding DB-backed src/modules/learn/lib/__tests__/tutor-context.test.ts (55 files / 487 tests); ESLint passed on both changed files; git diff --check passed.
- Typecheck and production build not run for this slice. Browser/manual responsive, keyboard and screen-reader checks remain outstanding; no browser session was started and no WCAG sign-off is claimed.
- No production DB access, schema/migration, dependency/provider, production data, deployment, or Vercel settings changed. Git deployment remains disabled per vercel.json.
- Learner Today remains open until manual interaction/accessibility QA is completed. Follow-up audit: review the standalone learner project list/detail APIs for the same current-enrolment boundary before considering the project surface fully signed off.

## 2026-11-12 — Learner check-in saved-state accessibility

- Starting live main: `b28fd54250075f084edee5d2193ea706109dfa62`.
- Application fix: `58ef99ad98d0eff1d5aa570b12acc0aa5dc857ad`; regression-test preservation: `cf764a8d39d08564e3575739b1fec094bf38b346`.
- The saved check-in UI now places the polite status announcement on the message paragraph only. The “Edit check-in” button remains a separate sibling control inside the labelled section, rather than a descendant of the live region.
- Preserved the existing collapsed check-in/history discoverability regression test and the saved-state action/focus assertions; added coverage that the live region contains no interactive control.
- Validation: focused learner home/check-in and related API tests, 5 files / 12 tests passed; full Vitest suite, 55 files / 482 tests passed excluding the DB-backed `src/modules/learn/lib/__tests__/tutor-context.test.ts`; ESLint passed for both changed files; `git diff --check` passed.
- TypeScript `--noEmit --skipLibCheck` could not complete: Node ran out of heap at both 950 MB and 1.4 GB settings in the 2 GB sandbox. No typecheck pass is claimed. Production build and browser/manual accessibility checks were not run; no browser binary is installed in the sandbox.
- `vercel.json` keeps Git deployments disabled. Vercel returned zero deployments for both application commits. No manual deployment, production database access, schema/migration, production data change, dependency or provider change.
- Remaining Learner Today work: inspect check-in state after a page refresh (the current saved-state flag is component-local), then complete responsive visual, keyboard and screen-reader review before closing the screen.

## 2026-11-12 — Learner Today KPI layout and responsive accessibility

- Main commit for this fixation: `0ea004bf32e90e34020910b6534d08059c4f5ee9` (`fix: improve learner dashboard KPI layout`).
- Fixed the desktop KPI composition defect: KPI cards previously retained a 240px minimum width at desktop, contradicting StatStrip's equal-width grid and causing the learner's four metrics to wrap into a 3+1 layout. They now retain the 240px minimum only in the mobile horizontal carousel and may shrink at the desktop breakpoint.
- Corrected the metric region's accessible name to “Key metrics” and attached a unique screen-reader description that accurately says horizontal scrolling applies on small screens. This avoids announcing a mobile-only interaction as though it applied on desktop.
- Added a regression test for desktop KPI shrink behavior and updated the responsive metric-region accessibility test.
- Validation on the updated source: LearnerHome tests 4/4 passed; full Vitest suite 55 files / 482 tests passed excluding DB-backed `tutor-context.test.ts`; ESLint passed for changed files; `tsc --noEmit --skipLibCheck` passed; `git diff --check` passed.
- Production build compiled successfully, then the Next.js build worker ran out of memory during its separate TypeScript phase (1.4GB Node heap in the 2GB sandbox). Standalone TypeScript check passed. Build is therefore not signed off.
- Browser binaries and Playwright/Puppeteer modules are not installed in this sandbox. Manual keyboard navigation and screen-reader verification remain outstanding; Learner Today stays open. No new dependency was installed.
- No database, migration, dependency, provider, billing, production data or deployment changes.

## 2026-11-12 — Learner Today check-in feedback preservation and interaction polish

- Live baseline: `79f2c363c98fa55963d0bb128485eba90ba0e48a` (`main`). Remote inventory rechecked: exactly one branch (`main`), no open PRs, and no remote tags returned. No branch/tag/PR deletion or history rewrite was performed. The older `/vercel/ExaminerAI` worktree's pre-existing uncommitted documentation edits remain untouched; this work was isolated in `/tmp/ExaminerAI-live-main`.
- Learner check-in deletion previously removed instructor comments in the same transaction. DELETE now counts linked mentor comments transactionally and returns HTTP 409 with an actionable explanation when feedback exists; the check-in is deleted only when no mentor feedback is attached. Added route tests for both outcomes.
- Learner Today check-in saved state now announces completion with `role="status"` and retains an “Edit check-in” action that reopens the form with the current note/confidence intact. The history delete action now has a 44px minimum target and explicit keyboard focus styling.
- Tests on the final main tree: Vitest 55 files / 481 tests passed when excluding the DB-backed `tutor-context.test.ts`. The unfiltered run's only failure was that test requiring `DATABASE_URL`, intentionally absent in this workspace; no `.env` file or secret was read. ESLint on all four changed source/test files passed; TypeScript `--noEmit --skipLibCheck` passed; `git diff --check` passed.
- Not run: production build, browser screenshot review, manual Tab/Shift+Tab, screen-reader review, full WCAG 2.2 AA sign-off. Learner Today remains open until manual keyboard and screen-reader checks are completed.
- Vercel Hobby does not support deployment policies (403 `pro_plan_required`). As explicitly requested by the owner, the project-level Git ignore-build-step was updated to `exit 0`. Deployment lookups for all code/test commits and the first progress-document commits returned zero records, confirming automatic Git deployments were suppressed. No deployment was initiated manually.
- Main source/test commits: `22e9fb4bfb44577bccac976b23719e61d9695b6c` (mentor-feedback preservation), `24c096eea402a48e4c3e0838e16550d62b1dc35a` (saved/edit state and 44px delete target), `a8d32990cf845ea9ede09f5dc36b8057f20bb023` and `a057b7bc64577982cd260077ada1ecb4befb8a9f` (regression coverage). No production database access, schema/migration, dependency/provider, billing, production-data or application deployment changes.

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

## 2026-11-12 — Main-only preservation and Vercel deployment pause

- Owner explicitly approved direct commits to `main` and requested Vercel deployments stop. `vercel.json` now sets `git.deploymentEnabled: false`, preventing automatic Git deployments across branches; manual Vercel deployment remains separate and was not invoked.
- Live main before this commit: `e9fc682f5233332cc8e10c3c09c1849455ce070c`. Live branch list contained only `main`; no open PRs; rulesets endpoint empty; branch metadata `protected: false` (dedicated protection endpoint inaccessible to the integration).
- GitHub Actions run `43140023300` passed on the pre-change SHA. Vercel latest deployment `dpl_8xUPE6hHFghQv4GaTAQW9nsXT5C9` was CANCELED; zero QUEUED/BUILDING deployments were returned. Post-commit deployment-list verification remains required.
- Existing Daily Test fixes are already saved on main in `6c0f36d`, `a9fcb70`, `e9fc682`. Older workspace edits were stale relative to main; the original workspace was snapshot-preserved as `snap_9LzNZJHfbxob30FRC4oohjkMLoHS` and successfully resumed.
- Next screen card: Learner Today home; revalidate UX, course/enrolment truth, check-in API/history scope, errors, accessibility and responsive states.
- No production DB, migration, schema, dependency or manual deployment changes.
## 2026-11-10 — PR #3 live continuation and local SQLite execution gate

- Live PR #3 head before this continuity update: `f768d9a954071c8ea9cab5aa71b9ee53ac1af2e5`; PR open/draft/unmerged/mergeable; `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head Actions run `42868179073` passed all configured steps: dependency install, isolated SQLite test DB initialization, lint, unit tests, TypeScript, production build, page-route smoke checks, authenticated role screenshots and artifact upload. Exact-head Vercel status is success. No inline review threads.
- Re-read current project continuity and upgrade docs. The WeeklyTest edit review observation is corrected: current route requires courseId, checks staff-authorised learner/course intersection and course week, and scopes by learner/course/week/optional attempt with latest-attempt semantics when omitted. Route tests cover latest attempt and cross-course denial.
- ReportCard concurrency review observation is corrected: current writer uses compare-and-swap on ID + current version; a zero-row update returns `REPORT_CARD_VERSION_CONFLICT` before writing a version snapshot. Regression test covers the concurrent loser.
- Schema rollout safety remains documented: no automatic production db push during Vercel build; derived schemas aligned; production migration still needs verified target schema/history, executable migration review and explicit owner approval. No production operation authorised.
- Owner explicitly permits use of the local SQLite development database for non-production migration prototyping/tests. However, this execution environment has no repository checkout or local SQLite database: root is `/`, no git workspace was found under `/home`, `/mnt/data` or `/openai`, and container network access to GitHub is unavailable. CI's isolated SQLite DB is not a persistent local project DB. No local commands or DB operations were run.
- Agent Pack prerequisites remain absent on PR #3: `AGENTS.md`, `docs/UPGRADE-2026-10/QUEUE.md` and `scripts/agent/run-logged.mjs`. The uploaded runner remains unsafe because it switches branches and reads prohibited `.env*`. Do not invent a task card or invoke it.
- Comprehensive-report privacy/evidence finding remains unresolved: learner-global generator after staff content_only authorisation, cross-course inputs, missing-score-to-zero coercion and management-style judgments; rendering consumer must be handled in one coherent task with the owner-approved AI-reliability notice. Block pending an approved task card/workflow.
- Questions recorded in `docs/UPGRADE-2026-10/QUESTIONS.md`. No application code/schema/migration/dependency/production data changes, no merge/deployment/branch switch/main write. PR remains draft.
- The continuity-only commits after the validated head require their own exact-head CI refresh before calling the branch's latest head green.

# TraineesAI — Project Progress

**Updated:** 2026-11-10 (WeeklyTest fixture correction and latest-attempt regression test; code head 788cad5987ccd869556ea6553c252b61dbfcce4e)  
**Repository:** https://github.com/fccljbplant/ExaminerAI  
**Active PR:** [#3](https://github.com/fccljbplant/ExaminerAI/pull/3)  
**Only working branch:** ux-audit/fix-dashboard-truthfulness-and-agent-safety


## 2026-11-10 — WeeklyTest fixture and latest-attempt regression coverage

- Updated the weekly-answer route test fixture with `week: 1`, matching the stored test to the `/weekly-test/1/answer` route. This fixes the failing test's early 403 so it exercises the intended AI-unavailable 503/no-persistence behaviour.
- Added staff edit-route coverage for omitted `attempt`: the query remains constrained to learner + selected course + week and orders attempts descending; the test asserts the latest returned attempt is the one updated.
- Test-only application changes committed on PR #3 at code head `788cad5987ccd869556ea6553c252b61dbfcce4e`. No runtime application code, schema, migration or dependency changed.
- Exact-code-head Actions run `42763242665` was in progress at this update. No pass is claimed until completion; documentation commits will require checking the resulting final PR head too.
- No local checkout was available; no local test/lint/typecheck/build or browser/a11y checks were run. No production operation, branch switch, merge or deployment.
- Next: verify the full exact-head CI run, then retain the production schema/additive rollback and explicit owner approval gates before any release.


## 2026-11-10 — Latest continuation: course-specific secondary APIs and assessment safeguards

- Validated application-code head: `a5e1ad903d8da5f39d455f297cbf3e94df7e2589`; PR #3 open/draft/unmerged/mergeable; 379 commits / 121 changed files. `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head Actions PR run `42737212881` passed install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke, authenticated role screenshots and artifact upload.
- Added reusable server-side staff-to-learner course intersection resolution and course-scoped Growth report, Comments GET and mentor briefing endpoints. Missing evidence remains unavailable; measured zero practice accuracy remains real evidence. Course-less competencies are explicitly learner-level.
- Restored course-scoped Growth panel. Comments composer remains unavailable because write endpoints are not course-scoped.
- Disabled learner/week-scoped weekly-test retake/unlock and report-card generation controls in the course-specific instructor view. Those legacy endpoints can affect or aggregate another course. Existing course-linked rows remain read-only until WeeklyTest and ReportCard identity becomes learner+course+week.
- No schema/migration/dependency/production data changes. Vercel remains failure due to build-rate limit; no Ready preview. No local/manual browser/axe checks.
- Next: additive course-specific WeeklyTest/ReportCard identity + APIs, preserve null-course legacy rows, test same-week/two-course isolation; then scope comment writes and provide an activity-linked composer. Keep PR #3 draft/unmerged.

## Current verified state
- PR #3 is open, draft, unmerged and mergeable. Latest live head at this refresh: ad1638fc9a1862b2876131fef8e1d656c82d757b; 309 commits and 111 changed files. The latest application-code/test head is earlier; subsequent commits are continuity documentation only.
- Exact-head GitHub Actions run 42724107308 completed successfully. Install, isolated DB initialization, lint, unit tests, TypeScript, production build, app-page route smoke, authenticated role screenshots and artifact upload all passed.
- Vercel combined status remains failure due to the project build-rate limit; no Ready preview is verified.
- No local checkout/test runner was available. No local test, lint, typecheck, build, browser or axe commands were run.
- No branch switch, merge, deployment, production-data operation, schema change, dependency change or main-branch write occurred in this continuation.

## Latest validated PR #3 implementation — final-result course scope
- src/app/api/students/final-result/route.ts derives staff-authorised course IDs after assertCanAccessStudent(..., "content_only").
- Instructor scope is teaching enrolments intersected with learner student enrolments; an active explicit full/content_only student grant is a fallback only when no shared teaching course exists.
- Org-admin scope uses active admin membership, active learner membership in the same organisation, linked OrgCourse rows, then the learner-enrolment intersection.
- Platform-admin scope is bounded to learner enrolments. Demo/other staff require a re-read active explicit full/content_only grant.
- weeklyTests, interactions, reportCards, projectReports and tasks are all filtered by the authorised course IDs. Empty/revoked scope returns 403 before loading report records; staff targets must be learners.
- Learner self-view remains cross-course. Academic performance, participation, areasToImprove, overallAssessment, careerReadiness, project reports and task statistics remain. behavioralPattern remains learner-self only.
- Added src/app/api/students/final-result/route.test.ts covering instructor isolation, org-admin linked-course scope, explicit grant fallback, empty/revoked scope denial, denied-access short-circuit, platform-admin bounding and learner self-view.
- Exact-head Actions run 42724107308 passed all configured quality steps, including the new route tests.

## Next PR #3 response-scope findings — implementation paused pending semantics
- src/app/api/students/[id]/generate-report-card/route.ts reads ProjectTask, DailyLog, Interaction, WeeklyTest and Comment by learner/week without course scoping. ReportCard has nullable courseId but Prisma enforces @@unique([userId, week]); a scoped calculation would still overwrite one learner-wide weekly record. Owner decision required: learner-global card or course-specific card (the latter requires approved additive migration/API changes).
- src/app/api/students/[id]/generate-project-analysis/route.ts reads ProjectReport, ProjectTask and ProjectWeek by userId alone even though those models carry nullable courseId. It also uses legacy User.project* fields with no course relation, while LearnProject is course-linked. Owner/product decision required on whether this analysis is learner-global or course-linked; do not partially filter the AI context.
- src/app/api/students/[id]/comprehensive-report/route.ts remains owner-blocked because managementAttitude contains productivity/professionalism/leadership/manager-readiness judgments. It also gathers course-bearing data learner-wide. Do not change until the owner decision is resolved.
- These findings are recorded in docs/UPGRADE-2026-10/QUESTIONS.md. No application code was changed for these findings.

## Access, privacy and data-minimisation work already in PR #3
- Org-admin access requires active admin and learner memberships in the same organisation and active learner enrolment in an organisation-linked course. Explicit grants cannot widen this boundary.
- Platform/org admins are denied explicit wellbeing/crisis scopes; instructor course membership alone does not grant those support scopes.
- Staff final-result views do not generate or return individual behavioural analysis; learners retain their own view.
- Staff portfolio views are clamped to academic content. Daily logs are queried as dates only; reflections/confidence are not loaded. Private instructor comments remain instructor-only.
- Staff-facing report-card generation fetches only daily-log dates because the calculation uses check-in count only.
- Support indicators require both explicit consent and a feature gate; both default false. No consent workflow exists and support/crisis features remain off.
- The comprehensive-report `managementAttitude` field classification remains an owner decision in `docs/UPGRADE-2026-10/QUESTIONS.md`; do not widen staff visibility or remove fields without clarification.

## UXPeak Pro — product-wide scope (owner clarification, 2026-11-09)

The owner explicitly wants UXPeak concepts applied across the whole product, not dashboards alone. Added `docs/UXPEAK-PRO-PRODUCT-WIDE-BLUEPRINT.md` covering:
- Role dashboards/command centres for learner, instructor, org admin and platform admin.
- Gamification and evidence-based motivation (phase-gated; Master Prompt places this in Phase 8).
- Course discovery, catalogue, marketplace governance and read-only first-lesson preview.
- Course “shopping” as discovery → compare → preview → request/join/enrol → approval → onboarding. Paid checkout/cart/payments are not approved and remain out of scope.
- Modern classroom, course workspace, assignments/tests/projects and legacy feature parity.
- Learner tutor, instructor Copilot, contextual AI assistance and human handoff.
- Role-based tutorials/onboarding, searchable help centre, product helpdesk and learner “I need help”.
- Inbox, announcements, notifications and the shared design system/state/accessibility matrix.
- Privacy, consent, role boundaries, feature flags and evidence gates.

Use this blueprint together with the Master Upgrade Prompt and existing UXPeak role redesign. It does not override the approved phase order or grant permission for payments, new providers/dependencies, support-data enablement, or new data processing.

## UXPeak / Workstream M implementation (parallel with privacy work)
The active role redesign is specified in `docs/UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md`. Workstream M is mandatory across UI work. Changes on the current PR are deliberately incremental foundations, not a claim that the full role redesign is complete.

- Learner dashboard: recoverable load errors now use safe, actionable copy instead of rendering raw error text.
- Instructor dashboard: safe recovery copy; “View all students” now has a 44px minimum target and visible keyboard focus.
- Organisation dashboard: safe recovery copy; a true no-members empty state explains the next step and links to member management; announcement body textarea has visible keyboard focus.
- Platform dashboard: safe recovery copy; organisation and audit empty states explain the absence and provide direct navigation; loading skeleton now matches all eight KPI cards; empty-state actions use Next.js client navigation.
- Existing token/theme architecture retained; no dependencies or parallel design system added.
- The latest code has not yet been visually inspected after these changes. Before/after screenshots, populated/error/permission fixtures, axe, manual keyboard/screen-reader, reduced-motion, zoom/reflow and task-based checks remain required for UX sign-off.

## Earlier dashboard and theme foundations
- Learner session-duration chips and Projects “See all” action use 44px minimum targets and visible keyboard focus.
- Instructor header links use 44px targets; at-risk roster rows use 48px targets and visible focus.
- Organisation announcement title input, retry action, Manage people and Full audit links use 44px targets and visible focus.
- Theme validation was expanded across the shipped theme modes; navigation target sizing and semantic navigation fixes are included in the branch.

## Open risks and next steps
1. Recheck Actions for current head `6d90c757`; fix failures only on this branch.
2. Capture and inspect before/after dashboard screenshots at the seven specified viewports and supported themes. Do not score UX screens release-ready without interaction and accessibility evidence.
3. Add route-level tests for org membership, OrgCourse scope, cross-tenant denial, grant revocation and instructor regression.
4. Review all `assertCanAccessStudent` callsites for field-level response classification and explicit support-scope handling.
5. Keep learner-support consent workflow, `learner_support_v1`, support-view audit logs and Learner Support Lead crisis handling off until owner approval and safeguards exist.
6. Keep PR #3 draft; no merge or deploy without explicit owner approval.


## 2026-11-09 — PR #3 marketplace accessibility and learner-target guard

- Continued only on the existing PR #3 branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Live starting head: `875e80c6bca63654dd88ab245612ab49f614b382`; PR #3 was open, draft and unmerged.
- Verified GitHub Actions run `42658325358` passed every configured step on that starting head: dependency install, isolated DB init, lint, unit tests, TypeScript, production build, route smoke, authenticated screenshots and artifact upload.
- Marketplace discovery: `src/app/(public)/courses/MarketplaceFilters.tsx` now exposes the already-supported Featured-only filter, gives search and select controls accessible names, and raises search/category/level/quick-filter/clear targets to 44px minimum height.
- Learner target validation: `src/app/api/v2/instructor/students/[id]/route.ts` now returns 404 unless the target account normalizes to the learner role, before querying or returning the learner drill-down aggregate.
- Commits: `98c4b328e495c426f106349c262cafd7fc19214c` (marketplace filters) and `b4f937c098fda0b6f7aa78f2d1ad31944b9c71f6` (learner-target guard).
- Latest verified PR head: `b4f937c098fda0b6f7aa78f2d1ad31944b9c71f6`; 250 commits, 109 changed files; still open, draft, unmerged. No workflow run was returned yet for this new head. The previous green run is not evidence for these two commits.
- Vercel status remains failed due to the build-rate limit. No preview, deployment, merge, production data operation or main-branch change was performed.
- No local tests/build or manual browser/axe checks were available. Latest-head CI is pending; marketplace filter interaction and route denial need automated coverage in a subsequent focused pass.
- Comprehensive-report `managementAttitude` field classification remains blocked in `docs/UPGRADE-2026-10/QUESTIONS.md`; no schema or visibility changes were made. Learner-support features remain off.


## 2026-11-09 — Instructor course-scope privacy hardening

- Starting PR head: `7831019ebfa174e0dfaa256df6312d97235c8e4d`.
- Latest PR head: `d78ec3e7589edd9c3e907de9a6707f3848bb6384` on the existing branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Reviewed the v2 instructor student drill-down and roster queries against `prisma/schema.prisma`. Found that several learner records with a `courseId` were selected by `userId` alone, allowing a staff member scoped to one course to see activity from another course for the same learner.
- Added an intersection of staff-authorised course IDs and the learner's course enrolments in `src/app/api/v2/instructor/students/[id]/route.ts`. Weekly tests, report cards, daily logs, project tasks, certificates and engagement events are now filtered to that shared-course set; LearnProjects were already scoped.
- Added `getAuthorizedStudentCourseIds` and unit tests for intersection, non-overlap denial and duplicate IDs in `src/modules/instructor-portal/student-detail-visibility.ts` and `student-detail-visibility.test.ts`.
- Also scoped instructor roster daily-log aggregation and project-task progress to the instructor's taught course IDs in `src/app/api/v2/instructor/students/route.ts`.
- Commits: `5bb879bbf58d757f0291c7785d28406846b660f2`, `7d2873b15a11d7623d93c3e40a85b4d89601de74`, `f220698463de78f0c1704ed6b53ea9aaf648855c`, `d78ec3e7589edd9c3e907de9a6707f3848bb6384`.
- GitHub Actions run `42661008830` passed on the latest head: dependency install, isolated DB initialization, lint, unit tests, TypeScript, production build, route smoke tests, authenticated dashboard screenshots and artifact upload. Screenshot artifact `role-dashboard-screenshots` is retained until 2026-11-16.
- Vercel status remains failed due to the project build-rate limit; no current preview is verified. No merge, deploy, production data change or main-branch write occurred.
- Residual scope note: `SkillMastery` and legacy `Competency` have no `courseId` in the current schema, so the drill-down still returns these learner-level records as global learner profile data. Confirm intended semantics before introducing course partitioning or changing their visibility. The unresolved comprehensive-report `managementAttitude` classification remains blocked in `docs/UPGRADE-2026-10/QUESTIONS.md`.
- The interactive Vercel sandbox endpoint returned 403 for this connection; verification was performed on the GitHub-hosted Actions runner instead. No interactive VM shell was available.


## 2026-11-09 — Latest PR #3 staff portfolio review

- Verified live PR #3 at `9ac14c13069bbe91b8a1fca54d305514f66590e3`: open, draft, unmerged, mergeable; 262 commits / 109 changed files.
- Exact-head Actions run `42661692753` passed install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke tests, authenticated role screenshots and artifact upload. Exact-head Vercel status remains failed due to build-rate limit; no Ready preview confirmed.
- Read-only review found that the staff portfolio endpoint checks access to at least one shared course but queries ProjectTask, Interaction, WeeklyTest and ReportCard by learner ID only. All four models carry courseId, so multi-course learners can expose records outside the caller's authorised courses. Finding and required correction are recorded in `docs/UPGRADE-2026-10/QUESTIONS.md`.
- The v2 student-detail support visibility helper defaults to false and only permits instructors when both consent and feature gate are true; the current route call passes neither, so support fields remain off.
- Agent Pack prerequisites are missing: AGENTS.md, QUEUE.md and run-logged.mjs return 404. The uploaded pack is unsafe to activate unchanged because its runner switches/creates branches and its guard reads prohibited .env* files. No approved task card or safe runner is available.
- No application code changed. No merge, deployment, production-data change, branch switch or main-branch write.
- Next: restore/adapt the Agent Pack safely on this branch, obtain an approved task card, then implement the portfolio authorised-course intersection and route-level access tests. Clarify expired-enrolment visibility; do not change course-less competency semantics without owner direction.




## 2026-11-10 — PR #3 portfolio scope and roadmap additions

- Continued on the existing PR #3 branch only. Current live head at this update: 6fe426c2cbd571fd1f77569b6421f6cc4f81ef83. PR remains open, draft, unmerged and mergeable.
- Portfolio endpoint now derives staff-authorised course IDs and intersects them with learner enrolments before querying ProjectTask, DailyLog, Interaction, WeeklyTest and ReportCard. Instructor access uses teaching enrolments; org-admin access uses active same-org memberships and OrgCourse links; platform admin is bounded to learner enrolments.
- Explicit student grants remain student-scoped but bounded to learner enrolments. The route now respects grant dataScope: full/content_only return academic content; wellbeing_only/crisis_only return no academic portfolio records. It fails closed if a grant disappears between the initial access check and scope derivation.
- Instructor comments are scoped through course-bearing records they annotate. All non-null comment relation IDs must also belong to the authorised record sets; unlinked or mixed-scope comments are excluded.
- Added route tests for instructor multi-course isolation, org-admin linked-course scope, explicit-grant fallback, restricted wellbeing grant, grant disappearance and denied access. Existing helper tests cover intersection/deduplication.
- Competency remains course-less in the schema and is unchanged for authorised academic viewers. Expired CourseEnrollment semantics remain unchanged; no expiresAt filter was added.
- Appended the owner-requested org-admin trainee assignment/reassignment and instructor course-access removal approval requirements to the end of docs/UXPEAK-PRO-PRODUCT-WIDE-BLUEPRINT.md and Issue #4. These are future Workstream J scope, not PR #3 implementation.
- Exact-head Actions status is pending/not yet returned for the latest commits; run 42721835502 on an earlier code head was cancelled by a subsequent push before tests began. Vercel status remains pending. No local test/lint/typecheck/build/browser/axe checks were available.
- No schema/dependency/production-data changes, branch creation/switch, merge or deployment. Agent Pack queue/runner remains absent and was not invoked.

### Next
1. Verify GitHub Actions on the latest PR head; fix lint, test, typecheck, build or smoke failures before starting another implementation slice.
2. Review the final route diff and test coverage, especially comment-link scoping and grant-scope denial.
3. Keep course-less Competency and expiresAt semantics as explicit follow-up decisions; keep learner-support/crisis features default-off.
4. Continue the remaining PR #3 plan in sequence. Keep PR #3 draft and do not merge/deploy without approval.


## 2026-11-10 — Next PR #3 response-scope slice identified

- Read src/app/api/students/final-result/route.ts. It authorises staff with assertCanAccessStudent(payload, targetUserId, "content_only") but its nested weeklyTests, interactions, reportCards, projectReports and tasks queries at lines 47–51 are not filtered by courseId. Each model has a courseId field in Prisma. This is the next PR #3 access-scope slice after the portfolio route passes validation.
- Preserve learner self-view across their own courses. For staff, apply the same instructor/org-admin/platform-admin/explicit-grant course boundary to every course-bearing relation.
- Owner clarification remains controlling: do not remove required academic outcomes. Staff responses retain academic performance, participation, areasToImprove, overallAssessment, careerReadiness and project/course data where authorised. behavioralPattern remains learner-self only until the approved support consent/feature-gate pathway exists.
- Comprehensive-report managementAttitude classification remains blocked in QUESTIONS.md; do not change it as part of this next slice.
- Exact current PR head at this note: 4d394819e074f528b12b821d6d69d54a45c5739f. Portfolio implementation still awaits an exact-head successful Actions run; no local checks were available. Do not claim this review is implementation or validation.


## 2026-11-10 — Institutional policy decisions resolved

Owner delegated the outstanding academic/product policy decisions. Adopted direction is documented in `docs/UPGRADE-2026-10/QUESTIONS.md` and summarised in `docs/PROJECT-STATUS.md`.

- Academic record is course-specific: ReportCard and WeeklyTest identity is learner + course + week; certificate is per course completion.
- Published course-specific grading, pass, retake and credential policies; missing evidence remains unavailable, never defaulted to zero or a fabricated score.
- Report cards are reviewable/versioned; weekly sequencing remains self-paced and server-enforced.
- Course project analysis must not combine learner-global legacy fields with course-specific records.
- Replace subjective management-attitude/manager-readiness labels with observable rubric competencies and human review.
- Academic integrity indicators require fair human review, learner response and appeal; no automatic penalties.
- Instructor assignment is same-organisation and course-scoped. Organisation-course removal requires independent org-admin approval; independent instructors may confirm. Pending requests do not revoke access; history is retained.
- Preserve learner-support privacy and designated crisis oversight boundaries.
- Historical null-course rows remain legacy/unassigned without reliable provenance; no guessed backfill.
- This session records policy only. No implementation or migration was performed. Next implementation should be a coordinated, additive, tested course-specific assessment/report-card/certificate slice; keep PR #3 draft and unmerged.


## 11. 2026-11-10 — Comprehensive-report assessment policy clarification

- Owner clarified that AI-generated personality/management-style sections must be **retained**, not removed. Keep productivity signals, professionalism signals, leadership-potential observations, manager-readiness observations and focus areas.
- Add a prominent, professionally worded limitation notice: the assessment is AI-generated and based solely on the learner's interactions with the AI; it is not a validated psychometric assessment or comprehensive professional appraisal; reliability and completeness are limited; management should conduct a structured, comprehensive interview and consider work samples, observed performance, references and other appropriate evidence before consequential decisions.
- The notice must be adjacent to the assessment and part of the report/API contract. A human-reviewed flag does not validate the assessment or remove the warning. The report must not be the sole basis for consequential employment, placement, promotion, discipline or certification decisions. Do not make clinical or validated psychological claims.
- This supersedes the prior policy note recommending removal of subjective personality-style labels.
- Live PR #3 at session start: open/draft/unmerged/mergeable, head `08073be20037f21f5e52ffa9bead0dcd1f8bd6d6`, 319 commits / 111 files. Exact-head Actions run `42728018598` passed; Vercel status failed due to build-rate limit; no reviews/threads returned.
- Source review confirmed the comprehensive-report generator still gathers learner-global data. No verified display consumer for the endpoint was found in the repository tree. Do not make a disclaimer-only API change and claim the user-facing report is fixed; align course/tenant evidence scope, cached/new response shape, rendering and tests as one coherent change.
- Updated repository `QUESTIONS.md`, `PROJECT-STATUS.md` and `SESSION-LOG.md` with the owner decision. Documentation-only commits followed; re-fetch the latest head and checks before further work.
- No application code, tests, schema, migration, dependencies, production data, merge or deployment changed in this session. PR #3 remains draft/unmerged.


## 2026-11-10 — Standing institutional decision-maker mandate and comprehensive-report audit

- Owner delegated routine product, academic and learner-experience decisions to the assistant acting as course coordinator, student counsellor, examination head and university leadership. Do not repeatedly ask the owner to settle routine policy questions; decide professionally and record rationale, safeguards and superseded decisions in the running ledger.
- Owner intends to compile all accumulated decisions into a polished consolidated policy document later. Maintain the running ledger in docs/UPGRADE-2026-10/QUESTIONS.md, docs/PROJECT-STATUS.md and docs/SESSION-LOG.md; do not present it as the final consolidated document.
- Preserve explicit owner approval for production settings/data, destructive or production migrations, spending/provider changes, protected-branch pushes, merge and deployment. Escalate materially ambiguous legal/safety decisions.
- Live PR #3 before this documentation update: open/draft/unmerged/mergeable; branch ux-audit/fix-dashboard-truthfulness-and-agent-safety; head d202b14623d34b4e1ea689f277756e1c03d7bddc; 323 commits / 111 files. Exact-head Actions run 42729780661 passed install, isolated DB setup, lint, unit tests, typecheck, production build, route smoke, authenticated role screenshots and artifact upload. Vercel remains failed due to project build-rate limit. No reviews/threads returned.
- Comprehensive-report audit found learner-global queries across interactions, weekly tests, project tasks, project reports and certificates; SkillMastery has no courseId; legacy User projectName/currentWeek are global; missing scores are coerced to zero and no test evidence becomes overall 0 / grade F. The endpoint has no course context and no verified UI consumer was found. Keep management-style fields per owner instruction, add the approved AI-interaction-only reliability notice when implementing the actual report surface, and do not expose cross-course learner-global evidence as a course-specific evaluation.
- The Master Prompt's Phase 0 remains read-only; Agent Pack runner/task-card files are absent on this branch. No task card was fabricated or runner bypassed. Existing PR #3 continuation follows the owner's explicit direction, but new large schema/academic-record work must remain separately scoped and migration-reviewed.
- This session updated policy/governance documentation only. No application code, tests, schema, dependencies, migrations, production data, merge or deployment changed. No local checks/browser/axe validation were available.


## 2026-11-10 — Learner-detail metrics truthfulness fix and course-scope follow-up

- Fixed the instructor learner-detail KPI contract in PR #3: no assigned tasks now returns unavailable progress (null), not 0%; no activity dates and no scored tests returns unavailable attention score (null), not 0. Genuine evidence-backed zero remains a valid value. The UI renders unavailable values as an em dash and does not show a risk banner when attention evidence is absent. Project progress uses the same no-task semantics.
- Added six pure-helper unit tests covering no evidence, genuine zero, positive progress, inactivity-only, low score and declining score.
- Changed files: src/modules/instructor-portal/student-detail-visibility.ts; src/modules/instructor-portal/student-detail-visibility.test.ts; src/app/api/v2/instructor/students/[id]/route.ts; src/modules/instructor-portal/student-profile.tsx.
- Separate course-scope issue discovered: the detail API queries all courses shared by the instructor and learner, but returns only the first courseId. This can mislabel a cross-course aggregate as one course. Decision: auto-select only for exactly one shared course; otherwise require explicit course selection and filter all course-bearing evidence to it. Do not infer course attribution for learner-level mastery records without courseId. This remains open.
- Latest code head: 48bc189c48012d62da5dd7582145398fd19293ec. Actions run for latest head not yet confirmed; prior run 42730939202 was pending on previous code head 2fc96787c36cce2d6a2cd3c785b63b590b0248ec. Vercel status remains build-rate limited. No local checks/browser/axe available.
- Standing decision-maker delegation and the plan to consolidate the running decision ledger into formal documentation later are recorded in QUESTIONS.md, PROJECT-STATUS.md and SESSION-LOG.md.
- No schema, migration, dependency, production data, merge or deployment changed. PR #3 remains open/draft/unmerged.


### Validation update — 2026-11-10

- Latest code commit 48bc189c48012d62da5dd7582145398fd19293ec has Actions run 42730976622 cancelled during dependency installation; all substantive checks were skipped. Do not claim the metric fix passed CI.
- PR head after documentation updates:  f332108143ff6f48e99b6f195452e42bd4e8b41a (337 commits / 112 files); no Actions run returned for this docs-only head. Vercel remains failed due to project build-rate limit.
- The metric change is implemented but awaits successful exact-head CI and local validation is unavailable. PR remains open/draft/unmerged.


## 2026-11-10 — Instructor learner-detail course isolation

- Starting code head: `a00590da6e21c1c25ba4502bef8956bc7a1ea32e`; ending code head: `01bb794544bfabb6beca10abd32a1ad97a094ec1`.
- PR #3 remains open/draft/unmerged/mergeable; main HEAD remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Fixed the multi-course aggregate mislabelling issue. One shared course auto-selects; multiple shared courses require an explicit authorised selection; invalid/no shared course is denied. All course-bearing drill-down queries now use the selected course only.
- UI adds accessible course selection and selected-course labelling; avoids stale data during switching. SkillMastery is labelled learner-level because it has no courseId. Unscoped Growth/Comments/mentor briefing panels are withheld until their APIs are course-scoped.
- Added pure-helper tests for course selection policy. No route-level integration tests yet.
- Previous head Actions run `42731168978` passed on `a00590da...`; no run yet returned for `01bb794...`. Vercel remains blocked by build-rate limit. No local checks/browser/axe available.
- No schema/migration/dependency/production data, merge, deployment or main change.
- Next: verify exact-head CI, add route-level query-isolation tests, then scope Growth/Comments APIs before restoring panels.



### Route-level tests added — 2026-11-10
- Added `src/app/api/v2/instructor/students/[id]/route.test.ts` with four cases covering multi-course selection-required/no-query behaviour, selected-course relation filtering, invalid course denial and one-course auto-selection.
- Test/code head: `f26de0c15cdecb541792066c3d2b34d72914c0b3`. Exact-head CI not yet returned; prior run `42734322946` cancelled during dependency installation. Do not claim checks passed.



## 2026-11-10 — Course-scoped comment writes

- PR #3 code head: `c4a63e5c0779aa48150c8405e019e7546549983d`; open/draft/unmerged/mergeable. `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Staff comment POST requires an authorised selected course and at least one activity link. Every supplied link must belong to the same learner and selected course. PATCH/DELETE require courseId and revalidate every existing linked record. General/unassigned/mixed-course comments remain read-only through staff writes; learner self-history remains cross-course.
- Added route tests for missing course/activity, unauthorised course/activity, mixed references, valid linked creation and cross-course edit/delete denial. Updated `docs/api.md`.
- Exact-head Actions run `42740191410` passed: lint (0 errors, 7 warnings), 436/436 unit tests across 41 files, typecheck, production build, 83/83 route smoke checks, four-role × seven-viewport screenshot capture and artifact upload `13729306143`.
- Vercel remains blocked by build-rate limit. No Ready preview, local test run, manual browser/axe/a11y validation. No schema/migration/dependency/production data, merge, deploy or main write.
- Next: coordinated course-specific WeeklyTest/ReportCard schema and APIs, with null-course legacy preservation, report-card versioning and rollback notes. Agent Pack `AGENTS.md`, queue and logged runner are absent; do not invent a task card.


## 2026-11-10 — Comment write audit trail

- Current validated application-code head: `b12017d0a5dd4d26da0fcad3726b2b9c9cacffa7`; PR #3 open/draft/unmerged; main unchanged at `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Comment POST/PATCH/DELETE now emit `comment_created`, `comment_updated`, `comment_deleted` audit events through the existing helper. Metadata is privacy-minimised (course ID, activity types, changed field names; no comment text, learner ID or activity IDs).
- Added tests for audit events and metadata minimisation. Exact-head Actions run `42741613904` passed 438/438 tests across 41 files, lint (0 errors / 7 warnings), typecheck, build, 83/83 route smoke and screenshot artifact upload `13729682267`.
- Vercel remains blocked by build-rate limit. No local/manual accessibility validation, schema/migration/production data, merge, deployment or main write.
- Next: course-specific WeeklyTest/ReportCard schema/API work, preserving legacy null-course rows and version history; Agent Pack task-card/runner prerequisites remain absent.


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


## 2026-11-10 — Live continuation refresh

- Live PR #3: open/draft/unmerged/mergeable; branch `ux-audit/fix-dashboard-truthfulness-and-agent-safety`; head `69a1fbf65a723badc28bb6a4699ad3a50ddb4382`; base `main` unchanged at `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`.
- Exact-head Actions run `42752208726` passed 438 tests / 41 files, lint (0 errors / 7 warnings), TypeScript, production build, 83/83 route smoke checks, four-role × seven-viewport screenshot capture and artifact upload `13734421184`. Screenshots were not manually inspected.
- Vercel combined status remains failure due to project build-rate limit; no Ready preview verified. No PR reviews/inline threads.
- Course-scoped comment writes and privacy-minimised comment audit events remain present.
- Next privacy/evidence issue: comprehensive-report route checks `content_only` but calls a learner-global generator. Cross-course evidence, course-less mastery, legacy global project/current-week fields, missing-score-to-zero coercion and default F-grade behavior remain. Keep management-style fields with the owner-approved adjacent AI-reliability notice; no report renderer is yet verified.
- Blocked: branch-preserving task-card/logged-check workflow is missing. Uploaded Agent Pack has no card for this follow-up; its runner switches branches and its OpenCode guard reads `.env*`. Do not run it, invent a task card, or patch this high-risk slice without the required workflow.
- No application code/tests/schema/dependency/migration/production data, merge, deployment, branch switch or main write in this refresh. Local/manual accessibility checks remain unavailable.


## 2026-11-10 — Post-refresh metadata correction

- The application/code head `69a1fbf65a723badc28bb6a4699ad3a50ddb4382` passed Actions run `42752208726` (438 tests / 41 files, lint 0 errors / 7 warnings, TypeScript, build, 83/83 routes, screenshots/artifact).
- Subsequent handoff-only commits advanced the branch to `28b4da846b8a5ad9629332e8f8a8ca125b9a9835`; no Actions run was returned for that docs-only head. Vercel reports build-rate-limit failure.
- PR #3 remains open/draft/unmerged. Latest metadata reported mergeable=false, while compare says 416 ahead / 0 behind main; mergeability is therefore unconfirmed and must be rechecked.
- No application source changes in the handoff refresh. Comprehensive-report implementation remains blocked pending safe task-card/logged-check workflow.


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


## 2026-11-10 — Additional assessment hardening and course-context fallback removal

- Manual report-card API score validation now requires an integer 0–100 (or null), matching Prisma storage. New route tests cover fractional values, numeric-string input, selected-course grade derivation and cross-course denial.
- Course outline loading no longer silently chooses the first enrolment or substitutes a global hardcoded topic ladder when course context is missing/ambiguous. Added tests for multi-course ambiguity, absent outlines and explicit course selection. This keeps assessment prompts and unlocks tied to the learner's actual course content.
- Exact code head at this update: `65adda3fead4875ce45e45a4617beefb7168d402`. GitHub Actions quality checks are queued/in progress (runs `42757359856` and `42757365580`); no pass is claimed. Vercel remains failed by build-rate limit.
- PR #3 remains open/draft/unmerged. No local test/lint/typecheck/build or manual browser/a11y checks were available. No production schema push, migration deployment, merge or deployment occurred.


## 2026-11-10 — PR #3 certificate eligibility typecheck fix

- Refreshed the live PR before editing: PR #3 open/draft/unmerged on the existing branch; prior head `a10b93029dc192b3aef08b564840946f3e43d7f3`.
- Exact-head Actions run `42763366450` passed lint and unit tests, then failed TypeScript at `src/app/api/certificates/user/route.ts:102-103`: `eligibility` may be null. Build, route smoke and screenshot stages were skipped.
- Fixed the response projection to return `eligible: null` and `averageScore: null` when eligibility evidence is unavailable, instead of dereferencing null or fabricating a negative eligibility decision.
- Commit: `6e7ea3a8000ae7a59e838c43c3e76d00df8cf138`.
- Exact-head Actions run `42865683017` is in progress; Node setup completed, dependency installation was in progress at this update. Do not report validation as passed until the run completes.
- Vercel preview check is pending at this commit; no Ready preview confirmed. PR remains draft/unmerged. No schema, production data, migration, merge or deployment operation.


## 2026-11-10 — PR #3 review follow-up and schema safety

- Refreshed the live PR #3 branch and verified the current source. Review observation 1 (weekly-test staff edit course/attempt boundary) is implemented and covered by route tests. Review observation 2 (report-card concurrent update race) is implemented with compare-and-swap and a race regression test.
- Added `docs/UPGRADE-2026-10/PR3-SCHEMA-ROLLOUT.md` with preflight, controlled migration, legacy NULL-course preservation, report-card baseline history, rollback/recovery and owner approval gates.
- Removed the automatic production `prisma db push` from `scripts/vercel-build.sh`; Vercel builds no longer attempt production schema mutation.
- Regenerated `prisma/schema.prod.prisma` and `prisma/.demo.prisma` from canonical `prisma/schema.prisma`. Verified model bodies are identical after regeneration.
- Code/doc commits in this slice: `28ec1728afc64c82cd75ea0dd909b8d82d1503c9` (build no longer pushes schema), `509cc4cc1a4a14646b5f74af754ef4d8d706ba7c` (production schema regeneration), `61277c52d2c315c0b0ae2fa088a435a9fee738f4` (demo schema regeneration), `c3ba33dfdcf2e2d5e48c88849a4e16eb88adc4c1` (rollout plan).
- Exact-head Actions run `42867165869` was pending at the last refresh; Vercel status was pending. Do not claim validation until the final docs head has a completed run.
- Remaining external release gate: no executable production migration is included or validated; actual production schema/migration history is unknown and no production database was inspected. Explicit owner approval of the exact migration/target/backup/restore window remains required. Keep PR #3 draft/unmerged/undeployed.
- No production data/schema operation, merge, deployment, branch switch, dependency change, or main-branch write. No local checkout or manual browser/axe/keyboard/screen-reader/reduced-motion/zoom/reflow validation was available.


## 2026-11-10 — Exact-head validation completed for PR #3 review follow-up

- Exact PR head `dd69eb46906d664a860fdb43f613986783066eb3` passed GitHub Actions run `42867410267`: dependency install, isolated DB initialization, lint, unit tests, TypeScript, production build, app-page route smoke tests, authenticated role screenshot capture and artifact upload.
- Vercel combined status for this exact head is success. PR #3 remains open, draft, unmerged and mergeable; no inline review threads are open.
- Updated the PR discussion response with the fixes and exact-head validation evidence. Review observations 1 and 2 are corrected. Schema observation 3 has a documented rollout/rollback plan and the Vercel build no longer pushes schema automatically, but explicit owner approval and a verified executable production migration remain release gates.
- No production database inspection or schema operation, merge, deployment, branch switch, dependency change or main-branch write. CI screenshots were captured but not manually inspected; no axe/manual keyboard/screen-reader/reduced-motion/zoom/reflow validation was performed.


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


## 2026-11-11 — Mainline consolidation

- Merged to main: Vercel Analytics (PR #2), safe UI simplification / role-aware home routing (PR #7), learner courses compatibility redirect (PR #8), and learner-home unavailable/error truthfulness fix (PR #9).
- Exact-head quality workflows passed for PR #7 (`42909814324`), PR #8 (`42910567097`), and PR #9 (`42911198601`), including build, route smoke and authenticated role screenshot artifacts. Main CI after PR #8 passed (`42911131106`).
- All automatic production deployments from these merges were cancelled before release. No production database or manual deployment was used.
- PR #3 stays draft pending the specific PostgreSQL migration, NULL-course legacy treatment, backup/restore, staging rehearsal and owner approval of exact production target/window. PR #6 V3 stays held due shell/role/nav incompatibility, tracked SQLite DB and regression-test removals.


## 2026-11-11 — Vercel build write-safety hardening (PR #11)

- Live source audit found `main/scripts/vercel-build.sh` was applying `prisma db push`, running `scripts/ensure-accounts.js` (which reset the platform-admin password to a hardcoded value and swallowed upsert errors), and running `scripts/seed-marketplace-prod.js` during Vercel builds.
- Created branch `fix/vercel-build-readonly` from main and draft PR #11. Replaced the build script with Prisma client generation plus Next.js build only; removed schema mutation and all account/marketplace seed invocations from deployment.
- Converted `scripts/ensure-accounts.js` into an explicit one-time bootstrap requiring `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` from a secret manager (minimum 16 characters). Existing accounts are skipped without changing password, role, status or approval state; errors are no longer swallowed.
- Exact PR head: `8066af94ae87e6c9c7dc8ef8e49fed37a94babc0`. GitHub Actions run `42938312216` is in progress at dependency installation; Vercel preview `DC6oshqfcbsywZudqnjDtYcMd5UG` is BUILDING. No check is claimed passed yet.
- No database was accessed or modified; no migration, seeding, merge, production deployment, or branch deletion occurred. PR #11 remains draft pending exact-head CI and preview verification.


## 2026-11-11 — PR #11 merged: Vercel build is read-only

- PR #11 merged to main by squash as commit `24b69fbf716d0c4fa3d7fd9f278db4b85163ece8`.
- `scripts/vercel-build.sh` now only generates the production/demo Prisma clients and runs `next build`; it no longer runs `prisma db push`, admin account bootstrap, or marketplace seeding.
- `scripts/ensure-accounts.js` is an explicit one-time bootstrap requiring `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` supplied by a secret manager. It skips existing accounts without changing them; no hardcoded default admin password remains.
- Added `src/lib/vercel-build-safety.test.ts` to enforce the read-only build and safe bootstrap contract.
- Exact PR head `fa59d645d6b729c16d32e4bc1ab23ca814678aa4` passed Actions run `42938561279`: install, isolated SQLite setup, lint, unit tests, TypeScript, production build, route smoke tests, authenticated role screenshots and artifact upload. Artifact `role-dashboard-screenshots` retained until 2026-11-18.
- Vercel preview deployment `dpl_EDusyC3RNBZPuHwt2wE655Fa9vHS` reached READY. Its build logs show Prisma client generation and Next.js build without schema push or seeding steps.
- Main commit `24b69fb` automatically triggered a production-target Vercel deployment `dpl_2tHWh3SjhiXajjCWQ1cmsfwjAdHj`; it was BUILDING at this status update. Recheck final state and runtime health separately.
- No database was accessed or modified, and no schema migration or seed was run. PR #3 remains blocked by schema/privacy gates; PR #6 remains held for selective V3 salvage only.


## 2026-11-11 — Role screenshot review: learner empty-state heading gap

- Manually inspected the 28 screenshot artifact from Actions run `42938561279` (4 roles × 7 viewports: 360, 390, 768, 1024, 1366, 1920, 2560 widths). The artifact was downloaded and the role contact sheets reviewed.
- Manifest reports no horizontal document overflow at any viewport; no unnamed controls, unlabeled fields, missing image alt text, missing page language, or missing main landmark in the heuristic scan. This is not an axe/WCAG audit.
- Found one concrete accessibility issue: all 7 learner-home screenshots report `primaryHeadings: 0`. Source inspection confirms `LearnerHome` returns `NoEnrollment` when `enrolledCount === 0`, and `NoEnrollment()` renders “Start your first course” as a paragraph rather than a page-level `h1`. The enrolled state has an `h1`.
- Required follow-up: make the learner no-enrollment state expose one meaningful page-level `h1` (without introducing duplicate headings), add component/route regression coverage for empty and enrolled states, and rerun role screenshots. Manual keyboard, screen-reader, zoom/reflow and axe validation remain outstanding.
- No application code changed for this finding. It is logged for the next approved UI accessibility task; the required Agent Pack task card/queue and safe logged runner are still absent.


## 2026-11-11 — Final deployment state after documentation consolidation

- Current main HEAD is `e390031cbf6eb0203c046947fcd3bd4c260014c7`; it contains the PR #11 deployment-safety fix, PR #12 deployment status documentation, and PR #13 screenshot QA finding documentation.
- Latest READY production deployment observed is `dpl_AS4D5wBkdubVHXEaXfQmumDSoahQ`, built from main commit `1c2af3e962290ea20634229dc506e3a71bb51ada`. It carries the stable alias `examiner-ai-tau.vercel.app` and the project main aliases. This commit includes all application-code changes from PR #11; PR #13 added documentation only.
- Vercel status for current docs-only main commit `e390031` is failure due to the free-plan build-rate limit. This does not invalidate the READY application deployment on `1c2af3e`; no application source changed in PR #13.
- Runtime error/fatal log query for the READY production deployment over the inspected 15-minute window returned no entries. This is not proof of database connectivity or successful user journeys.
- Open PRs remaining: PR #3 (schema/privacy/task workflow gates) and PR #6 (V3 selective integration hold). All other prior feature PRs are merged/closed. Branch refs remain because the available GitHub integration does not expose branch deletion; preserve unmerged work.
- No database was accessed or seeded. No migrations were run. No production settings changed.


## 2026-11-11 — Live consolidation refresh and Agent Pack reconciliation

- Refreshed live `main`: `aa64d6aa7d4813c3f3b6b3738216de73375b7a1c`. Exact-head GitHub Actions quality check `42976216079` completed successfully. This verifies configured CI for this docs-only main commit; it is not manual accessibility or production validation.
- PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 11 behind). PR #6 remains open/draft/non-mergeable at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 19 behind); its branch contains tracked `prisma/db/custom.db` and broad shared-shell changes.
- The branch inventory was refreshed: 13 refs. `backup/v3-ui` and `master` are identical. UI simplification branches overlap. Learner courses and learner-home error-handling branches contain small unique file sets. Documentation branches overlap continuity files. Analytics and build-safety branches require duplicate-commit checks against already merged PRs before any integration.
- The repository Agent Pack is being reconciled onto a dedicated PR from current `main`. The proposed `scripts/agent/run-logged.mjs` was deliberately excluded because its hard-coded PR #3 branch guard is incompatible with the current consolidation workflow; GitHub Actions remains the validation source.
- Confirmed PR #11 build-safety work is already represented in `main`; do not re-integrate the older branch wholesale. PR #14 is docs-only and merged.
- No app source, database, schema, dependency, production setting or deployment was changed. No source branch was deleted and no force update/history rewrite occurred.
- Next: complete the docs-only Agent Pack PR and CI, then continue P0-03 by verifying commit equivalence and integrating the small learner compatibility/error-handling changes only once. Hold PR #3 until schema/privacy gates are resolved; hold V3 pending selective salvage and DB artifact exclusion.


## 2026-11-11 — Duplicate branch content verified against main

- Verified identical blob SHAs for all changed application files in `fix/ui-simplification-safe`, learner-courses compatibility, learner-home error handling, Vercel Analytics, and reviewed Vercel build-safety source/test files. PRs #2/#7/#8/#9/#11 already integrated the code; do not merge these branches again.
- Documentation branches overlap existing merged records. Remaining substantial unmerged work is PR #3 (large code/schema/privacy surface) and PR #6 (V3 shell/theme/feature flags plus tracked SQLite DB artifact).
- No app code or database changed in this documentation-only reconciliation.


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


## 2026-11-11 — Reset-first upgrade plan saved to main

- Added the new active programme in docs/UPGRADE-2026-11/: START-HERE.md, MASTER-PLAN.md, UXPEAK-RESEARCH-AND-DESIGN.md, AI-AND-DATA-STRATEGY.md, RESET-BASELINE.md and DECISIONS-REGISTER.md.
- Reconciled the active agent contract and legacy Agent Pack instructions/queue to the owner’s reset-first, main-only direction. Previous consolidation queue entries are historical and not executable.
- Snapshot main HEAD for the documentation milestone: 4377fa40854622ca4cc0ad5f7b6f55b48f303404. Pre-reset inventory: 20 refs including main, 19 non-main refs; open/draft PRs #3 and #6. The reset has not yet run; branches are still present and PRs remain open.
- Vercel status on this docs-only main commit is failure due to build-rate limit. The connected workflow-run query returned no PR-triggered Actions runs for this exact main SHA. No tests/build/browser checks were run for docs-only changes.
- No application code, schema, dependency, production DB, migration or deployment was changed. No branch deletion or PR closure performed.
- Next: verify private archive and restore; close open retired PRs; delete all remote refs except main; verify exactly one branch; then perform the read-only main audit and create a gap-only implementation register.


## 2026-11-11 — Mainline reset programme and deployment side-effect record

- New programme saved under `docs/UPGRADE-2026-11/`: START-HERE, MASTER-PLAN, UXPEAK-RESEARCH-AND-DESIGN, AI-AND-DATA-STRATEGY, RESET-BASELINE and DECISIONS-REGISTER.
- Root AGENTS.md and legacy agent instructions/Agent Pack queue reconciled. Old consolidation cards are historical and non-executable. Project continuity/status/session history retained.
- Main HEAD at this update: `777f3131fefcb4878973237e1e4ad4e0003ad824`. The actual reset remains pending: 20 branch refs including main; PR #3 and #6 open/draft; no archive restore has been verified; no refs deleted.
- Vercel auto-created two production-target deployments from programme documentation commits. Canceled `dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ` (BUILDING) and `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK` (QUEUED). Follow-up listing confirmed both CANCELED.
- Current main's Vercel check fails due to build-rate limit; no exact-head Actions run was returned. No tests/lint/typecheck/build/manual browser/a11y checks were run.
- No app source/schema/dependency/production data changed. No manual deploy, migration or branch deletion/PR closure.
- Next: private archive and restore verification, then reset refs and close old PRs in a Git-capable owner-controlled environment; deep audit main read-only; create gap-only task register.


## 2026-11-11 — Mainline reset programme status

- New programme and research are saved under `docs/UPGRADE-2026-11/`; root AGENTS and legacy Agent Pack instructions have been reconciled.
- Live main HEAD before this final documentation status refresh: `b70cfa719e338d4397e369ecc0a31b71ac5ebd63`. Reset not yet executed: 20 refs including main, PR #3 and #6 open/draft, and no verified private archive.
- Vercel status on the checked main SHA is failure due to build-rate limit; exact-head Actions query returned no PR-triggered runs. No test/lint/typecheck/build/browser/a11y check was run for docs-only changes.
- Two automatic production-target deployment attempts from the initial docs commits were canceled: `dpl_3unwXVVjd28KTq4wrkoCMg9DsRrJ` and `dpl_4WskUe79rW5L3Bts3gBqgvzP3WNK`. Both confirmed CANCELED.
- No app source/schema/dependency/production DB/migration change; no branch deletion or PR closure.
- Next: verified private archive and reset in a Git-capable owner-controlled workspace, then deep read-only main audit.


## 2026-11-12 — Consolidated audit and bottom-up fixation plan recorded

- Live main before the documentation update: `43d85da7465c9ad51819ad0f525efe575ad65c62`; live branch search returned only `main`.
- Added `docs/UPGRADE-2026-11/COMBINED-AUDIT-AND-FIXATION-PLAN.md` in commit `9e16504ea416d71773a909dc7b0cd27d91209e08`.
- The document consolidates the recent security, privacy, assessment, data, AI, operational, UX and accessibility audit findings into a bottom-up remediation sequence and integrated component work-card template.
- Findings are explicitly marked for revalidation against current main before implementation; no application source, schema, migration, dependency, production data or runtime configuration was changed.
- No tests/build were run for this documentation-only change. No application fixes were started.

## 2026-11-12 — UI-first component work begins (Daily Test)

- Resumed the preserved local main worktree at base SHA 18b2b95011b0480f4176a0d2881788070ddf74c2; origin/main matched at start and only main was listed by the live branch search.
- Reprioritised delivery to the owner's screen-first direction: each visible component work card combines UX, functional behavior, API/data scope, security, responsive behavior and accessibility. UI is the primary visible outcome; security is addressed in the same component, not as a separate phase.
- Daily Test first pass: clearer check-in header and study context, topic badge, accessible question progress, refined conversation surface/message hierarchy, labeled answer composer, responsive action layout, explicit busy/error/completion semantics. Shared TestChatUI changes also apply to Practice and Weekly Test consumers; optional progress total prevents misleading progress on other consumers.
- Added SSR-based UI regression tests for topic/progress/accessible composer and for omitting progress when total is unknown.
- Continued the recovered API/data work in the same batch. Closed two known legacy portfolio scope gaps: org admins receive date-only daily-log rows; global course-less competencies are omitted for course-scoped instructors/org admins. Added regression assertions.
- Validation on a disposable local SQLite DB only: full Vitest suite passed (466/466 tests across 155 files); full ESLint passed; TypeScript tsc --noEmit passed; git diff --check passed. Tutor-context seed-dependent assertions still skip when socratic.test seed is absent.
- Production build compiled but could not complete in the sandbox: default Node heap OOM; retry with 1.8 GB heap was SIGKILLed by sandbox memory limits during build. No production DB accessed, no production migration or deploy.
- Browser screenshot/manual responsive and WCAG checks remain unrun (no Chrome/Chromium available in this sandbox). No commit/push yet at this entry; preserve progress by committing the validated batch to main after final diff review.
- Next UI card: finish Daily Test visual review and then continue learner journey screens in bottom-up order; keep AI scoring rubric and consent-dependent support processing blocked pending owner/professional approval.


## 2026-11-12 — Learner Today daily check-in fixation

- Implementation committed directly to `main`: `d62076da989b2a1e8bf725e87f1f6264a6b1b8ed` (`fix: scope learner check-ins to enrolled courses`).
- Learner check-in writes now verify a `CourseEnrollment` row for the authenticated learner, requested course and student role before creating/updating a daily log or engagement event. Unenrolled course IDs return 403.
- Daily-log history now honors the selected `courseId` while retaining the authenticated learner filter. The learner card now distinguishes history-load failure from a genuine empty list and offers retry; its confidence selector uses native keyboard-operable radio inputs, and the note field has a visible label, 2,000-character limit/count and improved focus treatment.
- Added route and component regression tests. Targeted Vitest: 3 files / 5 tests passed. ESLint on all six changed source/test files exited 0. `git diff --check` passed. `tsc --noEmit --pretty false --skipLibCheck` passed with a 1.5 GB Node heap; full `tsc --noEmit` hit the sandbox's ~1 GB heap limit. No production build, browser screenshot or manual WCAG review was run.
- Fresh `bun install --frozen-lockfile` could not proceed because the existing `package.json` and `bun.lock` disagree about Prisma dependency groups. No lockfile or dependency was changed. Tests used the already-installed workspace dependencies; this limits reproducibility until the lockfile mismatch is reviewed.
- Vercel auto Git deployment remains disabled by `vercel.json` (`git.deploymentEnabled: false`). After this code commit, Vercel still reported zero queued/building deployments and no deployment for SHA `d62076d`. GitHub Actions run `43142609752` was in progress at the time of this record.
- Next: continue Learner Today home-level fixation, including the profile-count versus CourseEnrollment count discrepancy and continue-card data selection. Revalidate the current implementation before changes. Keep learner-support processing blocked pending consent/legal/professional approvals.
- No production database access, schema/migration changes, new dependency/provider, manual deployment or production setting changes.

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


## 2026-11-12 — Learner Today KPI carousel discoverability and validation

- UI finding from authenticated CI screenshots: the 360px learner home showed only part of the next KPI card with no explicit indication that the metric row could be swiped. Added a mobile-only “Swipe to view all metrics” cue, a named keyboard-focusable metrics region, and visible focus styling in the existing shared StatStrip; Learner Today opts into the cue. Existing desktop grid layout is retained.
- Regression coverage verifies the scroll region name, keyboard tab stop, focus outline, and mobile-only cue. The StatStrip children type remains compatible with existing usages.
- Fixation commits on main: 812990c011ca5f9ff05e12051b18f0a838037156, 3dc6ce41381ea16203cfa555a796aefa817fdca4, 6075983c997708e63524f247f710333cba226e67, and final corrected head c9cbb80cd522fa4145d45f2299b863d725661915.
- Exact-head GitHub Actions run 43161460123 passed: dependency install, isolated SQLite setup, lint, 480 unit tests across 55 files, TypeScript, production build, app-page route smoke tests, authenticated role screenshot capture and artifact upload. Screenshot artifact 13917734486 is retained by GitHub Actions for seven days.
- Final learner screenshot manifest: 360x800 and 390x844 each report one primary heading, zero horizontal overflow, zero unnamed controls, zero unlabeled fields and zero missing image alt text. Bottom captures report lastContentClearsBottomNav: true at both sizes; reserved main bottom padding is 96px. The visible swipe cue appears below the KPI strip in the 360px capture. Wider learner captures (768, 1024, 1366, 1920, 2560px) report no horizontal overflow.
- Screenshot accessibility metrics are heuristic DOM checks only, not axe/WCAG conformance or manual assistive-technology testing. Manual Tab/Shift+Tab behavior, focus contrast, touch/keyboard scroll interaction and screen-reader review remain outstanding. Learner Today is not signed off; do not advance to another screen until those checks are completed.
- Vercel deployment lookup for c9cbb80cd522fa4145d45f2299b863d725661915 returned zero deployments. Git deployments remain disabled. No production deployment, database access, schema/migration, dependency, provider or production-data changes.
- Repository branch inventory at the prior live check contained only main; no open PRs. GitHub reports main as unprotected. No repository settings were changed.

## 2026-11-12 — Learner check-in refresh persistence

- Baseline: live `main` at `805da1df52e00ea3d11f14129581ad5cc47fb8f4`. Added an authenticated `GET /api/v2/learn/checkin?courseId=...` that requires learner role and active student course enrollment, then selects only that learner/course's current-day check-in fields.
- Learner Today now restores the saved check-in message and confidence after reload, returns to the saved-state view, and offers a retryable loading error instead of silently treating an unavailable read as no check-in. The save action remains available after a read failure; server-side POST continues to upsert.
- GET intentionally mirrors POST's existing server-local calendar-day boundary; no date/timezone policy was changed. A course/user timezone policy remains an open product question before any broader calendar semantics change.
- Regression coverage: GET returns selected-course learner data, null when absent, and rejects missing scope, unenrolled course, unauthenticated and non-learner callers.
- Validation: full Vitest suite excluding DB-backed `src/modules/learn/lib/__tests__/tutor-context.test.ts`: 55 files / 486 tests passed. Focused check-in suite: 2 files / 8 tests passed. ESLint passed on four changed source/test files; `git diff --check` passed. TypeScript `--noEmit --skipLibCheck` ran out of heap at 1.4 GB in the 2 GB sandbox. No typecheck pass is claimed. Build and browser/manual accessibility checks were not run.
- No schema/migration, production DB/data access, dependency/provider, Vercel deployment or production-setting changes. Vercel Git deployment remains disabled in `vercel.json`; exact baseline SHA had no Vercel deployment record and no GitHub status checks.
- Learner Today remains open pending manual responsive, keyboard and screen-reader review; saved-state refresh persistence is addressed by this slice.
