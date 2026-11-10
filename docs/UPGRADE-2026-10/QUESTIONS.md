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


## 2026-11-10 — Institutional academic policy decisions (owner delegated)

The owner delegated resolution of the remaining academic/product policy questions to the assistant acting as course coordinator, student counsellor, examination head and university leadership. The following decisions are the adopted product direction for planning; they do not authorise an unreviewed production migration.

### A. Academic record and assessment identity
1. A course is the independent unit of academic record. Each learner has separate assessments, report cards, projects, completion and certificates per course.
2. ReportCard identity is `(userId, courseId, week)`. WeeklyTest identity is also `(userId, courseId, week)`. A learner can have same-week assessments in multiple courses.
3. Every course publishes its grading scale, pass threshold, assessment weights, retake rules and certificate criteria before enrolment. Do not hard-code one universal threshold across disciplines.
4. A report card uses only evidence from its course. Missing evidence is represented as unavailable/not attempted/not submitted, never as zero, a default score, an inferred pass or a fabricated completion.
5. Report cards are reviewable and versioned. Published results are not silently overwritten; corrections retain prior versions, actor, reason and timestamp.
6. Preserve learner-paced progression. Week/day are curriculum organisation, not calendar deadlines. Daily tests follow study sessions; weekly tests unlock after the final content day, enforced server-side.
7. Retakes are distinct attempts. The published course policy determines which attempt counts. A course transfer or instructor reassignment never transfers grades or certificates.

### B. Certificates and historical records
8. Certificates are course-specific and tied to a successful course-completion instance. Eligibility uses that course's published requirements, including required curriculum, assessments, pass standard and mandatory practical work.
9. Certificate requests, pending approvals, rejections, issued credentials and verification are scoped by learner + course. Independent requests/issuance in another course remain unaffected.
10. Issued credentials are immutable academic records. Corrections/revocations use an auditable process; no destructive delete-and-reissue.
11. Existing rows with null/unreliable course attribution remain legacy/unassigned. No first-enrolment guessing, fabricated backfill or use of unassigned scores in course grades. Preserve history and verification.
12. Schema changes are additive and reversible. Update Prisma source schema and regenerate derived schemas with the repository script; do not hand-edit derived schemas. No production migration without separate explicit approval.

### C. Course project analysis
13. Project analysis is course-specific. The authoritative context is the project brief, objectives, tasks, milestones, submissions and rubric belonging to the selected course.
14. Do not mix legacy learner-global `User.project*` fields with course-linked project records in a single AI analysis. Legacy fields remain historical until an approved migration; if no course project exists, return unavailable rather than analysing another course.
15. AI output is advisory. An authorised instructor reviews academic conclusions; the analysis identifies its course/project and cites the evidence used.

### D. Comprehensive report and integrity
16. Retire subjective personality-style classifications such as “management attitude” and “manager readiness” from automated reports. Replace them with observable, course-relevant competencies assessed against explicit rubrics, with evidence and human review. No psychological/personality inference.
17. Plagiarism/assessment-integrity indicators are academic review signals, not proof of misconduct. No automatic penalty, failure or certificate cancellation. The learner receives notice and an opportunity to respond; an authorised instructor/examination officer decides under published policy, with an appeal and auditable evidence trail.
18. Academic integrity details are restricted to authorised academic staff and are not exposed in general organisation dashboards.

### E. Roles, enrolment and access lifecycle
19. Course instructors control teaching, assessment, feedback, report cards and certificate recommendations only within assigned course scope.
20. Examination officers oversee assessment policy, integrity cases, grade disputes and credential exceptions.
21. Organisation admins manage organisation membership, course/instructor allocation and organisational oversight; they do not casually edit grades.
22. Org-admin instructor assignment is restricted to active instructors in the same organisation and valid course scope. Record before/after assignment, actor, reason and timestamp.
23. An organisation-course instructor's learner course-access removal is a request requiring approval by an authorised org admin; the requester cannot self-approve. Independent instructors may confirm their own removal. Explicit confirmation identifies learner, course and consequence. Pending requests do not revoke access; rejection changes nothing. Approved revocation removes access only and preserves academic history.
24. All access decisions are enforced server-side, tenant- and course-scoped, and audited. Organisation membership alone does not grant access to every course.

