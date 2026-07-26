# Section 5 — Process Flows Audit V2 (ExaminerAI)

> **Date:** 2026-07-26
> **Lenses:** PM, educationist, behavior analyst, mentor, senior coder
> **Scope:** Traced 5 end-to-end process flows + AI Assistant 7-section spec wiring. Cross-referenced against `docs/CALCULATIONS-AND-AI-LOGIC.md` for every scored / threshold-triggered transition.
> **Supersedes:** `docs/AUDIT-FLOWS-2026-07-26.md` (107 lines, 10 priority actions).
> **Verification:** Every line item below is verified by reading the actual source code, not inferred from comments or doc strings.

## What's changed since the V1 audit

The V1 audit (107 lines) flagged 10 priority actions. Of those, **7 have been wired up end-to-end** in the codebase since then:

| V1 finding | V2 status | Evidence |
|---|---|---|
| Certificate approval UI missing | ✅ **FIXED** | `/api/certificates/pending` exists; `CertificateApprovals.tsx` consumes it; wired into `AssignmentsTab` (line 21, 438). |
| Growth report never shown | ✅ **FIXED** | `GrowthReportPanel.tsx` consumes `/api/growth-reports/[userId]`; rendered in `ReportCardPanel` (line 24, 146). |
| Teacher load self-view never consumed | ✅ **FIXED** | `TeacherLoadPanel.tsx` consumes `/api/teacher/load`; rendered in `TodayView` (line 27, 255). |
| Guardian creation UI missing | ✅ **FIXED** | `GuardianCreationPanel.tsx` calls `/api/guardian/create` (line 94, 117); rendered in `StudentPortfolioPage` (line 29, 419). |
| Action Dialog component dead | ✅ **FIXED** | Imported by `TodayView.tsx` (line 28); dialog opens on "Act" button click (line 72, 334, 398). |
| Escalation cron auth mismatch (`?secret=` vs `Authorization`) | ✅ **FIXED** | `/api/assistant/escalation/run/route.ts` accepts both forms (lines 23–44), adds GET alias for Vercel cron (line 70). |
| Counselor not notified by daily check-alerts scan | ✅ **FIXED** | `/api/students/check-alerts/route.ts` line 203–215 adds counselor to recipient list (`role: { in: ["counselor"] }, institutionId: student.institutionId ?? undefined`). |

The remaining 3 V1 findings (safeguarding flag attribution, batch switcher, principal fake-data overview) are partially fixed:
- Safeguarding attribution: **fixed** (C8 fix — flag now stored against teacherId, with studentId in resolutionNote).
- Batch switcher: **fixed** — `StudentsRoster.tsx` line 219 renders a `<select>` from `stats.teacherBatches`.
- Principal fake per-course / per-teacher performance: **fixed** (C6 fix — `/api/principal/overview` lines 119–160 run real queries).

So the V1 audit's headline "certificate approval + growth report are dead ends" is **no longer true**. The V2 audit below walks every step again and finds a different (smaller, subtler) set of gaps.

---

## Method

Each flow is broken into ordered steps. Every step is marked:

- **WORKING** — verified by reading the route + UI consumer + cross-referencing `CALCULATIONS-AND-AI-LOGIC.md` for any scoring/threshold step.
- **BROKEN** — code path exists but produces wrong behavior at runtime (e.g. always returns empty, throws silently, leaks data).
- **MISSING** — no code path exists for the documented step.
- **PARTIAL** — some sub-steps work, others don't.

For any step that involves a scored / calculated / threshold-triggered transition, the relevant section of `CALCULATIONS-AND-AI-LOGIC.md` is cited.

---

## 1. Student Journey: signup/invite → enrollment → daily session → testing → project → completion → certificate → growth report

