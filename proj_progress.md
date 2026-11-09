# TraineesAI — Project Progress

**Updated:** 2026-11-09  
**Repository:** https://github.com/fccljbplant/ExaminerAI  
**Active PR:** [#3](https://github.com/fccljbplant/ExaminerAI/pull/3)  
**Only working branch:** `ux-audit/fix-dashboard-truthfulness-and-agent-safety`

## Current state
- PR #3 is open, draft, unmerged, based on `main`.
- Latest code head: `fea1683ef68245fdbedd8a9b397b529fa183bcff` (207 commits, 105 changed files).
- No merge, deployment, production-data change, or main-branch write was made.

## Latest fixes
- Org admins require active admin and learner memberships in the same organisation and learner enrolment in an organisation-linked course. Explicit grants cannot bypass this boundary.
- Platform/org admins are denied explicit wellbeing/crisis scopes; instructor course membership alone does not grant those support scopes.
- Staff final-result views do not generate or return individual behavioural analysis. Learners retain their own view.
- Staff portfolio views are clamped to academic content. Daily logs are queried as dates only; reflections/confidence are not loaded. Private instructor comments remain instructor-only.
- Support indicators require both explicit consent and a feature gate; both default false. The v2 student-detail route omits confidence and psychWeekly while the gate is absent.
- Unit tests cover default-off support visibility and learner-only behavioural analysis.

## Latest commit sequence
`eb07cde8`, `49910fda`, `71102e60`, `941ea441`, `02253840`, `e7939d72`, `14a0a8df`, `4650190c`, `34a0ff19`, `a8bedbe8`, `29b66ed5`, `98f17db8`, `b7ddf70d`, `84dfef67`, `fea1683e`.

## Validation
- CI run `42643565316` passed on earlier head `d850ff0d`, before these latest changes.
- Run `42644831199` on intermediate head `84dfef67` was cancelled during dependency installation.
- No completed Actions run is verified on latest head `fea1683e`; lint, tests, typecheck, build and route smoke remain unverified for this latest code.
- Vercel combined status for latest head is failure due to build-rate-limit.
- No local checkout or local tests were run.

## Remaining work
1. Verify CI on latest head and resolve failures.
2. Add route-level tests for org membership, OrgCourse scope, cross-tenant denial, grant revocation and instructor regression.
3. Review every route using `assertCanAccessStudent` for response-field classification and explicit support-scope handling.
4. Implement only after approval: per-org consent workflow, default-off `learner_support_v1`, support-view audit logs and designated Learner Support Lead crisis handling.
5. Keep PR #3 draft; no merge/deploy without explicit approval.