### F. Learner support and institutional safeguards
25. Learner support signals go to the learner's authorised instructor. Individual support/psychology data is not available to ordinary organisation admins; designated org Learner Support Leads oversee crisis cases and handling records. Platform admins do not see individual learner support signals.
26. Support data is consent-based, minimised, access-controlled and retained under an approved policy. Crisis language/protocols must be owner-authored and professionally reviewed, never invented by the product.
27. No AI-generated result is a final misconduct, clinical or academic judgement. Humans remain accountable for consequential decisions.

### Implementation order
- First coordinate the course-specific WeeklyTest and ReportCard schema/API identity and report-card CRUD/generation.
- Then align certificate request, approval, rejection, listing, learner retrieval and verification to course-specific completion.
- Next align project analysis and comprehensive reporting with course-specific project/competency evidence.
- Implement assignment approval/removal lifecycle in the planned enrollment workstream, not by expanding PR #3's academic-record slice.
- For every slice, add same-week/two-course, cross-course, cross-tenant, legacy-null, missing-evidence, concurrency/idempotency and audit tests as applicable.
- These are policy decisions, not evidence that implementation is complete. No application code or schema changed in this policy-recording session.


## 2026-11-10 — Owner clarification: retain management-style assessment with explicit reliability warning

This entry supersedes item 16 in the institutional policy decision above. The owner clarified that comprehensive reports must **retain** the AI-generated personality/management-style assessment sections, including productivity signals, professionalism signals, leadership-potential observations, manager-readiness observations and focus areas. Do not remove these sections or silently replace them with a different report model.

The retained assessment must carry a prominent, professionally worded limitation notice. Approved wording:

> **Important limitation — AI-generated assessment:** The observations in this section are generated by AI and are based solely on the learner's interactions with the AI system. They do not constitute a validated psychometric assessment, a comprehensive appraisal of professional capability, or a definitive measure of personality, leadership potential or management suitability. Their reliability and completeness are therefore limited and should be treated with appropriate caution. Before drawing conclusions or making employment, placement, promotion or other consequential decisions, management should conduct a structured, comprehensive interview and consider relevant work samples, observed performance, references and other appropriate evidence. The final assessment and any resulting decision must be made by qualified human reviewers.

Operational safeguards:
- Keep the warning adjacent to the management-style assessment wherever it is displayed, and include it in the API/report contract so consumers cannot mistake the assessment for a validated evaluation.
- Keep the report clearly identified as AI-generated and distinguish AI observations from human-verified conclusions. A human review flag must not imply psychometric validation or remove the limitation notice.
- The report may support developmental conversations, but it must not be the sole basis for hiring, placement, promotion, discipline, certification or other consequential decisions.
- Do not infer clinical conditions or present the section as a validated personality or psychological instrument.
- Preserve course/tenant authorization and evidence provenance. The existing comprehensive-report data gathering is learner-global; before expanding or relying on it for staff-facing course-specific decisions, align its source records and access boundary with the selected course and authorised viewer.

This is the current owner-approved policy. The earlier recommendation to retire these fields is withdrawn. Policy approval does not mean the disclaimer or the underlying report/access-scope corrections have been implemented.


## Standing owner delegation — institutional product and academic decisions (2026-11-10)

The owner has delegated routine product, academic and learner-experience policy decisions to the assistant acting in the combined capacity of course coordinator, student counsellor, examination head and university leadership. Do not repeatedly return already-delegated policy choices to the owner. Make a defensible, professional decision, record its rationale and safeguards in this decision ledger, and communicate the decision succinctly. Escalate only genuine owner-reserved matters (production data/settings, destructive or production migrations, spending/provider changes, push to protected branches, merge, deployment, or a materially ambiguous legal/safety decision).

Maintain a cumulative decision record in this file and docs/PROJECT-STATUS.md / docs/SESSION-LOG.md. The owner intends to compile the accumulated decisions into a polished, consolidated institutional/product policy document later; do not prematurely treat this running ledger as that final document. Keep decisions, implementation status, evidence and open questions clearly distinguished. New owner clarifications supersede conflicting earlier decisions and must be recorded as such.

The current comprehensive-report clarification is one example: retain AI-generated personality/management-style sections, but prominently warn that they are based solely on AI interactions, have highly questionable/limited reliability, are not validated psychometric or comprehensive professional assessments, and require a structured management interview plus independent evidence before consequential decisions.


