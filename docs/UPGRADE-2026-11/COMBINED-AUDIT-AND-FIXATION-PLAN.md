# TraineesAI — Consolidated Audit Report and Bottom-Up Fixation Plan

**Repository:** fccljbplant/ExaminerAI  
**Target:** main  
**Prepared:** 12 November 2026  
**Status:** Consolidated audit and remediation plan; no application fixes included in this commit  
**Product principle:** AI trains; humans mentor.

## 1. Purpose and interpretation

This document consolidates the recent multi-area audit and turns its findings into an integrated bottom-up remediation programme. Each component work item combines visual design, interaction, functionality, authorization, tenant/course scope, data integrity, AI governance, accessibility and QA.

The audit findings below are evidence from the inspected source paths and prior repository snapshot. They are **not a claim that every finding remains unfixed on the current main HEAD**. Before each work card is implemented, recheck the current source, tests, call sites and history. If a fix is already present, verify it and close the item with evidence rather than rebuilding it.

No application source, schema, migration, dependency, production data or runtime configuration is changed by this document.

## 2. Executive assessment

The highest-risk areas identified were:
- Fail-open authentication and cron authorization paths.
- Assessment start/grading rules that were not consistently enforced server-side.
- Potential cross-course and cross-organisation learner-data exposure.
- Comprehensive-report fields and access paths that risk exposing unsupported profiling or sensitive learner signals.
- AI credential isolation, learner-data processing approval and cost/rate-limit failure handling.
- Progress/reporting paths that could misrepresent missing evidence as zero.
- Mobile navigation overlap and accessibility gaps in assessment/chat interactions.
- Operational scripts capable of destructive database actions.

The remediation order is deliberately foundational: safe change process, identity and scope, canonical learning data, AI governance, shared UI shell, then role-specific experiences and end-to-end assurance.

## 3. Consolidated audit findings

### P0 — Critical security, privacy and integrity findings to revalidate

#### A. Authentication and cron authorization
- `src/lib/auth.ts`: previously observed fallback to JWT payload when database revalidation fails and no cached user state is available. This can preserve stale identity/role claims.
- `src/middleware.ts`: previously observed development JWT secret fallback. Verify every middleware consumer and production behaviour.
- `src/lib/cron-auth.ts`: previously observed allow behaviour when `CRON_SECRET` is missing; 12 cron routes used the helper.
- Required outcome: authoritative identity/role failure denies access; missing production cron secret denies execution; no development secret fallback in production.

#### B. Daily Test authorization and grading
- `src/app/api/learn/daily-test/[date]/start/route.ts`: previously observed absence of independent active-enrolment/entitlement and completed-study-session checks.
- `src/app/api/learn/daily-test/[date]/answer/route.ts`: previously observed fallback score of 0.5 when AI grading fails, weak question-index/sequence validation, date/test identity mismatch risk and separate completion/XP writes.
- `DailyTestPanel`: previously observed response typing that did not surface `aiError`.
- Required outcome: server-side enrolment, entitlement and study prerequisite checks; strict date and sequence validation; grading failure is unavailable/retryable; deterministic and idempotent completion/XP ledger writes.

#### C. Instructor and organisation tenant/course isolation
- `src/app/api/v2/instructor/students/[id]/route.ts`: previously observed learner-ID-only reads for some weekly tests, report cards, daily logs, project tasks and certificates after a shared-course check.
- `src/app/api/org/assign-course/route.ts`, enrolment routes and `/api/access-grants`: previously observed inconsistent same-organisation membership and course-to-organisation checks.
- Organisation metrics previously included learner-wide evidence while being presented per course.
- Invalid or missing access-grant `dataScope` previously defaulted to full access.
- Required outcome: every query and mutation is scoped to authorised organisation, course and learner; instructor and org-admin permissions are distinct; invalid scope denies by default.

