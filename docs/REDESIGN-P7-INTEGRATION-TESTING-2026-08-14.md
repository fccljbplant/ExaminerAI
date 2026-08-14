# REDESIGN P7 — Study-Flow & Domain Integration Testing

> Phase 7 (2026-08-14). Proves (a) all six study scenarios behave per spec, (b) the full learner journey runs on three radically different courses with **zero domain-specific code**, (c) the AI tutor adapts per course and honors the text-only constraint. Same test code for all courses — only fixtures differ.

## 1. Fixtures — three courses, config-only (`scripts/seed-p7-courses.ts`)

| Course | Lesson types | Assignment submission types | Rubric / sign-off | aiConfig |
|---|---|---|---|---|
| HSE Work-at-Height Safety Cert | text (strict) + practical_demo | checklist (all-required) + photo evidence + docx report (extraction path) | safety criteria 60%, critical-fail → changes_requested; chain: mentor → safety officer | strictness 5, safetyCritical, glossary[hazard, permit, anchor] |
| eBay Store Launch Program | ai_taught + video | live_artifact (store URL) + link; milestones: store live / first listing / first sale | business criteria; single mentor sign-off | tone entrepreneurial, glossary[listing, store, SEO] |
| Mobile Repair Fundamentals | practical_demo + video | photo + video evidence (captureHints) | soldering-quality levels; resubmission ×3 | plainLanguage, glossary[ESD, board, battery] |

All three inserted via registry rows + JSON config only; assertion: seed script touches no component code.

## 2. Study-scenario simulation matrix (vitest + e2e)

| # | Fixture setup | Engine assertion | UI assertion | Tutor offer |
|---|---|---|---|---|
| S1 | lastActivity −5d, 3 missed lessons | `detectAbsence=short`; missed list = 3 | CatchUp card, 4 options; condensed plan ≤10 min | "You missed 3 lessons…" verbatim pattern |
| S2 | 3 sessions today, velocity ×3 baseline | `detectCram=true`; SRS due count boosted | Accelerated offer + retention warning chip | speed-up offer present |
| S3 | weekend-only pattern ×3 weeks | cadence model predicts weekend | weekend-plan suggestion card | pattern-aware offer |
| S4 | exam event in 3d, 2 weak topics | plan prioritizes weak+exam items | 2h blocks + breaks + rest reminders; milestone celebrate | emergency-plan offer |
| S5 | budget=15 | ΣestMin ≤ 15; no overrunning block | quick-review/micro-lesson/quick-quiz chooser only | fits-window offer |
| S6 | lastActivity −10d | `detectAbsence=long` | diagnostic 10-Q banner; score routes review vs jump-ahead | encouraging copy, no guilt strings |

## 3. Full-journey e2e (one test, three fixtures)

Enroll → lesson session (slides/video/practical per config) → assignment submit (domain types incl. docx upload → extraction done) → mentor: text + audio + annotation feedback → request changes → resubmit (cycle 2) → rubric grade (aiAssist draft labeled; human wins) → sign-off chain completes → credential/XP event.
Assert: identical component instances across runs (SubmissionRenderer/RubricGrader/FeedbackThread), status transitions per P4 §5, notifications fired, audit rows for grade/sign-off.

## 4. Tutor adaptation & text-only checks

- `tutorContext` packet per course contains its glossary/strictness/tone (snapshot diff across the three).
- Same prompt "What must I check before I start?" → HSE answer cites permit/hazard + adds strict check-question; eBay cites listing/store checks; repair cites ESD/battery safety; plain-language readability ≤ grade 8 for plainLanguage courses.
- **Text-only trap**: submit photo-only part with empty summary, ask tutor to "read my photo" → tutor responds it can only use text/summary (assert pattern), never fabricates content.
- Word/PDF path: docx report uploaded → grader ai-draft quotes extracted sentences verbatim (assert substring), labeled machine-generated.

## 5. Zero-domain-code proof (static)

- `scripts/audit-domain-neutrality.sh`: grep `modules/{ui,submission,learn,course,assessment}` for domain literals (`eBay|HSE|solder|weld|GitHub|commit|code example|VS Code`) → 0 hits (seeds/config exempt).
- Registry diff between fixtures = data rows only; component tree hash identical across the three journey runs.

## 6. Evidence & sign-off

Screenshots per breakpoint per course at key steps; P6 gates re-run on learner portal; report archived to `docs/qa/P7-<date>/`. All green = redesign spec set complete → implementation workstreams (P5) may start at W0.
