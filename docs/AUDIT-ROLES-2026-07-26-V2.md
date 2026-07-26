# Section 4: Role-by-Role UI Audit V2 — ExaminerAI

> **Date:** 2026-07-26
> **Auditor:** Sub-agent, general-purpose
> **Lenses:** UI specialist, features engineer, QA, PM, educationist
> **Scope:** Walked every nav item / tab for all 8 roles (student, teacher, counselor, course_coordinator, principal, administrator, demo, guardian); verified data flow from `AppShell.tsx` → per-role dashboards → leaf components → backend API routes.
> **Previous audit:** `docs/AUDIT-ROLES-2026-07-26.md` (findings 1–5 + cross-cutting RoleNavConfigPanel issue).
> **This audit:** re-walks every role after the Task-ID-1 + Task-ID-2 fixes (course-aware project config, certificate approvals UI, teacher assignment-creation fix, RoleNavConfigPanel keys, etc.), and adds empty-state / loading / error / professional-polish / workflow-simplification sections per role.

## Summary verdict

The fixes from the previous Section-4 audit (Task IDs 1 and 2) landed cleanly:
- `RoleNavConfigPanel` now ships all 27 nav keys and the API whitelist accepts every key in `ALL_NAV`.
- Teachers can now create assignments (`AssignmentsTab` fetches `batchId` from `/api/auth/me` in parallel with the task list).
- Counselors can refresh after logging a session (`onReload` is wired through `SessionsView` → `VoiceTouchpointLogger`).
- "Struggling psychologically" and "Flagged" filters work (`/api/stats?as=teacher` now returns `wellbeingTier` + `hasFlag`).
- Students/guardians can compose messages (`/api/users` returns a scoped recipient list for them).
- Guardian "Report Cards" is a separate, dedicated view (`GuardianReportCards.tsx`).
- Settings nav item is a real settings page (`SettingsPanel.tsx`) — no longer renders Home.
- Principal Academic tab returns real data (course performance + teacher performance).
- Counselor "load()" is no longer a no-op in the Mentorship view.
- Demo role can preview admin via the role switcher.

What this audit newly flags:
- **8 fresh "hardcoded 6-week" class of bugs** in places the previous audit didn't reach (`AppShell.tsx` header subtitle, `StudentPortfolioPage.tsx` Week X/6 stat, `AdminPrincipalTab.tsx` 6-bucket grouping, `FinalResultPanel.tsx` "10 per week" assumption, etc.).
- **2 latent UX regressions** (`SettingsPanel` lets demo change the shared demo password; `ReportCardPanel.CertificateCard` uses `useState(() => load())` as a side-effect channel).
- **Several professional-polish issues** (placeholder text still says "WordPress" / "6-week bootcamp" in non-web-dev courses, stale comments like "Teacher picks a week (1-6)", duplicated `Bell` icon defined locally, etc.).
- **Per-role simplification ideas** grounded in each role's actual workflow.

---

## Cross-cutting finding (affects multiple roles)

### C1 (NEW, HIGH): `RoleNavConfigPanel` `NAV_LABELS` map is stale — 9 toggleable keys render as raw kebab-case

`src/components/examiner/admin/RoleNavConfigPanel.tsx` lines 27–47.

The previous audit fixed the *backend* whitelist (now in sync with `AppShell.ALL_NAV`). The admin *panel UI*, however, still uses the old `NAV_LABELS` map that pre-dates the C10 fix. Keys present in `allNavKeys` but missing from `NAV_LABELS`:

| Key | What it actually is |
|---|---|
| `batch-students` | Teacher Students tab |
| `batch-mentorship` | Teacher Mentorship tab |
| `batch-assignments` | Teacher Assignments tab |
| `batch-insights` | Teacher Insights tab |
| `counselor-dashboard` | Counselor Command Center |
| `principal-dashboard` | Principal Institution dashboard |
| `guardian-dashboard` | Guardian Overview |
| `guardian-progress` | Guardian Report Cards |
| `teacher-ai-tutor` | Staff AI Assistant |

**Impact:** an admin ticking any of those 9 keys sees the raw string `batch-students`, `principal-dashboard`, etc. as the checkbox label — looks unfinished. Also the "Quick Presets" card line 209 still sets the **Counselor preset** to `["batch", "messages", "settings"]`, which **removes the counselor's purpose-built `counselor-dashboard`** and forces them into the teacher dashboard. The previous audit flagged this exact preset bug — it survived.

**Fix:** add the 9 missing labels to `NAV_LABELS`, and update the Counselor preset to include `counselor-dashboard`.

---

## 1. Student (8 nav items: Home, Study, Project, AI Tutor, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Home (`dashboard`) | ✅ Works | Motivation banner, 4 stat cards, "Today's Tasks" action items, score trend chart, AI Tutor CTA. Project-setup amber banner now correctly gated on `stats.projectConfig?.projectEnabled && tasks.length === 0`. |
| Study (`checkin`) | ✅ Works | 4 sub-tabs (Practice / Daily Test / Weekly Test / Check-in). `CheckInPanel` correctly hides curriculum cards when `hasCourse === false` and shows a friendly amber "No course assigned yet" notice. |
| Project (`gantt`) | ✅ Works | `ProjectDescriptionCard` + `ProjectProgressChart` + `CompactGantt` + `ProjectWeekPlan`. Nav item hidden by AppShell when `projectConfig.courseAssigned === false` OR `projectEnabled === false`. |
| Progress (`report-card`) | ⚠️ Minor | `ComprehensiveReportView` + `ReportCardPanel` + `GrowthReportPanel` + `FinalResultPanel` + `ProjectReportPanel` + `CertificateCard` — six stacked cards on one scroll. The `CertificateCard` component uses `useState(() => { load(); })` as a side-effect channel (line 70) — this is a misuse of the lazy `useState` initializer and silently calls `load()` once at mount. It happens to work, but is fragile and reads as a bug. Should be `useEffect(() => { load(); }, [])`. |
| AI Tutor | ✅ Works | `AITutor` from `@/modules/ai-tutor`. |
| Course | ✅ Works | `CourseOutline.tsx` is DB-driven, fetches `/api/courses/user/outline`. Has empty state ("No course outline available yet"), error state, loading spinner. **Note:** the comment at lines 134–138 says "Legacy HTML outline link — kept for the currently-enrolled student who is using the hardcoded 6-week web dev course. Can be removed once that course ends (~1 month)." That removal is now overdue — every student still sees a "Classic HTML view" link to `/course-plan.html` even when their course is a 12-week Python course. |
| Messages | ✅ Works (post-H8) | `/api/users` now returns a scoped list (batch teachers + admins) for students. Compose dialog shows real recipients. Empty states for inbox + sent both present. |
| Settings | ✅ Works | Real `SettingsPanel` with Profile / Appearance / Change Password / Security Question. |