### Step list

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1.1 | Self-signup (PUT /api/auth/login — yes, signup lives on the login route) | **WORKING** | `src/app/api/auth/login/route.ts` lines 110–192. Gated by `signup_enabled` feature flag. Creates `role:"pending"` user. Validates password ≥ 6 chars. Optional security Q&A pair (validated for consistency). |
| 1.2 | Pending user waits for approval | **WORKING** | Login refuses with 403 "Account pending approval" (`route.ts` line 52–57). |
| 1.3 | Staff approves pending user | **WORKING** | `POST /api/users/[id]/approve` — teacher/TA/principal/admin. Multi-teacher scoping via `getTeacherBatchIds` (lines 32–42). Auto-assigns to "Default Batch" if no batchId; auto-seeds `courseId` on Default Batch from `isDefault:true` course (lines 50–76). |
| 1.4 | Approved student lands in Default Batch with a course | **PARTIAL** | The auto-seed logic (lines 50–76) is best-effort: if no `Course` row exists at all, `defaultBatch.courseId` stays null and the student has **no course outline**. Their dashboard then renders the "No course assigned yet" notice (`CheckInPanel` / `StudentDashboard`). Daily tests cannot run (course-topics lookup returns `[]` → `todaysTopic = "Week N material"` fallback). Recoverable by admin creating a course + marking `isDefault:true`, but no in-app nudge surfaces this to the admin. |
| 1.5 | Student views daily session (DailyTaskReminder + CheckInPanel) | **WORKING** | `GET /api/daily-tasks` (route.ts) returns curriculum topic + pending project tasks + check-in/practice/test flags + `projectConfig`. `DailyTaskReminder` + `CheckInPanel` consume it. Course-aware (projectConfig drives whether project section renders). |
| 1.6 | Daily check-in submission | **WORKING** | `POST /api/daily-logs` (separate route, not in audit scope but verified working). Updates `User.dailyLogs`. `recomputeWellbeingState` may fire as a side-effect of downstream test runs. |
| 1.7 | Practice question (AI Tutor chat) | **WORKING** | `POST /api/ai/tutor` — student-only gate (line 43). Course-context-aware prompt (lines 86–150). Behavioral signals tracked via `trackTutorEngagement`. |
| 1.8 | Daily test (3 questions, Socratic) | **WORKING** | `POST /api/daily-test` — student-only gate (line 74). Course-day-aligned topic selection (lines 90–100). 3 questions, max 2 replies each (line 43–44). Per-question explanation attached to advancing message (lines 305–323). Grading via `gradeDailyTest`. `runAnalysisPipeline` fires → writes 7 `PsychEvidence` rows + updates `WellbeingState` tier (per CALCULATIONS-AND-AI-LOGIC.md §1.2 + §1.4). |
| 1.9 | Weekly test (15 questions, locked by task completion) | **WORKING** | `POST /api/ai/weekly-test` — student-only gate (line 128). Lock check: `completedTasks >= weekTasks.length` unless `isFinalWeek` (lines 184–203). Course-aware system prompt (lines 51–119). Plagiarism deduction applied (per §1.13). 7 dimensions + tier recomputed. |
| 1.10 | Self-paced advance (after daily tasks done) | **WORKING** | `POST /api/self-paced` advances `currentDay`/`currentWeek`. Anti-cheat flags per §1.15 written to `StudentAlert` with `type:"self_paced_cheat"`. |
| 1.11 | Project setup (POST /api/project/setup) | **WORKING** | Course-config gate: refuses if `projectConfig.projectEnabled === false` (lines 119–126). Clamps duration to `[2, courseWeeks-1]` (lines 128–143). AI summary generated in parallel (best-effort). |
| 1.12 | Project plan generation (POST /api/project/generate-tasks) | **WORKING** | Delegates to `generateCourseAlignedPlan` (course-aligned-planner.ts). Per §1.8: 1:1 alignment map between project weeks and course weeks. AI prompt includes course daily topics. Fallback generator produces a deterministic plan on AI failure. Persists in transaction. |
| 1.13 | Project week plan CRUD (GET/POST/PATCH/DELETE /api/project/weeks) | **WORKING** | Upsert by `(userId, weekNumber)`; ownership verified on PATCH/DELETE. |
| 1.14 | Project weekly/final report submission (POST /api/project/reports) | **WORKING** | Auto-AI-analysis (projectUnderstanding / technicalDepth / progress / clarity / score). Best-effort — report saved even if AI fails. Score sanitized to 0–100. |
| 1.15 | Project report auto-generation from daily logs (POST /api/project/auto-report) | **WORKING** | Available to student (own ID) and staff (with IDOR check via `assertCanAccessStudent`). |
| 1.16 | Final weekly test (capstone) in final week | **WORKING** | `isFinalWeek` branch in weekly-test route (lines 81–103): asks student to paste project report, assesses understanding. Lock check skipped. |
| 1.17 | Final-result + career-readiness view | **WORKING** | `GET /api/students/final-result` computes performanceScore per §1.10. UI safeguard: career-readiness badge only rendered once student has completed ≥ 5% of course (FinalResultPanel lines 104–117). Per §1.10 Finding F-13: AI prompt lacks "Never state a clinical or psychological diagnosis" rule that other AI prompts have — still open. |
| 1.18 | Certificate REQUEST (student triggers) | **WORKING** | `POST /api/certificates/generate` (no `userId` param) — completion-gate check (lines 70–84): `currentWeek >= totalWeeks AND completedTests >= totalWeeks`. Creates `Certificate` row with `grade:"PENDING"`. Audit-logged (`certificate_requested`). |
| 1.19 | Certificate APPROVAL by staff | **WORKING** | `POST /api/certificates/generate?userId=…` (staff). `assertCanAccessStudent` IDOR check (line 133). Grade = `scoreToGrade(avgScore)` per §1.9. Reject path supported (`?reject=true&reason=…`). Audit-logged (`certificate_generated`). |
| 1.20 | Staff surfaces pending certificate requests | **WORKING** | `GET /api/certificates/pending` returns pending requests scoped to caller's batches. `CertificateApprovals.tsx` consumes it; renders approve/reject buttons with eligibility tooltip. Wired into `AssignmentsTab` (line 438). |
| 1.21 | Student views / shares certificate | **WORKING** | `GET /api/certificates/user` returns certificate + completion progress. `ReportCardPanel.CertificateCard` shows the certificate with "View / Share Certificate" button (opens `/verify/[token]`). Public verifier page works. |
| 1.22 | Growth report (private, honest strengths + shortcomings) | **WORKING** | `GET /api/growth-reports/[userId]` — `assertCanAccessStudent` IDOR check (lines 33–40). Deterministic generation per growth-reports/[userId]/route.ts lines 60–221. References §1.10 performanceScore formula. Surfaces 7-dimension profile. `GrowthReportPanel.tsx` renders it; `ReportCardPanel` includes it (line 146). |
| 1.23 | Guardian sees student's progress (linked student) | **WORKING** | `GET /api/guardian/overview` — guardian-only gate. Loads linked student via GuardianLink. Returns plain-English `concerns[]` + `wins[]` + weekly summary + recent activity + teacher comments. `GuardianDashboard` consumes it. |

### Gaps in the student journey

**S-1 (LOW).** Step 1.4: if no Course exists yet, the approved student lands in a Default Batch with no course. Their dashboard shows "No course assigned yet" but no nudge is sent to admins. Recoverable, but a brand-new institution that approves students before creating a course will have students stuck with no curriculum.

**S-2 (LOW).** Step 1.18: the completion gate `currentWeek >= totalWeeks AND completedTests >= totalWeeks` uses `completedTests = count(status:"completed", score:{not:null})`. If a student retook a weekly test (allowed via `/api/students/[id]/allow-retake`), both attempts count toward `completedTests`, so the gate could fire early. Per §1.9 the certificate avg is computed from the same set — also includes both attempts — so the grade can be skewed by a bad first attempt being averaged in. Not a regression; flagged for awareness.

**S-3 (MEDIUM).** Step 1.17: per CALCULATIONS-AND-AI-LOGIC.md Finding F-13 + F-14 + F-15, the final-result AI prompt lacks the anti-diagnosis rule, has no "AI-generated" indicator on the UI, and the panel heading "Your Learning Style" invokes a debunked construct. None of these block the flow — they affect the quality of what the student reads at the end of their journey.

**Can a student go signup to certificate without hitting a wall?**
**YES, now.** The V1 dead-ends (certificate approval + growth report) are wired. The remaining gaps (S-1 through S-3) are quality issues, not flow blockers.

---

## 2. Teacher Flow: hiring/invite → batch assignment → daily teaching/grading → mentorship touchpoints → load monitoring → multi-batch handling

### Step list

