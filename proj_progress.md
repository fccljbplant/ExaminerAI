# TraineesAI — Project Progress

**Updated:** 2026-11-09  
**Repository:** https://github.com/fccljbplant/ExaminerAI  
**Active PR:** [#3](https://github.com/fccljbplant/ExaminerAI/pull/3)  
**Only working branch:** `ux-audit/fix-dashboard-truthfulness-and-agent-safety`

## Current state
- PR #3 is open, draft, unmerged, and based on `main`.
- Latest recorded head: `02ecbc28a1400610c333aa6f8099679a7c0fa4dc`.
- No merge, deployment, production-data change, or main-branch write was made.

## Latest implementation
- Instructor student detail remains scoped to learners enrolled in courses they teach.
- Org-admin student detail now requires active admin membership in an organisation, active learner membership in that same organisation, and learner enrolment in an organisation-linked course (`OrgCourse`).
- Org-admin responses omit daily confidence values and do not compute/return `psychWeekly`; instructor support/learning indicators remain on the instructor path.
- Added a role visibility helper and unit tests for the support-signal response projection.

## Commits
- `7b3ee1ad` — server-side org/course scope and org-admin support-field filtering.
- `2e1eea9e` — role visibility helper.
- `f5dcef6e` — helper unit tests.
- `02ecbc28` — access comment clarification.

## Validation
- Workflow `42643245325` for intermediate commit `f5dcef6e` was cancelled during lint after subsequent branch updates; it is not a pass.
- No PR-triggered workflow result is currently available for latest head `02ecbc28`.
- Local lint, tests, typecheck, build, route smoke, browser and accessibility checks were not run in this session.

## Remaining work
1. Verify CI on the latest head and fix any failures.
2. Add route-level tests for org-admin tenant/course scope and instructor regression.
3. Fix final-result and portfolio field-level access without removing intended learner/instructor functionality or broadening `content_only`.
4. Confirm consent/default-off and audit requirements before enabling learner-support signals.
5. Keep PR #3 draft; no merge/deploy without explicit approval.