### Hardcoded assumptions found in student UI
- **`FinalResultPanel.tsx` line 79**: title says `Final Bootcamp Result - {studentName}` — "Bootcamp" is hardcoded.
- **`FinalResultPanel.tsx` line 82**: "Based on {N}/{Math.ceil(totalPossibleQuestions / 10)} weekly tests" — assumes 10 questions per weekly test. If a course configures 5 or 15 questions, the math is wrong.
- **`FinalResultPanel.tsx` line 155**: "Per-Week Breakdown ({N} questions total, 10 per week)" — same hardcoded "10 per week" assumption.
- **`ProjectSettingsCard.tsx` line 306**: placeholder text "Using WordPress for CMS, custom plugin for AI chatbot, deploy on Vercel..." — a Python student sees WordPress copy.
- **`ProjectWeekPlan.tsx` line 235**: placeholder "e.g. Build homepage with WordPress blocks" — same issue.
- **`AppShell.tsx` line 702**: header subtitle hardcodes `AI Examiner · Modern Web Dev & AI Bootcamp` for ALL users regardless of course/institution.

### Empty / loading / error states (student)
- **`StudentDashboard`**: full error card with Retry button. Loading state shows "Refreshing…" spinner.
- **`CheckInPanel`**: amber notice when no course assigned. Friendly empty state for "no pending project tasks today". `toggleError` surfaces API failures inline.
- **`ProjectDescriptionCard`**: loading spinner. Generation status surfaces success/error in colored banner. Confirm dialog before regenerating tasks (since it deletes existing tasks).
- **`ProjectWeekPlan`**: empty state "No tasks yet. Generate tasks with AI or add manually." Status change errors surface via `taskMsg` + `taskMsgType`.
- **`ReportCardPanel`**: empty state for no report cards. `GrowthReportPanel` empty state with "Generate My Growth Report" CTA.
- **`CourseOutline`**: empty state, error state with reason text, loading spinner with text.
- **`Messages`**: empty states for inbox and sent.

### Missing features (student)
- **No way to see other students' progress / peer benchmarking** (intentional — privacy). But there is also no "leaderboard" or "top performers this week" surface that some bootcamps use for motivation.
- **No way to download/print a report card or certificate as PDF.** The certificate has a "View / Share" button that opens a verification URL, but no PDF export.
- **No way to message another student** (by design — only teachers/admins). Reasonable.
- **No way to see the course's other batches / cohort context.** Students are silo'd to their own batch.
- **No way to retake a weekly test** unless the teacher explicitly unlocks it. UI surfaces this in `WeeklyTestPanel` correctly.
- **No "what's coming next week" preview** — the curriculum view only shows the current/selected week expanded, but there's no teaser of the next week's phase.

### Professional polish issues (student)
- `AskMyTeacher.tsx` line 132 uses `text-growth-coral` and `bg-growth-coral-soft` Tailwind classes that don't appear to exist in `tailwind.config.ts` — likely renders as plain unstyled text. Need to verify the theme tokens are defined.
- `DailyTaskReminder.tsx` bottom-20 right-6 stacking comment mentions "Ask My Teacher button (which is ~48px tall + 24px bottom = 72px)" — fine, but the FAB visually overlaps on small viewports when the DailyTaskReminder popup is open.

### Simplification idea for student dashboard
**Replace the 6-card Progress view with a single "Weekly Snapshot" timeline.** Right now the Progress tab stacks: Comprehensive Report (7 sections, ~600 lines of UI), Certificate, Growth Report, Final Result (10-per-week table), Project Reports, Weekly Report Cards — all on one vertical scroll. A Week-1 student sees six "no data yet" cards stacked. A Week-6 student sees the same six cards each fully populated. Both extremes feel overwhelming.
**Proposal:** collapse to a single weekly-strip UI: each week is a card with grade + score + 1-line summary + "expand" → reveals the full report card. The comprehensive report and growth report become buttons ("View full report") that open a dialog, not permanent page sections. Final Result becomes a single "Course Summary" card at the bottom that's hidden until week 2+. This cuts scroll length by ~60% and gives the student a clear "this week → that week" mental model.

---

