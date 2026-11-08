# UX audit — baseline screenshot review

**Reviewed:** 2026-11-09  
**Branch:** `ux-audit/fix-dashboard-truthfulness-and-agent-safety`  
**Evidence run:** [GitHub Actions 42537096856](https://github.com/fccljbplant/ExaminerAI/actions/runs/42537096856)  
**Screenshot artifact:** `role-dashboard-screenshots` (28 PNGs + manifest; retained through 2026-11-15)  
**Fixture:** synthetic CI-only users and isolated SQLite database; empty-state data, not production/customer data.

## Scope and method

Captured the four role home routes at seven viewport sizes: 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080 and 2560×1440. The capture script verified each role's authenticated route before saving a screenshot. The manifest reports no document-width overflow in any of the 28 captures.

This is a first rendered baseline, not a release sign-off. It does not yet include interaction walkthroughs, populated data fixtures, theme variants, axe, manual keyboard/screen-reader checks, console/network inspection, or user task testing.

## First visual observations

### Learner — `/learner`

- The no-enrollment state gives a clear primary action: **Browse courses**.
- A numbered getting-started path explains the next steps and reduces the need to discover features unaided.
- On a 390px viewport, the sequence is readable and the bottom navigation remains visible.
- Review next: ensure the checklist reflects the learner's actual enrollment/course context; verify progress and course-resume states with populated data; test whether the five-step list is the right amount of content for returning learners.

### Instructor — `/instructor`

- The dashboard makes four operational signals visible: in queue, at risk, students, and in review.
- The grading queue, attention area, roster drill-down and AI assistant are distinct sections.
- The empty queue and no-attention states are explicit rather than blank.
- Review next: clarify KPI definitions, scope and freshness; test populated queues and high-volume rosters; ensure the AI assistant's suggested prompts and response states are useful and clearly distinguish AI suggestions from verified facts.

### Organisation admin — `/org`

- Member count, seats used, mentors and pending invitations are surfaced before the member list.
- Recent activity/audit and announcements are discoverable on the home screen.
- The synthetic fixture exposes a single member and unused seats, so it tests empty/light states only.
- Review next: validate scope labels and seat definitions, larger member lists, invitation lifecycle, bulk actions, announcement validation/confirmation, and the mobile alternative for operational tables.

### Platform admin — `/platform`

- Tenant/member counts, financial/usage indicators, pending approvals and audit activity are grouped into a compact operational overview.
- An action-items section creates a route into operational work.
- Review next: make metric periods, provenance and freshness explicit; test populated and exceptional states; verify high-impact action confirmations and audit trail; improve the wide-screen use of space only where it improves operational scanning (do not add decorative content).

## Cross-role issues to investigate

1. The baseline is visually consistent in shell, navigation and card treatment, but hierarchy and density should be tuned by role rather than forced into identical dashboards.
2. The synthetic dataset is intentionally sparse. A populated fixture is required before deciding whether density, charts, filters or table patterns are appropriate.
3. Dashboard metrics need visible scope, time window, definition and freshness wherever the underlying API can provide them.
4. Screenshots show layout only. They do not prove that buttons, forms, menus, tabs, drawers, filters, keyboard focus, screen readers or recovery states work.
5. No horizontal overflow was recorded at the seven tested viewport sizes. This does not prove there are no clipped popovers, sticky overlays or inner-container overflow issues.

## Next audit pass

- Capture populated and empty/error/permission/stale states for each role.
- Inspect high-frequency tasks route-by-route, beginning with learner and instructor flows.
- Compare before/after at the same viewport and theme; record the user problem and trade-off.
- Add approved browser interaction and accessibility automation only after the dependency/Agent Pack constraints are resolved.
- Maintain screenshot artifacts and a manifest for each reviewable phase.




### Additional mobile composition observations

- **Instructor:** the 390px layout places four KPIs first, then the queue, attention list and AI assistant. The page remains readable and the navigation is reachable. Verify the assistant's suggested prompts and answers against evidence/provenance rules, and test a populated queue before changing its density.
- **Organisation admin:** the announcement composer occupies a substantial part of the lower mobile viewport. Its form has accessible labels and visible posting feedback in source. Confirm whether composing announcements is a frequent home-screen task; if not, consider a compact entry point to a dedicated announcement workflow, but do not hide a high-frequency action without task evidence.
- **Platform admin:** the mobile dashboard presents eight top-level KPIs and four additional overview cards before the action-items section. The metrics are currently given similar visual weight, so action items begin low in the 390×844 viewport. Investigate which indicators are decision-critical and group business health, platform operations and action items with a clear hierarchy. Keep all decision-critical status visible; do not simply delete metrics or add decorative charts.

## Source cross-checks from the first visual review

### Learner no-enrollment state

The screenshot is rendered by `src/modules/learner-portal/home.tsx`. The no-enrollment branch deliberately shows a primary course-catalog action plus a hard-coded five-step `OnboardingGuide`.

- The guide still points to `/learner/exams/weekly` and describes weekly tests/certificate completion. These routes are present in the current route inventory, and the broader upgrade plan explicitly defers legacy exam-route retirement until the data/entitlement migration and parity work are complete. **Do not remove these steps as "outdated" yet.** Verify the canonical course-outline assessment and certificate flow during Workstreams J/K before changing the guide.
- The phrase "your streak starts on day one" is present in source and the home API provides a real `streakCurrent` value. The owner prompt rejects manipulative streaks and gamified pressure, not every truthful progress signal. Keep the actual metric only if it remains accurate and non-coercive; review the copy for a supportive, learner-controlled tone before the learner redesign.
- The onboarding list is a guide, not a completion tracker. Future work should avoid implying that a step is completed unless the product has evidence of completion.

### Instructor at-risk KPI — code defect found and fixed

The screenshot fixture has zero at-risk learners, so the visual baseline alone could not reveal a count bug. Source review found that the instructor home API returns a complete `atRisk.count` plus a five-row `atRisk.items` preview, while the UI used `atRisk.items.length` for the KPI. That could cap the displayed count at five.

**Fixed on this branch:** the KPI now uses the aggregate count via `getAtRiskKpiCount`, with a regression test proving a count of 17 is not reduced to a five-item preview. The current screenshot is still an empty-state fixture; a populated browser fixture should verify the rendered value in a later pass.

### Organisation and platform admin

- Organisation home code has explicit labels for the announcement title/body fields, submit validation, and success/error feedback. The first fixture shows only one member; bulk member operations, invitation lifecycle, large tables and permissions still need populated-state review.
- Platform home displays eight operational KPIs. The next critique should make definitions, scope and time windows discoverable for values such as active members, MRR, pending payouts and AI spend; avoid adding charts unless they answer a named operational question.

## Reconciliation of older audit statements (verified 2026-11-09)

| Older statement / proposed exclusion | Verification | Current treatment |
|---|---|---|
| "There is no CI" / "no type or route checks" | Superseded. The current branch has a passing workflow with lint, 31 test files / 374 tests, TypeScript, production build and 83/83 route requests. | Mark as resolved for this baseline; do not repeat as a current defect. Keep broader quality and security audit open. |
| "There are no authenticated screenshots" | Superseded. Run 42537096856 produced 28 authenticated dashboard captures and a manifest. | Keep screenshot capture as an ongoing requirement; this first baseline is not full route coverage. |
| "There are no E2E or accessibility checks" | Still substantially current. The screenshot runner is a Chrome DevTools Protocol capture, not a full Playwright interaction suite; no axe package or manual keyboard/screen-reader report was produced. | Retain as open work; do not call screenshots E2E or accessibility sign-off. |
| "The Agent Pack task-card/off-peak workflow is installed" | Not verified; the repository review found `AGENT-INSTRUCTIONS.md` but did not find the referenced `AGENTS.md`, queue/decision/progress files or `scripts/agent/*` runner. | Do not claim those controls are active. Treat installation as a prerequisite under the owner's approval rules. |
| UXPeak video references can be treated as fully reviewed | Not supported. The research log distinguishes inspected official pages/descriptions from full playback or reliable transcripts that were not verified. | Keep the references in the research queue; do not invent timestamped lessons. |
| Commerce conversion patterns should be copied into learning screens | Not appropriate as a blanket rule. UXPeak examples include e-commerce, pricing and booking contexts. | Transfer only general principles—clarity, trust, hierarchy, decision confidence and user control—when a real learning task benefits. Do not import urgency, persuasion or irrelevant purchase widgets. |

Older findings are not silently deleted: superseded claims are labelled as historical, still-valid gaps remain open, and uncertain claims stay unverified until evidence is available.

## Evidence links

- [Successful screenshot/quality run](https://github.com/fccljbplant/ExaminerAI/actions/runs/42537096856)
- [PR #3](https://github.com/fccljbplant/ExaminerAI/pull/3)
- [Role redesign plan](../UX-PEAK-INSPIRED-ROLE-EXPERIENCE-REDESIGN.md)
- [UXPeak reference research](./UX-REFERENCE-RESEARCH.md)
