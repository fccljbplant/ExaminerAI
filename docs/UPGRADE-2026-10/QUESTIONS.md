# Upgrade questions and unresolved product decisions

## 2026-11-09 — Comprehensive learner report field classification

**Status:** Blocked pending owner clarification; do not broaden visibility or change the report schema without a decision.

The current `src/modules/comprehensive-report/index.ts` describes the report as academic-only and states that behavioral/psychological/mentorship monitoring has been removed. However, its report type and AI prompt still generate `managementAttitude` fields, including productivity signals, professionalism signals, leadership potential, manager readiness, and focus areas. The GET route currently authorizes staff with `content_only` access and platform admins have global operational access.

This is a mismatch between the module's stated scope and the actual generated fields. The fields may be intended as educational coaching feedback, but they may also constitute behavioural profiling or learner-support signals. The project invariants require learner-support signals to remain with the in-scope instructor under the approved consent pathway and prohibit platform admins from viewing individual learner psychology/support signals.

**Owner decision required:**
1. Should `managementAttitude` and its derived narrative content be removed from the report entirely, retained only in the learner's own report, or exposed to the in-scope instructor only after the approved consent/feature-gate pathway exists?
2. Should organisation admins and platform admins receive only the educational score/mastery/project sections from this endpoint?

Until clarified, keep learner-support features default-off, do not add new staff exposure, and do not use these fields for formal decisions. Treat this as an unresolved access/privacy risk, not as a completed implementation.


## 2026-11-09 — Staff portfolio cross-course response scope

**Status:** Blocked pending the approved PR #3 task card and a safe, branch-preserving Agent Pack runner. Do not patch the endpoint until those prerequisites are resolved.

**Verified finding at PR #3 head `9ac14c13069bbe91b8a1fca54d305514f66590e3`:**

- `src/app/api/students/[id]/portfolio/route.ts` calls `assertCanAccessStudent(payload, id, "portfolio")`. That check establishes that an instructor shares at least one course with the learner, or that an org admin has the required active same-organisation membership and linked-course enrolment.
- After that one-course authorisation succeeds, the route queries `ProjectTask`, `Interaction`, `WeeklyTest` and `ReportCard` using only `userId: id`; it does not constrain their `courseId` values to the caller's authorised courses and the learner's shared course enrolments.
- The current Prisma schema confirms that each of those four models has a `courseId` field. A learner enrolled in multiple courses can therefore have records from courses outside the caller's course/tenant scope included in this staff portfolio response.
- `Competency` has no `courseId`; its learner-level/global semantics remain unclassified and must not be silently partitioned or removed.
- The staff route sets `portfolioDataScope = "content_only"`, so daily-log reflections/confidence are not returned. This does not correct the course-scoping issue in the academic records above.

**Required correction (not yet implemented):** derive the caller's authorised course IDs using the same instructor-vs-org-admin tenant rules as the v2 student-detail route; intersect them with the learner's course enrolments; filter every course-bearing portfolio query by that intersection; preserve learner self-view; and add route-level tests for multi-course isolation, no shared course, cross-tenant denial, org-admin linked-course scope, and grant revocation. Decide and test the intended treatment of expired `CourseEnrollment.expiresAt` records before calling an enrolment active.

**Separate prerequisite blocker:** `AGENTS.md`, `docs/UPGRADE-2026-10/QUEUE.md` and `scripts/agent/run-logged.mjs` return 404 on the current PR branch. The uploaded Agent Pack was not activated because its queue runner switches/creates branches and its guard reads prohibited `.env*` files. No task card or safe runner is available to authorise and verify this application change. Restore/adapt those prerequisites without branch switching or reading `.env*`, or provide an owner-approved task card and safe execution method. Until then, keep this finding blocked and make no application-code change.


## 2026-11-10 — Portfolio scope blocker rechecked

**Status:** Still blocked; no application patch authorised under the current task workflow.

