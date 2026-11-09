# UXPeak Pro — Product-wide experience blueprint

**Status:** living design/implementation scope for PR #3  
**Date:** 2026-11-09  
**Source basis:** `TraineesAI-FINAL-PROMPT.md`, `TraineesAI-Master-Upgrade-Prompt.md`, existing `docs/UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md`, Workstreams A–M and the redesign blueprint decisions.  
**Purpose:** make UXPeak a product-wide experience standard, not a dashboard-only visual refresh.

## Product principles

- **AI trains; humans mentor.** Make the human instructor relationship visible and easy to reach.
- Role-first information architecture: each role sees the work it is responsible for, not a reskinned copy of another role.
- Learners control their pace. Weeks/days are organisational structure, not calendar-imposed deadlines.
- Show real progress and evidence only. Unknown, stale or failed data is unavailable—not zero, success or fabricated activity.
- Power UI: strong hierarchy, useful data density, contextual actions, low navigation friction and minimal unnecessary scrolling.
- Responsive from 360px through 4K; WCAG AA, keyboard operation, visible focus, reduced motion, zoom/reflow and semantic structure.
- Keep existing theme packs, tokens and component architecture. Star Admin 2 Pro is visual inspiration only; do not copy its code or assets.
- Gamification must reward learning evidence and healthy consistency, never time-on-platform, compulsive streak protection or public shaming.

## Product-wide concept inventory

### 1. Role dashboards and command centres

- **Learner — Learning cockpit:** continue learning, today's lesson, course/topic pipeline, mastery trend, skills to revisit, spaced-practice queue, tests unlocked by learning sequence, projects, calendar/deadlines where applicable, announcements, tutor, messages, Study Center and Help.
- **Instructor — Teaching command centre:** courses and cohorts, upcoming teaching work, student progress and mastery evidence, submissions needing review, attendance/participation, assignment authoring, feedback, learner questions/inbox, Copilot and clear links to individual learner support only within authorised scope.
- **Organisation Admin — Organisation command centre:** people, programmes, cohorts, enrolments, course health, organisation-scoped academic progress, instructor–learner teaching activity records, announcements, access and audit. No individual learner psychological/support signals for ordinary org admins.
- **Platform Admin — Mission control:** tenant/platform health, catalogue governance, operational queues, configuration and aggregate service metrics. No individual learner psychology/support data.

### 2. Gamification and motivation

- XP/level, streak and achievement concepts must be grounded in completed learning actions and verified mastery evidence.
- Topic/course milestones, skill badges, personal progress journeys and optional cohort celebrations.
- Streaks are supportive and forgiving; avoid punitive resets, manipulative urgency, leaderboards that expose sensitive performance, and rewards for raw activity volume.
- Learner dashboard can show level, XP and streak only when backed by persisted, auditable rules. Do not fabricate values or ship fake/demo activity as live.
- The Master Upgrade Prompt schedules gamification and public restyle in Phase 8; treat this as designed scope/backlog until the owner-approved phase and rules exist.

### 3. Course discovery, catalogue and marketplace

- Course catalogue with search/filter, skill/topic taxonomy, course detail, outcomes, curriculum preview, instructor/org attribution, prerequisites and clear availability.
- Marketplace governance: platform review before public publishing; org courses can be enabled/disabled by org admins per the existing prompt decisions.
- Marketplace course pages offer a **read-only preview of the first lessons**. Do not expose protected course content or learner data.
- Authoring, preview and publishing are separate states with review status, version and visibility clearly shown.
- Marketplace is not automatically a paid storefront. Payments, pricing, commissions, cart, checkout, refunds, tax and billing provider require explicit owner approval and a separate security/compliance design.

### 4. Shopping / enrolment journeys

- Treat the learner's “shopping” journey as course discovery → compare → preview → request/join/enrol → approval (where configured) → onboarding → start learning.
- Support organisation-sponsored enrolment, invitation links, approval queues and cohort assignment as specified in Workstreams J/L.
- Keep purchase/cart/checkout UI out of scope until commercial model, provider, pricing, entitlements, refunds and data-processing decisions are approved.
- No new dependency, payment provider, spend or production transaction in this PR.

### 5. Classroom and learning workspace

- Modern classroom: course map, lesson canvas and tutor dock; clear stage/progress indicator.
- Lesson content, editable/importable presentations, projects, assignments, tests, practice, feedback and post-lesson flow.
- Tests remain sequenced server-side: daily test after study session; weekly test unlocks after final content day; difficulty adapts across five levels.
- Accessible captions/transcripts; sound off by default; native-language voice opt-in; learner can ask instructor for help.
- Learner parity matrix must retain essential legacy capabilities while moving to the new learning model.