## 2. Teacher (10 nav items: Today, Students, Mentorship, Assignments, Insights, Course Planner, AI Assistant, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Today (`batch`) | ✅ Works | `TodayView` — 4 stat cards, triage queue (crisis → alert → silent → blocked → plagiarism), wins-to-celebrate, AI Assistant box. Action Dialog wired (H9 fix). `TeacherLoadPanel` wired in (H10 fix). |
| Students (`batch-students`) | ✅ Works (post-H16) | `StudentsRoster` — search + 6 filters (All / Struggling academically / Struggling psychologically / Overdue / Flagged / On track). The `struggling_psych` filter now works because `wellbeingTier` is in the API response. Pagination at 25/page. |
| Mentorship (`batch-mentorship`) | ✅ Works (post-H15) | `MentorshipView` — 4 stat cards, GROW Logger, mentorship queue (urgency-sorted), Case Review panel, Automation Rules. `load()` is no longer a no-op. |
| Assignments (`batch-assignments`) | ✅ Works (post-C5) | `AssignmentsTab` — Group Assignments + Events + Certificate Approvals. `createTask()` passes `batchId` from `/api/auth/me`. New Assignment button disabled when no batch assigned, with amber error notice. Grade submissions inline. |
| Insights (`batch-insights`) | ✅ Works | `InsightsView` — distribution charts, top performers, struggling students, AI Assistant Q&A. |
| Course Planner | ✅ Works | Full course CRUD, AI generator, per-day editing, project config card (toggle required/optional, duration dropdown). |
| AI Assistant | ✅ Works | `TeacherAITutor`. |
| Course | ✅ Works | `CourseOutline` — same component as student. |
| Messages | ⚠️ Limited | Teachers can only message **students in their batch** + pending users. The `/api/users` roleScope for teachers is `{ role: { in: ["student", "pending"] } }` (line 128 of `users/route.ts`). Teachers **cannot** message other teachers, counselors, principals, or admins via Compose. This is a real workflow gap — a teacher who wants to escalate a concern to the principal or coordinate with the counselor has to use external email. |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in teacher UI
- **`TeacherCourseProgressView.tsx` lines 13–20**: `TEACHER_BOOTCAMP_PLAN` is a hardcoded 6-week plan with phases "Planning & Dev Environment" / "Website & Database Fundamentals" / "APIs, Automation & AI Agents" / "Prompt Engineering & AI" / "Testing, Security & Deployment" / "Career Prep & Capstone". Any non-web-dev course (Python, HR, UI/UX) shows incorrect phase names in BOTH the 6-week stepper AND the compact Gantt at the bottom of the Project tab. This is the single most prominent "hardcoded 6-week" bug — it's the first thing a teacher sees when they open a student's portfolio.
- **`TeacherCourseProgressView.tsx` line 41**: comment `{/* 6-week stepper */}` — also hardcoded.
- **`StudentPortfolioPage.tsx` line 425**: `{portfolio.student.currentWeek} / 6` — the "Week" stat card in the portfolio header hardcodes the denominator to 6. A Week-7 student in a 12-week course sees "Week 7 / 6".
- **`StudentPortfolioPage.tsx` line 72 (comment)**: "Teacher picks a week (1-6) and generates a report card." The actual dialog (line 1081) now shows weeks 1–12 (`Array.from({ length: 12 })`). The comment is stale, but the implementation is correct.
- **`TeacherAITutor.tsx` line 118**: suggested prompt `"Draft a rubric for a WordPress project"` — course-specific copy leaking into the AI Assistant suggestions.
- **`AssignmentsTab.tsx` placeholder text** (line 208): `"Assignment title (e.g. 'Week 3 Project Milestone')"` — fine, course-agnostic.

### Empty / loading / error states (teacher)
- **`TeacherDashboard`**: full-screen spinner during initial load. `showError()` toast on fetch failure.
- **`TodayView`**: defensive `safeStudents`/`safeAlerts` guards. AI Action Dialog has fallback content if the AI call fails.
- **`StudentsRoster`**: empty state for no matches. Pagination shows range.
- **`MentorshipView`**: empty state "No active mentorship cases" with green check.
- **`AssignmentsTab`**: empty states for "No assignments yet" and "No events scheduled". Submission viewer empty state.
- **`CertificateApprovals`**: empty state with helpful copy.
- **`StudentPortfolioPage`**: 9 tabs (Project / Progress / Check-Ins / Assessments / Report Cards / Comments / Psychological / Educational / Mentorship / Audit) — each tab has its own loading state.

### Missing features (teacher)
- **Cannot compose a message to other staff.** The `/api/users` endpoint scopes teachers to students+pending only. A teacher who needs to consult the counselor or escalate to the principal has no in-app path.
- **Cannot bulk-message their batch.** The Assignments tab creates group *tasks*, but there's no "send announcement to whole batch" feature. The Outreach endpoint (`/api/messages/outreach`) exists in the API folder but has no UI consumer in the teacher dashboard.
- **Cannot see a student's guardian contact info** from the portfolio — `GuardianCreationPanel` is wired in (line 419) but only shows the guardian if the teacher creates one. There's no read-only "guardian on file" surface for teachers who inherit a student.
- **Cannot reset a student's weekly test** from the portfolio — the unlock/retake endpoint exists (`/api/students/[id]/allow-retake`, `/api/students/[id]/unlock-test`) but I don't see them wired into the portfolio UI in the read of `StudentPortfolioPage.tsx` (only weekly test comment + grade-edit dialogs are present).
- **Cannot see cohort-level "topics causing the most difficulty"** as a structured heatmap. `InsightsView` has a topic-mastery section but it's per-student, not batch-aggregated. The AI Assistant can answer the question in free-text, but there's no dedicated widget.

### Professional polish issues (teacher)
- `TeacherCourseProgressView.tsx` uses `text-amber-600` for the "warning" accent (line 25 of the accent map) — but the previous audit noted that the amber→warning rename was applied only to wellbeing tiers, not grade colors. The accent name is `warning` but the class is `amber`. Confusing for future maintainers.
- `StudentPortfolioPage.tsx` line 72 comment is stale ("1-6" → actually 1–12).
- `AIAssistantBox.tsx` catches all errors with a generic "I wasn't able to process your question right now" message — no error code or retry hint surfaced.

### Simplification idea for teacher dashboard
**Merge "Today" + "Mentorship" into a single "Daily Triage" view.** Right now a teacher opens Today → sees triage queue. Then they click Mentorship → sees the *same* students re-sorted by mentorship urgency with a GROW logger on top. The two views share 70% of their data (alerts + students + touchpoints) and the teacher's actual workflow is: "who needs me → act on them → log what I did." That's one workflow, not two.
**Proposal:** single "Today" view with three sections: (1) Crisis/Alert queue (urgency-sorted, with inline "Log GROW touchpoint" button on each row), (2) Follow-ups due today, (3) AI Assistant. The current Mentorship tab becomes a "Coaching History" sub-tab inside the Student Portfolio. This eliminates the "I acted on a student in Today, then had to switch to Mentorship to log it" round-trip.

---

