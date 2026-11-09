# TraineesAI project status

**Snapshot date:** 2026-11-09 (PR #3 head `02ecbc28` live verification)  
**Repository:** [fccljbplant/ExaminerAI](https://github.com/fccljbplant/ExaminerAI)  
**Active UX baseline PR:** [#3 — UX audit: fix dashboard KPI accuracy and safer failure states](https://github.com/fccljbplant/ExaminerAI/pull/3)

## Live Git and PR state

| Ref | Commit | State |
|---|---|---|
| `main` | `fc70a296b28334ff45e8b081a0f8fe9a070be3a4` | PR base SHA; no changes made to main. |
| PR #3 branch | `02ecbc28a1400610c333aa6f8099679a7c0fa4dc` | Live PR head at this refresh. |

PR #3 live metadata:
- State: **open**
- Draft: **yes**
- Merged: **no**
- Mergeable: **yes**
- Base: `main` (`fc70a296b28334ff45e8b081a0f8fe9a070be3a4`)
- Head branch: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`
- Head SHA: `02ecbc28a1400610c333aa6f8099679a7c0fa4dc`
- Commits: **180**
- Changed files: **99**
- No submitted PR reviews or inline review threads were returned.

## Current CI and preview status

- GitHub Actions run [42613884082](https://github.com/fccljbplant/ExaminerAI/actions/runs/42613884082) completed **successfully** on exact head `0fd41710a8bd460a430ec540b8ed158314498c27`.
- The `quality` job passed dependency installation, isolated test DB initialization, lint, unit tests, TypeScript type-check, production build, all app-page route smoke tests, authenticated role screenshots and artifact upload.
- Combined Vercel status for the same head: **success**; deployment completed.
- This validates the current PR head before this documentation update. Re-fetch checks after the resulting documentation commit; do not claim the new head is green until verified.
- No live browser walkthrough, production data change, merge or production deployment was performed.

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

1. **Final-results response is not filtered to the requested data scope.** `src/app/api/students/final-result/route.ts` calls `assertCanAccessStudent(payload, targetUserId, "content_only")`, then returns academic, project and behavior-related fields without response filtering. In `src/lib/auth.ts`, the platform-admin, same-tenant org-admin and course-instructor paths return before checking the requested grant scope. For staff granted `content_only`, the endpoint still returns fields such as `behavioralPattern`, `avgPlagiarism`, per-week plagiarism values, `careerReadiness`, `projectReports` and `projectTaskStats`. Preserve the functionality for intended audiences; classify fields before filtering. Keep `content_only` narrow unless its contract is explicitly redefined.
2. **Instructor v2 profile exposes support-like indicators to org admins.** `src/app/api/v2/instructor/students/[id]/route.ts` accepts both `instructor` and `org_admin`, then returns `psychWeekly` (confidence calibration), daily confidence values and per-test plagiarism indicators. It checks course enrolment but does not check a designated Learner Support Lead capability or a support-consent flag. Master Upgrade Prompt Workstream H says individual learner support indicators are for the learner and their own-course instructor; org Learner Support Leads see crisis-case handling records only, not individual support signals. The role exception must be enforced server-side.
3. **Portfolio `content_only` implementation does not match its own comment.** `src/app/api/students/[id]/portfolio/route.ts` documents the scope as tasks, report cards and interactions, but also returns weekly tests and competencies when `canSeeContent` is true. Make the contract and response agree; do not silently broaden the grant.
4. **Support consent/feature gating remains unverified.** Workstream H requires per-org `learner_support_v1` to default off until owner-approved consent text is reviewed with counsel, and requires audit logging for every support-signal/case view. The inspected routes do not demonstrate those controls. Do not enable or expand the support layer until those prerequisites are confirmed.
5. **Field-level policy still needs an explicit mapping.** Keep learner self-view and instructor-scoped support functionality where required. Separate academic outcomes from support indicators; the current sources do not conclusively map every final-result field to the `content_only` grant. Do not remove required functionality or broaden the grant implicitly.
6. No focused final-result route test or role-specific support-response test was found in the inspected evidence. Add route-level tests for learner self-view, instructor course scope, org admin, designated support lead crisis-only access, platform admin, explicit grant scopes, revoked/absent grants and cross-tenant/course access.
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
