# TraineesAI — Master Product and Technology Upgrade Plan

**Version:** 1.0  
**Date:** 11 November 2026  
**Status:** Owner-directed programme; reset and full mainline audit are the first gates.  
**Source specifications:** TraineesAI-FINAL-PROMPT.md (2026-11-03) and TraineesAI-Master-Upgrade-Prompt.md (revision 5, 2026-10-31), supplied by the owner.

## 1. Product thesis

TraineesAI is a learning and workforce-development SaaS for engineering trainees, interns, instructors/mentors and organisations.

It should help a trainee become demonstrably job-ready through guided instruction, deliberate practice, evidence-based assessment and human mentorship. It should help businesses run better training programmes, see reliable course outcomes and support learners without turning the product into a surveillance system.

**AI trains; humans mentor.**

The product must earn trust from three groups:
- Learners need clarity, agency, useful instruction, fair assessment and a visible route to help.
- Instructors need to teach and mentor efficiently, with reliable course-scoped evidence and human control.
- Organisations need programme operations, capacity, governance, outcomes and business reporting without access to prohibited individual support data.

Platform Admins operate the platform, tenants, reliability, cost, entitlements and incidents. They are not entitled to individual learner psychological/support signals.

## 2. Strategic principles

### Product and commercial strategy

- Solve a specific customer problem before expanding feature breadth.
- Treat engineering trainees, early-career professionals, instructors and organisation training leaders as distinct research segments. Do not assume all “Gen Z” users behave alike.
- Validate the target market by interviews, task observation, product analytics with consent, customer pilots and willingness-to-pay tests.
- Establish the buyer, user, champion, approver, deployment owner and renewal reason for B2B customers.
- Evaluate business performance using actual activation, time-to-first-learning-value, course completion, verified competency change, mentor workload, renewal, gross margin and support cost.
- Do not manufacture market size, testimonials, conversion, usage, revenue, outcome or ROI claims.
- No pricing, billing provider or packaging changes without owner approval.

### Education and curriculum

- Start from course outcomes, job competencies and prerequisite maps.
- Align each lesson objective with an explanation, authentic workplace activity, formative practice, rubric and evidence of mastery.
- Use retrieval practice, spaced practice, interleaving where suitable, worked examples, faded scaffolding and explanatory feedback.
- Keep assessment low-stakes when its purpose is formative. Explain why an answer is incomplete and teach the next step.
- Course weeks and days organise content; they are not deadlines. Learners control pace.
- Daily tests follow study sessions. Weekly tests unlock only after the learner reaches the last content day of that week; enforce this on the server.
- Adaptive difficulty uses five evidence-derived levels: Warm-up, Core, Stretch, Advanced and Expert.
- Explanation register is not the same as mastery. Use topic-specific evidence and preserve uncertainty.

### Human support and trust

- Learner support is not diagnosis. Describe observable learning evidence and learner-reported signals in neutral, non-clinical language.
- No psychological or behavioral monitoring, scoring or profiling of instructors.
- Learner support features remain disabled by organisation until consent, data-processing, safety wording, retention and owner approvals are complete.
- Crisis language is never improvised by an AI model. A model may surface a signal; trained humans confirm, act and close the case.
- Keep crisis/support data minimal, consented, access-controlled, purpose-limited, audited and retained only for an approved period.
- Use the owner-approved role visibility policy in DECISIONS-REGISTER.md. Never widen access merely because an administrator role sounds powerful.

## 3. Programme phases

The old A–L workstreams remain the scope map. The phases below reorganise them around verified dependencies and actual mainline gaps.

### Phase 0 — Repository reset and source-of-truth recovery

**Outcome:** one remote branch (main), old PRs closed, branch history safely archived and the live main HEAD recorded.

Actions:
- Archive and verify the pre-reset branch/PR state privately.
- Close PR #3 and PR #6 and remove their source branches as part of the reset.
- Remove every remote branch except main.
- Retain tags and merged history.
- Confirm deployment side effects, branch rules and CI before mainline implementation.

Exit gate: exactly one remote branch named main; no open PRs; archive restore verified; current main SHA and checks recorded.

### Phase 1 — Deep audit of main (read-only)

**Outcome:** an evidence-based picture of what works and what does not.

Required deliverables:
1. Architecture map: route groups, server actions, APIs, modules, database domains, external services and runtime jobs.
2. Role charters and top tasks for Learner, Instructor, Organisation Admin and Platform Admin.
3. Feature inventory by role: complete, partial, broken, duplicate, legacy, missing and unverified.
4. Legacy-versus-Learn parity matrix; identify the authoritative system for each workflow and data field.
5. API route inventory with auth, RBAC, tenant, course, consent and entitlement rules.
6. Prisma model/relationship and migration inventory; identify nullable/legacy identities and derived schemas.
7. AI inventory: every provider call, route, prompt, model, tokens, budgets, cache, fallback, RAG source, privacy boundary and eval.
8. Security/privacy threat model; route-by-route IDOR and tenant tests.
9. UX/UI inventory with route screenshots and interactions at the device matrix.
10. Reliability baseline: install, lint, typecheck, unit/integration tests, build, smoke tests, CI, deployment and runtime evidence.
11. Existing feature register against workstreams A–L, marking already implemented functionality.
12. Cleanup register for duplicated, stale or unreferenced files and dependencies.