#### D. Comprehensive reports and learner-support privacy
- `src/modules/comprehensive-report/index.ts`: previously observed `managementAttitude` fields and management-style judgments.
- `src/app/api/students/[id]/comprehensive-report/route.ts`: previously observed privileged role bypass without adequate tenant boundary.
- `src/modules/learn/lib/psych-weekly.ts`: previously observed Dunning–Kruger-like labels such as “overconfident” and “underconfident”.
- Instructor learner detail previously included psychological/support-like data without a clearly verified org support enablement and consent gate.
- Required outcome: remove unsupported profiling; keep support off per organisation until consent, legal/data review, professionally reviewed safety copy, retention and owner approval. Support signals go only to authorised instructors; org Support Leads oversee crisis cases; Platform Admins see no individual support/psychology signals. AI never diagnoses or declares crisis.

#### E. AI credential and context-secret isolation
- `src/modules/ai/lib/rag.ts`: previously observed DeepSeek credential fallback when calling a Z.ai endpoint, risking cross-provider credential disclosure.
- `src/modules/ai/privacy.ts`: previously observed fallback chain ending in a development secret.
- Required outcome: provider credentials are isolated; production context signing fails closed without an approved secret; secrets remain server-only and are never logged or exposed.

#### F. Assessment and learner data sent to external AI
- Daily/weekly free-text answer paths were observed passing raw learner text to external AI.
- Consent, DPA, legal review and owner approval were not verified for those paths.
- Required outcome: block unapproved processing; minimise and pseudonymise context; scope retrieval; treat user/retrieved text as untrusted; validate outputs; set time, token, budget and step limits.

### P1 — High-priority data, AI and operational findings

#### G. AI budgets and rate limits
- `src/modules/assessment/lib/ai-rate-limits.ts`: previously observed usage-query errors returning zero and usage accounting excluding failed calls.
- Assessment routes did not consistently enforce per-user/per-org budgets.
- Required outcome: fail safely on unavailable budget state; count relevant failures/cost; use durable shared quotas; enforce limits at route boundaries.

#### H. Model configuration and provider behaviour
- Assessment provider previously defaulted to a legacy model alias and omitted explicit thinking/reasoning configuration.
- Streaming path previously used only one provider despite configured fallback expectations.
- Required outcome: verify official current model identifiers/pricing; explicitly disable thinking for routine tasks unless an evaluated exception is approved; make streaming/non-streaming fallback behaviour coherent and tested.

#### I. Truthful progress and reporting
- `src/app/api/students/final-result/route.ts` and enrolment metrics previously used learner-wide data where course-specific data was expected.
- Missing evidence could be represented as zero or grade F.
- Required outcome: all metrics identify scope, source, denominator and freshness; missing, failed or stale evidence is unavailable, never fabricated zero/success.

#### J. Operational scripts and database artifacts
- `scripts/transfer-aven-to-neon.ts` was observed to drop/recreate a remote schema after confirmation.
- `scripts/purge-demo-accounts.ts` and `scripts/sync-prod-schema.mjs` are potentially destructive.
- `package.json` exposed production schema-sync/transfer/purge commands.
- `prisma/db/custom.db` was tracked in the repository; its contents were not inspected in the audit.
- Required outcome: review destructive scripts and safeguards; inspect SQLite artifact offline before any movement/removal; never access production DB or run destructive commands without exact-target owner approval and a reviewed rollback plan.

#### K. CI and release assurance
- Earlier CI used Node 22/npm while the Vercel project used Node 24/Bun, creating a parity question.
- Dedicated security and WCAG/axe CI coverage was not confirmed.
- Required outcome: verify current CI configuration and checks; add appropriate security/accessibility coverage only through approved changes; report exact checks and results.

### UX and accessibility findings

#### L. Shared mobile navigation
- CI screenshots at 360px previously showed fixed bottom navigation overlapping learner checklist, instructor composer, organisation announcement action and platform metrics.
- Required outcome: correct shared shell safe-area/content inset, scroll and keyboard behaviour, then verify every role.