## 2026-11-10 — Learner-detail metric truthfulness and course-context decision

Owner-delegated institutional decision:
- A missing evidence set is **unavailable**, not a score of zero. This applies to task progress, assessment/attention indicators and report metrics. A genuine zero is valid only when the relevant evidence exists and mathematically supports zero.
- In instructor learner detail, no assigned tasks means progress is unavailable; no activity dates and no scored tests means the attention score is unavailable. When evidence exists and no risk indicator is present, an attention score of zero is valid.
- The UI must render unavailable metrics as an em dash (or explicit unavailable label), not as 0% / 0. Risk banners must not be triggered by missing evidence.
- Course-specific staff views must never silently aggregate several courses and label the result as one course. If the learner has one shared course, it can be selected automatically; if there are multiple shared courses, the staff member must choose the course explicitly. Course-bearing evidence is filtered to that course. Learner-level SkillMastery/Competency records without course provenance must be labelled as learner-level or excluded from course-specific conclusions until their semantics are approved; do not infer course ownership.

Implementation finding still open: GET /api/v2/instructor/students/[id] currently queries all authorised shared course IDs but returns only the first course ID as courseId. It therefore presents a multi-course aggregate under a single-course label. This is a separate course-switcher/API contract change; do not treat the current fix as resolving it.


## 2026-11-10 — Instructor learner-detail course-selection policy and implementation

**Decision**
- A staff learner-detail view is course-specific. If the learner and staff member share exactly one authorised course, select it automatically. If they share multiple authorised courses, return only the authorised course choices and require an explicit selection before loading academic/activity records.
- Validate the requested course against the staff-authorised/learner-enrolled intersection on every API request. An unassigned, unrelated or no-longer-shared course selection is denied; never trust the client selector as authorisation.
- Filter every course-bearing learner-detail record to the selected course: weekly tests, report cards, daily logs, project tasks, certificates, engagement events and learning projects. Course-scoped psych-weekly data also receives the selected course ID.
- SkillMastery/competency has no courseId in the current schema. It may be shown only as explicitly learner-level information, separate from course-specific results; never attribute it to the selected course.
- Suppress learner-wide growth summaries, general comments and the global mentor briefing from the course-specific detail screen until their backing APIs enforce the selected course and record provenance. Re-enable only after API-level scope and tests exist.

**Rationale and safeguards**
- Prevents a multi-course aggregate being labelled as one course and prevents cross-course academic records being mixed into a course-specific staff decision.
- Server-side scope is authoritative; UI selection is only a request parameter and cannot grant access.
- A course switch reloads the profile and shows a loading state rather than briefly presenting stale records under the new course label.
- No schema migration is required for this UI/API contract. Course-less legacy mastery remains learner-level.

**Implementation status**
- Implemented on PR #3 branch in `src/app/api/v2/instructor/students/[id]/route.ts`, `src/modules/instructor-portal/student-profile.tsx`, `src/modules/instructor-portal/student-detail-visibility.ts` and its unit tests.
- Added pure helper tests for single-course auto-selection, multi-course selection requirement, authorised selection, invalid selection and no shared course.
- Learner-wide Growth and Comments panels now explain their temporary unavailability in this course view; the unscoped mentor-briefing request/display was removed.
- This does not claim that the separate growth/comments APIs themselves have been course-scoped. That remains a follow-up before those panels are restored.

