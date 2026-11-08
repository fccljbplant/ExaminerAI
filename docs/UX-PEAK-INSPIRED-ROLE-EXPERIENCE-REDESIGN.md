# UX Peak-informed, role-based product experience redesign

**Status:** Active follow-on workstream — structural route inventory completed; authenticated UX discovery and design-system foundation next  
**Backlog:** [Issue #4](https://github.com/fccljbplant/ExaminerAI/issues/4)  
**Baseline dependency:** [PR #3](https://github.com/fccljbplant/ExaminerAI/pull/3)

## Purpose

Deliver a professional, modern, coherent and easy-to-use experience across all TraineesAI roles. This is a product design programme: the objective is to help each user understand their situation, make good decisions, and complete important tasks with confidence. It is not a surface-level reskin.

The repository currently contains 83 app page routes. The work must be role-aware, responsive, accessible, measurable, and incremental enough to validate safely.

## Reference study

The initial source list is retained, but source access is recorded precisely in [the UXPeak research log](./UPGRADE-2026-10/design/UX-REFERENCE-RESEARCH.md). Official website pages and some YouTube descriptions have been inspected; full playback/transcripts are not assumed:

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

1. **Discovery and inventory — structural pass complete:** [docs/UX-ROUTE-INVENTORY.md](./UX-ROUTE-INVENTORY.md) maps all 83 page routes by area, records layout-level role/feature-flag boundaries, and documents navigation and theme-validation findings. The instructor More active-state defect is fixed with regression tests. Authenticated visual journeys, page-purpose confirmation and usage-frequency research remain open.
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


---

## 2026-11-09 master-prompt reconciliation: Workstream M and A–L

The updated owner prompt makes **Workstream M — UXPeak-inspired product design excellence — mandatory across all UI work**. M strengthens Workstream F and does not replace the role charters, the classroom blueprint, existing theme tokens, or owner decisions. The complete source and access-provenance log is [UX-REFERENCE-RESEARCH.md](./UPGRADE-2026-10/design/UX-REFERENCE-RESEARCH.md).

### Workstream M — operating requirements for every UI phase

**M0 — Research and attribution.** Before each design phase, review the relevant official UXPeak site resources and channel videos. Log URLs, access date, whether the full video or reliable transcript was actually inspected, and timestamped observations. Separate source facts from interpretation. Extract decision logic; never copy UXPeak screens, assets, brand, or wording. Supplement with current, relevant education-SaaS and data-product patterns.

**M1 — Start from the user's decision.** For each important screen, record role, context, frequency, device, task, primary decision, information required before acting, what can be deferred, error/delay cost, metric provenance, next step, and recovery route. Test each element against: does it help the person understand, decide, act, or recover?

**M2 — Senior-level hierarchy and composition.** One clear page purpose, one primary action, deliberate secondary actions, consistent grid/alignment/spacing/type/contrast/grouping, distinct values and metadata, and charts that answer a named question with labels, units, period, legend, accessible summary, empty state, and drill-down. Avoid decorative gradients, glass effects, oversized empty hero areas/cards, gratuitous shadows, random iconography, and charts that add no decision value.

**M3 — Task-appropriate information density.** Do not equate minimalism with usability. Learners get a calm next step; instructors get scannable evidence-rich review/roster queues; organisation admins get scoped operational and cohort controls; platform admins get precise diagnostics and control-plane workflows. Use progressive disclosure for infrequent/advanced controls only; keep decision-critical evidence, status, permissions, and recovery visible. Tables need practical mobile alternatives, not simply compressed columns.

**M4 — Interaction quality.** Every control must be labelled, predictable, keyboard-operable, and provide visible feedback. Cover applicable default/hover/focus/pressed/selected/disabled/loading/pending/success/warning/error/empty states. Preserve user input after recoverable validation errors and keep filters/search context. Use optimistic updates only when rollback is safe. Confirm consequential/destructive actions and offer undo where safe. Protect unsaved editor work. Skeletons must match final geometry; no fake progress. Use notifications/activity history for persistent tasks and toasts only for transient feedback. Respect reduced motion.

**M5 — Responsive design as distinct layouts.** Verify 360×800, 390×844, 768×1024, 1024×768 landscape, 1366×768, 1920×1080, and 2560×1440. Design navigation, content order, charts, tables, drawers/dialogs, and sticky actions intentionally at each size. Prevent overflow, clipped menus, unreachable dialogs, keyboard obstruction, and sticky controls covering content. Test touch, keyboard-only, screen reader, zoom/reflow, and reduced motion. Keep targets at least 44×44 CSS px unless a documented exception applies. Critical status and the primary action should remain visible above the fold on the specified mobile and compact desktop views where appropriate.

**M6 — Content and data trust.** Use concise adult-appropriate language and task-specific action labels. Explain metrics/status/AI confidence with units, date window, scope, source, freshness, and definition. Distinguish facts, estimates, AI suggestions, and human decisions. Never imply that AI detected, reviewed, or verified something unless the backend really did. Avoid manipulative urgency, shame, alarmism, or gamified pressure. Enforce the learner-support visibility matrix.

**M7 — One design system.** Extend current primitive → semantic → component tokens and existing theme packs. Audit token usage before changing it; prefer semantic tokens over literal color values. Standardize purposeful component APIs/states for buttons, forms, cards, badges, tables, dialogs, menus, tabs, navigation, charts, skeletons, empty/error states, and feedback. Maintain a design-system gallery with live states, breakpoints, themes, and accessibility notes. No parallel palette/library and no new commercial kit or dependency without owner approval.

**M8 — Screen-by-screen critique loop.** For each priority route: capture current rendered screen; score it; rank the top five problems by severity and frequency; sketch a before/after alternative; implement the smallest coherent reversible/flagged change; capture the same viewport/theme again; inspect the screenshots; test interactions, keyboard/focus, axe, responsiveness, and recovery; record remaining issues with evidence. A code diff alone is not proof of visual improvement.

**M9 — Visual QA.** Build stable seeded fixtures for every role. Cover role dashboards, learner classroom, instructor review queue/student profile, Course Workspace/Presentation Studio, organisation crisis oversight, and platform diagnostics. Cover light/dark/Bed where supported and mobile/tablet/desktop/wide desktop. Add screenshot regression, axe, and manual keyboard/focus review. Check horizontal overflow, console errors, failed requests, broken images, loading stalls, and layout shift. Review visual diffs; never blindly update baselines. Preserve the performance budgets already defined by the master prompt.

**M10 — Evidence-based acceptance scorecard.** Score every priority screen 0–5 for: task clarity; hierarchy/scanability; information density; design-system consistency; feedback/recovery; responsive behavior; accessibility/keyboard; data accuracy/provenance/trust; performance/stability; role-specific usefulness. Require at least 4/5 on every criterion before calling a priority screen release-ready. Any 0–2 in accessibility, data trust, task completion, or responsive usability blocks release regardless of average. Scores require screenshot/test/usability evidence.

**M11 — Deliverables.** Maintain:
- `docs/UPGRADE-2026-10/design/UX-REFERENCE-RESEARCH.md`
- `docs/UPGRADE-2026-10/design/UX-AUDIT.md`
- `docs/UPGRADE-2026-10/design/UX-SCORECARD.md`
- `docs/UPGRADE-2026-10/design/ROLE-DESIGN-DECISIONS.md`
- role journey maps and responsive wireframes
- visual regression coverage and a living design-system gallery.

Phase 0 remains read-only. UX tasks must be evidence-backed, small, and staged in the approved task-card workflow. Every UI change requires before/after rendered evidence, interaction tests, responsive checks, and accessibility review before sign-off.

### A–L scope crosswalk and status

These workstreams remain in the long-term upgrade scope. They are **not** claimed as implemented by the current UX audit PR.

| Workstream | Relevant outcome retained in the combined plan | Status in current UX audit branch |
|---|---|---|
| A — AI model | One model configuration; explicitly disable thinking by default; usage/cost visibility; hardened prompts; batch work scheduled separately from interactive AI. | Not implemented by PR #3; verify runtime call sites and current provider docs in its own workstream. |
| B — Voice | Roman-script text, native-language speech for tutor and instructor assistant; preserve sound-off default and caption-only slide policy unless owner changes it. | Deferred; not implemented by PR #3. |
| C — Presentation Studio | Per-class editable decks, AI-assisted authoring, supported imports/exports, human review and save/recovery states. | Deferred; not implemented by PR #3. |
| D — Classroom v2/parity | Course map, lesson canvas, tutor dock, learner dashboard and legacy-feature parity before cutover. | Deferred; not implemented by PR #3. |
| E — Instructor Copilot | Scope-bounded evidence-based guidance; pseudonyms to the model; server-side identity restoration. | Deferred; not implemented by PR #3. |
| F — Power UI | Role-specific dashboards and responsive experience for all four roles, building on the existing token/UI architecture. | Plan + structural route inventory; theme/navigation/correctness foundations partly changed in PR #3. Full role redesign is not done. |
| G — Audit backlog | Security, RBAC, CI, tests, data correctness, route/access safety, and UX debt. | Partly addressed in PR #3 (selected safe-state, KPI, navigation, theme-validation, and CI fixes); broader audit remains open. |
| H — Learner support/crisis | Learner indicators to their own instructor; org Learner Support Leads see crisis cases/handling only; instructors are never behaviorally/psychologically monitored; platform admins see none. Consent/legal gating and owner-authored safety copy remain mandatory. | Deferred; not implemented by PR #3. Do not enable signals from this UX plan. |
| I — Adaptive teacher | Per-learner/per-topic teaching policy for depth, register, scaffolding, and difficulty, with minimal AI reasoning. | Deferred; not implemented by PR #3. |
| J — Course/enrollment | Course Workspace; unified enrollment lifecycle; invitations, approvals, cohorts, assignment/rubric authoring; org programs. | Deferred; not implemented by PR #3. |
| K — Data/entitlement | One enforceable entitlement decision and learning read model/snapshots shared by role dashboards. | Deferred; not implemented by PR #3. Existing UX metric fixes do not solve this broader data-model problem. |
| L — Identity/communications | Email, invitations, onboarding, verification, staff MFA, inbox, announcements, reminders; SSO later. | Deferred; not implemented by PR #3. Provider choices still require owner decisions. |
| M — UXPeak design excellence | Reference research, role/task decisions, hierarchy/density, interactions, responsive/accessibility, visual QA, scorecard and iterative before/after work. | Added to this plan and the dedicated source log; full screen-by-screen work remains ahead. |

### Reconciled delivery order

Keep the owner's phase order for product architecture (security/access + AI configuration → read model/UI kit → enrollment/identity → Course Workspace/Presentation Studio → classroom/adaptive teacher/voice → learner support/crisis/Copilot/inbox → org/platform dashboards/MFA/SSO → legacy retirement). Run Workstream M as a **quality gate and parallel design method**, not as a reason to reorder or skip product dependencies.

For the current UX-audit stream, continue in this order:
1. Close the theme/navigation foundation and document the CI result.
2. Establish authenticated role fixtures and screenshot/browser QA prerequisites.
3. Capture baseline screenshots and complete role-specific task/route critique before broad visual implementation.
4. Deliver learner + instructor flows first, then organisation admin, then platform admin.
5. Roll the shared patterns through remaining routes; add visual regression and measure task outcomes.

### Verified repository/tooling gaps

- The current branch has `AGENT-INSTRUCTIONS.md`, but the updated prompt's `AGENTS.md`, `docs/UPGRADE-2026-10/START-HERE.md`, `QUEUE.md`, `DECISIONS.md`, `PROGRESS.md`, and `scripts/agent/*` runner/evidence scripts were not found on the current branch during this reconciliation. The described Agent Pack is therefore **not installed/verified here**. Treat installing it as a prerequisite before claiming the task-card/off-peak guard is active. Do not silently fabricate those files or bypass their safety intent.
- The current package manifest does not include Playwright or axe packages. The current CI has no browser screenshot artifact step. The owner's updated prompt says no new dependency without approval; obtain that approval before adding Playwright/axe. A route HTTP smoke test is not authenticated browser QA.
- Latest validated CI run [42537096856](https://github.com/fccljbplant/ExaminerAI/actions/runs/42537096856) on branch head `fbc489054dbba62ce7876c8cd8239b6859c2e1ab` passed: 31 test files / 374 tests; lint; TypeScript; production build; 83/83 page-route requests; authenticated screenshot capture; and artifact upload.
- The screenshot artifact contains 28 authenticated role-dashboard PNGs (four roles × seven required viewport sizes) plus a manifest. The manifest records no horizontal document overflow across those 28 captures. The screenshots were downloaded and visually inspected as a first baseline; see [UX-AUDIT.md](./UPGRADE-2026-10/design/UX-AUDIT.md), [UX-SCORECARD.md](./UPGRADE-2026-10/design/UX-SCORECARD.md), and [ROLE-DESIGN-DECISIONS.md](./UPGRADE-2026-10/design/ROLE-DESIGN-DECISIONS.md).
- This is not UX sign-off: the fixtures are synthetic and sparse. Populated/error/permission states, interaction walkthroughs, axe, manual keyboard/screen-reader checks, reduced motion, zoom/reflow, console/network review, performance measurement and task-based usability evidence remain open.


### Prompt fact check — DeepSeek schedule and model wording (2026-11-09)

The official [DeepSeek Models & Pricing page](https://api-docs.deepseek.com/quick_start/pricing/) was rechecked during this reconciliation. It currently identifies `deepseek-flash` as the API model name for the DeepSeek-V4.1-Flash-1017 version, lists thinking as supported and enabled by default, and documents an explicit non-thinking mode. Therefore the owner prompt's floating model name and requirement to turn thinking off explicitly remain relevant; implementation must follow the current official Thinking Mode guide rather than relying on SDK defaults.

The same pricing page defines weekday peak windows as 01:00–04:00 and 06:00–10:00 UTC, **excluding Chinese public holidays**; weekends and Chinese public holidays are listed as off-peak. The Agent Pack prompt deliberately treats those holidays as peak. That is a conservative cost guard, not an outdated fact about the current API price schedule. Preserve the conservative behavior unless the owner explicitly asks to optimize those holiday windows. No model/provider/runtime code was changed in this UX audit.