#### M. Assessment chat accessibility
- `src/modules/assessment/components/TestChatUI.tsx`: previously observed missing explicit textarea label, missing conversation live-region semantics, unannounced loading/completion, autofocus and undersized retry target.
- Required outcome: accessible labels, role/log semantics, state announcements, predictable focus and adequate touch targets.

#### N. Mastery language and dashboard states
- `PostTestReflection.tsx` / `ClassroomShell.tsx`: previously observed mastery overclaims based on short tests.
- Role dashboards previously rendered raw API error values in some states.
- Required outcome: align claims with evidence and five mastery levels; use safe actionable errors and complete empty/stale/partial/retry states.

## 4. Bottom-up remediation programme

### Phase 0 — Repository and change safety
- Verify live main HEAD, refs, PRs, workflow history, permissions and current task status.
- Read the current project instructions, decisions register, status and latest session log.
- Inventory affected files, call sites, tests and existing fixes before each work card.
- Confirm the target branch is main and keep changes small and reversible.
- Record exact scope, risk, approval and rollback for each card.
- No production DB access, destructive migration, seed, reset, secret inspection, new provider/dependency or external processing without explicit approval.

**Exit:** a current evidence-backed baseline and an approved first work card.

### Phase 1 — Identity, authorization and tenant security
1. Authentication: fail closed on database identity/role revalidation failures; remove production development-secret fallback.
2. Cron: require valid production secret and deny when missing; test all cron consumers.
3. Authorization foundation: reusable server-side org/course/enrolment/entitlement checks.
4. Instructor drill-down: scope every returned collection to authorised course intersection.
5. Org Admin: enforce same-org membership and course ownership on enrolment, assignment and access-grant actions.
6. Comprehensive report: resolve fields and scope; remove unsupported profiling and privileged bypasses.
7. Support boundary: consent and org enablement default false; enforce instructor/Support Lead scope; deny individual support signals to Platform Admin.

**Exit:** denial-by-default, verified cross-tenant/course isolation and no prohibited learner-data visibility.

### Phase 2 — Canonical learning data and assessment integrity
1. Daily Test start: active enrolment, entitlement and study-session prerequisite enforced server-side.
2. Daily Test answer: date/test identity, integer index, sequence and overwrite rules validated.
3. Daily Test grading: no fallback score on AI failure; unavailable/retryable state.
4. Daily Test completion: transaction or equivalent idempotency for completion and XP ledger.
5. Weekly Test: final-content-day unlock, active enrolment and course/week identity enforced server-side.
6. Progress/reporting: course-specific evidence; missing/stale/failed distinct from genuine zero.
7. Mastery: evidence-derived five levels (Warm-up, Core, Stretch, Advanced, Expert).

**Exit:** assessments are fair, scoped, deterministic and retry-safe; metrics are truthful.

### Phase 3 — AI privacy, provider safety and cost
1. Isolate provider credentials and remove development-secret fallback.
2. Block external learner-data processing until consent, DPA, legal review and owner approval.
3. Pseudonymise/minimise AI context; scope retrieval; validate outputs and resist prompt injection.
4. Make AI budgets durable and fail safely; include relevant failed-call costs.
5. Enforce per-user/org budgets on assessment and tutoring routes.
6. Explicitly configure model and thinking behaviour; verify official model/pricing.
7. Define timeouts, concurrency, retry and maximum-step limits; log safe operational metadata only.
8. Keep learner support disabled until all governance gates are met.

**Exit:** AI is approved, bounded, privacy-preserving and safe under provider/budget failure.

### Phase 4 — Shared design system and application shell
1. Audit existing tokens, theme packs and shared components; do not create a second design system.
2. Fix bottom navigation overlap in the shared shell.
3. Standardise page spacing, responsive containers, scroll and keyboard behaviour.
4. Standardise loading, empty, partial, stale, error, denied, retry and success states.
5. Review accessible dialogs, menus, forms, notifications, focus and reduced motion.
6. Validate 360px through 4K without horizontal overflow.

