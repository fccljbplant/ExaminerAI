# TraineesAI project status

**Snapshot date:** 2026-11-09 (live PR #3 head `6d90c757`; latest-head CI recheck pending)  
**Repository:** [fccljbplant/ExaminerAI](https://github.com/fccljbplant/ExaminerAI)  
**Active UX baseline PR:** [#3 — UX audit: fix dashboard KPI accuracy and safer failure states](https://github.com/fccljbplant/ExaminerAI/pull/3)

## Live Git and PR state

| Ref | Commit | State |
|---|---|---|
| `main` | `fc70a296b28334ff45e8b081a0f8fe9a070be3a4` | PR base SHA; no changes made to main. |
| PR #3 branch | `6d90c757a2273c3d6a49677d8766d50d2176f094` | Live PR head at this refresh. |

PR #3 live metadata:
- State: **open**
- Draft: **yes**
- Merged: **no**
- Mergeable: **yes**
- Base: `main` (`fc70a296b28334ff45e8b081a0f8fe9a070be3a4`)
- Head branch: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`
- Head SHA: `6d90c757a2273c3d6a49677d8766d50d2176f094`
- Commits: **235**
- Changed files: **107**
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