## 3. Counselor (5 nav items: Command Center, AI Assistant, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Command Center (`counselor-dashboard`) | ✅ Works | 4 stat cards (Avg Mood, Avg Engagement, Frustration, Avoidance). Crisis Queue with Acknowledge/Resolve buttons. Active Alerts (top 15 + "N more" indicator). Follow-ups Due. Wellbeing Distribution pie chart. |
| Caseload (sub-tab) | ✅ Works | Search + 5 filters (All/Red/Warning/Crisis/Alerts). Click row → opens portfolio in new tab (H7 fix). |
| Sessions (sub-tab) | ✅ Works (post-L8) | GROW Logger (`VoiceTouchpointLogger`) with `onReload` wired. Recent Sessions list. Case Reviews panel. |
| Patterns (sub-tab) | ✅ Works | 7-dimension evidence breakdown + behavioral signals bar chart. |
| AI Assistant | ✅ Works | `TeacherAITutor`. |
| Course | ✅ Works | `CourseOutline`. |
| Messages | ⚠️ Same as teacher | Counselors are scoped to `student` + `pending` only by `/api/users` (line 128). They **cannot message teachers or principals** via Compose — even though escalating to a teacher is a core counselor workflow. |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in counselor UI
- None specific to the counselor dashboard. (`CounselorDashboard.tsx` uses generic `tier` strings and dimension names from the API.)

### Empty / loading / error states (counselor)
- **`CounselorDashboard`**: full loading spinner. Error card with Retry button when `data === null`. Per-section empty states (Crisis Queue: "No open crisis flags. All clear." with green check; Active Alerts: "No active alerts."; Follow-ups Due: "No follow-ups due this week.").
- **`CaseloadView`**: empty state differentiates between "no students with concerns" (positive) and "no students match your filter" (neutral).
- **`SessionsView`**: "No sessions logged yet." for the recent-sessions list. Case Review panel has its own empty state.

### Missing features (counselor)
- **Cannot compose a message to a teacher or principal.** Same `/api/users` scoping issue as teachers. A counselor who identifies a student in crisis and wants to alert the student's teacher has no in-app path — they can only create a crisis flag and hope the teacher sees it in their Today queue.
- **Cannot see the student's full portfolio inline.** Clicking a student opens a new tab (`window.open(...)`). There's no split-pane or drawer for "view caseload + portfolio side-by-side", which is the standard counselor workflow.
- **Cannot schedule a future session.** The GROW logger records past sessions + follow-up dates, but there's no calendar view or "upcoming sessions" list. Follow-ups due are surfaced in the Command Center, but the counselor can't see "I have 3 sessions scheduled for tomorrow" as a distinct list.
- **Cannot export a caseload report** (CSV/PDF) for compliance or supervision.

### Professional polish issues (counselor)
- `CounselorDashboard.tsx` line 701–704 defines a local `Bell` component that just re-exports `AlertTriangle`. The real `Bell` icon exists in lucide-react. The local shim should be removed and `Bell` imported directly.
- The "Active Alerts" panel caps at 15 with "+N more alerts" — but the cap is hardcoded. A counselor with 200 alerts sees "+185 more alerts" with no way to view them. Should be a "View all alerts" link to a paginated view.

### Simplification idea for counselor dashboard
**Add a "Daily Check-out" card at the top of the Command Center.** Counselors' actual workflow ends with: "Here's what I did today, here's what I'm worried about, here's what I'm watching tomorrow." Right now they log touchpoints one-by-one but there's no end-of-day summary surface. A single card that auto-populates with "Today you: acknowledged N crises, resolved N alerts, logged N sessions, scheduled N follow-ups. Top concern tomorrow: {student name}." would close the loop and reduce the "did I miss anyone?" anxiety that leads to over-checking.

---

## 4. Course Coordinator (5 nav items: Course Planner, Students, AI Assistant, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Course Planner (`course-planner`) | ✅ Works | Full course CRUD with AI generation, per-day editing, project config card. |
| Students (`batch-students`) | ✅ Works (post-M4) | Coordinator now has access to the Students tab. Reuses `StudentsRoster`. |
| AI Assistant | ✅ Works | `TeacherAITutor`. |
| Course | ✅ Works | `CourseOutline`. |
| Messages | ⚠️ Same scoping | Coordinators are scoped to `student` + `pending` only. |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in coordinator UI
- Inherits the `AppShell.tsx` header subtitle "Modern Web Dev & AI Bootcamp".
- Inherits `CoursePlanner.tsx` "default bootcamp notebook" copy at lines 468, 602, 1007.

### Empty / loading / error states (coordinator)
- Inherits `CoursePlanner` (loading spinner, error message via `showMsg("error", ...)`, success auto-dismisses after 4s, errors persist).
- Inherits `StudentsRoster` empty state.

### Missing features (coordinator)
- **Cannot see their institution's batches list with student counts** directly. The Course Planner shows batches per-course, but there's no "all batches I coordinate" view. Admin has this via `AdminPrincipalTab` Batches section — coordinator doesn't.
- **Cannot assign teachers to batches.** The `batches/[id]/teachers` API exists, but the coordinator's CoursePlanner only lets them assign a course to a batch (line 335 `assignBatch`). They can't add or remove teachers from a batch.
- **Cannot see batch-level progress analytics** (avg score, completion rate, alerts). They see the roster but not the aggregate.
- **Cannot duplicate a batch** for rolling admissions (admin can via `AdminPrincipalTab`).

### Professional polish issues (coordinator)
- The coordinator's default landing view is `course-planner` (AppShell line 282–283). If they have no courses yet, they see an empty Course Planner list with no onboarding nudge. Compare to admin Overview which shows "Pending Approvals" + quick actions.

### Simplification idea for coordinator dashboard
**Replace the Course Planner list view with a "Course Health" dashboard as the default landing.** Right now the coordinator lands on the Course Planner list (a CRUD surface). What they actually want to know is: "are my courses healthy?" — which means: are batches assigned, are students progressing, are there quality issues. The `AdminCoordinatorTab` already computes this (course catalog summary, batch→course matrix, content quality issues). **Proposal:** make `AdminCoordinatorTab` the coordinator's default landing page (it currently lives inside the admin dashboard), and move the Course Planner CRUD behind a "Manage courses" button. The coordinator sees health first, edits second.