**Exit:** every role uses a coherent and accessible shared foundation.

### Phase 5 — Learner experience
Fix each component as one integrated work card:
1. Today / next action.
2. My Courses and course map.
3. Study session.
4. Daily Test.
5. Weekly Test.
6. Mastery and feedback.
7. Tutor.
8. Human-help route.

For every component combine visual hierarchy, iconography, interaction, loading/error/empty states, API behaviour, authorization, data integrity, AI/privacy, accessibility and tests. Preserve learner-controlled pacing; days/weeks organise content and are not deadlines.

**Exit:** learners can study at their pace, complete valid assessments and understand evidence-based feedback.

### Phase 6 — Instructor experience
1. Course workspace and scoped roster.
2. Learner drill-down and mentoring evidence.
3. Assignments and grading.
4. Copilot with pseudonym-only context and scoped retrieval.
5. Inbox and human-controlled interventions.
6. Accessible, responsive mentoring workflows.

**Exit:** instructors see and act only within their authorised course/organisation scope.

### Phase 7 — Organisation Admin
1. People and enrolment.
2. Courses and cohorts.
3. Seats, access grants and entitlements.
4. Course-scoped outcomes and governance.
5. Clear unavailable/stale states and metric definitions.

**Exit:** no cross-organisation action or misleading per-course metric.

### Phase 8 — Platform Admin
1. Organisation/user governance.
2. Audit and security operations.
3. Aggregate AI cost, latency, error and reliability views.
4. Entitlement and platform operations.
5. No individual learner support or psychological signals.

**Exit:** platform governance works without prohibited learner-level visibility.

### Phase 9 — Database and operational tooling
- Compare SQLite/PostgreSQL Prisma schemas and migration history.
- Review migration scripts and destructive commands without executing them.
- Inspect tracked SQLite artifact offline before any handling decision.
- Require exact target, reviewed migration and rollback, and owner approval for database changes.
- Never access remote production DB as part of routine audit.

**Exit:** operational changes are understood, scoped and safely reversible.

### Phase 10 — End-to-end assurance
- Security: auth failures, tenant/course isolation, cron auth, grants, consent and prompt injection.
- Assessment: unlock rules, invalid indexes, sequence, grading failure, retries, duplicate XP and concurrency.
- Data: missing/stale/partial evidence and course-specific reporting.
- AI: consent denial, provider outage, secret/config failure, budget exhaustion, timeout and malformed output.
- UX/accessibility: keyboard, screen reader, focus, contrast, touch targets, zoom/reflow, reduced motion and all responsive states.
- Operations: lint, tests, typecheck, build, route smoke, security checks and accessibility checks as applicable.

**Exit:** evidence-backed sign-off with unresolved risks explicitly listed.

## 5. Component work-card template

Every visual/component must be delivered as a complete product unit:

1. **Visual/UX:** hierarchy, typography, spacing, icons, responsive layout and interaction affordances.
2. **Functionality:** real actions, persistence, navigation, retry and state transitions.
3. **Authorization:** authentication, role, organisation, course, learner and entitlement checks.
4. **Data integrity:** canonical source, correct scope, freshness, deterministic totals and idempotency.
5. **AI governance:** approved processing, pseudonymisation, retrieval scope, output validation, budget and failure behaviour.
6. **Accessibility:** labels, keyboard, focus, screen-reader announcements, contrast, reflow and touch targets.
7. **QA:** unit, route, authorization, cross-tenant, failure, concurrency, visual and accessibility tests.
8. **Release:** diff review, rollback, exact test results and separate release approval.