At PR #3 head `43aa35909b85275432619303baddf845f852e5df`, the route-level finding remains reproducible by source inspection: `src/app/api/students/[id]/portfolio/route.ts` performs `assertCanAccessStudent(payload, id, "portfolio")`, then queries ProjectTask, Interaction, WeeklyTest and ReportCard by learner ID without an authorised-course filter. The Prisma schema confirms these records carry course IDs. The existing `getAuthorizedStudentCourseIds` helper tests set intersection only; the route does not yet derive or apply the set.

Exact-head Actions run [42663209736](https://github.com/fccljbplant/ExaminerAI/actions/runs/42663209736) passed. Vercel remains rate-limited. The branch still lacks the approved task queue and safe logged runner; the uploaded queue runner must not be used because it changes branches. Keep this finding blocked until a branch-preserving, no-`.env*` task workflow or owner-approved equivalent is available.


## 2026-11-10 — Portfolio course-scope implementation update

**Status:** Implementation committed on PR #3; exact-head CI validation pending.

The staff portfolio route now derives course IDs according to the existing role/tenant rules and intersects them with the learner's course enrolments before querying ProjectTask, DailyLog, Interaction, WeeklyTest and ReportCard. Org admins are restricted to courses linked to a shared active organisation. Instructor and explicit-grant fallback paths remain bounded to the learner's enrolments. Comments are scoped through linked course-bearing records; unlinked comments are omitted. Restricted wellbeing/crisis grants do not receive academic portfolio records, and learner-support data remains default-off.

Route regression tests were added for instructor multi-course isolation, org-admin linked-course scope, explicit-grant fallback, restricted wellbeing grants and access denial. No local test runner was available; wait for exact-head GitHub Actions before marking validation complete.

**Remaining decisions (not blockers for this scoped patch):**
1. Competency has no courseId in the current Prisma schema. Its learner-level/global semantics remain unresolved; this patch preserves existing behaviour.
2. CourseEnrollment.expiresAt is documented as a retake/compliance date, not explicitly as revocation. This patch preserves current access semantics (matching the v2 detail route) and adds no expiry filter. Confirm the intended access rule before changing it.


## 2026-11-10 — Additional portfolio scope hardening

The portfolio route now also respects the AccessGrant dataScope value, and fails closed if a grant disappears between the initial access check and the subsequent course-scope derivation. Comment filtering requires every non-null task/interaction/weekly-test/daily-log relation to be within the authorised record sets, preventing mixed-scope comments from crossing course boundaries. Route tests were added for restricted wellbeing grants and the disappearing-grant case. Exact-head CI remains pending.



## 2026-11-10 — Final-result course-scope follow-up

**Status:** Next PR #3 implementation slice; source review only, not yet changed.

In src/app/api/students/final-result/route.ts, staff authorisation is checked with assertCanAccessStudent(payload, targetUserId, "content_only") at line 38, but the nested relation queries at lines 47–51 do not filter by courseId:
- weeklyTests
- interactions
- reportCards
- projectReports
- tasks

The Prisma schema confirms each relation model has a courseId field. A multi-course learner can therefore contribute records outside the staff member's authorised course scope to the final-result calculation.

**Required next correction:** preserve learner self-view across the learner's own courses; for staff, derive the same instructor/org-admin/platform-admin/explicit-grant course boundary used by the portfolio route and apply it to every course-bearing relation. Add route-level tests for instructor multi-course isolation, org-admin linked-course scope, explicit grants, cross-tenant denial and empty scope.

**Owner-approved field handling:** do not remove required academic functionality. Keep performance, participation, areasToImprove, overallAssessment, careerReadiness, project reports and task statistics where the caller is authorised. The behavioralPattern field remains learner-self only until an approved consented support pathway exists. Do not broaden support data.

The separate comprehensive-report managementAttitude classification remains blocked by the earlier owner-decision entry; do not silently alter that report in this slice.


## 2026-11-10 — Final-result course-scope correction implemented

**Status:** Source and route-level regression tests committed on PR #3; exact-head CI validation pending.

`src/app/api/students/final-result/route.ts` now derives the authorised course boundary for staff after the existing `assertCanAccessStudent(..., "content_only")` check:
- Instructor: teaching course enrolments intersected with learner student enrolments; explicit active `full`/`content_only` student grant fallback only when no shared teaching course exists.
- Org admin: active admin membership, active learner membership in the same organisation, linked `OrgCourse` rows, intersected with learner enrolments.
- Platform admin: bounded to the learner's actual enrolments.
- Demo/other staff: active explicit `full`/`content_only` grant re-read; grant disappearance fails closed.

The nested Prisma relations `weeklyTests`, `interactions`, `reportCards`, `projectReports` and `tasks` are all filtered by the authorised course IDs. Staff requests with no authorised course return 403 before loading the report; staff target accounts must be learners. Learner self-view remains cross-course.

Added `src/app/api/students/final-result/route.test.ts` for instructor course isolation, org-admin linked-course scope, explicit grant fallback, no-course/revoked-grant denial, access-denied short-circuit, platform-admin bounding and learner self-view.

**Field handling:** academic performance/participation, areasToImprove, overallAssessment, careerReadiness, project reports and task statistics remain available within the authorised scope. `behavioralPattern` remains learner-self only. No support/crisis data was added.

**Validation:** the code/test head was `0edeed1f22b7e7274ed3f05b9ce3982aee7f43b8`. No Actions run had been returned for that exact head at update time. Previous-head run `42722331613` passed, but is not evidence for this change. Vercel is blocked by the build-rate limit. No local tests or build were run. Keep validation pending until a run for the updated head completes.


## 2026-11-10 — Remaining staff project/report endpoint scope

**Status:** Read-only source review; implementation blocked pending data-ownership semantics and the approved task workflow. No endpoint code changed.

### POST /api/students/[id]/generate-report-card

- The handler authorises a staff viewer with assertCanAccessStudent(payload, id, "content_only"), then reads ProjectTask, DailyLog, Interaction, WeeklyTest and Comment using learner/week or learner-only predicates, without an authorised-course intersection.
- The Prisma schema confirms the first four models have courseId. Comment has no courseId, but has optional relation keys to task, interaction, weekly test and daily log records, so comments can be scoped through those authorised record IDs.
- The handler writes ReportCard using upsert with the unique userId_week key. Prisma defines @@unique([userId, week]) even though ReportCard.courseId is nullable. A course-filtered calculation would still overwrite the one learner/week report-card record and could misrepresent a partial course view as a learner-wide report.
- **Owner decision required:** Is a report card intentionally one learner-wide record per week, or should it become course-specific? The latter requires an approved additive schema/index migration and a revised API contract. Do not filter partially and continue writing the global record until this is decided.

### POST /api/students/[id]/generate-project-analysis

- The handler authorises any staff viewer with content_only, then loads ProjectReport, ProjectTask and ProjectWeek by userId alone. All three Prisma models have a nullable courseId; this can mix course records outside the caller's scope.
- The same handler reads project definition fields directly from User (projectName, projectScope, projectObjectives, projectRequirements, projectBusinessCase, projectDurationWeeks, projectGithubUrl, projectDeployUrl). These fields have no course relation. The newer LearnProject model is course-linked and owns project weeks/tasks, but this endpoint currently uses the legacy user-level project fields.
- **Owner/product decision required:** Is this endpoint intended to analyse one learner-global legacy project, or a course-linked LearnProject? Do not apply a partial course filter while retaining unscoped project-definition data in the same AI context. Preserve current functionality until the authoritative project model and scope are confirmed.

### Existing comprehensive-report blocker remains

The managementAttitude classification in src/modules/comprehensive-report/index.ts remains owner-blocked by the 2026-11-09 decision above. Its generated productivity/professionalism/leadership/manager-readiness fields must not be exposed more widely or silently removed. The report also gathers several course-bearing records by learner ID alone; do not attempt a partial scope patch until the field classification and report audience are decided.

### Validation context

The final-result course-scope code and tests are now validated by exact-head Actions run 42724107308 on PR head bbb431a585a547bf15fa92d499cbb5f5dec2f0c3. All configured quality steps passed. Vercel remains failed due to build-rate limit. The two endpoint findings above are source-review findings only; no tests or code changes were made for them.


## 2026-11-10 — Owner decision: report cards and certificates are course-specific

**Status:** Report-card/certificate ownership semantics resolved. Implementation planning remains open; do not treat the current learner-wide endpoints as compliant.

**Owner decision:** “Each course has its own report card/course certificate.”

### Verified implementation gaps at PR #3 head `ffe5abff4d5c8edecd677743141c769c901be237`

1. **ReportCard schema and generation**
   - `ReportCard.courseId` already exists but is nullable.
   - The current unique constraint is `@@unique([userId, week])`, so one learner cannot store separate same-week report cards for multiple courses.
   - `POST /api/students/[id]/generate-report-card` accepts only `week`, queries ProjectTask, DailyLog, Interaction and Comment by learner/week or learner ID, resolves WeeklyTest with `userId_week`, and upserts the global key. It does not establish a course ID for the report.
   - `GET/POST /api/report-cards` also reads/writes report cards by learner/week and does not accept or enforce a course ID.

2. **Assessment source model dependency**
   - `WeeklyTest.courseId` exists but is nullable and its unique key is also `@@unique([userId, week])`. Therefore a learner cannot have separate same-week WeeklyTest rows for two courses. A course-specific report card cannot safely derive a course-specific weekly-test score until the assessment model/flow supports the same course boundary.
   - ProjectTask, DailyLog and Interaction have course attribution fields; generation must filter them by the requested course. Comment has no courseId and must be limited to comments linked to records in that course.
   - Course duration/week bounds must be resolved from the selected course, not a learner-wide default.

3. **Certificate workflow**
   - `Certificate.courseId` already exists but is nullable; the current generation flow creates learner-level requests, finds the latest pending/issued certificate by user only, counts WeeklyTests across all courses, and selects the first student enrollment when issuing.
   - `GET /api/certificates/user` returns one latest certificate and learner-level completion counts. Request, approval/rejection, retrieval and completion checks need a selected course and same-course enrollment/test scope.
   - A certificate should be independently requestable/approvable/retrievable per course. Legacy certificate rows with null courseId must not be assigned to an arbitrary course.

### Safe implementation direction

- Make courseId mandatory for all new report-card generation/manual-write and certificate request/approval operations; verify learner enrollment and the caller's authorised course scope server-side.
- Use a course-specific report-card identity, normally `(userId, courseId, week)`; resolve legacy null-course rows as legacy records, not as a guessed course.
- Update WeeklyTest identity and the weekly-test APIs in the same coordinated slice if course-specific weekly tests are intended/required by the course report-card calculation. Do not silently use a learner-global weekly test as a course score.
- Scope every source record and comment relation to the selected course; do not include private DailyLog reflections or wellbeing fields in staff report cards.
- Return/list report cards and certificates by course, preserving learner self-view while enforcing instructor/org-admin tenant and course boundaries.
- Add migration/backfill analysis, rollback notes and tests for two courses with the same week, legacy null-course records, cross-course access, duplicate certificate requests, and idempotent approvals.
- Prisma model source is `prisma/schema.prisma`; production and demo schemas are derived by `scripts/generate-derived-schemas.mjs`. Do not hand-edit derived schemas.

**Still not approved by inference:** automatic backfill of historical null-course ReportCard/Certificate/WeeklyTest rows; production migration execution; changing unrelated project-analysis semantics. No schema or application code was changed in this review.