---

## 5. Principal (5 nav items: Institution, Admin Dashboard, Users, Courses, Features, Passwords, System, AI Assistant, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Institution (`principal-dashboard`) | ✅ Works | 4 tabs: Overview / Academic / Wellbeing / Audit. Overview has 6 stat cards + 3 charts. Academic now shows real course + teacher performance (C6 fix). Wellbeing has tier cards + behavioral signals + alerts-by-type. Audit shows last 20 actions + growth reports. Audit tab hidden from demo. |
| Admin Dashboard / Users / Courses / Features / Passwords / System | ✅ Works (post-M2) | Principal now has access to all admin nav items. Role-based tab visibility inside `AdminDashboard` correctly gates Features/Resets/System to `isAdminRole` only (principal is `isPrincipalRole`, so they DON'T see Features/Resets/System — only admin does). Principal DOES see Principal tab, Teacher Behavior, Coordinator, Operations, Users, Courses, AI Limits, User Audit. |
| AI Assistant | ✅ Works | `TeacherAITutor`. |
| Course | ✅ Works | `CourseOutline`. |
| Messages | ⚠️ Scoping | Principals are admins — `/api/users` returns all users for them. They CAN message anyone. ✅ |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in principal UI
- **`AdminPrincipalTab.tsx` line 264**: `Math.ceil((s.currentWeek || 1) / Math.max(Math.ceil(6 / 3), 1))` — buckets students into "Early/Mid-course/Late" using a hardcoded 6-week denominator. A 12-week course puts Week-7 students in "Late (Final stretch)" prematurely.
- **`AdminPrincipalTab.tsx` line 265**: bucket labels "Early (Onboarding)" / "Mid-course" / "Late (Final stretch)" assume a 3-phase structure that not all courses follow.

### Empty / loading / error states (principal)
- **`PrincipalDashboard`**: full loading spinner. Error card with Retry. All chart cards have "No data" / "No alerts" / "No signals" fallbacks.
- **`AdminPrincipalTab`**: per-section empty states ("No batches yet", "No staff members yet", etc.).
- **`AcademicView`**: "No courses yet." / "No teachers yet." empty states.

### Missing features (principal)
- **Cannot see per-teacher student satisfaction or mentorship outcome rates.** The teacher performance table shows courses/sessions/alertsRaised but not "students who improved" or "average student mood change after a session".
- **Cannot compare batches** side-by-side (e.g., "Batch A vs Batch B avg score over 6 weeks"). The data is all there in the API but no comparison view exists.
- **Cannot see financial / enrollment-funnel data** beyond the basic counts. The "Enrollment Funnel" card in `AdminPrincipalTab` is just Total → Pending → Students → Teachers → Blocked, which isn't a funnel.
- **Cannot export any dashboard view** as CSV/PDF for board meetings.

### Professional polish issues (principal)
- `AdminPrincipalTab.tsx` "Run Struggle Detection" button (line 452) links to `/app?view=admin-system` — but the principal role doesn't have the System tab (it's admin-only). Clicking it lands the principal on the admin dashboard with no System tab visible. Dead-end CTA.
- `PrincipalDashboard` "Audit" tab hidden for demo (line 118) — good. But the tab is also hidden for any principal previewing as themselves, which is correct.

### Simplification idea for principal dashboard
**Add a "Weekly Board Report" card at the top of the Overview tab.** Principals' actual workflow is reporting upward (to a school board / leadership team) and downward (to teachers). Right now they have to manually assemble "this week's highlights" from 6 different cards. A single auto-generated card with: "This week: N new students enrolled, N crisis flags resolved, N tests taken, avg score N%, top concern: {batch name}." with a "Copy to clipboard" / "Email to board" button would save 30 minutes a week.

---

## 6. Administrator (10+ nav items: Dashboard, Users, Courses, Features, Passwords, System, Principal, Teacher Behavior, Coordinator, Operations, AI Limits, User Audit)

| Page | Status | Notes |
|------|--------|-------|
| Dashboard (`admin-dashboard`) | ✅ Works | `AdminOverview` — 5 stat cards + pending approvals + quick actions + recent signups. |
| Users | ✅ Works | Search + role filter + pagination (20/page). Role change with confirm. Block/unblock with confirm. Delete with confirm. Batch-approve all pending. |
| Courses (`admin-courses`) | ✅ Works | `AdminCoursesPanel` — list + seed default + assign to batch + delete (with force-delete flow). |
| Features | ✅ Works | `FeaturesPanel`. Admin-only (hidden from demo). |
| Passwords | ✅ Works | `PasswordResetPanel`. Admin-only. |
| System | ✅ Works | `SystemPanel` with 8 sub-tabs: Overview / AI / Flags / Actions / Audit / Access / NavConfig / Maintenance. `RoleNavConfigPanel` lives here. |
| Principal tab | ✅ Works | `AdminPrincipalTab` — visible to principal + administrator. |
| Teacher Behavior | ✅ Works | `TeacherBehaviorTab`. |
| Coordinator | ✅ Works | `AdminCoordinatorTab` — visible to all admin-equivalent roles. |
| Operations (PM) | ✅ Works | `AdminPMTab` — action items + system health + AI usage. |
| AI Limits | ✅ Works | `AILimitsPanel` — per-user rate limits + demo AI toggle. |
| User Audit | ✅ Works | Searchable user audit trail. |
| AI Assistant | ✅ Works | `TeacherAITutor`. |
| Course | ✅ Works | `CourseOutline`. |
| Messages | ✅ Works | Admins see all users. |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in admin UI
- **`AdminCoursesPanel.tsx` line 129**: "Click **Seed Default** to create the standard 6-week bootcamp" — assumes the default course is always a 6-week bootcamp.
- **`AdminPMTab.tsx` line 89**: "⚠ AI provider not configured — set DEEPSEEK_API_KEY in Vercel env vars" — assumes DeepSeek specifically. If the admin has configured Gemini or Z.ai, this message is misleading.
- **`AdminPrincipalTab.tsx` line 264**: 6-week bucketing (covered above).