### 6. AI assistance and Copilot

- Learner tutor: context-aware, adaptive, evidence-grounded, language-aware; clear uncertainty and instructor escalation.
- Instructor Copilot: scoped courses/learners, evidence and pseudonyms only; server restores identities only for authorised UI presentation.
- Contextual AI help should explain the current learning/task screen, not replace instructor mentoring or invent system state.
- Distinguish AI tutor, AI-generated content, staff Copilot and human help. Label AI output and provide a human escalation route.
- Interactive tutoring/grading is never delayed by off-peak scheduling; only deferrable batch work is queued.

### 7. Tutorials, onboarding and guidance

- Role-based first-run onboarding with short, dismissible steps and a visible “show me how” re-entry point.
- Contextual walkthroughs for learner classroom, instructor course workspace, org enrolment/governance and platform catalogue/operations.
- Empty states teach the next valid action; avoid modal tours that block work.
- Inline definitions, searchable help articles, short task tutorials and contextual examples.
- Onboarding must not imply calendar deadlines or create fabricated course/progress state.

### 8. Helpdesk, learner help and support

- Product helpdesk: searchable help centre, contact/support request, category, optional note, status, history and clear response expectations.
- Learner “I need help” is a request to the in-scope instructor, not an AI chat; it should show request status and preserve an auditable record.
- Separate ordinary technical/product support from learner wellbeing/crisis handling.
- Learner support indicators remain off until consent, per-org feature gate, access controls, retention, audit and owner approvals are implemented. Crisis wording is owner-authored and professionally reviewed.
- Org Learner Support Leads oversee crisis cases and handling records only; ordinary org admins do not see private support/psychological indicators; platform admins see none.
- Do not monitor/profile instructors psychologically or behaviourally.

### 9. Communications and notifications

- Unified inbox, instructor questions, scoped announcements (platform/org/course/cohort), schedule/pin/acknowledge, preferences and delivery state.
- Clear distinction between informational, action-required and critical notices.
- Quiet hours and user preferences; critical safety/security events remain non-disableable.
- Inactivity nudges are instructor drafts unless the instructor explicitly opts into automation.

### 10. Shared design system and UX quality

- Consistent application shell, navigation, page headers, breadcrumbs, action hierarchy, cards, data tables, filters, search, command actions and responsive drawers.
- Standard states on every data surface: loading, populated, empty, error/retry, stale, denied and success.
- Data visualisation with labels, units, time ranges, accessible alternatives and honest missing-data treatment.
- 44px minimum touch targets where practical, visible focus, labelled controls, logical headings, keyboard access and screen-reader announcements.
- Theme packs must remain coherent in light/dark and supported variants; avoid hard-coded colours and one-off styles.
- Performance: prioritise first meaningful content, avoid layout shift, keep dashboards responsive and defer nonessential heavy visualisations.

## Delivery sequence and gates

1. **Current PR #3 — safe foundations:** dashboard recovery/empty/loading/keyboard fixes; truthful existing data; privacy/RBAC regression protection; record the full UXPeak scope. Continue only small, verifiable, reversible changes.
2. **Design-system and role IA phase:** role charters, journey maps, feature inventory, route inventory, learner legacy parity, component/state matrix and seven-viewport screenshots in light/dark.
3. **Core learning journeys:** course catalogue/preview, enrolment/invitations/approvals/cohorts, course workspace, classroom v2 and presentations, with server-side entitlements and tests.
4. **Assistance and communications:** tutor/Copilot, contextual tutorials, inbox/announcements and product helpdesk with human handoff.
5. **Governed support:** only after consent workflow, per-org feature flag, retention/audit, designated support roles, approved language and tabletop exercise.
6. **Gamification and public polish:** after owner-approved rules, data model, abuse/privacy review and evidence-based metrics. The Master Upgrade Prompt currently places gamification/public restyle in Phase 8.
7. **Commerce decision gate:** marketplace preview is specified; paid commerce is not. Obtain explicit approval before any checkout, payments, pricing, commissions or billing implementation.

## Acceptance evidence (not waived)

- Role-based journey and route inventory with works/partial/broken/legacy-dead status.
- Before/after screenshots at 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080 and 2560×1440 in light and dark.
- Populated, empty, loading, stale, error, denied and success fixtures; no false live metrics.
- Keyboard-only, focus order, screen reader, reduced motion, 200% zoom/reflow and axe checks.
- Lint, typecheck, unit/integration/permission tests, production build, route smoke and token audit.
- No release-ready UX score without actual visual and interaction evidence.