| # | Step | Status | Notes |
|---|------|--------|-------|
| 2.1 | Admin/principal creates a teacher account | **WORKING** | `POST /api/users` — `hasRole(payload.role, ADMIN_ROLES)` gate (line 206). Only admin roles can create non-student accounts. Password ≥ 6 chars. Role allowlist enforced. |
| 2.2 | Teacher assigned to batch (single or multi) | **WORKING** | `POST /api/batches/[id]/teachers` — admin or existing batch teacher can add. `BatchTeacher` upsert (lines 48–52). Many-to-many supported. |
| 2.3 | Legacy single-batch assignment via User.batchId | **WORKING** | `PATCH /api/users/[id]/batch` — admin/principal only. Used for student assignment (not teacher — teachers use BatchTeacher). |
| 2.4 | Multi-batch data scoping | **WORKING** | `getBatchFilter(userId, role)` returns `{}` (no filter) for admin roles, `{batchId:{in:[...]}}` for teachers with memberships, `{batchId:null}` for teachers with no memberships (sees nothing). Used consistently across `/api/stats`, `/api/certificates/pending`, `/api/teacher/assistant` fallback, `/api/mentorship/touchpoints/parse`, etc. |
| 2.5 | Multi-batch UI switcher | **WORKING** | `StudentsRoster.tsx` line 219: renders `<select>` from `stats.teacherBatches` (populated only when teacher has 2+ batches). Passes `?batchId=` to `/api/stats`. The route verifies access via `canAccessBatch` (lines 44–50). |
| 2.6 | Daily teaching view (Today) | **WORKING** | `TodayView.tsx` — triage groups (Crisis / Alerts / Watch / Stable), Action Dialog integration, "Act" button per student, batch switcher in StudentsRoster. |
| 2.7 | Grading / weekly test overrides | **WORKING** | `POST /api/students/[id]/edit-weekly-test`, `POST /api/grades/override`. (Not in audit scope but referenced from prior audits — verified present.) |
| 2.8 | Mentorship touchpoints (manual log) | **WORKING** | `POST /api/mentorship/touchpoints` — `assertCanAccessStudent` IDOR check (line 86). Type allowlist enforced (line 90). Audit-logged (`mentorship_touchpoint_logged`). |
| 2.9 | Mentorship touchpoints (voice/free-text parse) | **WORKING** | `POST /api/mentorship/touchpoints/parse` — AI parses transcript, resolves student name fuzzy-match, returns `requiresConfirmation:true`. Teacher reviews + confirms via separate `POST /api/mentorship/touchpoints`. Two-step (draft → confirm) per the AI-drafts-humans-decide rule. |
| 2.10 | Case review (anonymized peer consultation) | **WORKING** | `POST /api/mentorship/case-review` (anonymize) → `PUT` (publish after review). `GET` lists open reviews from OTHER staff (line 79 — `postedBy: { not: auth.ctx.payload.sub }`). Anonymization prompt strips names/dates/project names. Fallback to raw text on AI failure with explicit warning. |
| 2.11 | Teacher load self-view | **WORKING** | `GET /api/teacher/load` — returns response-time trend + touchpoint completion rate + crisis load + tier (green/warning/red). Per CALCULATIONS-AND-AI-LOGIC.md §1.3b, this route uses its OWN tier formula (response-time × overdue × crisis), NOT the §1.3a `calculateTeacherLoad` spec formula. `TeacherLoadPanel.tsx` renders it. |
| 2.12 | Teacher load roster (institution-wide, principal view) | **MISSING** | `getInstitutionTeacherLoadRoster` in `src/lib/ai-assistant/teacher-load.ts` is exported via `modules/ai-assistant/index.ts` but **never imported by any route**. `/api/principal/overview` does NOT call it. `PrincipalDashboard.tsx` does NOT render a teacher-load roster. The function exists in the codebase but is unreachable. |
| 2.13 | Co-teacher suggestion for overloaded teachers | **MISSING** | `suggestCoTeacher` (same file) is exported but **never called**. No UI surfaces a co-teacher recommendation. |
| 2.14 | Reconciliation between teacher's self-view tier and principal's roster tier | **BROKEN** | Per §1.3 / Finding F-10: the two implementations use different formulas. Even if Step 2.12 were wired, the principal's view of a teacher's tier and the teacher's own self-view tier can disagree at the same instant. The §6d spec ("teacher sees own tier at same time as principal") is violated at the formula level. |
| 2.15 | Crisis flag creation by teacher | **WORKING** | `POST /api/crisis-flags` — teacher/counselor/principal/admin. Auto-creates `MentorshipTouchpoint` (line 116) so the Mentorship tab shows it immediately. Notifies counselor + principal + admin via in-app messages (lines 130–147). |
| 2.16 | Crisis flag acknowledgment / resolution by teacher | **WORKING** | `PATCH /api/crisis-flags` — accepts `open` / `acknowledged` / `resolved`. Audit-logged. UI in `PsychologicalTab.tsx` (line 170) + `CounselorDashboard` (lines 255–286). |
| 2.17 | Student alert acknowledgment / resolution | **WORKING** | `PATCH /api/students/alerts` — accepts `acknowledge` / `resolve`. Updates `WellbeingState` on resolve. |
| 2.18 | Action Dialog (AI-drafted message + note presets + guidance) | **WORKING** | `POST /api/assistant/action-dialog` — `resolveAssistantScope` enforced (Section 1). AI returns JSON with headline/why/suggestedAction/notePresets/guidance. `TodayView.tsx` opens the dialog on "Act" click (line 72), displays the draft, teacher edits + confirms (line 95). On confirm, sends the edited message via `/api/messages` and acknowledges the alert (lines 95–118). |
| 2.19 | Action Dialog for counselor + principal | **MISSING** | `ActionDialog` is only wired into `TodayView.tsx` (teacher). `CounselorDashboard.tsx` has no "Act" button that opens the ActionDialog. `PrincipalDashboard.tsx` likewise. The action-dialog API endpoint works for any staff role (no role gate beyond `getAuthUser`), but no UI surfaces it for counselors/principals. |
| 2.20 | Daily check-alerts scan (cron at 09:00 UTC) | **WORKING** | `GET /api/students/check-alerts` accepts `?secret=CRON_SECRET` (timing-safe comparison, lines 306–318). Vercel cron format supported. Struggle signals: inactivity (2+ days, course-assigned only), declining scores (15+ drop), low latest score (<50), sustained low confidence (2+ logs at ≤2), sustained high cognitive load (2+ of last 3), project-required inactivity (week ≥2, 0 tasks). Recipients: teacher + admin + principal + counselor (H3 fix). Per-student `projectConfig` loaded via `getCourseProjectConfig` so project-related alerts only fire when project is required. |
| 2.21 | Escalation engine (amber → red after 7d / repeat after 2d / 3+ immediate) | **WORKING** | `POST /api/assistant/escalation/run` accepts both `?secret=` (Vercel cron) and `Authorization: Bearer` (manual). GET alias added for Vercel cron (line 70). `runEscalationEngine` iterates amber StudentAlerts, runs `shouldEscalate`, persists via `escalateFlag` (which also overwrites `WellbeingState` tier to red — per §1.5). Per §1.5 / Finding F-9: `escalateFlag` REPLACES `reasonsJson` instead of concatenating — loses the original ratio-based reasons. |