### Empty / loading / error states (admin)
- **`AdminDashboard`**: full-screen spinner. Per-tab loading states.
- **`AdminOverview`**: pending approvals card only renders when pending.length > 0.
- **Users tab**: pagination + "No users found" empty state with context-aware copy.
- **`RoleNavConfigPanel`**: loading spinner. Save button shows success/failure message. Reset to default with confirm.

### Missing features (admin)
- **Cannot create a new user from the Users tab.** The `/api/users` POST endpoint exists and works, but the admin Users tab is read+edit only — there's no "Add User" button. Admins have to either seed the DB or have a teacher/student self-register.
- **Cannot impersonate a specific user** (only role-level preview via the switcher). For debugging "why does this student see X?", admins need to log in as that user, which requires changing their password.
- **Cannot see AI cost in dollars** — only token counts. `AdminPMTab` shows `tokens.total` but no $-value conversion.
- **Cannot bulk-import users** from a CSV.
- **Cannot schedule a feature flag change** (e.g., "turn on AI Tutor for students at 9am Monday").

### Professional polish issues (admin)
- `AdminDashboard.tsx` lines 612–661 are 50 lines of `// ============` comment headers for sections that are now in separate files (`AdminOverview`, `FeaturesPanel`, etc.). The comments are stale documentation of code that's no longer there.
- `AdminDashboard.tsx` line 41 — `initialView` type includes `"pm"` but the previous audit listed it as "Operations" — naming inconsistency between type and UI label.
- `RoleNavConfigPanel` Quick Presets card (line 207) still has the broken Counselor preset (see C1 above).

### Simplification idea for admin dashboard
**Collapse the 12 top-level admin tabs into 4 groups.** Right now the admin tab bar wraps onto 2–3 rows on smaller screens: Overview | Principal | Teacher Behavior | Coordinator | Operations | (divider) | Users | Courses | Features | Resets | AI Limits | User Audit | System. That's 12 buttons. **Proposal:** group into 4 super-tabs: (1) **People** (Users, Pending, User Audit, Access Grants), (2) **Learning** (Courses, Coordinator, Principal, Teacher Behavior), (3) **System** (Features, AI Limits, AI Connection, Maintenance, NavConfig), (4) **Operations** (Overview, PM, Audit Log, Password Resets). Each super-tab has its own sub-nav. Cuts cognitive load from "12 buttons to scan" to "4 groups, 3 sub-items each".

---

## 7. Demo (variable — defaults to teacher's nav, can switch to any role)

| Page | Status | Notes |
|------|--------|-------|
| All teacher pages | ✅ Works (read-only) | All writes blocked server-side via `demoWriteBlock()`. Client-side `examiner-is-demo` localStorage flag also blocks. |
| Role switcher | ✅ Works | 7 roles in the switcher (Student / Teacher / Coordinator / Counselor / Guardian / Principal / Admin). Demo is the default landing role (effectiveRole = "teacher"). Previous audit said "Can't preview admin" — **fixed**, admin is now in the switcher. |
| AI Limits tab | ✅ Works | Demo sees only the demo-AI-enable toggle. Cannot change rate limits. |

### Hardcoded assumptions found in demo UI
- Inherits `AppShell.tsx` header subtitle "Modern Web Dev & AI Bootcamp".
- The DEMO BANNER (line 526) says "Use the role switcher below to preview any dashboard." — accurate.

### Empty / loading / error states (demo)
- Same as the role being previewed.

### Missing features (demo)
- **Cannot save any state** — by design. But the demo also can't *reset* its view to a clean state. If a previous visitor clicked through a bunch of tabs, the next visitor sees the same tab state (localStorage `lastPopupShown` for DailyTaskReminder, etc.).
- **Cannot preview the student Messages compose flow** end-to-end. The compose dialog opens but the Send button is blocked. A sales demo of "here's how a student messages their teacher" requires the visitor to imagine the final step.

### Professional polish issues (demo)
- `AppShell.tsx` line 526 demo banner uses an amber→rose gradient. Fine, but the banner text says "Read-only access. Write actions are blocked." — accurate but doesn't tell the visitor *how* to sign up. A "Sign up your institution →" CTA in the banner would convert better.

### Critical bug specific to demo
- **`SettingsPanel` does NOT call `demoWriteBlock()` before `POST /api/auth/change-password`.** The `change-password` route (`src/app/api/auth/change-password/route.ts`) also doesn't call `demoWriteBlock`. This means **any visitor using the demo account can change the demo account's password**, locking out all future demo visitors until an admin resets it. This is a P0 for the demo experience.
  - **Fix:** either add `demoWriteBlock("changing password")` to the route, OR hide the Change Password card in `SettingsPanel` when `user.email === "demo@examiner.ai"`.

### Simplification idea for demo dashboard
**Add a "Demo Tour" overlay.** Right now a demo visitor lands on the teacher dashboard with no guidance. A simple 5-step tour ("This is your triage queue. Click a student to see their portfolio. Try the AI Assistant. Switch roles using the buttons below. Click Settings to see account options.") would dramatically improve demo-to-signup conversion. The tour can be a one-time overlay that dismisses on completion.

---

## 8. Guardian (6 nav items: Overview, Report Cards, AI Tutor, Course, Messages, Settings)

