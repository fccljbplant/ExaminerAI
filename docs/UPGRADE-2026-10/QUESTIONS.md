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