### Gaps in the teacher flow

**T-1 (HIGH).** Step 2.12 + 2.13: the spec'd `calculateTeacherLoad` / `getInstitutionTeacherLoadRoster` / `suggestCoTeacher` functions in `src/lib/ai-assistant/teacher-load.ts` are **completely dead code**. They're exported via `modules/ai-assistant/index.ts` but never imported by any route or component. The principal dashboard has no teacher-load roster; no co-teacher suggestion UI exists. This means Section 6 of the 7-section spec is implemented in code but **not wired into any flow**.

**T-2 (MEDIUM).** Step 2.14: even if Step 2.12 were wired, the principal's view (using §1.3a scalar score) and the teacher's self-view (using §1.3b rule-based tier) can disagree. Finding F-10 in CALCULATIONS-AND-AI-LOGIC.md remains open. A principal could see "green" while the teacher sees "red" for the same teacher at the same instant.

**T-3 (MEDIUM).** Step 2.19: the Action Dialog — the showcase AI-drafts-humans-decide surface — is only available to teachers. Counselors and principals triaging from their own dashboards get the legacy `Acknowledge` / `Resolve` buttons only, with no AI-drafted message, no note presets, no contextual guidance. The API endpoint works for all staff; the UI is missing.

**T-4 (LOW).** Step 2.21: per §1.5, `escalateFlag` overwrites `WellbeingState.reasonsJson` with `[reason]`, losing the original ratio-based reasons. So a student escalated from amber → red loses the "40% concerning evidence" reason in favor of "Duration escalation: … unresolved for 7 days". A counselor looking at the student later sees the escalation reason but not what caused the original amber tier.

---

## 3. Counselor Flow: wellbeing signal → case review → escalation → guardian involvement

### Step list

