# UX scorecard — baseline (screenshot-only)

**Reviewed:** 2026-11-09  
**Evidence:** [CI run 42537096856](https://github.com/fccljbplant/ExaminerAI/actions/runs/42537096856), artifact `role-dashboard-screenshots`.  
**Status:** baseline observations only; **not a release score or acceptance sign-off**.

## Scoring rules

0–5 per Workstream M10 criterion. A score is assigned only when the available evidence supports it. Screenshot-only evidence cannot establish interaction quality, accessibility, performance, stability, or real-user usefulness. Those criteria remain **Not scored** until tested. The M10 release threshold remains at least 4/5 on every criterion; any 0–2 in accessibility, data trust, task completion or responsive usability blocks release.

## Preliminary visual evidence

| Role / route | Task clarity | Hierarchy | Density | Design-system consistency | Feedback / recovery | Responsive | Accessibility / keyboard | Data trust | Performance / stability | Role usefulness |
|---|---:|---:|---:|---:|---|---|---|---|---|---|
| Learner `/learner` | 4 | 3 | 3 | 4 | Not scored | 4* | Not scored | 3* | Not scored | 3* |
| Instructor `/instructor` | 3 | 3 | 3 | 4 | Not scored | 4* | Not scored | 3* | Not scored | 3* |
| Org admin `/org` | 3 | 3 | 3 | 4 | Not scored | 4* | Not scored | 3* | Not scored | 3* |
| Platform admin `/platform` | 3 | 3 | 3 | 4 | Not scored | 4* | Not scored | 3* | Not scored | 3* |

* Provisional screenshot-only judgement. Responsive 4 means only that the rendered document width did not exceed the viewport in the seven captured sizes; it is not a full responsive-usability score. Data-trust and role-usefulness values are conservative baseline flags because the screenshots use synthetic, sparse fixtures and do not show complete provenance or real task outcomes. Re-score after populated-data and interaction review.

## Evidence and open checks

- 28 authenticated screenshots captured: four role dashboards × seven viewport sizes.
- Manifest recorded no horizontal document overflow in any capture.
- Empty/light states were visible for all roles; populated/high-volume and failure states remain untested.
- No axe scan, manual keyboard/focus test, screen-reader test, reduced-motion test, zoom/reflow test, console/network review or performance budget measurement is included in this baseline.
- No user task completion/time-on-task evidence has been collected.

## Release decision

**Not ready for UX sign-off.** This is an initial baseline only. Complete interaction, accessibility, populated-data, theme and task-based evidence before awarding final scores or claiming a screen meets the 4/5 acceptance bar.