**Validation**
- Latest code head at implementation review: `01bb794544bfabb6beca10abd32a1ad97a094ec1`; PR #3 remains open/draft/unmerged/mergeable; `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4).
- Previous exact-head Actions run `42731168978` passed all configured jobs on `a00590da6e21c1c25ba4502bef8956bc7a1ea32e), before this course-selection implementation. No Actions run was returned yet for `01bb794...`; do not treat the earlier green run as validation of these changes.
- Vercel status remains failure due to the project build-rate limit. No local tests/typecheck/lint/build/browser/axe run was available.
- No schema, migration, dependency, production data, merge, deployment or main-branch change. PR #3 remains draft.



### Follow-up — route-level course-selection tests

- Added `src/app/api/v2/instructor/students/[id]/route.test.ts` with route-level coverage for: multi-course selection response with no academic queries before selection; exact selected-course filtering for course-bearing relations; denial of a course outside the current authorised intersection; and automatic selection when exactly one shared course exists.
- This closes the earlier test gap for the course-selection contract at the API boundary. The tests are committed but not yet validated by CI; do not describe them as passing until a successful exact-head run is available.



## 2026-11-10 — Course-specific learner-detail secondary APIs and assessment write safeguards

**Decision**

- A staff learner-detail view is always bound to one explicitly selected course. The server validates the selection against the current staff-authorised/learner-enrolled course intersection on every request.
- Staff growth reports require `courseId`; weekly tests and practice interactions are filtered to that course. A learner may still view their own cross-course growth summary or request one of their enrolled courses.
- Missing test/practice evidence is unavailable, not zero. A measured practice score of zero remains valid evidence. No-data reports return null score fields, an empty strengths list, and an explicit insufficient-evidence growth area.
- Staff comment reads require `courseId`. A comment is visible in a course view only when it has at least one linked activity record and every non-null linked record ID belongs to that same learner and selected course. Mixed-course and unassigned legacy comments are excluded. Learners retain access to their own complete comment history.
- Mentor briefings require a selected authorised course and use only course-scoped daily tests, weekly tests, tasks, check-ins and practice interactions. Global last-login/current-week fields are not used as course activity. No evidence yields `insufficient_data`, not a fabricated 999-day inactivity signal.
- The Growth panel is restored in the instructor course view and passes the selected course ID. Competency/mastery data without a course ID is explicitly labelled learner-level and is not presented as a course result.
- Comment writing remains unavailable in the course-specific UI. The legacy POST/PATCH/DELETE comment write path is not yet fully course-scoped and the old composer cannot attach a comment to a selected course activity. Do not restore that composer until its write path and record provenance are corrected.
- Weekly-test retake/unlock and report-card generation controls are withheld from the course-specific instructor profile. The legacy endpoints are keyed by `(userId, week)`, and report-card generation reads learner/week evidence across courses. They can mutate or aggregate the wrong course. Existing course-linked records remain read-only in this view until the assessment identity and APIs are course-specific.
- Course-specific assessment identity remains: WeeklyTest and ReportCard are independently keyed by learner, course and week. Legacy null-course rows remain unassigned; never backfill them to a guessed course. Any schema work must be additive/reversible and derived schemas must be regenerated from `prisma/schema.prisma`. No production migration is authorised by this implementation.

**Rationale and safeguards**

- Course labels must never imply that a cross-course aggregate belongs to one course.
- Client course selectors are not authorisation; server-side role, tenant, course and learner-enrolment checks remain authoritative.
- No learner-global current-week, last-login or project fields are used as selected-course progress.
- The Growth report's zero score is shown only when zero was measured; absent evidence is null/unavailable.
- The Comments UI remains a clear unavailable state because the write endpoint still supports unassigned/general comments and does not enforce course-linked writes.
- Assessment mutation controls remain unavailable rather than silently writing to legacy learner/week records. This is a temporary safety gate, not a permanent removal of assessment functionality.

**Implementation**

- Shared scope resolver: `src/modules/instructor-portal/authorized-student-courses.ts` with instructor, org-admin, platform-admin and explicit-grant/demo scoping; unit tests in the adjacent `.test.ts`.
- Growth report: `src/app/api/growth-reports/[userId]/route.ts` and `.test.ts`.
- Comment reads: `src/app/api/comments/route.ts` and `.test.ts`.
- Mentor briefing: `src/app/api/instructor/student-briefing/route.ts` and `.test.ts`.
- Instructor profile: `src/modules/instructor-portal/student-profile.tsx` restores course-scoped Growth, labels learner-level competencies, withholds comment writing, withholds unsafe assessment mutations, and displays unavailable test scores without a zero-width bar.
- The earlier multi-course selector and route tests remain in place in `src/app/api/v2/instructor/students/[id]/route.ts`, `src/modules/instructor-portal/student-detail-visibility.ts`, and the instructor profile.

**Validation**

- Code head: `a5e1ad903d8da5f39d455f297cbf3e94df7e2589`.
- Exact-head GitHub Actions PR run `42737212881` completed successfully: dependency install, isolated DB setup, lint, unit tests, TypeScript, production build, all app-page route smoke tests, authenticated role screenshots and artifact upload.
- Vercel combined status remains failure because the project build-rate limit is reached. No Ready preview is confirmed.
- No local checkout or local test/lint/typecheck/build/browser/axe run was available. CI screenshots are not a substitute for manual keyboard, screen-reader, zoom/reflow and axe validation.
- PR #3 remains open, draft, unmerged and mergeable. `main` remains `fc70a296b28334ff45e8b081a0f8fe9a070be3a4`. No schema, migration, dependency, production-data, merge or deployment change.

**Next**

1. Design and implement additive composite identity for WeeklyTest and ReportCard: learner + course + week; preserve legacy null-course rows without guessing.
2. Refactor unlock, retake and report-card generation endpoints to require `courseId`, enforce the selected course server-side and use only selected-course evidence; keep mutations unavailable until this is complete.
3. Course-scope comment POST/PATCH/DELETE and provide an activity-linked composer before restoring Comments.
4. Decide whether/when to restore the course-specific mentor briefing UI; its API is now scoped but no UI consumer is enabled.
5. Keep PR #3 draft/unmerged; no production migration or deployment without explicit approval.



## 2026-11-10 — Course-scoped comment write contract

**Decision**
- Staff comment creation must include an explicit `courseId` and at least one activity relation (`interactionId`, `taskId`, `weeklyTestId` or `dailyLogId`).
- Every supplied activity relation must belong to the target learner and the same selected course. A partially valid or mixed-course set is rejected in full.
- Staff PATCH and DELETE require `courseId`; the server revalidates the caller's current course authorisation and every existing non-null relation before changing the comment.
- Unassigned/general and mixed-course legacy comments remain historical/read-only through staff write APIs. They are not deleted or guessed into a course.
- Learners retain their own cross-course comment history. The instructor Comments composer remains unavailable until it can attach comments to a selected activity in the selected course.

**Rationale**
- The Comment model has no `courseId`; trustworthy course provenance is derived from the linked course-bearing activity records. Requiring every supplied relation to match prevents a comment from crossing course boundaries without adding a redundant course field or migration.
- A request's `courseId` is context, not authority; the server recomputes the staff/learner authorised course intersection on every write.

**Implementation**
- `src/app/api/comments/route.ts`: POST/PATCH/DELETE enforce selected-course authorisation and same-learner/same-course relation validation; unassigned writes are rejected.
- `src/app/api/comments/route.test.ts`: route tests cover missing course/activity, unauthorised course/activity, mixed-course references, valid linked creation, and cross-course edit/delete denial.
- `docs/api.md` now documents the required course and activity-link contract.

**Validation**
- Exact code head `c4a63e5c0779aa48150c8405e019e7546549983d`; GitHub Actions run `42740191410` passed all configured steps: 436 tests across 41 files, lint with 0 errors and 7 warnings, TypeScript, production build, 83/83 page-route smoke checks, authenticated role screenshots and artifact upload `13729306143`.
- Vercel combined status remains failed due to build-rate limit; no Ready preview verified.
- No local checkout/tests or manual browser/axe/a11y checks were available. No schema, migration, dependency, production data, merge, deployment or main-branch write.

**Next boundary**
- Course-specific WeeklyTest/ReportCard identity and CRUD/generation remain the next academic-data priority. Preserve null-course legacy rows and versioned report-card history. The Agent Pack task queue/runner is not present on this branch; do not invent a task card or bypass the missing tooling prerequisite.


## 2026-11-10 — Comment mutation audit trail

- Added `COMMENT_CREATED`, `COMMENT_UPDATED` and `COMMENT_DELETED` audit actions to `src/lib/audit-log.ts`.
- The course-scoped comment POST/PATCH/DELETE routes now call the existing `logAudit` helper after successful mutations. Events identify the comment target and actor and record course ID, activity types and updated field names only. They deliberately exclude comment text, learner ID and activity IDs from metadata to minimise sensitive data exposure through the existing optional audit webhook.
- Added route tests proving each successful mutation emits the corresponding audit event and that comment text is not copied into audit metadata.
- This uses the existing audit-log/webhook mechanism; it introduces no new provider or dependency.
- Exact code head `b12017d0a5dd4d26da0fcad3726b2b9c9cacffa7`; Actions run `42741613904` passed 438 tests / 41 files, lint (0 errors / 7 warnings), typecheck, production build, 83/83 route smoke checks, four-role × seven-viewport screenshot capture and artifact upload `13729682267`.
- Vercel remains blocked by build-rate limit. No local or manual accessibility validation, schema/migration/production-data change, merge or deployment.