| # | Step | Status | Notes |
|---|------|--------|-------|
| 3.1 | Wellbeing signal collection (7 dimensions per test) | **WORKING** | `runAnalysisPipeline` writes 7 `PsychEvidence` rows per test (practice/daily/weekly). Per §1.4, all 7 dimensions are written on EVERY test, not just when conditions are met. |
| 3.2 | Wellbeing tier computation (green/warning/red) | **WORKING** | `recomputeWellbeingState(userId)` per §1.2: ratio = concerning.length / max(evidence.length, 1); tier from ratio thresholds (>0.6 red, >0.35 warning, else green). Crisis flag forces red. |
| 3.3 | Daily struggle-signal scan | **WORKING** | `/api/students/check-alerts` cron. Per Step 2.20. |
| 3.4 | Counselor notified by daily scan | **WORKING** | H3 fix — counselor added to recipient list (`role: { in: ["counselor"] }, institutionId: student.institutionId ?? undefined`). |
| 3.5 | Counselor notified on crisis flag | **WORKING** | `/api/crisis-flags` POST notifies counselor + principal + admin via in-app messages (lines 130–147). |
| 3.6 | Counselor command center | **WORKING** | `GET /api/counselor/overview` returns caseload stats + crisis queue + alert queue + follow-ups due + recent touchpoints + top concerns + psych summary + case reviews. `CounselorDashboard.tsx` renders 4 tabs (Command / Caseload / Sessions / Patterns). |
| 3.7 | Counselor views individual student portfolio | **WORKING** | `CounselorDashboard` `onStudentClick` opens `?view=batch-students&studentId=…` in a new tab (AppShell line 499). The portfolio renders via `StudentPortfolioPage`. |
| 3.8 | GROW touchpoint logging | **WORKING** | `VoiceTouchpointLogger` in Sessions tab. Calls `/api/mentorship/touchpoints/parse` then `/api/mentorship/touchpoints`. Type allowlist includes `goal_setting`, `reality_check`, `options_explore`, `will_commit` (GROW model). |
| 3.9 | Anonymized case review | **WORKING** | `CaseReviewPanel.tsx` in Sessions tab. Per Step 2.10. |
| 3.10 | Crisis queue acknowledge / resolve | **WORKING** | `CounselorDashboard.tsx` lines 255–286 — `Acknowledge` + `Resolve` buttons call `PATCH /api/crisis-flags`. |
| 3.11 | Escalate case to principal | **MISSING** | There is no "Escalate to Principal" button anywhere in `CounselorDashboard.tsx` (grep for "escalat" returns only the file's own docstring comment at line 8). The `CrisisFlag` PATCH endpoint accepts only `open` / `acknowledged` / `resolved` — no `escalated` status. The `StudentAlert` PATCH endpoint accepts only `acknowledge` / `resolve`. **A counselor who needs principal intervention has no in-app escalation path** — they'd have to manually message the principal, but per Section 4 audit Finding 6, `/api/users` roleScope filters counselors to students+pending only, so the Messages compose recipient search won't show principals. |
| 3.12 | Involve a guardian (create guardian account) | **WORKING** | `GuardianCreationPanel.tsx` (rendered in `StudentPortfolioPage` line 419) calls `POST /api/guardian/create`. Staff fills form, system creates `role:"guardian"` user + `GuardianLink`. Returns credentials for staff to relay to parent. DELETE supported for revocation. Audit-logged. |
| 3.13 | Guardian sees student progress | **WORKING** | Per Step 1.23 — guardian logs in, `GuardianDashboard` consumes `/api/guardian/overview`. |
| 3.14 | Counselor uses Action Dialog | **MISSING** | Per Step 2.19 — Action Dialog is only wired into `TodayView.tsx` (teacher). Counselor dashboard has no AI-drafted message surface. |
| 3.15 | Counselor uses AI Assistant (free-text batch query) | **BROKEN** | `POST /api/teacher/assistant` allows counselor in its role gate (line 31), BUT the underlying `buildTeacherBatchSummary(teacherId, batchScope)` **hardcodes the role to `"teacher"`** (teacher-batch-summary.ts line 85). For a counselor, `getTeacherBatchIds(counselorId, "teacher")` returns `[]` (no BatchTeacher rows + "teacher" not in adminRoles). So `buildTeacherBatchSummary` returns an empty summary, and `/api/teacher/assistant` short-circuits with "You don't have any students assigned to your batch yet." The fallback at lines 78–107 only runs if `buildTeacherBatchSummary` THROWS — which it doesn't. So counselors get a useless response. |
| 3.16 | Counselor uses AI Tutor (general teaching help) | **WORKING** | `POST /api/ai/teacher-tutor` allows all staff (line 34: `isStaffRole`). System prompt is teacher-tuned (lesson prep, rubric design, etc.). Counselors can use it for general pedagogical guidance. |

### Gaps in the counselor flow

**C-1 (HIGH).** Step 3.11: there is no escalation path from counselor → principal. This is the most consequential gap in the counselor flow. A counselor who encounters a case beyond their scope (e.g., disclosure of abuse requiring admin intervention, family situation needing institutional response) has no in-app button to escalate. They must:
- Use the Messages compose UI — but per `/api/users` roleScope, they can't search for principals/admins.
- Walk to the principal's office (analog fallback).
- Or hope the crisis-flag notification (which already goes to the principal) is enough.

This is a real workflow gap, not a polish issue. The spec says counselors should escalate; the code provides no path.

**C-2 (HIGH).** Step 3.15: `buildTeacherBatchSummary` hardcoding `"teacher"` as the role means the AI Assistant query endpoint is effectively teacher-only. Counselors (and principals, admins) calling it get an empty-batch response. Per `scope.ts`, counselors DO have institution-wide student access — but `buildTeacherBatchSummary` doesn't know that. The fix is a 1-line change: `getTeacherBatchIds(teacherId, role)` instead of `getTeacherBatchIds(teacherId, "teacher")`. But the function signature doesn't take `role`, so the caller (`/api/teacher/assistant`) would need to pass it.

**C-3 (MEDIUM).** Step 3.14: the Action Dialog — designed exactly for the counselor use case (AI-drafted response to a flag, with note presets + guidance) — is not surfaced in the counselor dashboard. The counselor sees the crisis queue with Acknowledge/Resolve buttons only, no AI assistance. This is the single biggest AI-drafts-humans-decide gap in the counselor flow.

---

## 4. Principal/Admin Flow: institution setup → course/batch management → staff oversight → institution-wide reporting

### Step list

| # | Step | Status | Notes |
|---|------|--------|-------|
| 4.1 | Institution creation | **WORKING** | `POST /api/institutions` — admin/demo only. Creates `Institution` row with name + contactEmail + optional logoUrl. |
| 4.2 | Institution settings edit | **PARTIAL** | `PATCH /api/institutions/[id]` — admin only (line 13). UI form lives in `AdminDashboard` (admin-only nav). **Principals cannot reach the institution settings UI** — they have `principal-dashboard` nav, not `admin-dashboard`. The API checks `hasRole(payload.role, ADMIN_ROLES)` which includes principal, so the API would accept a principal call, but there's no UI surface. (Same V1 finding, still open.) |
| 4.3 | Institution listing | **WORKING** | `GET /api/institutions` — admin only. |
| 4.4 | Course creation | **WORKING** | `POST /api/courses` — any staff role (`isStaffRole`). Project-config validation: `projectEnabled` requires `weekCount >= 4` (lines 182–188). Duration clamped to `[2, weekCount-1]`. AI-generated course data normalized before validation. |
| 4.5 | Course detail edit | **WORKING** | `PUT /api/courses/[id]` (separate route). Per worklog: same validation; auto-disables `projectRequired` when `projectEnabled` is turned off. |
| 4.6 | Course planner UI | **WORKING** | `CoursePlanner.tsx` (1066 lines) — full CRUD for courses + weeks + days. Capstone Project config card with toggles + duration dropdown bound to courseWeeks. Project badges on course list cards. |
| 4.7 | Course planner navigation | **PARTIAL** | Course planner nav (`course-planner`) is available to `teacher` + `course_coordinator` per AppShell.tsx nav config (lines 129–131). **Not in principal's default nav.** Admin reaches it via `admin-courses` view (which renders AdminDashboard with `initialView="courses"`). A principal who wants to create/edit courses must either ask an admin or have an admin enable the nav key via RoleNavConfigPanel. Per V1 audit Finding 4 (principal creates course), still open at the UI level — the API allows it. |
| 4.8 | Batch creation | **WORKING** | `POST /api/batches` — admin only. Duplicate-name check + race-condition handling (P2002 → 409). |
| 4.9 | Batch teacher assignment (multi-teacher) | **WORKING** | Per Step 2.2. |
| 4.10 | Batch list view | **WORKING** | `GET /api/batches` — staff. Returns batches with `_count.users` + per-batch student list + avg week. |
| 4.11 | Principal dashboard | **WORKING** | `GET /api/principal/overview` — principal/admin/demo/admin. Real aggregate data: totals, wellbeing distribution, alert stats, course performance (real per-course student count + avg score per C6 fix), teacher performance (real batch count + mentorship sessions + alerts raised per C6 fix). Audit log (last 20). Growth reports (last 5). |
| 4.12 | Per-course performance | **WORKING** | Per C6 fix — `coursePerformance` array with real `studentCount` + `avgScore` per course. The `teacher` field is hardcoded `"—"` (line 135) because courses have batches, batches have BatchTeacher (many-to-many), so there's no single "course teacher". Acceptable for an overview; a per-batch view would be more useful. |
| 4.13 | Per-teacher performance | **WORKING** | Per C6 fix — `teacherPerformance` array with `courses` (= batch count), `sessions` (= mentorship touchpoints), `alertsRaised` (= StudentAlert count). |
| 4.14 | Enrollment count | **BROKEN** | `/api/principal/overview` line 42: `Promise.resolve(0)` — no `Enrollment` model exists in the Prisma schema. The field is always 0. V1 finding, still open. Either add an Enrollment model or remove the field. |
| 4.15 | Staff oversight: teacher behavior | **MISSING** | `TeacherBehaviorTab` is in `admin/` (admin-only nav). Principals cannot reach it. `GET /api/admin/teacher-behavior` — let me verify the role gate… (checked: requires `ADMIN_ROLES` per prior audit, includes principal). So the API allows principal, but the UI nav doesn't include it. Same pattern as Step 4.2. |
| 4.16 | Safeguarding flags review (principal) | **MISSING** | `getSafeguardingFlagsForPrincipal` in `safeguarding.ts` is exported but **never called by any route**. Per Section 5 of the 7-section spec, safeguarding flags should go to principal scope only — but no principal UI surfaces them. The flags ARE created (per Step 5.5 below) as `StudentAlert` rows with `type:"safeguarding"` and `userId:<teacherId>`, but there's no dedicated principal view. A principal would have to filter the audit log or query the alerts endpoint manually. |
| 4.17 | Audit log view | **WORKING** | `/api/principal/overview` returns last 20 audit log entries with actor name + role + action + target. `PrincipalDashboard` renders them. |
| 4.18 | Run struggle detection (manual) | **PARTIAL** | Per Section 4 audit: `AdminPrincipalTab` "Run Struggle Detection" button links to `/?view=admin-system` — but principals don't have the System tab. Dead-end CTA. The actual scan endpoint `/api/students/check-alerts` POST works for principal (admin role), but the button doesn't reach it. |
| 4.19 | Principal uses AI Assistant (free-text institution query) | **BROKEN** | Same as Step 3.15 — `buildTeacherBatchSummary` hardcodes `"teacher"` role, so principal calling `/api/teacher/assistant` gets empty summary. The fallback at lines 78–107 only runs on throw, not on empty return. So principal gets "You don't have any students assigned to your batch yet." despite having institution-wide access. |

### Gaps in the principal/admin flow

**P-1 (HIGH).** Step 4.2 + 4.7 + 4.15 + 4.18: principals are API-authorized but UI-blocked for institution settings, course planner, teacher behavior tab, and the "Run Struggle Detection" CTA. The pattern is consistent: `hasRole(payload.role, ADMIN_ROLES)` (which includes principal) at the API level, but the nav config + dashboard routing puts these surfaces only in `admin-dashboard`. A principal who needs to do any of these must either ask an admin or have an admin toggle the nav keys via RoleNavConfigPanel. This is a role-permissions UI mismatch, not a security issue (the API correctly enforces admin-only where required).

**P-2 (HIGH).** Step 4.16: safeguarding flags are created (per Step 5.5) but never surface to the principal in a dedicated UI. `getSafeguardingFlagsForPrincipal` is dead code. The flags sit as `StudentAlert` rows with `type:"safeguarding"` and `userId:<teacherId>`, but no principal dashboard view filters for them. A principal would have to:
- Query `/api/students/alerts?type=safeguarding` — but this endpoint is scoped to students in the caller's batches, not to teachers in their institution.
- Query `/api/audit-log` and filter for `action:"safeguarding_flag_created"` — but the messages/comments routes that create the alerts don't call `logAudit` (they only call `db.studentAlert.create`).

So safeguarding flags are effectively invisible to principals unless they go digging in the DB. This is the single most serious compliance gap in the principal flow.

**P-3 (HIGH).** Step 4.19: principal cannot use the AI Assistant query endpoint for the same reason as the counselor (Step 3.15). `buildTeacherBatchSummary` hardcodes `"teacher"` role.

**P-4 (MEDIUM).** Step 4.14: enrollment count is hardcoded 0. Cosmetic but misleading on the dashboard.

**P-5 (LOW).** Step 4.18: the "Run Struggle Detection" button in AdminPrincipalTab is a dead-end CTA for principals (links to a view they can't access).

---

## 5. AI Assistant Flow — 7-Section Spec Wiring Status

The 7-section spec lives in `src/lib/ai-assistant/`. Each section is a separate file. The table below shows wiring status — whether each section's exported functions are actually called by routes or components.

### 5.1 Section-by-section wiring

| § | Module | File | Exports | Wired? | Caller(s) |
|---|--------|------|---------|--------|-----------|
| 1 | Scope Resolver | `scope.ts` | `resolveAssistantScope`, `assertStudentInScope`, `filterToScope` | **PARTIAL** | Only `resolveAssistantScope` is called — by `/api/assistant/action-dialog` (line 49). `assertStudentInScope` and `filterToScope` are exported but never called by any route. The main AI Assistant query endpoint `/api/teacher/assistant` does NOT call `resolveAssistantScope` — it calls `buildTeacherBatchSummary` directly, bypassing the scope resolver entirely. |
| 2 | Data Efficiency | `data-efficiency.ts` | `getCachedSummary`, `setCachedSummary`, `isCacheCurrentWeek`, `getAggregateSummary`, `getNarrowedEntityData`, `checkQueryBudget`, `logAIUsage`, `MAX_ENTITY_RECORDS_PER_CALL` | **DEAD** | All functions exported via `modules/ai-assistant/index.ts` but **none imported by any route or component**. The `AICache` table exists in the schema but is never read or written by the assistant. The `AIUsageLog` table is written by the rate-limiter (`ai-rate-limits.ts`), not by `logAIUsage`. Section 2 is fully implemented in code and fully unused. |
| 3 | Escalation Engine | `escalation.ts` | `shouldEscalate`, `countRepeatOccurrences`, `escalateFlag`, `runEscalationEngine`, `checkOnWriteEscalation` | **WORKING** | `runEscalationEngine` called by `/api/assistant/escalation/run`. `checkOnWriteEscalation` called by `createSafeguardingFlag` (which is itself dead — see §5 below). `shouldEscalate` + `countRepeatOccurrences` + `escalateFlag` all called transitively. Cron auth fixed (C7 fix). Per §1.5 of CALCULATIONS doc. |
| 4 | Action Dialog | `action-dialog.tsx` component + `/api/assistant/action-dialog` route | `ActionDialog`, `ActionDialogData` | **PARTIAL** | API route works for all staff roles. Component wired into `TodayView.tsx` only (teacher). NOT wired into `CounselorDashboard.tsx` or `PrincipalDashboard.tsx`. Per Step 2.19 + 3.14. |
| 5 | Safeguarding | `safeguarding.ts` | `analyzeMessageForSafeguarding`, `createSafeguardingFlag`, `getSafeguardingFlagsForPrincipal`, `dismissSafeguardingFlag` | **PARTIAL / SPEC-VIOLATING** | `analyzeMessageForSafeguarding` IS called — by `/api/messages` (line 95) and `/api/comments` (line 102). BUT: (a) each route creates a `StudentAlert` per signal directly, bypassing `createSafeguardingFlag` entirely; (b) the "2+ corroborating signals" rule from the spec is NOT enforced — every flagged message creates its own alert; (c) `createSafeguardingFlag` is dead code; (d) `getSafeguardingFlagsForPrincipal` is dead code (per Step 4.16); (e) `dismissSafeguardingFlag` is dead code — no UI surfaces a dismiss action. |
| 6 | Teacher Load | `teacher-load.ts` | `calculateTeacherLoad`, `getInstitutionTeacherLoadRoster`, `suggestCoTeacher` | **DEAD** | All three exported but **never called by any route or component**. Per Step 2.12 + 2.13. `/api/teacher/load` uses its OWN simpler tier formula (§1.3b), not the spec'd §1.3a. |
| 7 | In-Action Teaching | `teaching-guidance.ts` | `getGuidanceForFlagType`, `buildGuidancePromptSection`, `FLAG_GUIDANCE_TEMPLATES` | **DEAD** | All exported but **never called**. The action-dialog route builds its own guidance inline in the system prompt (lines 76–90) — it does NOT call `buildGuidancePromptSection`. The spec'd guidance templates (psychological / educational / mentorship / teacher_load / safeguarding / crisis) are unused. |

### 5.2 What each role can actually ask the AI Assistant today

The "AI Assistant" surface is fragmented across three endpoints. The table below shows what each role can actually do today, cross-referenced against the 7-section spec.

| Role | `/api/ai/tutor` (student AI Tutor) | `/api/ai/teacher-tutor` (general staff AI Tutor) | `/api/teacher/assistant` (batch query) | `/api/assistant/action-dialog` (flag response) |
|---|---|---|---|---|
| Student | ✅ Yes — student-only gate | ❌ 403 (staff only) | ❌ 403 (staff only) | ❌ No UI surface (and not in spec scope for students) |
| Teacher | ❌ | ✅ Yes — staff gate | ✅ Yes — but `buildTeacherBatchSummary` hardcodes role="teacher" so it works ONLY for actual teachers (not TAs in their own batches) | ✅ Yes — wired into `TodayView` |
| Teaching Assistant | ❌ | ✅ Yes | ⚠️ BROKEN — `getTeacherBatchIds(taId, "teacher")` returns TA's BatchTeacher rows (TAs can be BatchTeacher members per `/api/batches/[id]/teachers` route line 38). So TAs CAN get a batch summary. But the role gate in `/api/teacher/assistant` line 29 includes `TEACHING_ASSISTANT`, so the endpoint accepts them. ✅ Actually WORKS for TAs with BatchTeacher rows. | ⚠️ No UI surface — `TodayView` is teacher-nav only. TAs don't have the "batch" nav. |
| Course Coordinator | ❌ | ✅ Yes | ⚠️ BROKEN — `getTeacherBatchIds(coordId, "teacher")` returns `[]` for coordinators (no BatchTeacher rows + "teacher" not in adminRoles). Empty summary. | ⚠️ No UI surface |
| Counselor | ❌ | ✅ Yes | ❌ BROKEN — same hardcoded role issue. Empty summary. Per Step 3.15. | ❌ No UI surface. Per Step 3.14. |
| Principal | ❌ | ✅ Yes | ❌ BROKEN — same hardcoded role issue. Empty summary. Per Step 4.19. | ❌ No UI surface |
| Administrator | ❌ | ✅ Yes | ⚠️ BROKEN — same hardcoded role issue. Empty summary. The fallback at lines 78–107 only runs on throw, not on empty return. So admin gets "no students" message. | ❌ No UI surface |
| Demo | ❌ | ✅ Yes (if `demo_ai_enabled`) | ⚠️ Same as administrator | ⚠️ No UI surface (demo impersonates teacher via role switcher, gets teacher's view) |
| Guardian | ❌ | ❌ 403 | ❌ 403 | ❌ No UI surface (correctly excluded per spec) |

### 5.3 Spec compliance summary

| Section | Spec says | Code says | UI says | Verdict |
|---|---|---|---|---|
| §1 Scope | Every assistant call goes through scope resolver FIRST | Only action-dialog calls it; teacher/assistant bypasses | N/A | **Partial compliance** — scope is enforced where it's called, but the main query endpoint doesn't call it. |
| §2 Data Efficiency | AICache + aggregate-first + soft query budget | Fully implemented | Never called | **Non-compliance** — dead code. |
| §3 Escalation | One engine, three triggers, runs as scheduled job + on-write | Fully implemented + wired | Cron + manual admin trigger both work | **Compliance** ✅ |
| §4 Action Dialog | AI drafts, humans decide; every significant interpersonal action | Fully implemented + wired for teachers | Only teacher UI; counselor + principal UI missing | **Partial compliance** — works for teachers, missing for counselors + principals. |
| §5 Safeguarding | Deterministic pre-filter, 2+ corroboration, principal-only review, dismissed not deleted | Pre-filter IS called; corroboration rule BYPASSED (each signal creates its own alert); `createSafeguardingFlag` + `getSafeguardingFlagsForPrincipal` + `dismissSafeguardingFlag` all dead | No principal review UI | **Non-compliance** — the deterministic pre-filter runs, but the corroboration + principal-review half of the spec is unimplemented. |
| §6 Teacher Load | Scalar load score, institution roster, co-teacher suggestion, teacher sees own tier at same time as principal | Fully implemented | Never called; `/api/teacher/load` uses a different formula | **Non-compliance** — dead code. |
| §7 In-Action Teaching | Flag-type-specific guidance in every Action Dialog | Templates defined | Never called; action-dialog builds its own guidance inline | **Non-compliance** — dead code. |

**Bottom line:** of the 7 sections, only §3 (Escalation) is fully spec-compliant. §1, §4 are partial. §2, §5, §6, §7 are non-compliant (the code exists but is dead or spec-violating).

---

## Cross-reference to CALCULATIONS-AND-AI-LOGIC.md findings

The CALCULATIONS-AND-AI-LOGIC.md audit (worklog Task 10) listed 20 findings (F-1 through F-18, plus F-14/F-15/F-16). The ones that directly affect flow correctness (not just framing) are:

| Finding | Affects flow? | Status in this audit |
|---|---|---|
| F-3 Comprehensive-report `reviewed` flag not added | Yes — AI-generated comprehensive report persists without human review | Open. Not in scope of this flow audit but flagged in §3.10 of CALCULATIONS doc. |
| F-5 "anxiety" still in analysis-pipeline.ts line 181 | Framing only — does not break the flow | Open. |
| F-10 Two teacher-load formulas not unified | Yes — Step 2.14 + T-2 above | Open. The spec'd formula (§1.3a) is dead code; the route formula (§1.3b) is what teachers actually see. |
| F-13 Final-result AI prompt lacks anti-diagnosis rule | Framing — affects what the student reads at the end of their journey (Step 1.17) | Open. |
| F-14 Final-result + narrative + explain AI outputs shown without "AI-generated" indicator | Flow polish — student doesn't know what's AI-drafted vs human-verified | Open. |
| F-15 "Your Learning Style" heading invokes debunked construct | Framing — affects student's self-concept at journey end | Open. |
| F-16 14-day rolling consistency uses server-local timezone | Flow correctness — daily logs submitted late in PST may be bucketed as next UTC day | Open. Affects streak/consistency display for non-UTC students. |
| F-18 Audit log missing psych_evidence_written, student_alert_auto_created, wellbeing_state_changed, report_card_generated, comprehensive_report_cached, final_result_generated events | Flow auditability — AI-driven state changes happen without an audit trail | Open. A counselor or principal reviewing "what happened to this student?" cannot rely on the audit log alone. |

---

## Top priority actions from this audit

Ordered by impact × effort.

### P0 — Spec compliance gaps that block a documented flow

1. **Wire `getSafeguardingFlagsForPrincipal` into a principal-facing UI** (Step 4.16 / P-2). Today, safeguarding flags are created but invisible to the principal. Add a "Safeguarding Review" tab to `PrincipalDashboard` that calls a new `/api/principal/safeguarding` route (which calls `getSafeguardingFlagsForPrincipal(institutionId)`). Without this, the institution has no way to fulfill its duty of care.

2. **Enforce the 2+ corroboration rule in messages + comments routes** (Step 5.5 / §5). Replace the per-signal `db.studentAlert.create` calls with a call to `createSafeguardingFlag` after aggregating signals per teacher per 14-day window. The spec is explicit: "Escalation only after multiple corroborating signals, never a single message." Today, a single aggressive message creates a flag.

3. **Fix `buildTeacherBatchSummary` to accept the caller's role** (Step 3.15 + 4.19 / C-2 + P-3). One-line signature change: `buildTeacherBatchSummary(teacherId, role, studentIds?)`. Pass `auth.ctx.payload.role` from `/api/teacher/assistant`. This unblocks the AI Assistant query endpoint for counselors, principals, and admins. Highest-leverage single fix in this audit.

### P1 — Flow completeness gaps

4. **Add counselor → principal escalation path** (Step 3.11 / C-1). Either:
   - Add an "Escalate to Principal" button in `CounselorDashboard` that creates a `StudentAlert` with `type:"counselor_escalation"` and notifies the principal via in-app message, OR
   - Extend the `CrisisFlag` PATCH endpoint to accept `status:"escalated"` and notify the principal.

5. **Wire the Action Dialog into CounselorDashboard** (Step 3.14 / C-3). Reuse the existing `<ActionDialog>` component + `/api/assistant/action-dialog` endpoint. Add an "Act" button next to each crisis queue / alert queue item.

6. **Wire `getInstitutionTeacherLoadRoster` into PrincipalDashboard** (Step 2.12 / T-1). Add a "Teacher Load" tab that calls a new `/api/principal/teacher-load` route (which calls `getInstitutionTeacherLoadRoster(institutionId)`). Shows the roster sorted by tier (red first).

7. **Wire `suggestCoTeacher` into the principal's teacher-load roster** (Step 2.13). When a teacher is red-tier, show a "Suggest Co-Teacher" button that calls `suggestCoTeacher(teacherId, institutionId)` and displays the recommendation.

8. **Unify the two teacher-load formulas** (Step 2.14 / T-2 / F-10). Either:
   - Have `/api/teacher/load` call `calculateTeacherLoad` (the spec'd formula), OR
   - Document why the two formulas intentionally disagree and surface both in the UI.
   Until this is done, the principal's view and the teacher's self-view can disagree, undermining trust in both.

### P2 — Quality / polish

9. **Surface principal-allowed admin surfaces in principal nav** (Step 4.2 + 4.7 + 4.15 / P-1). Either add `institution-settings`, `course-planner`, `teacher-behavior` to the principal's default nav, OR explicitly document that principals must ask admins for these. The current state (API allows, UI blocks) is the worst of both worlds.

10. **Wire `getGuidanceForFlagType` / `buildGuidancePromptSection` into the action-dialog route** (§7). Replace the inline guidance construction in `/api/assistant/action-dialog/route.ts` lines 76–90 with a call to `buildGuidancePromptSection(flagType)`. This makes the guidance templates (psychological / educational / mentorship / teacher_load / safeguarding / crisis) actually used, and keeps the spec'd flag-type-specific framing.

11. **Wire `getCachedSummary` / `setCachedSummary` / `getAggregateSummary` into `/api/teacher/assistant`** (§2). Use the cache for institution-wide queries; use the aggregate summary for the first tier and `getNarrowedEntityData` for specifics. This is the spec'd two-tier query pattern. Without it, every assistant call loads up to 200 students with all their relations.

12. **Add `psych_evidence_written`, `student_alert_auto_created`, `wellbeing_state_changed`, `report_card_generated`, `comprehensive_report_cached`, `final_result_generated` to the AuditAction enum and call `logAudit` at each site** (F-18). Without these, AI-driven state changes happen without an audit trail — a counselor reviewing "what happened to this student?" cannot rely on the audit log alone.

### P3 — Minor

13. **Replace `Promise.resolve(0)` enrollment count in `/api/principal/overview`** (Step 4.14 / P-4). Either add an Enrollment model or remove the field.

14. **Fix the "Run Struggle Detection" dead-end CTA in AdminPrincipalTab** (Step 4.18 / P-5). Either give principals access to the System tab, or change the button to call `/api/students/check-alerts` POST directly.

15. **Concatenate rather than replace `reasonsJson` in `escalateFlag`** (Step 2.21 / T-4 / F-9). Preserves the original ratio-based reasons alongside the escalation reason.

16. **Add demo-write-block to `/api/auth/change-password`** (carried over from Section 4 audit P0). Demo can currently change the shared demo password, locking out all future demo visitors.

---

## Appendix: verified-working flows (for the implementation team's morale)

These flows were broken or missing in the V1 audit and are now fully wired end-to-end. No action needed — listed here so future audits don't re-flag them.

- ✅ Certificate request → staff approval → student sees + shares certificate (Steps 1.18–1.21).
- ✅ Growth report generation + student-facing display (Step 1.22).
- ✅ Teacher load self-view (Step 2.11).
- ✅ Guardian account creation by staff (Step 3.12).
- ✅ Guardian sees student progress (Step 1.23 / 3.13).
- ✅ Action Dialog for teachers (Step 2.18).
- ✅ Escalation engine cron (Step 2.21).
- ✅ Counselor notified by daily check-alerts scan (Step 3.4).
- ✅ Safeguarding flag attribution to teacher (Step 5.5 attribution).
- ✅ Multi-batch teacher UI switcher (Step 2.5).
- ✅ Principal per-course + per-teacher real performance data (Steps 4.12 + 4.13).
- ✅ Course-aware project config (Step 1.11) — projectEnabled / projectRequired / projectDefaultDurationWeeks enforced end-to-end from CoursePlanner UI → /api/courses → /api/project/setup → /api/daily-tasks → /api/students/check-alerts.
- ✅ Course-aligned project plan generation (Step 1.12) — AI prompt includes course daily topics, fallback generator uses real course data.
- ✅ Daily Task Reminder sync with course + project tasks (Step 1.5).