| Page | Status | Notes |
|------|--------|-------|
| Overview (`guardian-dashboard`) | ✅ Works | `GuardianDashboard` — child header, wellbeing banner, 4 snapshot cards, Wins/Concerns, score trend chart, recent activity, teacher comments, "Message teacher" CTA, recent report cards. |
| Report Cards (`guardian-progress`) | ✅ Works (post-H14) | `GuardianReportCards` — dedicated view with score trend chart + expandable report cards. Distinct from Overview. |
| AI Tutor | ⚠️ Questionable fit | `AITutor` is the student-facing practice chat. A parent clicking "AI Tutor" expects "help me understand my child's progress" not "let me practice Socratic questions on REST APIs". The previous audit flagged this — still not addressed. |
| Course | ✅ Works | `CourseOutline`. |
| Messages | ✅ Works (post-H8) | `/api/users` returns scoped list (linked student's batch teachers + admins). |
| Settings | ✅ Works | Real settings page. |

### Hardcoded assumptions found in guardian UI
- Inherits `AppShell.tsx` header subtitle "Modern Web Dev & AI Bootcamp".
- `GuardianDashboard.tsx` uses generic `wellbeingTier` strings from the API — no hardcoded course assumptions.

### Empty / loading / error states (guardian)
- **`GuardianDashboard`**: loading spinner. Error card with "Setup needed" copy when no student is linked (different from a generic error — context-aware). Per-section empty states (Wins: "No specific wins yet. Encourage your child to keep practicing!"; Concerns: "No concerns right now. Your child is on track!"; Recent Activity: "No recent activity."; Teacher Comments: hidden when empty; Report Cards: hidden when empty).
- **`GuardianReportCards`**: loading spinner. Error card. Empty state: "No report cards yet. Report cards are generated weekly by the AI once your child completes their weekly test."

### Missing features (guardian)
- **Cannot see their child's project tasks or Gantt chart.** The guardian sees the project *name* in the header (line 152) but not the task breakdown. A parent who wants to ask "what did you work on this week?" has only the daily-logs summary (surfaced in Recent Activity) to go on.
- **Cannot see their child's check-in reflections** (learningReflection, confusionNotes, nextQuestion). Only `whatDidYouDo` is surfaced in the activity feed.
- **Cannot message their child directly through the platform** (intentional — they live together). But they also can't see messages BETWEEN their child and the teacher (only the teacher's public comments). This is a privacy choice but worth surfacing: "You see teacher comments on your child's work; private messages between your child and teacher are not visible to you."
- **Cannot see attendance / login history.** The `activeDaysThisWeek` count is shown but there's no "your child logged in at 3am" or "your child hasn't logged in for 5 days" alert.
- **Cannot reply to teacher comments inline.** Teacher comments are shown as one-way announcements. To respond, the guardian has to go to Messages and compose a new message.

### Professional polish issues (guardian)
- `GuardianDashboard.tsx` line 529–538: local `gradeColor` function duplicates the one in `@/lib/constants`. Should import.
- `GuardianDashboard.tsx` "Send Message" button (line 408) navigates to Messages but doesn't pre-fill the recipient as the teacher. The guardian has to manually pick their child's teacher from the dropdown.

### Simplification idea for guardian dashboard
**Add a "This Week's Conversation Starters" card.** Guardians' #1 need is: "what do I say to my child about their learning?" Right now they see data (wellbeing tier, score, engagement) but have to translate that into a conversation. A single card with 3 AI-generated prompts like "Ask Alex about the REST API they built this week — they scored 85% on the test" or "Alex's engagement dropped 2 days this week — try 'what's getting in your way?'" would close the gap between data and parenting. The AI Tutor endpoint could power this without new infrastructure.

---

## Top 10 highest-impact findings (this audit)

| # | Severity | Finding | File |
|---|---|---|---|
| 1 | 🔴 P0 | Demo account can change the shared demo password — `change-password` route has no `demoWriteBlock`. Any visitor can lock out all future demo visitors. | `src/app/api/auth/change-password/route.ts` |
| 2 | 🔴 P0 | `TeacherCourseProgressView` hardcodes a 6-week web-dev bootcamp plan. Every student portfolio opens with wrong phase names for any non-web-dev course. | `src/components/examiner/teacher/TeacherCourseProgressView.tsx:13–20` |
| 3 | 🟠 P1 | `StudentPortfolioPage` "Week X / 6" stat card hardcodes the denominator. Week-7 students see "Week 7 / 6". | `src/components/examiner/teacher/StudentPortfolioPage.tsx:425` |
| 4 | 🟠 P1 | `RoleNavConfigPanel` Quick Presets Counselor preset still removes `counselor-dashboard`. Previous audit flagged this — not fixed. | `src/components/examiner/admin/RoleNavConfigPanel.tsx:209` |
| 5 | 🟠 P1 | `RoleNavConfigPanel` `NAV_LABELS` missing 9 keys — admin sees raw kebab-case labels for `batch-students`, `principal-dashboard`, etc. | `src/components/examiner/admin/RoleNavConfigPanel.tsx:27–47` |
| 6 | 🟠 P1 | Teachers + counselors cannot compose messages to other staff (teachers, counselors, principals). `/api/users` scopes them to students+pending only. | `src/app/api/users/route.ts:128` |
| 7 | 🟡 P2 | `AppShell.tsx` header subtitle hardcodes "Modern Web Dev & AI Bootcamp" for ALL users. | `src/components/examiner/AppShell.tsx:702` |
| 8 | 🟡 P2 | `AdminPrincipalTab` buckets students into Early/Mid/Late using `Math.ceil(6 / 3)` — 6-week hardcoded. | `src/components/examiner/admin/AdminPrincipalTab.tsx:264` |
| 9 | 🟡 P2 | `FinalResultPanel` assumes "10 questions per weekly test" in two places — wrong for courses with 5 or 15 questions. | `src/components/examiner/student/FinalResultPanel.tsx:82, 155` |
| 10 | 🟡 P2 | `CourseOutline` "Classic HTML view" link to `/course-plan.html` is still shown to every student, with a stale "can be removed once that course ends (~1 month)" comment. | `src/components/examiner/CourseOutline.tsx:135–147` |

## Other notable findings (not in top 10)