Do not take old R1–R37 findings as facts until reverified against current main.

Exit gate: every priority finding has path/line evidence, user impact, dependencies, tests and proposed correction. No code is written during the audit.

### Phase 2 — P0 trust, security and operational correctness

Prioritise:
- Authentication, session, JWT and revocation behavior.
- Server-side role and tenant boundaries on every protected operation.
- Course access and enrollment/expiry entitlements.
- Instructor-to-learner course intersection and organisation membership checks.
- Access-grant scope and revocation.
- Learner support consent and role visibility.
- Platform Admin exclusion from individual psychology/support signals.
- Pseudonymous Instructor Copilot context and server-side identity restoration.
- Fail-closed cron authorization and production secrets.
- AI provider credential isolation and safe diagnostics.
- Truthful loading, empty, stale, error and retry states.
- Audit logging for privileged and sensitive operations.
- Build and deployment write-safety.

Use deny-by-default behavior and regression tests. No broad refactor where a small boundary correction is sufficient.

### Phase 3 — Canonical learning data and academic correctness

Prioritise:
- One explicit course context throughout the learner and staff experience.
- Course-specific learner progress, assessment, attempts and report-card history.
- Topic-level mastery with history and evidence counts.
- Correct assessment sequencing and retake policy.
- Course-scoped instructor and organisation read models.
- Reliable data provenance, freshness, denominator and unavailable-state handling.
- A safe relationship between legacy records and Learn* records.
- Enrollment lifecycle, entitlements and course ownership/staff assignment.
- A migration plan that preserves legacy NULL-course records and history.

Prefer additive migrations and backfills. Do not guess the course for legacy NULL-course records. Do not run migrations against production without a separate exact-target approval, backup/restore rehearsal and rollback plan.

### Phase 4 — AI platform, adaptive teacher and data science

Workstream A (AI model) and I (adaptive teacher) are joined here.

Deliver:
- One provider/model configuration with capability discovery and versioned feature profiles.
- Explicit thinking disabled by default; any exception needs a measured quality gain and approval.
- Zod-validated structured output, bounded repair and visible failure.
- Course-grounded prompts and citation/provenance for factual outputs.
- AI golden evaluations in English, Roman Urdu, Roman Hindi and mixed technical language.
- Per-feature model, latency, token, cache, error, quality and cost telemetry.
- Per-tenant/user feature budgets and rate limits.
- Privacy-minimal learner context packs, pseudonymization and tenant/course-filtered retrieval.
- Adaptive learner-state estimates based on evidence, with confidence and explanation.
- Teaching policy implemented as deterministic code; the model verbalizes the plan rather than deciding permissions, scores or hidden learner labels.
- AI Copilot tools with strict read-only scopes; drafts only for messages and interventions.
- Batch/interactive separation: never defer an interaction a person is waiting for.

Exit gate: quality, privacy, latency and cost baselines exist; no AI feature is enabled on a new data class until its data-use approval and evaluation are complete.

### Phase 5 — UXPeak-informed, role-based product experience

Workstream F and product-wide UX quality.

Do not redesign all pages at once. Start from role charters and top tasks. Use UXPeak as a practical design reference for hierarchy, spacing, contrast, typography, copy, interaction detail and clear state communication; combine this with accessibility standards and academic/dashboard research.

Deliver:
- One coherent design system using existing tokens and theme packs.
- Role-specific information architecture and navigation.
- Clear task-first dashboards and course contexts.
- Real status, progress, freshness and evidence—not decorative numbers.
- Progressive disclosure and efficient drill-down.
- Accessible components and responsive behavior from 360px to 4K.
- Visual regression screenshots, keyboard testing and WCAG 2.2 AA checks.
- Real usability sessions with representative learners, instructors, organisation admins and platform operators.

Do not copy UXPeak, Star Admin, Dribbble or other providers' assets, code, paid material or distinctive branded screens.

### Phase 6 — Learning and operating workflows (only remaining gaps)

Workstream J (course/enrollment), C (Presentation Studio), D (classroom), B (voice), E (Copilot) and L (communications).

Possible scope, subject to the audit:
- Course Workspace, roster, cohort and assignment/rubric authoring.
- Unified, transactional enrollment/invitation/approval service.
- Editable class presentations with import/export and version history.
- Classroom parity and a tested learner dashboard.
- Roman-script text with native-language speech preparation and locale-correct voice behavior.
- Evidence-based Instructor Copilot with pseudonym-only model context.
- Real email delivery, invitations, MFA, inbox, announcements and notification preferences.

