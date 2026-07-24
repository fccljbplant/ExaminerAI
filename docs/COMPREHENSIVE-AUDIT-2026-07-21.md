# ExaminerAI — Comprehensive Multi-Perspective Audit (2026-07-21)

## Executive Summary

The app has 31,137 lines of code across 70+ files. Many phases have been implemented (RBAC, audit log, three-tab redesign, daily test, analysis pipeline, charts), but a re-audit from 10 professional perspectives reveals **systemic gaps between what exists in code and what actually works end-to-end**. The pattern is consistent: models exist, APIs exist, UI components exist, but the data flow between them is broken or missing. This is the "shell without pipeline" problem, repeated across multiple features.

---

## The 10-Perspective Audit

### 1. Product Manager — Feature Completeness

**What's shipped and working:**
- Student dashboard with daily test, weekly test, practice, project, check-ins, report cards
- Teacher dashboard with 4 tabs (Overview, Psychological Health, Educational Health, Mentorship)
- Admin dashboard with 9 sub-views (Overview, Principal, Coordinator, PM, Users, Courses, Features, Passwords, System)
- AI course generation with batching for long courses
- NotebookLM AI Tutor (per-course URL, opens in new tab)
- Certificate generation + public verification
- Audit log (grade overrides, role changes, access grants)
- Ask My Teacher floating button
- Batch approve all pending students

**What's shipped but broken (the PM's biggest concern):**
- **Role system is invisible in the UI.** The admin role picker shows only 4 legacy roles (pending/student/teacher/admin). The 9 new roles (principal, administrator, developer, course_coordinator, counselor, guardian, teaching_assistant) exist in the RBAC layer and schema but cannot be assigned from the admin panel. A principal logging in falls through to the student dashboard because AppShell only recognizes "admin".
- **Dunning-Kruger chart will always be empty.** The calibration scatter chart on the Psychological tab depends on ConfidenceRating data. The analysis pipeline's `writeConfidenceRatings` function expects `input.answers` with per-question `confidenceRating`, but the daily test (rewritten as Socratic conversation) sends `conversation` instead — no `answers` array. The weekly test never captured confidence either. Result: zero ConfidenceRating rows ever written, chart permanently empty.
- **CrisisFlag is read-only.** The model exists, the API exists, the Psychological tab displays them — but nothing ever CREATES a CrisisFlag. No UI, no auto-detection pipeline, no manual flag button. The column is always empty.

### 2. Software Engineer — Code Quality

**Architecture issues:**
- `StudentDashboard.tsx`: 5,429 lines in one file. Flagged as the #1 technical risk in the original audit. Never split. Contains 15+ components crammed together (DashboardView, CheckInPanel, PracticePanel, WeeklyTestPanel, GanttChart, ReportCardPanel, FinalResultPanel, SettingsPanel, JourneyWizard, and more).
- `TeacherDashboard.tsx`: 3,675 lines. Also flagged, never split.
- `AdminDashboard.tsx`: 2,020 lines.
- `BehavioralTrendsTab` is dead code (~200 lines) — still defined at line 2274 of TeacherDashboard.tsx but never rendered (the `tab === "trends"` reference was removed in the three-tab redesign). Should be deleted.

**Consistency issues:**
- 36 `alert()` calls in components — hostile UX, flagged in the original audit, never replaced with toast notifications.
- 22 `confirm()` calls for destructive actions — no undo, no custom dialog.
- Mixed API client usage: some routes use `api.*`, others use raw `fetch()`.

**Data flow bugs:**
- The analysis pipeline (`src/lib/analysis-pipeline.ts`) has a `PipelineInput` interface with an `answers` field, but the daily test route (rewritten as Socratic conversation) passes `conversation` instead. The `writeConfidenceRatings` function silently does nothing because `input.answers` is undefined. This is a type-level silent failure — TypeScript doesn't catch it because `answers` is optional.

### 3. Principal — Institution-Level Oversight

