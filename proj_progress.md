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