Do not rebuild features already present. Select the smallest meaningful gaps from the audit. Providers, storage, queues, imports, paid services and external processing require technical verification and owner approval.

### Phase 7 — Organisation and platform operations, evaluation and controlled retirement

- Organisation command center and platform mission control only where real data and permissions exist.
- Cohort, course and customer outcome reporting with definitions, dates, source and data quality.
- Pilot evaluation: learning gain, delayed retention, completion, mentor workload, fairness and customer value.
- Operational SLOs, incident procedures, budget alerts and backup/restore exercises.
- Legacy retirement only after parity, backfill accuracy, read-only period, auditability and owner approval.
- Delete legacy tables/routes only after explicit migration and retention sign-off.

## 4. Workstream coverage

| Workstream | Scope retained from the owner specification | Dependency emphasis |
|---|---|---|
| A — AI model | Model/provider configuration, thinking policy, cost and reliability | Phase 4 after provider/API audit |
| B — Voice | Roman text with locale-correct native-language audio | Phase 6 after UX/accessibility and speech tests |
| C — Presentation Studio | Authored/editable class decks, import/export, grounded content | Phase 6 after course permissions/storage decisions |
| D — Classroom v2 | Classroom UX, dashboard parity, learner pacing | Phase 6 after canonical data and parity audit |
| E — Instructor Copilot | Instructor-scoped evidence tools, pseudonyms, human review | Phase 4/6 after access and privacy gates |
| F — Power UI | Four role-specific product experiences | Phase 5 after role research and data correctness |
| G — Audit backlog | Security, RBAC, CI, test and UX debt | Phase 2 and continuous |
| H — Learner support/crisis | Consent-based support and human-owned cases | Disabled until approval and professional review |
| I — Adaptive teacher | Topic mastery, teaching policy and adaptive explanation | Phase 4 after data provenance audit |
| J — Course/enrollment | Course workspace, enrollment, cohorts, authoring | Phase 3 before dependent dashboards |
| K — Unified data/entitlement | Canonical read models, access checks, legacy parity | Phase 3 foundation |
| L — Identity/comms | Email, invitations, onboarding, MFA, inbox | Phase 6/7 after provider decisions |

## 5. UX, learning and business measures

### Learning outcomes

- Topic mastery change with evidence count and confidence.
- Delayed retention, not just immediate quiz score.
- Repeated attempts and prerequisite gaps.
- Quality and usefulness of feedback.
- Project/rubric competency evidence.
- Improvement by language, course, device and cohort where samples permit.

Do not equate clicks, time-on-page or streaks with learning.

### Product and business outcomes

- Time to first meaningful learning activity.
- Learner activation and course continuation.
- Course completion and demonstrated competency.
- Instructor time to find and support the right learner.
- Organisation onboarding and programme activation.
- Renewal and customer retention.
- AI cost per completed learning session/course and gross margin.
- Support burden and reliability.

All metrics must show scope, time range, source, definition, denominator and freshness.

### Quality

- WCAG 2.2 AA as the accessibility target.
- 360px–4K responsive validation.
- No page-level horizontal overflow.
- Keyboard-only operation, visible focus, zoom/reflow, reduced motion and screen reader checks.
- Unit, integration, authorization, tenant, route-smoke and end-to-end tests.
- Exact test/build/CI evidence per commit.

## 6. Change and migration policy

- Main is the only active development branch after reset.
- One scoped task per commit; direct main only, no replacement feature branches or PRs.
- No force push, rebase, reset, destructive clean or history rewrite.
- Feature flags for high-impact user-visible rollout where useful.
- Additive migrations with rollback notes; never silently sync production schema during build.
- Backups and restore verification before any production data change.
- No new dependency, AI provider, email/storage vendor, paid plan or external processing without approval.
- Never read, copy or expose secrets or .env files.

## 7. Definition of done

A feature is done only when:
1. The audit identified the real gap.
2. Role, tenant, course, consent and entitlement boundaries are server-enforced.
3. Missing and failed data remains unavailable, not fabricated.
4. Behavior and edge cases have automated tests.
5. Lint, typecheck, tests, build and applicable audits pass.
6. Desktop, mobile, keyboard and accessibility behavior are checked.
7. Metrics and AI costs are observable where relevant.
8. Documentation, status, progress and session log are updated.
9. Rollback and migration implications are documented.
10. Any production deployment or data operation has separate approval.

## 8. Historical source requirements to keep

The uploaded October specification remains the detailed source for feature intent, including:
- the four-role model and role charters;
- AI model/configuration and runtime prompt safety;
- Urdu/Hindi voice requirements;
- Presentation Studio;
- classroom parity;
- Instructor Copilot;
- all-role Power UI;
- learner support and crisis governance;
- adaptive teaching;
- course, cohort and enrollment operations;
- unified read models/entitlements;
- identity, communication and notifications.

The new plan does not silently cancel those requirements. It re-verifies each one on main and implements only the remaining gaps.