**What the principal needs:** Can I see aggregate program health? Can I manage roles? Can I set escalation policy?

**What they'd find:**
- The AdminDashboard has a "Principal" tab — but it's visible to anyone with role="admin", not specifically to "principal" role. No role-based tab visibility.
- The principal cannot log in. AppShell routes `role === "admin"` to the admin dashboard, but `role === "principal"` falls through to `else setView("dashboard")` — the student dashboard. The principal sees a student's view, not the admin panel.
- No escalation config UI exists. The `EscalationConfig` model was never built. The audit doc references it, but it doesn't exist in the schema.
- The audit log viewer works — the principal can see grade overrides and role changes. This is the one institution-level feature that actually functions.

### 4. Course Coordinator — Curriculum Management

**What the coordinator needs:** Can I edit course content? Can I see which questions are too hard? Can I configure AI prompts per course?

**What they'd find:**
- The CoursePlanner works — coordinators can generate, edit, and assign courses. This is genuinely functional.
- The "Coordinator" tab in AdminDashboard exists but shows the same course list as the Courses tab. No cognitive-load-outlier analysis (the spec called for flagging questions that are too hard for everyone).
- Per-course AI prompt configuration exists in the schema (`aiPromptsJson`) but there's no UI to edit it — only the CoursePlanner's basic fields (name, description, tools, NotebookLM URL).
- The coordinator role is in the RBAC layer but can't be assigned from the admin panel (same role-picker gap as above).

### 5. Teacher — Daily Workflow

**What the teacher needs:** Can I see who needs help? Can I act quickly? Can I track my outreach?

**What works:**
- The teacher dashboard is functional. The 4-tab structure (Overview, Psychological Health, Educational Health, Mentorship) renders correctly.
- The student portfolio view has 9 tabs including the new Psychological/Educational/Mentorship tabs.
- Ask My Teacher button + batch approve + search/filter all work.
- The Mentorship tab's "Log touchpoint" form is fast and functional.

**What doesn't work:**
- The Psychological tab's 7 dimensions are always empty — PsychEvidence is written by the pipeline, but only when a student takes a test. The pipeline does write evidence rows (confirmed: `db.psychEvidence.createMany` at line 208). So this SHOULD work after a student takes a test — but the calibration scatter (ConfidenceRating) will still be empty (see PM finding above).
- The Educational tab's skill mastery grid falls back to on-the-fly computation from interactions — this works even without persisted SkillMastery rows. Good.
- The teacher can't create CrisisFlags. There's no "flag this student" button anywhere. If a teacher notices a concern during a conversation, they have no way to record it in the crisis system.

### 6. Student Psychologist — Emotional Impact

**What the psychologist checks:** Is the language supportive? Are surveillance terms hidden from students? Is the Dunning-Kruger signal actually being captured?

**What works:**
- Student-facing language was cleaned in Phase A (surveillance terms renamed). "Psychological Analysis" → "How You Think", "Behavioral Pattern Analysis" → "Your Learning Style", etc.
- Plagiarism scores hidden from students, shown to teachers only.
- Career Readiness gated behind 50%+ test completion.

**What doesn't work:**
- **The Dunning-Kruger calibration chart is the psychologist's #1 tool — and it's permanently empty.** ConfidenceRating rows are never written because the pipeline expects `input.answers` (from the old daily test format) but the rewritten daily test sends `conversation` (Socratic format). The weekly test never captured confidence either. This is the single biggest psychological-tools gap.
- The 7 dimensions on the Psychological tab will populate from PsychEvidence after a student takes a test (the pipeline does write these), but only 4-5 of the 7 dimensions will ever have data — SRL phase and fluency are explicitly skipped ("if there's no real evidence, skip"). So 2 of the 7 dimension cards will always say "No evidence collected for this dimension yet."

### 7. Student Counselor — Intervention Tracking

**What the counselor needs:** Can I see which students are flagged? Can I log interventions? Can I track escalation chains?