- **`ReportCardPanel.CertificateCard`** uses `useState(() => { load(); })` as a side-effect channel — misuse of the lazy initializer. Works by accident. (`student/ReportCardPanel.tsx:70`)
- **`AdminPrincipalTab` "Run Struggle Detection" button** links to `/app?view=admin-system` — but principals don't have the System tab. Dead-end CTA. (`admin/AdminPrincipalTab.tsx:452`)
- **`CounselorDashboard` defines a local `Bell` component** that re-exports `AlertTriangle`. The real `Bell` icon exists in lucide-react. (`CounselorDashboard.tsx:701–704`)
- **`AdminPMTab` AI warning** says "set DEEPSEEK_API_KEY" even when the admin has configured Gemini or Z.ai. (`admin/AdminPMTab.tsx:89`)
- **`AdminDashboard` 12 top-level tabs** wrap onto 2–3 rows on smaller screens. Needs grouping.
- **`CoursePlanner` "default bootcamp notebook" copy** at 3 locations (lines 468, 602, 1007) leaks bootcamp-specific language into a generic course-authoring tool.
- **`AskMyTeacher` uses `text-growth-coral` / `bg-growth-coral-soft`** Tailwind classes that may not be defined in the theme. (`AskMyTeacher.tsx:116, 132`)
- **`StudentPortfolioPage` line 72 comment** says "Teacher picks a week (1-6)" but the actual dialog shows weeks 1–12. Stale comment, correct code.
- **`TeacherAITutor` suggested prompt** `"Draft a rubric for a WordPress project"` — course-specific copy in a generic AI assistant. (`TeacherAITutor.tsx:118`)
- **Demo account state is not reset between visitors** — localStorage from previous demo sessions persists (DailyTaskReminder popup timers, etc.).
- **`journey` ViewKey** is in the type union but has no nav entry — dead code, harmless.
- **`AdminCoordinatorTab` is hidden inside the admin dashboard** but is the natural landing page for the course_coordinator role. Coordinator role lands on `course-planner` instead.

## Cross-role workflow gaps (affect multiple roles)

1. **No staff-to-staff messaging.** Teachers, counselors, and coordinators can all see student data but can't message each other in-app. Escalation paths (teacher → counselor, counselor → principal) require external email. The `/api/messages/outreach` endpoint exists but has no UI consumer.
2. **No shared "case file" per student.** Each role sees a different slice of the student's data (teacher sees portfolio, counselor sees caseload, principal sees aggregate). When a teacher escalates to a counselor, the counselor has to re-find the student in their caseload rather than clicking through from the teacher's view.
3. **No "I acted on this" feedback loop.** When a teacher acknowledges an alert via the Action Dialog, the counselor's Command Center doesn't show "teacher X acknowledged this alert at Y time". The alert just disappears from the open-queue. The counselor has no visibility into whether their escalation was acted on.
4. **No batch-level "what's happening this week" view** that's shared across roles. Teacher sees their Today view, counselor sees their Command Center, principal sees their Overview — but there's no single "Batch A this week" page that all three can look at together.

## What's genuinely working well

- **Empty states are comprehensive.** Every list/panel I checked has a helpful empty state with context-appropriate copy. The previous audit's empty-state gaps are closed.
- **Loading states are present** on every async surface I checked (dashboards, portfolios, course outline, messages, settings).
- **Error states surface the error message** (not just "something went wrong") on most surfaces. The student dashboard, counselor dashboard, principal dashboard, and guardian dashboard all show the actual error text + a Retry button.
- **Course-aware project config** is fully wired end-to-end: API → AppShell nav filter → StudentDashboard banner → CheckInPanel → ProjectSettingsCard duration dropdown. The "hardcoded 6-week" bug class is fixed *for the project configuration path* — but not for the other surfaces listed above.
- **Action Dialog** (H9 fix) gives teachers a one-click AI-drafted action with editable text + acknowledge — a genuine workflow acceleration.
- **Voice Touchpoint Logger** parses free-text into structured GROW fields — a real time-saver for mentors.
- **Certificate approval flow** (C4 fix) closes the loop between student request and teacher approval.
- **Role-based tab visibility in AdminDashboard** is correctly gated (demo sees only AI Limits, principal sees Principal+Teacher Behavior+Coordinator+Operations+Users+Courses+AI Limits+User Audit, admin sees everything).
- **Self-paced advancement** (P0-6 fix) has a real button with anti-cheat flags + early weekly test unlock notice.
- **Comprehensive report** (H11 fix) is now surfaced to students in the Progress tab.
- **Growth report** (H11 fix) is now surfaced to students with a "Private" badge and clear copy about sharing with mentors, not employers.
- **Daily Task Reminder** popup has thoughtful UX: auto-opens every 10 min when there are pending tasks, dismissable for 15 min, persists state across reloads, refreshes on window focus.

## Recommended next actions (ordered by impact)

1. **P0: Add `demoWriteBlock` to `/api/auth/change-password`** (or hide the Change Password card for demo). 1-line fix.
2. **P0: Replace `TEACHER_BOOTCAMP_PLAN` with a fetch from `/api/courses/user/outline`** (or the student's assigned course's weeks). This is the most visible hardcoded-6-week bug.
3. **P1: Fix `StudentPortfolioPage` "Week X / 6" stat** — use the student's course's `totalWeeks` (already in the portfolio data via `getCourseProjectConfig`).
4. **P1: Fix `RoleNavConfigPanel` Quick Presets** — add `counselor-dashboard` to the Counselor preset; add the 9 missing labels to `NAV_LABELS`.
5. **P1: Expand `/api/users` roleScope for staff** to include other staff roles (teacher → can see counselors+principals+admins of same institution; counselor → can see teachers+principals+admins).
6. **P2: Remove the `/course-plan.html` "Classic HTML view" link** from `CourseOutline.tsx` — the stale comment says it can be removed.
7. **P2: Replace `AppShell.tsx` header subtitle** with the user's institution name (already available via `/api/principal/overview` and `/api/guardian/overview`).
8. **P2: Fix `AdminPrincipalTab` week bucketing** — use the institution's longest course's `totalWeeks` instead of `Math.ceil(6 / 3)`.
9. **P2: Fix `FinalResultPanel` "10 per week" assumption** — divide by the course's actual questions-per-week config.
10. **P3: Address the per-role simplification ideas** above (each is a 1–2 day project).