### Example — Daily Test combined work card
- Redesign question/answer hierarchy, progress, feedback and completion states.
- Enforce enrolment, entitlement and study prerequisite server-side.
- Validate date, test identity, question index and sequence.
- Remove fabricated fallback grading; surface AI failure as retryable/unavailable.
- Make completion and XP idempotent.
- Enforce consent and AI budget before external processing.
- Add accessible labels, focus management, live announcements and 44px-class touch targets.
- Test success, invalid input, skipped question, duplicate submission, AI outage, database failure, concurrency, cross-course denial and mobile/desktop layouts.

A screen is not complete because it looks correct; the underlying workflow must also be trustworthy.

## 6. Acceptance checklist for every work card

- [ ] Uses existing design tokens and theme packs.
- [ ] Responsive without horizontal overflow.
- [ ] Loading, empty, partial, stale, error, denied, retry and success states are truthful.
- [ ] Server-side authorization and tenant/course scope are enforced.
- [ ] Consent and entitlements are enforced.
- [ ] Missing evidence is not converted to zero or success.
- [ ] Scores, permissions, totals and XP are deterministic.
- [ ] AI failure is visible and safe.
- [ ] External processing is approved.
- [ ] Secrets and personal data are protected.
- [ ] Keyboard and screen-reader workflows work.
- [ ] Normal, failure, adversarial and regression tests are run.
- [ ] Exact test results and unrun checks are recorded.
- [ ] Rollback and operational impact are understood.

## 7. Priority register

### P0
- Authentication fail-open and development-secret fallback.
- Cron authorization fail-open.
- Daily Test start authorization/prerequisite gap.
- Daily Test fallback grading and XP integrity.
- Instructor cross-course learner detail leakage.
- Organisation Admin tenant-scope gaps.
- Comprehensive-report access and unsupported profiling.
- Learner support consent/visibility governance.
- Cross-provider credential fallback.
- AI context secret fallback.
- Tracked SQLite artifact exposure review.

### P1
- AI budget/rate-limit fail-open.
- Model identifier/thinking/provider consistency.
- Unverified consent for raw learner text sent to external AI.
- Course-scoped final results and truthful progress.
- Destructive operational scripts and safeguards.
- CI runtime parity and security/accessibility coverage.
- Shared bottom-navigation overlap.
- Test chat accessibility.
- Mastery-feedback overclaim.
- Safe dashboard error and state handling.

### P2 / role-completion
- Full role-by-role visual consistency.
- Complete responsive and accessibility validation.
- Marketplace/course-discovery verification.
- Aggregate operations and analytics usability.
- Broader route/component test coverage.

Priority labels indicate planning order, not proof of current unresolved status.

## 8. Evidence limitations and revalidation requirements

The audit was source-focused and used available repository/CI artifacts. It is not a complete dynamic security assessment, production database audit or WCAG conformance certification.

Before implementing a finding, revalidate:
- Current main source and exact call sites.
- Existing tests and fixes merged since the audit snapshot.
- Current schema and migration history without accessing production data.
- Current consent, DPA, provider and owner approvals.
- Actual behaviour under failure and cross-tenant/course tests.
- Current UI at mobile and desktop breakpoints.

The contents of `prisma/db/custom.db` were not inspected. Production database state, production secrets, complete runtime behaviour of all routes and full WCAG 2.2 AA conformance were not verified.

## 9. Approval and delivery gates

- **Plan:** this document records the consolidated audit and proposed remediation order.
- **Task:** each implementation work card is scoped and approved before work begins.
- **Verification:** exact tests, security review, accessibility review and unrun checks are recorded.
- **Release:** release actions remain subject to the owner's explicit direction.

No application fixes are implied by this documentation commit.

## 10. Definition of done

A component or workstream is complete only when its user journey works, its data is truthful and correctly scoped, server-side permissions hold, failures are safe and understandable, AI is approved and bounded, accessibility is tested, regression tests pass, and operational risks are documented.

**Delivery principle: Fix from the foundations upward. Fix each visual component as a complete product unit. AI trains; humans mentor.**


## 2026-11-12 — Learner Today daily check-in fixation

