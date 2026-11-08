# Role design decisions — UX baseline

**Updated:** 2026-11-09  
**Purpose:** Record role-specific design intent from the owner's updated prompt and the first screenshot baseline. This file records design decisions and open verification work; it does not override product/security decisions in `DECISIONS.md`.

## Shared decisions

- Use UXPeak as the primary external design-quality reference, with source provenance logged in [UX-REFERENCE-RESEARCH.md](./UX-REFERENCE-RESEARCH.md).
- Diagnose user task and decision before styling; use paired before/after evidence.
- Extend the existing token/theme/component architecture; no parallel design system, copied proprietary assets, or unapproved commercial UI kit/dependency.
- Use editable smart defaults, explicit selected states, and clear interaction feedback.
- Show enough decision-critical information; progressive disclosure is for advanced/infrequent controls, not hiding status, permissions, evidence or recovery.
- Keep metrics truthful and contextual: definition, scope, units, time window, source and freshness.
- Design loading, empty, stale, permission, validation, pending, success, error, retry and recovery states.
- Treat mobile as a deliberate composition and test all seven owner-specified viewport sizes.
- Keep the learner-support privacy/consent visibility rules in force. UX work must not enable support signals or instructor monitoring.

## Learner

- Primary design outcome: make the next meaningful learning step obvious while preserving learner choice and pace.
- Keep course context, lesson/practice/exam choices, saved progress and recovery understandable.
- Baseline evidence: `/learner` currently presents a Browse courses action and a getting-started sequence in the synthetic no-enrollment state.
- Verify with enrolled, multi-course, returning, offline/error and incomplete-progress fixtures before redesigning.

## Instructor

- Primary design outcome: make review workload, learner evidence and the next teaching action scannable.
- Preserve useful data density for queues and rosters; avoid truncating counts or hiding evidence behind decorative minimalism.
- Clearly scope KPIs to course/cohort/date and distinguish system facts from AI suggestions.
- Baseline evidence: `/instructor` shows queue, at-risk, students and in-review KPIs, plus grading queue, attention section and AI assistant.
- Verify populated queues, filters, saved views, rubric grading, autosave, high-volume roster and keyboard workflows.

## Organisation admin

- Primary design outcome: provide safe, scoped operational control over members, seats, courses, cohorts, access and reporting.
- Make imports, bulk changes, invitations, permission changes and irreversible actions understandable and auditable.
- Baseline evidence: `/org` shows members, seats, mentors, pending invites, recent activity and announcements.
- Verify multiple departments/cohorts, large rosters, seat limits, invitation/approval lifecycle, scoped access and mobile table alternatives.

## Platform admin

- Primary design outcome: provide a precise control plane for tenant/user operations, support, audit, rollout, system health and revenue.
- Separate routine from high-impact actions; show scope/consequence, confirmation, audit trail and safe reversal where possible.
- Baseline evidence: `/platform` shows organizations, active members, MRR, fees, payouts, AI spend, users, approvals, action items and recent support.
- Verify high-volume tenant/user data, diagnostic failures, feature-flag rollouts, audit filters and sensitive-action confirmations.

## Cross-role open decisions

- Confirm high-frequency tasks and task success criteria from real usage; route counts alone do not establish frequency.
- Determine which metrics can provide trustworthy definitions, scope, source and freshness from their APIs.
- Identify populated, error, stale and permission-denied fixtures per role.
- Confirm approved automation/browser dependencies and install the Agent Pack workflow before claiming queue/off-peak enforcement.
- Keep all product/provider/legal decisions requiring owner input in the designated decision log; do not infer consent or provider approval from a UX prompt.
