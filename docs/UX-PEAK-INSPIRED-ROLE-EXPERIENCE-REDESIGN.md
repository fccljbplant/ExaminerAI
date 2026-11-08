# UX Peak-informed, role-based product experience redesign

**Status:** Planned follow-on workstream  
**Backlog:** [Issue #4](https://github.com/fccljbplant/ExaminerAI/issues/4)  
**Baseline dependency:** [PR #3](https://github.com/fccljbplant/ExaminerAI/pull/3)

## Purpose

Deliver a professional, modern, coherent and easy-to-use experience across all TraineesAI roles. This is a product design programme: the objective is to help each user understand their situation, make good decisions, and complete important tasks with confidence. It is not a surface-level reskin.

The repository currently contains 83 app page routes. The work must be role-aware, responsive, accessible, measurable, and incremental enough to validate safely.

## Reference study

The initial source study covers public UX Peak material and available video transcripts/descriptions:

| UX Peak video | Design lesson to apply |
|---|---|
| [The UX Psychology Behind Apps People Can't Stop Using](https://www.youtube.com/watch?v=2TlIg3VokY8) | Use editable smart defaults to reduce repetitive decisions; show real progress; give value before demanding commitment when the flow allows it; motivate without manipulation. |
| [Top 3 UX/UI Redesigns That Make You Design Like a Pro](https://www.youtube.com/watch?v=zr37ibqXl1U) | Make the next decision easy to understand; explain timelines, costs and consequences; create trust through transparency; use visual hierarchy and concrete language. |
| [Bad vs Great App Design](https://www.youtube.com/watch?v=U7jTCgIWS4w) | Do not equate minimalism with usability. Show enough information, personalization and control to support the user's decision without overwhelming them. |
| [This Video Will Take You From Junior to Senior UX/UI Designer](https://www.youtube.com/watch?v=YlN28RNChl0) | Make the primary task visually dominant; use conversational, contextual copy; prefer recognition and recent choices over memory and redundant steps; provide immediate, meaningful feedback; use interactive controls when they fit the task. |

These are source-derived principles from the material reviewed, not a claim that every UX Peak video on the channel has been watched. Further videos should be added to the reference log as each design phase begins. Apply the thinking to TraineesAI's actual workflows; do not copy unrelated booking or ecommerce screens literally.

For role dashboards and forms, translate the fourth video's examples carefully: prioritize the data the person is acting on; make the selected state unmistakable; give immediate feedback after interactions; use recent items/search and recognized people or courses where they reduce recall and error; show the consequences of important actions before confirmation. A slider or swipe interaction is appropriate only when it improves a real task—not simply to make an enterprise screen feel animated.

**Ethical guardrail:** no fake urgency, scarcity, progress, outcomes, reviews, or hidden material terms. Psychology should clarify choices, support motivation and increase trust—not manipulate users.

## Role experience principles

### Learner

- Provide a calm learning home with one obvious next step, course context, honest progress, and a clear way to resume.
- Offer supported choices for guided/self-paced study, learning goals, pace, language, content preferences, accessibility, and reminders.
- Make course, week, lesson, practice and exam structure understandable.
- Explain why recommendations appear and let learners choose another path.
- Make progress and achievement evidence-based; never inflate progress to make onboarding feel shorter.
- Design classroom and lesson actions for mobile use, with clear autosave and recovery feedback.

### Instructor

- Give a meaningful teaching overview: pending review workload, in-review workload, student attention signals, course activity and trends.
- Put definitions, data freshness, scope and drill-down behind every KPI.
- Provide roster search, filters, saved views, and clear cohort/course scoping.
- Make grading efficient with learner context, rubric criteria, autosave, keyboard operation, and visible submission state.
- Distinguish no students, no submissions, no data yet, loading, permission denial and service failure.

### Organisation admin

- Keep the organisation scope visible across people, seats, courses, departments/cohorts, engagement, billing and operations.
- Make invitations, role assignment, imports, permission changes and bulk actions understandable and auditable.
- Provide practical reporting with date ranges, filters, scope indicators, and exports.
- Explain downstream effects before organisation-wide or irreversible changes.

### Platform admin

- Organise the control plane around operational tasks: tenants, users, access, support, audit, rollout, system health and revenue.
- Provide fast global search and clear navigation without duplicated primary navigation.
- Separate routine actions from high-impact actions. State the target scope and consequences, require confirmation when appropriate, record the audit trail, and offer undo/reversal where safe.
- Keep exceptions and sensitive details in server logs; show a safe, actionable message to users.

## Shared design system

- Keep the token-based theme architecture as the visual source of truth. Audit every supported theme/preset, not just light, dark and bed modes.
- Standardize typography, spacing, responsive grid, color/contrast, surfaces, borders, radii, icons, focus, hover, active, pressed, disabled and reduced-motion behavior.
- Build shared patterns for page headers, section headers, KPIs, charts, filters, search, tables/lists, forms, command search, menus, drawers/sheets, dialogs, notifications, skeletons, empty states, errors and permission states.
- Support phone widths down to 360px, tablet, laptop and large desktop, without page-level horizontal overflow.
- Meet the product's minimum 44px interactive target guidance; support keyboard navigation and visible focus; use semantic landmarks, labels and announcements; validate WCAG AA contrast.
- Persist useful user choices: saved filters/views, density where it helps, table/card view where appropriate, theme, language, timezone, notifications and learning preferences. Defaults should be sensible and easy to change.
- Use progressive disclosure to manage complexity, not to hide information users need to decide. Avoid hover-only actions and unlabeled icon-only controls.
- Define loading, empty, error/retry, permission, stale/last-updated and success states for every data-dependent component.
- Make all metrics truthful: counts must use complete datasets, not preview lengths; errors must not become zero; data scope and freshness must be clear.

## Delivery sequence

1. **Discovery and inventory:** map all 83 app page routes by role, task, navigation, permission boundary, state, responsive layout and usage frequency. Document the key role journeys and duplicated patterns.
2. **System foundation:** rationalize theme validation, tokens, component patterns, interaction contracts, responsive breakpoints and accessibility tests.
3. **Learner + instructor journeys:** update learner home/classroom/progress/practice/exams and instructor home/roster/review/grading. Validate mobile and keyboard workflows.
4. **Organisation admin:** update members, access, departments/cohorts, course operations, reporting and billing.
5. **Platform admin:** update global overview, tenants, users, support, audit, feature flags, system and revenue.
6. **Route-wide rollout:** apply shared patterns to remaining pages; remove duplicate/legacy navigation; add authenticated browser journeys, responsive screenshots, axe checks, keyboard/screen-reader review and performance checks.
7. **Measure and iterate:** use task completion, time-on-task, error/retry, adoption and usability feedback. A/B test only where appropriate and ethically safe.

## Definition of done

- Every route has an identified role, primary task, navigation location, and phone/tablet/desktop layout.
- No dead ends, duplicate primary navigation, misleading KPI totals, or false empty/success states.
- Every important action has a clear outcome and recoverable error path.
- User choices are real, accessible, persistent, and do not introduce needless decision fatigue.
- Core workflows are tested at phone, tablet and desktop breakpoints, with keyboard and assistive-technology checks.
- Visual consistency comes from shared design tokens and components rather than one-off styling.
- Each phase has before/after evidence, test evidence, and measured user outcomes.
- Each phase is independently reviewable; the owner approves merge/deploy.

## Sequencing with the current UX audit

PR #3 is intentionally the foundation: dashboard correctness, safe failure states, credential-safe agent guidance, navigation target sizing, and baseline automation. Keep the larger role redesign in [Issue #4](https://github.com/fccljbplant/ExaminerAI/issues/4) so it can be delivered in focused, reviewable phases after the baseline is accepted. Do not merge or deploy without owner approval.