- Implementation committed directly to `main`: `d62076da989b2a1e8bf725e87f1f6264a6b1b8ed` (`fix: scope learner check-ins to enrolled courses`).
- Learner check-in writes now verify a `CourseEnrollment` row for the authenticated learner, requested course and student role before creating/updating a daily log or engagement event. Unenrolled course IDs return 403.
- Daily-log history now honors the selected `courseId` while retaining the authenticated learner filter. The learner card now distinguishes history-load failure from a genuine empty list and offers retry; its confidence selector uses native keyboard-operable radio inputs, and the note field has a visible label, 2,000-character limit/count and improved focus treatment.
- Added route and component regression tests. Targeted Vitest: 3 files / 5 tests passed. ESLint on all six changed source/test files exited 0. `git diff --check` passed. `tsc --noEmit --pretty false --skipLibCheck` passed with a 1.5 GB Node heap; full `tsc --noEmit` hit the sandbox's ~1 GB heap limit. No production build, browser screenshot or manual WCAG review was run.
- Fresh `bun install --frozen-lockfile` could not proceed because the existing `package.json` and `bun.lock` disagree about Prisma dependency groups. No lockfile or dependency was changed. Tests used the already-installed workspace dependencies; this limits reproducibility until the lockfile mismatch is reviewed.
- Vercel auto Git deployment remains disabled by `vercel.json` (`git.deploymentEnabled: false`). After this code commit, Vercel still reported zero queued/building deployments and no deployment for SHA `d62076d`. GitHub Actions run `43142609752` was in progress at the time of this record.
- Next: continue Learner Today home-level fixation, including the profile-count versus CourseEnrollment count discrepancy and continue-card data selection. Revalidate the current implementation before changes. Keep learner-support processing blocked pending consent/legal/professional approvals.
- No production database access, schema/migration changes, new dependency/provider, manual deployment or production setting changes.
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

## 2026-11-12 — Learner Today empty-state heading correction

- Fixation commit: `8e3686203b7035f864ed9dd08bb5341e73ac2bcf`, parent `82d6cc85ac20019e8bdb38d778a371ba42b4d56e`. The branch inventory remains main-only with no open PRs.
- Inspected the screenshot manifest for all four roles at 360, 390, 768, 1024, 1366, 1920 and 2560 widths. No horizontal overflow; heuristic counts for unnamed controls, unlabeled fields, missing image alt and missing page language were zero. Learner no-enrolment state had zero H1 headings at all captured sizes; this is a confirmed semantic UX gap, not a layout overflow.
- Corrected the learner no-enrolment card title to an H1 without changing its visual styling or adding a nested main landmark. Added an SSR regression test for the primary heading and course-catalog link.
- Local checks: targeted Vitest 1/1 passed; ESLint on both changed files passed; TypeScript `--noEmit --skipLibCheck` passed; `git diff --check` passed. Exact-head Actions run `43147226589` passed every step: install, isolated SQLite, lint, unit tests, TypeScript, production build, 84/84 route smoke, authenticated screenshots and artifact upload. A prior screenshot attempt on the preceding documentation head had a transient Chrome DevTools startup failure; the retry and this exact-head run both passed.
- Re-inspected the exact-head screenshot artifact `role-dashboard-screenshots`: learner no-enrolment state now has one H1 at 360x800, 390x844 and 1366x768; all role/viewport captures report no horizontal overflow. Aggregate heuristic findings remain zero for unnamed controls, unlabeled fields, missing image alt and missing page language. This is not a full WCAG or manual screen-reader sign-off.
- Vercel Git deployments are disabled in `vercel.json`; no deployment was created or manually triggered. No production DB, schema, migration, dependency or provider changes.
- Next: verify exact-head CI and inspect the refreshed learner screenshot/manifest; then complete manual keyboard and screen-reader review before closing Learner Today. Do not advance to the next screen until this card is signed off.
