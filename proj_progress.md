# TraineesAI — Project Progress

**Updated:** 2026-11-10 (PR #3 rechecked at ad1638fc; exact code-head CI verified; next endpoint scope blockers recorded)  
**Repository:** https://github.com/fccljbplant/ExaminerAI  
**Active PR:** [#3](https://github.com/fccljbplant/ExaminerAI/pull/3)  
**Only working branch:** ux-audit/fix-dashboard-truthfulness-and-agent-safety

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