**What works:**
- The Mentorship tab shows touchpoint history with narrative timeline.
- The "Log touchpoint" form is low-friction (under 15 seconds).
- WellbeingState (Green/Amber/Red) is computed by the pipeline after each test.
- Auto-touchpoint creation on tier transition works (with 24h dedupe to avoid spam).

**What doesn't work:**
- CrisisFlags are never created. The counselor would see "No crisis flags" for every student — not because there are none, but because there's no way to create one. No "Flag this student" button on the teacher's portfolio view, no auto-detection from crisis-related language in test answers.
- The counselor role can't be assigned from the admin panel.
- If a counselor DID log in, they'd see the student dashboard (same AppShell routing bug — only "admin" is recognized, not "counselor").

### 8. Student — Daily Experience

**What the student needs:** Is it clear what to do next? Is the daily test quick and useful? Does the AI tutor work?

**What works:**
- The daily test Socratic conversation is functional — examiner asks, student answers, examiner probes, advances through 3 questions, shows score.
- The daily test panel sits right after the welcome banner — visible and actionable.
- The AI Tutor is a simple "Open NotebookLM" button — clean and reliable (no iframe issues).
- Ask My Teacher floating button is always available.
- Daily tasks reminder includes the daily test.

**What doesn't work:**
- The daily test doesn't capture confidence ratings (Low/Medium/High before each answer). The old form-based daily test had this, but the Socratic rewrite dropped it. So the student's calibration data is never collected — the Dunning-Kruger chart on their teacher's Psychological tab will always be empty.
- The student never sees their own psychological data (by design — the spec says students shouldn't see raw dimension-level evidence). But they also don't see any reframed version of it. The student has no "how am I doing psychologically" view.

### 9. Mentor — Relationship Quality

**What the mentor checks:** Is presence tracking working? Can I see who I'm neglecting? Can I log quick check-ins?

**What works:**
- The Mentorship tab's presence indicator (fine / worth a check-in / overdue) works — it pulls from `/api/messages/outreach` which tracks last-contacted timestamps.
- The touchpoint activity chart (14-day area chart) renders from real touchpoint data.
- The "Log touchpoint" form is genuinely fast — type + note + save, under 15 seconds.

**What doesn't work:**
- Presence tracking is based on MESSAGES, not touchpoints. The `/api/messages/outreach` endpoint counts messages sent to the student, not MentorshipTouchpoint rows. So if a teacher logs a touchpoint ("called student's parent") without sending a message, the presence indicator doesn't update. This is a data-flow inconsistency.
- The escalation chain status section shows touchpoints of type "escalation" or "alert_response" — but since CrisisFlags are never created, there are never any escalations to track.

### 10. QA — Testing and Reliability

**Test coverage:** 134 tests, all pure-function unit tests. Zero route tests. Zero E2E tests. No integration tests for the analysis pipeline.

**Critical untested paths:**
- The analysis pipeline (`runAnalysisPipeline`) has zero tests. It's the most critical new code — it writes to 5 tables — but no test verifies that a weekly test completion actually produces PsychEvidence/ConfidenceRating/WellbeingState/SkillMastery/MentorshipTouchpoint rows.
- The daily test Socratic flow has zero tests. The state machine (start → reply → advance → complete) is complex and untested.
- The RBAC layer has zero tests. `requireRole()` and `hasRole()` are critical security functions with no test coverage.

**Manual testing findings:**
- 36 `alert()` calls remain — hostile UX, should have been replaced with toast notifications years ago.
- 22 `confirm()` calls — no custom dialogs, no undo.
- The `BehavioralTrendsTab` function is dead code that still compiles — a maintenance burden.

---

## Prioritized Fix Plan

### P0 — Critical (broken core functionality, fix now)

1. **Fix the role picker UI** — add all 9 roles to the admin Users tab dropdown
2. **Fix AppShell role routing** — recognize principal/administrator/developer/counselor/course_coordinator and route them to the admin dashboard (not student dashboard)
3. **Fix the ConfidenceRating pipeline** — add a pre-answer confidence step to the daily test Socratic flow, pass it through to the pipeline
4. **Remove dead BehavioralTrendsTab code** — ~200 lines of dead code

### P1 — High (missing features that block real use)

5. **Add "Flag this student" button** — let teachers create CrisisFlags from the portfolio view
6. **Fix presence tracking** — base it on MentorshipTouchpoint rows, not just messages
7. **Add role-based tab visibility in AdminDashboard** — principal tab visible to principal+administrator, system tab visible to developer+administrator, etc.

### P2 — Medium (code quality, UX polish)

8. **Replace `alert()` with toast notifications** — 36 call sites
9. **Replace `confirm()` with custom dialogs** — 22 call sites
10. **Split StudentDashboard.tsx** — 5,429 lines → extract into sub-components

### P3 — Low (future work)

11. **EscalationConfig model + UI** — not built, referenced in docs
12. **WellbeingState history chart** — needs a snapshot table for time-series
13. **Route tests + E2E tests** — zero coverage currently
14. **Cognitive-load-outlier analysis** — flag questions that are too hard for everyone

---

## P1 Fix Update (2026-07-21, same session)

### P1.1 — CrisisFlag creation UI ✅ FIXED

**Problem:** CrisisFlag model existed, API GET existed, Psychological tab displayed them — but nothing ever CREATED one. Teachers had no way to flag a student.

**Fix:**
- `POST /api/crisis-flags` — creates a flag with category + severity. Validated input, audit-logged, auto-creates a MentorshipTouchpoint so the Mentorship tab shows it immediately.
- `PATCH /api/crisis-flags` — resolve/acknowledge flags.
- "Flag this student" button on the Psychological tab (always visible, not just when flags exist).
- Flag creation form: category dropdown (6 options: behavioral_concern, academic_crisis, severe_distress, disclosure, self_harm_risk, other) + severity selector (amber/red).
- Existing flags show with resolve button (green checkmark) for open flags.
- Crisis flags card is ALWAYS shown (was previously hidden when empty).

### P1.2 — Presence tracking includes touchpoints ✅ FIXED

**Problem:** `/api/messages/outreach` only counted Messages, not MentorshipTouchpoints. Logging a touchpoint ("called student's parent") didn't update the presence indicator.

**Fix:** The outreach endpoint now fetches both messages AND touchpoints in parallel, merges them by taking the most recent contact from either source. Touchpoint notes appear as `[checkin] Quick check-in...` in the last-subject field.

### P1.3 — Role-based admin tab visibility ✅ FIXED

**Problem:** All admin tabs were visible to all admin-equivalent roles. A developer could see the Users tab (change roles), a principal could see the System tab (deploy config).

**Fix:** AdminDashboard now fetches the current user's role and conditionally renders tabs:
- **Overview, Coordinator, Operations, Courses** → visible to all admin-equivalent roles
- **Principal** → visible to principal + administrator only
- **Users** → visible to principal + administrator (user management roles)
- **Features, Resets** → visible to administrator only (not developer, not principal)
- **System & Dev** → visible to developer + administrator

### Verification

- `npx tsc`: clean
- `npm test`: 134/134 pass
- `npm run build`: succeeds

### Remaining P2/P3 items (documented for future sessions)

- **P2.1:** Replace 36 `alert()` calls with toast notifications
- **P2.2:** Replace 22 `confirm()` calls with custom dialogs
- **P2.3:** Split `StudentDashboard.tsx` (5,429 lines → sub-components)
- **P3.1:** EscalationConfig model + UI
- **P3.2:** WellbeingState history chart (needs snapshot table)
- **P3.3:** Route tests + E2E tests (zero coverage)
- **P3.4:** Cognitive-load-outlier analysis (flag questions too hard for everyone)
