# ExaminerAI — UI Components + Prisma Models Inventory

**Date:** 2026-07-26  
**Author:** sub-agent (UI + Prisma inventory auditor)  
**Scope:** Every UI page/panel/component under `src/components/`, every Prisma model in `prisma/schema.prisma`, a field-level comparison against `prisma/schema.prod.prisma`, plus an audit of `src/app/page.tsx`, `src/app/app/page.tsx`, and the `AppShell.tsx` nav config.

---

## Table of Contents
1. [Root + App Pages](#1-root--app-pages)
2. [AppShell Navigation Map](#2-appshell-navigation-map)
3. [UI Components — by Role](#3-ui-components--by-role)
   - 3.1 [Student-facing](#31-student-facing)
   - 3.2 [Teacher-facing](#32-teacher-facing)
   - 3.3 [Counselor-facing](#33-counselor-facing)
   - 3.4 [Course Coordinator-facing](#34-course-coordinator-facing)
   - 3.5 [Principal-facing](#35-principal-facing)
   - 3.6 [Administrator-facing](#36-administrator-facing)
   - 3.7 [Guardian-facing](#37-guardian-facing)
   - 3.8 [Demo role](#38-demo-role)
   - 3.9 [Shared / cross-role](#39-shared--cross-role)
   - 3.10 [Landing page](#310-landing-page)
   - 3.11 [Shared primitives (`src/components/shared/`, `src/components/ui/`)](#311-shared-primitives)
   - 3.12 [Utility / type-only files (no UI)](#312-utility--type-only-files-no-ui)
4. [Prisma Models — full inventory (47 models)](#4-prisma-models--full-inventory-47-models)
5. [Schema Sync Check: `schema.prisma` vs `schema.prod.prisma`](#5-schema-sync-check-schemaprisma-vs-schemaprodprisma)
6. [Summary + Findings](#6-summary--findings)

---

## 1. Root + App Pages

### `src/app/page.tsx` (root `/`)
- **Server component.** Calls `getCurrentUser()`.
- If authenticated → `redirect("/app")` (the dashboard).
- If unauthenticated → renders `<ModernLanding />` (the marketing page at `src/components/landing/modern-landing.tsx`).

### `src/app/app/page.tsx` (`/app`)
- **Client component entry.** Renders `<ErrorBoundary><AppShell /></ErrorBoundary>`.
- `AppShell` is the entire authenticated application: sidebar + header + view router + role switcher + login gate.

### `src/app/layout.tsx` (root layout, for context)
- Sets up Geist Sans + Mono fonts, `ThemeProvider`, `ThemePresetProvider`, and the global `<Toaster />`. Includes SEO metadata (`title`, `description`, `keywords`, `logo.svg` favicon).

---

## 2. AppShell Navigation Map

`AppShell.tsx` defines a `ViewKey` union of 27 keys and an `ALL_NAV` array of 25 `NavItem` records. Nav visibility is determined by either:
- **DB-backed:** `/api/role-nav-config` (admin-customizable per-role nav lists), OR
- **Hardcoded fallback:** the `roles: string[]` field on each `NavItem`.

### Role constant groups (from `AppShell.tsx`)
| Constant | Members |
|---|---|
| `ALL_ROLES_WITH_SHARED` | student, teacher, course_coordinator, counselor, guardian, admin, principal, administrator, demo (9 roles — see shared nav) |
| `ADMIN_NAV_ROLES` | admin, administrator, principal (3 roles — principal added in M2 fix) |
| `PRINCIPAL_NAV_ROLES` | principal (1 role) |
| `STAFF_NAV_ROLES` | teacher, course_coordinator, counselor, admin, principal, administrator, demo (7 roles — excludes students, guardians, pending; `teaching_assistant` was removed) |

### Complete nav table
| # | Nav Key | Label | Icon | Roles (hardcoded default) | Renders |
|---|---|---|---|---|---|
| 1 | `dashboard` | Home | LayoutDashboard | student | `<StudentDashboard />` |
| 2 | `checkin` | Study | BookOpen | student | `<StudentDashboard initialMode="checkin" />` |
| 3 | `gantt` | Project | ClipboardList | student *(hidden when `projectConfig.courseAssigned=false` OR `projectConfig.projectEnabled=false`)* | `<StudentDashboard initialMode="gantt" />` |
| 4 | `report-card` | Progress | FileText | student | `<StudentDashboard initialMode="report-card" />` |
| 5 | `batch` | Today | LayoutDashboard | teacher | `<TeacherDashboard initialTab="today" />` |
| 6 | `batch-students` | Students | Users | teacher, course_coordinator *(M4 fix added coordinator)* | `<TeacherDashboard initialTab="students" />` |
| 7 | `batch-mentorship` | Mentorship | HeartHandshake | teacher | `<TeacherDashboard initialTab="mentorship" />` |
| 8 | `batch-assignments` | Assignments | ClipboardList | teacher | `<TeacherDashboard initialTab="assignments" />` |
| 9 | `batch-insights` | Insights | BarChart3 | teacher | `<TeacherDashboard initialTab="insights" />` |
| 10 | `counselor-dashboard` | Command Center | Zap | counselor | `<CounselorDashboard />` |
| 11 | `course-planner` | Course Planner | GraduationCap | teacher, course_coordinator | `<CoursePlanner />` |
| 12 | `guardian-dashboard` | Overview | LayoutDashboard | guardian | `<GuardianDashboard />` |
| 13 | `guardian-progress` | Report Cards | FileText | guardian | `<GuardianReportCards />` |
| 14 | `principal-dashboard` | Institution | Building2 | principal | `<PrincipalDashboard />` |
| 15 | `admin-dashboard` | Dashboard | LayoutDashboard | admin, administrator, principal | `<AdminDashboard initialView="overview" />` |
| 16 | `admin-users` | Users | Users | admin, administrator, principal | `<AdminDashboard initialView="users" />` |
| 17 | `admin-courses` | Courses | BookOpen | admin, administrator, principal | `<AdminDashboard initialView="courses" />` |
| 18 | `admin-features` | Features | Settings | admin, administrator, principal | `<AdminDashboard initialView="features" />` |
| 19 | `admin-resets` | Passwords | Key | admin, administrator, principal | `<AdminDashboard initialView="resets" />` |
| 20 | `admin-system` | System | ShieldAlert | admin, administrator, principal | `<AdminDashboard initialView="system" />` |
| 21 | `ai-tutor` | AI Tutor | Bot | student, guardian | `<AITutor />` |
| 22 | `teacher-ai-tutor` | AI Assistant | GraduationCap | teacher, course_coordinator, counselor, admin, principal, administrator, demo | `<TeacherAITutor />` |
| 23 | `course-outline` | Course | BookOpen | all 9 roles | `<CourseOutline />` |
| 24 | `messages` | Messages | MessageSquare | all 9 roles *(shows unread red dot when `unreadCount > 0`)* | `<Messages />` |
| 25 | `settings` | Settings | Settings | all 9 roles | `<SettingsPanel user={...} />` |

### Additional `ViewKey` values that exist but are NOT in `ALL_NAV`
These are valid ViewKey strings used internally (e.g. by URL `?view=` params or `navigateTo()` calls) but they don't appear as sidebar items:
- `journey` — aliased to `<StudentDashboard />` (legacy "Today" route, kept for backward compat)
- `question` — aliased to `<StudentDashboard initialMode="question" />` (legacy)
- `weekly-test` — aliased to `<StudentDashboard initialMode="weekly-test" />` (legacy)

### Special UI features in AppShell
- **Demo banner:** A gradient amber→rose banner at the top when `user.email === "demo@examiner.ai"`, warning that writes are blocked.
- **Loading state:** `Sparkles` spinner with "Loading AI Examiner…" — and a 10s timeout screen with a "Retry" button.
- **Unread badge:** Polls `/api/messages?box=received` every 30s; shows `9+` red badge on Messages nav item.
- **Alert badge:** Polls `/api/students/alerts` every 60s for staff; shows amber badge on the Today nav item.
- **Role switcher:** For admin-equivalent roles (`administrator`, `principal`, `demo`, plus legacy `admin`), shows a 7-button "View As Role" panel at the bottom of the sidebar — student, teacher, coordinator, counselor, guardian, principal, admin (L7 fix added the Admin option).
- **Ask My Teacher FAB:** For students only (except on the Messages view), a floating button `<AskMyTeacher currentView={view} />`.
- **Back button:** When `viewHistory.length > 0`, a Back button appears in the header.
- **Document title:** Updated per-view (`"${label} — AI Examiner"`), respects DB nav config.
- **Mobile sidebar:** Hamburger toggle + backdrop; sidebar collapses to `translate-x-full` below `lg`.

---

## 3. UI Components — by Role

**Convention for state check columns:**
- **L** = Loading state (skeleton, spinner, or "Loading…" text)
- **E** = Error state (try/catch + visible error UI, not just silent catch)
- **∅** = Empty state (e.g. "No students yet", "No messages")

### 3.1 Student-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/StudentDashboard.tsx` | Main student dashboard. 4 view modes: Home / Study / Project / Progress. Driven by `initialMode` prop. Wires together daily check-in, AI Tutor, practice questions, daily/weekly tests, Gantt, report cards. | ✅ | ✅ | ⚠️ (partial) |
| 2 | `src/components/examiner/student/CheckInPanel.tsx` | Daily check-in form: "What did you do?", errors, confidence (1-5), git commit, learning reflection, confusion notes, next question. Respects course-aware project config (Task 1 fix). | ❌ | ✅ | ✅ |
| 3 | `src/components/examiner/student/CompactGantt.tsx` | Compact Gantt chart variant shown on the Home view. Fetches custom `ProjectWeek` rows for week titles. | ❌ | ✅ | ✅ |
| 4 | `src/components/examiner/student/GanttPanel.tsx` | Full Gantt chart for the Project tab. Renders `ProjectTask` rows + milestones. | ❌ | ❌ | ❌ |
| 5 | `src/components/examiner/student/ProjectDescriptionCard.tsx` | Shows the student's project name/description/scope/summary. Falls back to inline `<ProjectSettingsCard>` + AI suggestions when no project set. No redundant "set up project" banner (Task 1 fix). | ✅ | ✅ | ✅ |
| 6 | `src/components/examiner/student/ProjectSettingsCard.tsx` | Create/edit project form. Course-aware duration dropdown (`min=2`, `max=courseWeeks-1`, only shown when course ≥ 4 weeks). Fetches course project config from `/api/courses/user/outline`. | ❌ | ✅ | ✅ |
| 7 | `src/components/examiner/student/ProjectSuggestions.tsx` | Fetches 5 AI-generated project ideas from `/api/project/suggestions` based on course content. | ✅ | ✅ | ❌ |
| 8 | `src/components/examiner/student/ProjectWeekPlan.tsx` | Per-week task list + AI-generated week summary. Task form opens within a specific week. | ✅ | ✅ | ✅ |
| 9 | `src/components/examiner/student/ProjectReportPanel.tsx` | Submit weekly/final project reports. AI analysis scored on understanding, technical depth, etc. | ✅ | ✅ | ✅ |
| 10 | `src/components/examiner/student/ProjectProgressChart.tsx` | Bar/line chart of project progress vs configured duration (default 6 weeks). | ❌ | ❌ | ✅ |
| 11 | `src/components/examiner/student/ReportCardPanel.tsx` | Per-week report cards (grade, score, strengths, weaknesses, work habits, examiner observations). Includes certificate-request CTA when student has met completion criteria. Wires `<GrowthReportPanel>` for the Progress tab (H11 fix). Accepts `studentId` prop. | ✅ | ✅ | ✅ |
| 12 | `src/components/examiner/student/GrowthReportPanel.tsx` | Student-facing view of their private growth report (strengths, growth areas, behavioral notes, 7-dimension snapshot). "Generate" button when no report exists. "Private" badge. Added in H11 fix. | ✅ | ✅ | ✅ |
| 13 | `src/components/examiner/student/FinalResultPanel.tsx` | Final result / certificate view. Two grades side by side (course grade + project grade). | ✅ | ✅ | ❌ |
| 14 | `src/components/examiner/student/ComprehensiveReportView.tsx` | Full private report (7 sections: Executive Summary, Educational, Psychological, Behavioral, Mentor, Accomplishments, Recommendations). | ✅ | ✅ | ✅ |
| 15 | `src/components/examiner/student/SecurityQuestionPanel.tsx` | Set/change security question for self-service password reset. Fetches boolean "has question" (not the question itself, for privacy). | ✅ | ✅ | ❌ |
| 16 | `src/components/examiner/student/SelfPacedAdvanceButton.tsx` | "Advance to next day" button when self-paced mode is on + today's tasks are complete. Shows anti-cheat flags. Calls `/api/self-paced`. | ✅ | ✅ | ❌ |
| 17 | `src/components/examiner/student/TeacherComments.tsx` | Shows teacher comments attached to a specific entity (interaction, task, daily log, weekly test). Phase 5.1 extraction. | ❌ | ❌ | ❌ |
| 18 | `src/components/examiner/student/ThemePreferenceControl.tsx` | 3-button theme switcher (light/dark/system). Used in `SettingsPanel`. Uses `next-themes`. | ❌ | ❌ | ❌ |
| 19 | `src/components/examiner/student/CourseOutlineRedirect.tsx` | Legacy redirect component for old course-outline route. | ❌ | ❌ | ❌ |
| 20 | `src/components/examiner/student/shared.tsx` | `StatSquareCard` — small stat card for the Home view (Phase 5.1 extraction). NOT a page. | ❌ | ✅ | ❌ |
| 21 | `src/components/examiner/student/types.ts` | Shared TypeScript types for the student dashboard (`Stats`, `WeeklyTest`, `Mode`, `StatsResponse`, etc.). NOT a UI component. | — | — | — |
| 22 | `src/components/examiner/student/DailyTestPanel.tsx` | **Re-export** shim → `@/modules/assessment/components/DailyTestPanel`. Backward-compat only. | — | — | — |
| 23 | `src/components/examiner/student/PracticePanel.tsx` | **Re-export** shim → `@/modules/assessment/components/PracticePanel`. Backward-compat only. | — | — | — |
| 24 | `src/components/examiner/student/PostTestReflection.tsx` | **Re-export** shim → `@/modules/assessment/components/PostTestReflection`. Backward-compat only. | — | — | — |
| 25 | `src/components/examiner/student/TeachingFeedbackCard.tsx` | **Re-export** shim → `@/modules/assessment/components/TeachingFeedbackCard`. Backward-compat only. | — | — | — |
| 26 | `src/components/examiner/student/WeeklyTestPanel.tsx` | **Re-export** shim → `@/modules/assessment/components/WeeklyTestPanel`. Backward-compat only. | — | — | — |

### 3.2 Teacher-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/TeacherDashboard.tsx` | Main teacher dashboard. 5 tabs (Today/Students/Mentorship/Assignments/Insights) + batch switcher for multi-batch teachers (M1 fix). Single data load (stats + alerts) passed to all views. | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/teacher/TodayView.tsx` | Teacher's command center. Batch Health Pulse stat cards + Triage Queue (Crisis → Alerts → Silent → Blocked → Plagiarism) + Wins to Celebrate + AI Assistant + Action Dialog integration (H9 fix — "Act" button on triage items). | ✅ | ✅ | ✅ |
| 3 | `src/components/examiner/teacher/StudentsRoster.tsx` | Unified student roster. Columns: name, wellbeing tier, week, last active, attention score. Filters: struggling academically / psychologically / overdue / flagged / on-track. H16 fix: filters use typed `wellbeingTier` + `hasFlag` fields. | ❌ | ❌ | ✅ |
| 4 | `src/components/examiner/teacher/MentorshipView.tsx` | GROW coaching at scale. Sections: Follow-ups Due, Active Alerts, Caseload (full student list). Defensive against empty student arrays. | ✅ | ✅ | ✅ |
| 5 | `src/components/examiner/teacher/MentorshipTabV2.tsx` | Rebuilt GROW coaching framework (Goal → Reality → Options → Will). Structured mentorship touchpoint types. | ✅ | ✅ | ✅ |
| 6 | `src/components/examiner/teacher/AssignmentsTab.tsx` | Group-task (assignment) management. C5 fix: fetches teacher's `batchId` from `/api/auth/me` so POST `/api/group-tasks` works. | ✅ | ✅ | ✅ |
| 7 | `src/components/examiner/teacher/InsightsView.tsx` | Batch-level analytics + AI Assistant for weekly review. Sections: batch distribution, trend charts, AI weekly summary. Defensive against empty arrays. | ✅ | ✅ | ✅ |
| 8 | `src/components/examiner/teacher/EducationalTab.tsx` | Educational analytics per student. Computes mastery from interactions if API hasn't returned any (fallback). | ✅ | ✅ | ✅ |
| 9 | `src/components/examiner/teacher/PsychologicalTab.tsx` | Psychological 7-dimension view per student. Crisis-flag creation UI (P1.1 fix). | ✅ | ✅ | ✅ |
| 10 | `src/components/examiner/teacher/StatCard.tsx` | Stat card primitive for the Today view (red accent for "Needs Attention"). NOT a page. | ❌ | ❌ | ❌ |
| 11 | `src/components/examiner/teacher/SpatialBatchMap.tsx` | Visual batch ScatterChart. Position = progress (X), color = wellbeing tier, size = attention needed. Click a node → student detail. Pure frontend (consumes `buildTeacherBatchSummary`). | ❌ | ❌ | ✅ |
| 12 | `src/components/examiner/teacher/CalibrationScatterCard.tsx` | Scatter chart showing Dunning-Kruger calibration (predicted vs actual score per student). | ❌ | ❌ | ✅ |
| 13 | `src/components/examiner/teacher/TeacherCourseProgressView.tsx` | 6-week (or course-length) stepper showing batch progress through the course outline. | ❌ | ❌ | ✅ |
| 14 | `src/components/examiner/teacher/TeacherLoadPanel.tsx` | Teacher's own wellbeing/load metrics. Tier (green/amber/red) + reasons, response-time trend, touchpoint completion rate, load vs capacity, crisis load. Added in H10 fix. | ✅ | ✅ | ❌ |
| 15 | `src/components/examiner/teacher/TeacherRulesPanel.tsx` | Dropdown-based builder for personal teacher rules (predicates + actions). No free-text parsing. | ✅ | ✅ | ✅ |
| 16 | `src/components/examiner/teacher/UserAuditTab.tsx` | Comprehensive audit trail for any user. Activity summary cards + AI usage breakdown + paginated audit log. Visible to principal + administrator + the user themselves (self-audit). | ✅ | ✅ | ✅ |
| 17 | `src/components/examiner/teacher/VoiceTouchpointLogger.tsx` | Natural-language touchpoint logging ("Log a touchpoint with Alex, went well, still worried about pacing") → AI parses into structured fields → teacher confirms → saved. Also used by counselors (L8 fix: `onReload` callback). | ✅ | ✅ | ❌ |
| 18 | `src/components/examiner/teacher/CaseReviewPanel.tsx` | Anonymized peer case review. Teachers post anonymized patterns; AI strips identifying details before posting. | ✅ | ✅ | ✅ |
| 19 | `src/components/examiner/teacher/CertificateApprovals.tsx` | Staff UI for reviewing + approving/rejecting student certificate requests. Shows eligibility info computed by the API. Added in C4 fix. | ✅ | ✅ | ✅ |
| 20 | `src/components/examiner/teacher/GuardianCreationPanel.tsx` | Staff form for creating/removing guardian accounts linked to students. Added in H6 fix. | ✅ | ✅ | ✅ |
| 21 | `src/components/examiner/teacher/PeerAssessmentTeacherView.tsx` | Aggregated peer-assessment results per assessee, including text feedback. | ✅ | ✅ | ❌ |
| 22 | `src/components/examiner/teacher/StudentPortfolioPage.tsx` | Per-student deep-dive page (opens in new tab from counselor dashboard — H7 fix). Fetches current user's role for audit-tab visibility. | ✅ | ✅ | ✅ |
| 23 | `src/components/examiner/teacher/ai/AIAssistantBox.tsx` | Free-text AI query box on Today view. Synthesized answer with reasoning + clickable student references. Uses `/api/teacher/assistant`. Keeps last 5 queries in-session. | ✅ | ✅ | ❌ |
| 24 | `src/components/examiner/teacher/ai/StudentAITools.tsx` | AI features for student detail panel: Explain this student, Living-book narrative, Draft-a-check-in, Rehearsal mode (practice conversation against AI student persona). | ✅ | ✅ | ✅ |
| 25 | `src/components/examiner/teacher/types.ts` | Shared types for teacher dashboard (`StudentRow`, `PortfolioData`, etc.). NOT a UI component. | — | — | — |
| 26 | `src/components/examiner/teacher/computeMasteryFromInteractions.tsx` | Utility function: derives mastery level (mastered/proficient/developing/not-started) from `Interaction.correctness` scores per topic. NOT a UI component. | — | — | — |

### 3.3 Counselor-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/CounselorDashboard.tsx` | Purpose-built counselor command center (NOT a teacher clone). 5 jobs: monitor institution-wide wellbeing, manage crisis flags + escalate, conduct GROW mentorship sessions + track follow-ups, spot batch-level psychological patterns, voice-touchpoint logging. Opens student portfolio in new tab (H7 fix). Accepts `onNavigateToMessages` + `onStudentClick` callbacks. L8 fix: `SessionsView` accepts `onReload` so logging a session refreshes the list. | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/teacher/VoiceTouchpointLogger.tsx` | **Shared with teachers.** Used by counselors in their Sessions tab. | ✅ | ✅ | ❌ |

> **Note:** Counselors also see all "Shared / cross-role" components (see 3.9).

### 3.4 Course Coordinator-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/CoursePlanner.tsx` | Course outline editor (weeks/days/topics/activities/deliverables/resources) + course metadata (domain, level, tools, deliverable types, assessment type/config, NotebookLM URL, subjects, project config — `projectEnabled` / `projectRequired` / `projectDefaultDurationWeeks` — Task 1 fix, institution link, set-as-default). Used by both coordinators AND teachers. | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/teacher/StudentsRoster.tsx` | **Shared with teachers.** M4 fix gave coordinators access to the batch-students view so they can see students in their institution's courses. | ❌ | ❌ | ✅ |
| 3 | `src/components/examiner/TeacherDashboard.tsx` | **Shared with teachers.** When a coordinator clicks "Students" nav, AppShell renders `<TeacherDashboard initialTab="students" />`. | ✅ | ✅ | ✅ |

> **Note:** Coordinators also see all "Shared / cross-role" components (see 3.9).

### 3.5 Principal-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/PrincipalDashboard.tsx` | Institution administrator dashboard (institution-scoped, NOT system-level). Manages teachers, courses, batches, students. Monitors institution-wide wellbeing + academic performance. Reviews audit logs + growth reports. NO system-level controls (AI config, feature flags, password resets — those are admin-only). Fetches current user's actual role (not impersonated) to hide Audit Log tab from demo accounts. | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/admin/AdminPrincipalTab.tsx` | Institution management dashboard for principals (embedded inside `AdminDashboard` when admin-equivalent users click the "Principal" sub-tab). Manages courses, batches, teachers, students, settings, branding (logo). | ✅ | ✅ | ✅ |

> **Note:** Principals are in `ADMIN_NAV_ROLES` (M2 fix), so they ALSO see all 6 admin nav items (`admin-dashboard`, `admin-users`, `admin-courses`, `admin-features`, `admin-resets`, `admin-system`). They also see all "Shared / cross-role" components (3.9).

### 3.6 Administrator-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/AdminDashboard.tsx` | Container for admin sub-views. 12 internal `view` values: `overview`, `users`, `courses`, `features`, `resets`, `system`, `principal`, `coordinator`, `pm`, `teacher-behavior`, `ai-limits`, `user-audit`. Role-based tab visibility (P1.3 fix — fetches current user's role). | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/admin/AdminOverview.tsx` | Stat cards overview for the admin dashboard. | ❌ | ❌ | ❌ |
| 3 | `src/components/examiner/admin/OverviewStat.tsx` | Single stat card primitive used by `AdminOverview`. NOT a page. | ❌ | ❌ | ❌ |
| 4 | `src/components/examiner/admin/QuickAction.tsx` | Quick-action button primitive. NOT a page. | ❌ | ❌ | ❌ |
| 5 | `src/components/examiner/admin/LayoutDashboard.tsx` | SVG icon component (NOT a page, despite the name — it's a layout-grid icon). | ❌ | ❌ | ❌ |
| 6 | `src/components/examiner/admin/AccessGrantsPanel.tsx` | Phase RBAC+AUDIT Phase 2 — scoped least-privilege access grant management. Create/revoke grants by scopeType (batch/student/course/institution) + dataScope. | ✅ | ✅ | ✅ |
| 7 | `src/components/examiner/admin/AdminCoursesPanel.tsx` | Course catalog management. List, create, edit, delete courses. Set default course. | ✅ | ✅ | ✅ |
| 8 | `src/components/examiner/admin/AdminCoordinatorTab.tsx` | Coordinator management sub-tab. Course catalog summary + content quality checks (empty descriptions, no batches, inactive). | ✅ | ✅ | ✅ |
| 9 | `src/components/examiner/admin/AdminPMTab.tsx` | PM (program manager) sub-tab. Action items: pending approvals + blocked users + students with no project. | ✅ | ✅ | ❌ |
| 10 | `src/components/examiner/admin/AuditLogPanel.tsx` | Universal append-only audit log viewer (Phase RBAC+AUDIT Phase 4). | ✅ | ✅ | ✅ |
| 11 | `src/components/examiner/admin/FeaturesPanel.tsx` | Feature flag management (toggles for course-aware projects, peer assessment, etc.). | ✅ | ✅ | ❌ |
| 12 | `src/components/examiner/admin/PasswordResetPanel.tsx` | Admin-reset workflow: view/approve student password-reset requests, set temp passwords. | ✅ | ✅ | ✅ |
| 13 | `src/components/examiner/admin/RoleNavConfigPanel.tsx` | Admin-customizable per-role nav config. Override which nav items each role sees (replaces hardcoded `ALL_NAV` roles). | ✅ | ✅ | ✅ |
| 14 | `src/components/examiner/admin/SystemPanel.tsx` | System health: env var status, DB table counts, feature flags, AI connection diagnostics. | ✅ | ✅ | ❌ |
| 15 | `src/components/examiner/admin/TeacherBehaviorTab.tsx` | Per-teacher AI Assistant usage + behavioral signals. Reads from `ChatSession`. Recent sessions list + per-teacher summary. | ✅ | ✅ | ✅ |
| 16 | `src/components/examiner/admin/AIConnectionPanel.tsx` | AI provider config: API key, model selection, test connection. | ❌ | ✅ | ❌ |
| 17 | `src/components/examiner/admin/AILimitsPanel.tsx` | Per-category AI rate-limit config (test=50/day, tutor=150/day, assistant=100/day defaults). Demo only sees the demo-AI toggle (admin-only configuration inputs hidden). | ✅ | ✅ | ❌ |
| 18 | `src/components/examiner/admin/types.ts` | Shared admin types (`UserRow`, `ResetRequest`). NOT a UI component. | — | — | — |
| 19 | `src/components/examiner/teacher/UserAuditTab.tsx` | **Shared with principals.** Full audit trail for any user — wired into AdminDashboard under the `user-audit` view. | ✅ | ✅ | ✅ |

### 3.7 Guardian-facing

| # | File | Description | L | E | ∅ |
|---|---|---|---|---|---|
| 1 | `src/components/examiner/GuardianDashboard.tsx` | Purpose-built parent dashboard (NOT a student clone). 4 questions answered: "How is my child doing overall?" (Overview snapshot), "Are there any concerns?" (Concerns + alerts), "What did my child do this week?" (Activity timeline), "How can I help?" (Teacher recommendations + messaging). Simple, non-technical UI. Accepts `onMessage` callback. | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/GuardianReportCards.tsx` | Dedicated report-card view for guardians (H14 fix — was rendering the same Overview page). Shows ALL report cards (not just the few in the overview) with full details + trend computation (avg of last 3 vs avg of previous 3). | ✅ | ✅ | ✅ |

> **Note:** Guardians also see the `ai-tutor` nav item (shared with students) and all 3 shared nav items (`course-outline`, `messages`, `settings`). They use `<AITutor />` in read-only mode for their child's course context.

### 3.8 Demo role

The `demo@examiner.ai` account is a read-only preview role. It is in `ADMIN_ROLES` (so it can preview all admin dashboards) AND in `STAFF_NAV_ROLES` (so it sees `teacher-ai-tutor`, `course-outline`, `messages`, `settings`).

| Behavior | Detail |
|---|---|
| Default landing view | `<TeacherDashboard initialTab="today" />` (adminAs defaults to `"teacher"` per user request) |
| Demo banner | Gradient amber→rose banner at the top: "DEMO MODE — Read-only access. Write actions are blocked." |
| Role switcher | 7 buttons: Student, Teacher, Coordinator, Counselor, Guardian, Principal, Admin (L7 fix added Admin) |
| Nav items visible | Whatever the currently-impersonated role sees, PLUS the role switcher panel |
| Write blocking | Client-side: `localStorage.setItem("examiner-is-demo", "1")` flag → demo-guard.ts blocks writes. Server-side: `isDemoAIBlocked()` + `demoWriteBlock()` helpers. |
| AI rate limits | `enforceAIRateLimit()` (H1 fix) blocks demo from making AI calls (demo-AI toggle in AILimitsPanel) |

The demo user sees no nav items of its own — it impersonates other roles via the switcher.

### 3.9 Shared / cross-role

These components are used by multiple roles (often all 9 roles via `ALL_ROLES_WITH_SHARED`).

| # | File | Roles | Description | L | E | ∅ |
|---|---|---|---|---|---|---|
| 1 | `src/components/examiner/AppShell.tsx` | all | Sidebar + header + view router + role switcher + login gate. Wraps every authenticated view in `<ErrorBoundary>` (per-view crash isolation). | ✅ | ✅ | ✅ |
| 2 | `src/components/examiner/Login.tsx` | unauthenticated | Login form (email/password), security-question-based self-service password reset, demo-account quick login. Exports `PublicUser` type. | ❌ | ✅ | ❌ |
| 3 | `src/components/examiner/ForgotPassword.tsx` | unauthenticated | Multi-step forgot-password flow: enter email → answer security question → set new password. | ❌ | ✅ | ❌ |
| 4 | `src/components/examiner/ErrorBoundary.tsx` | all | React class error boundary. Catches client-side errors → shows friendly error card IN PLACE of the crashed component (sidebar + header stay functional). "Try Again" button re-renders. | ❌ | ✅ | ❌ |
| 5 | `src/components/examiner/Messages.tsx` | all 9 roles | Inbox + Sent tabs, compose dialog, user picker (teachers/admins see everyone; students see teachers+admin). Mark-all-read, delete, reply. | ✅ | ✅ | ✅ |
| 6 | `src/components/examiner/CourseOutline.tsx` | all 9 roles | DB-driven course outline view (replaces the old static `course-plan.html` iframe). Fetches from `/api/courses/user/outline`. Native rendering, expandable weeks/days. Phase 2.3. | ✅ | ✅ | ✅ |
| 7 | `src/components/examiner/CoursePlanner.tsx` | teacher, course_coordinator (also admin-equivalent via role switcher) | Pro Course Editor — full course outline CRUD + course metadata + project config + set-as-default. | ✅ | ✅ | ✅ |
| 8 | `src/components/examiner/SettingsPanel.tsx` | all 9 roles | Unified settings page (H13 fix — was rendering `<StudentDashboard>` for every role). Profile info (read-only), theme preference, change password, security question. | ❌ | ✅ | ✅ |
| 9 | `src/components/examiner/AITutor.tsx` | student, guardian | Student-facing AI Tutor chatbot. Teaches current week's topic, connects concepts to project, 3-step teaching method (analogy → example → project mapping), Roman English support, [Coherence Check] suffix. Logs behavioral signals. Backend: `/api/ai/tutor`. | ❌ | ✅ | ❌ |
| 10 | `src/components/examiner/TeacherAITutor.tsx` | teacher, course_coordinator, counselor, admin, principal, administrator, demo (STAFF_NAV_ROLES) | AI Assistant chatbot for staff. System prompt tuned for teaching assistance (lesson prep, case review, rubric design, parent comms, pedagogical guidance). Behavioral signals logged to same ChatSession pipeline. Backend: `/api/ai/teacher-tutor`. | ❌ | ✅ | ❌ |
| 11 | `src/components/examiner/AskMyTeacher.tsx` | student only | Floating "Ask My Teacher" button (Phase E.1). Opens a dialog to compose a message to the student's teacher. Hidden on the Messages view. | ✅ | ✅ | ✅ |
| 12 | `src/components/examiner/DailyTaskReminder.tsx` | student only | Floating daily-task reminder popup. Persists `lastPopupShown` + `dismissedUntil` in localStorage. Polls for today's tasks. | ❌ | ✅ | ✅ |
| 13 | `src/components/examiner/MarkdownRenderer.tsx` | all (consumed by AI chat components) | Lightweight safe markdown renderer for AI responses: headings, bold, italic, code, links, lists, tables, horizontal rules, code blocks, blockquotes. URL sanitizer blocks `javascript:`. | ❌ | ❌ | ✅ |
| 14 | `src/components/shared/action-dialog.tsx` | all staff (consumed by TodayView, AI Assistant) | AI Assistant Section 4 — ONE reusable dialog for every flag type. Shows AI-generated headline + "Why" + "Suggested action". Teacher can edit + confirm. | ❌ | ❌ | ❌ |
| 15 | `src/components/shared/prominent-tabs.tsx` | all (consumed by CounselorDashboard, PrincipalDashboard, TeacherDashboard) | Reusable horizontal tab bar. Prominent active state, icon support, badge support, horizontally scrollable on mobile, theme-synced. Two variants (pill / underline). | ❌ | ❌ | ❌ |

### 3.10 Landing page

| # | File | Roles | Description | L | E | ∅ |
|---|---|---|---|---|---|---|
| 1 | `src/components/landing/modern-landing.tsx` | unauthenticated visitors | Marketing landing page. Showcases all 6 role dashboards (Student, Teacher, Counsellor, Guardian, Principal, Admin) with screenshots + feature highlights. "Sign In" CTA → `/app`. | ❌ | ❌ | ✅ |

### 3.11 Shared primitives

These are the shadcn/ui primitive library + theme components. They are NOT role-specific — they're consumed by every UI component.

| Subdirectory | Contents |
|---|---|
| `src/components/ui/` | 51 shadcn/ui primitives: `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty-state`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radial-progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`. |
| `src/components/theme-provider.tsx` | `next-themes` provider wrapper (light/dark/system). |
| `src/components/theme-toggle.tsx` | Light/dark toggle button (sidebar footer). |

> Notable: `src/components/ui/empty-state.tsx` is a reusable empty-state primitive — present but underused (most components roll their own empty-state UI inline rather than consuming this).

### 3.12 Utility / type-only files (no UI)

These files live under `src/components/` but contain no rendered UI — they're types or pure functions.

| File | Purpose |
|---|---|
| `src/components/examiner/student/types.ts` | Shared types for the student dashboard (`Stats`, `WeeklyTest`, `Mode`, `StatsResponse`). 165 lines. |
| `src/components/examiner/teacher/types.ts` | Shared types for the teacher dashboard (`StudentRow`, `PortfolioData`). 68 lines. |
| `src/components/examiner/admin/types.ts` | Shared types for the admin dashboard (`UserRow`, `ResetRequest`). 24 lines. |
| `src/components/examiner/teacher/computeMasteryFromInteractions.tsx` | Pure function: derives per-topic mastery from `Interaction.correctness` scores. Used as a fallback when the API doesn't return mastery data. |

---

## 4. Prisma Models — full inventory (47 models)

Source: `prisma/schema.prisma` (default, SQLite for local dev). All 47 models also exist in `prisma/schema.prod.prisma` (PostgreSQL for Vercel). See [Section 5](#5-schema-sync-check-schemaprisma-vs-schemaprodprisma) for the sync check.

| # | Model | Description | Key relations |
|---|---|---|---|
| 1 | `Batch` | A group of students going through a bootcamp together (renamed from `Cohort`). Multiple intakes without data collision. Existing users default to the "default" batch. | `course`, `users`, `teachers` (m2m via BatchTeacher), `groupTasks`, `events` |
| 2 | `BatchTeacher` | Many-to-many junction between `Batch` and teacher `User`s. Students stay one-batch-each via `User.batchId`; teachers get multi-batch access via this table. | `batch`, `teacher` |
| 3 | `Course` | Named curriculum outline for ANY subject (CS, mechanical, HR, business, etc.). Created/edited via the Pro Course Editor. Holds domain metadata, assessment config, project config (`projectEnabled` / `projectRequired` / `projectDefaultDurationWeeks` — Task 1), `isDefault` flag, institution link, NotebookLM URL, subjects JSON. | `institution`, `batches`, `weeks`, `events` |
| 4 | `CourseWeek` | One week of a course: `weekNumber`, `phase` (e.g. "Fundamentals of Thermodynamics"), `milestone`. | `course`, `days` |
| 5 | `CourseDay` | One day within a `CourseWeek`: `day` (1-7), `title`, `objective`, `whyItMatters`, `topicsCovered` (JSON), `activity`, `deliverable`, `resources` (JSON), `teacherNote` (AI-generated guidance for question generation). | `courseWeek` |
| 6 | `User` | Central user table — all roles. Fields: email, name, passwordHash, role (String, normalized in `rbac.ts`), `blocked`, `approvedAt`, `currentWeek`/`currentDay` (self-paced progress), `selfPacedEnabled`, `batchId`, all `project*` fields (name/description/type/scope/objectives/requirements/businessCase/summary/keyFeatures/durationWeeks/startDate/notes/githubUrl/deployUrl), `journeyProgress` (JSON), `securityAnswer` (hashed). | `batch`, `dailyLogs`, `tasks`, `projectWeeks`, `projectReports`, `interactions`, `weeklyTests`, `competencies`, `reportCards`, `psychObs`, `curriculumProgress`, `commentsGiven`, `commentsRecv`, `messagesSent`, `messagesRecv`, `resetRequests`, `certificates`, `accessGrantsReceived`, `accessGrantsGiven`, `auditLogs`, `confidenceRatings`, `wellbeingState`, `crisisFlags`, `psychEvidence`, `skillMastery`, `mentorshipTouchpoints`, `dailyTests`, `chatSessions`, `eventsCreated`, `institution`, `groupTasksTaught`, `guardianLinks`, `studentGuardians`, `peerAssessmentsGiven`, `peerAssessmentsReceived`, `teacherRules`, `caseReviewsPosted`, `caseReviewResponses` |
| 7 | `PasswordResetRequest` | Admin-reset workflow: student requests a reset, admin approves + sets a temp password. | `user` |
| 8 | `DailyLog` | Student's daily check-in: `week`, `whatDidYouDo`, `anyErrors`, `confidence` (1-5), `gitCommit`, learning reflection fields (`learningReflection`, `confusionNotes`, `nextQuestion`). | `user` |
| 9 | `ProjectTask` | One task in a student's capstone project: `description`, `status` (planned/in-progress/completed/blocked), `week`, optional `day` (1-5), `dueDate`, `completedAt`, `estimatedMinutes`, `isMilestone`, `taskNotes`, `timeEstimate`. | `user` |
| 10 | `ProjectWeek` | Custom week titles + AI-generated summaries for the student's project. One row per week (1..projectDurationWeeks). | `user` |
| 11 | `ProjectReport` | Student's weekly or final project report with AI analysis. AI scores on project understanding, technical depth, etc. | `user` |
| 12 | `CurriculumProgress` | Tracks which curriculum days a student has completed. One row per `(userId, week, day)`. The curriculum itself is fixed in `src/lib/course-topics.ts`. | `user` |
| 13 | `Interaction` | One practice-question interaction: `week`, `pillar` (Why Probe / Break-It Scenario / Client Translation / Edge Case Test), `topic`, `question`, `studentAnswer`, `correctness` (0-100), `feedback`, `level`, `gaps` (JSON), `followUp`, cognitive load / confidence / metacognitive fields, `plagiarismScore`. | `user` |
| 14 | `WeeklyTest` | Weekly Socratic test: `status` (locked/available/in-progress/completed), `score`, strengths/weaknesses (JSON), chatbot agent fields (`conversation`, `currentQuestion`, `replyCount`), `psychAnalysis`, `examinerComment`, `plagiarismScore`, `retakeAllowed` (teacher-gated). | `user` |
| 15 | `Competency` | Per-topic competency: `level` (Beginner/…), `score`, `attempts`, `lastAssessed`, `weakSubTopics` (JSON). | `user` |
| 16 | `ReportCard` | Per-week report card: `grade`, `score`, strengths/weaknesses (JSON), `workHabits`, `progress`, `nextSteps` (JSON), `examinerObservations`. | `user` |
| 17 | `PsychologyObs` | Per-week psychological observation: `confidence`, `communication`, `learningCurve`, `engagement`, `cognitiveLoad`, `metacognitive`, `remarks`. (Legacy — newer system uses `PsychEvidence` for 7-dimension evidence.) | `user` |
| 18 | `AICache` | AI response cache — avoids redundant AI calls for the same week/topic/pillar. Used by practice-question generation. | *(no relations)* |
| 19 | `AIUsageLog` | Unified AI usage log — every AI call recorded (provider, token counts, cost, feature, userId, error). Powers the admin dashboard's AI stats. | *(no relations)* |
| 20 | `Message` | Internal messaging: `fromId`, `toId`, `subject`, `body`, `sentAt`, `isRead`, `reply`, `repliedAt`. | `from`, `to` |
| 21 | `Comment` | Teacher comment attached to a specific entity (interaction / task / weekly test / daily log). Optional `marksOverride`. | `student`, `teacher` |
| 22 | `Setting` | App-wide settings (key/value store). Stores the Gemini API key in the DB (encrypted at rest) so admins can set it from the UI. | *(no relations)* |
| 23 | `Certificate` | Issued when a student completes their course. DB row + shareable verification token. | `user`, `institution` |
| 24 | `AccessGrant` | Phase RBAC+AUDIT Phase 2 — scoped least-privilege access. `scopeType` (batch/student/course/institution) + `dataScope` (read/write/etc.). | `grantee`, `grantedBy` |
| 25 | `AuditLog` | Phase RBAC+AUDIT Phase 4 — universal append-only audit log. NEVER stores sensitive crisis content in `beforeJson`/`afterJson` (per CrisisFlag model docs). | `actor` |
| 26 | `ConfidenceRating` | Single student self-rating OR AI-observed confidence signal. Used by the Psychological tab for Dunning-Kruger calibration. | `user` |
| 27 | `WellbeingState` | Current Green/Amber/Red tier per student. Detection lives on the Psychological tab; human-response lives on the Mentorship tab. | `user` |
| 28 | `CrisisFlag` | A flagged concern requiring human follow-up. Existence/state is shown on Psychological tab; human response is on Mentorship. Content is sensitive — NEVER duplicated into AuditLog. | `user` |
| 29 | `PsychEvidence` | One observation across one of the 7 dimensions (calibration, explanatory_depth, gaming_pattern, srl_phase, fluency, attribution, cognitive_load). Sourced — every entry links to the interaction/test that produced it. | `user` |
| 30 | `SkillMastery` | Per-topic mastery computed from Interaction/WeeklyTest data. Turns "week 3: 68%" into "database queries: developing, custom post types: proficient". | `user` |
| 31 | `MentorshipTouchpoint` | Every logged contact between staff and student. Auto-written by alert-response actions + manually logged by teachers. Makes "presence tracking" possible. | `user` |
| 32 | `DailyTest` | Short 2-3 question test running on a daily cadence. Same Socratic format as the weekly test, just shorter. | `user` |
| 33 | `DailyTestAnswer` | One answer within a `DailyTest`: `question`, `answer`, `score`, `timeTakenSec`, `confidenceRating`, `topic` (for fine-grained SkillMastery). | `dailyTest` |
| 34 | `GroupTask` | Phase Scale Tier 2 — teacher assigns work to an entire batch. `type` (assignment/project/reading/practice/other), `dueDate`, `status` (open/closed/graded), `maxScore`. | `batch`, `teacher`, `submissions`, `peerAssessments` |
| 35 | `GroupTaskSubmission` | Student's submission for a `GroupTask`: `content`, `link` (URL), `score`, `feedback`, `submittedAt`, `gradedAt`. | `groupTask`, `user` |
| 36 | `Event` | Scheduled calendar event: `type` (deadline/exam/meeting/activity/holiday/vocational/extracurricular/other), `activityType` (workshop/internship/industry_visit/club/sports/arts/competition/community_service), `startDate`, `endDate`, `location`, `isAllDay`. | `batch`, `course`, `createdBy` |
| 37 | `PeerAssessment` | Students rate their group members' behavior after group activities. Feeds into the analysis pipeline (PsychEvidence, etc.). | `groupTask`, `assessor`, `assessee` |
| 38 | `RoleNavConfig` | Admin-configurable navigation per role. Replaces hardcoded `ALL_NAV` roles in `AppShell.tsx`. Each row = (role, navItems[]). | *(no relations)* |
| 39 | `GuardianLink` | Guardian↔Student link — allows guardians to see their own children's data without an explicit `AccessGrant`. A guardian can have multiple children; a student can have multiple guardians. | `guardian`, `student` |
| 40 | `TeacherRule` | Phase 3.5 — configurable personal rules for teachers (predicates + actions). | `teacher` |
| 41 | `CaseReview` | Phase 3.7 — anonymized peer case review. Teachers post patterns for peer consultation. AI strips identifying details before posting. | `postedByUser` |
| 42 | `CaseReviewResponse` | One response on a `CaseReview` from another teacher. | `caseReview`, `responder` |
| 43 | `StudentHealthSummary` | ONE row per student. Lightweight aggregate stats for the teacher dashboard's health overview. Updated on every interaction via a single db trigger. | `user` |
| 44 | `ChatSession` | Unified ChatSession — stores ALL chatbot sessions across the platform: student tests (practice/daily/weekly), student AI Tutor sessions, teacher AI Assistant sessions (behavioral logging). | `user` |
| 45 | `StudentAlert` | Created when a student crosses a psych/educational/mentorship threshold. Shown to teachers in the dashboard + mentorship tab. Resolved when the teacher takes action (logs a touchpoint or acknowledges). | `user` |
| 46 | `Institution` | Represents the organization running courses (e.g. FCCL-MIS). All users, courses, and certificates belong to an institution. | *(no relations — referenced by User, Course, Certificate)* |
| 47 | `GrowthReport` | Private, honest student growth summary generated at course completion. NOT publicly verifiable (unlike Certificate). Contains real shortcomings alongside strengths. | `user` |

---

## 5. Schema Sync Check: `schema.prisma` vs `schema.prod.prisma`

### Methodology
1. Extracted every `model { … }` block from both files.
2. Stripped comments (`//…`) and normalized whitespace.
3. Compared the field/relation/index lines **as sets** (sorted) per model — i.e. insensitive to field ordering within a model.
4. Verified all 47 model names match in both files (no model exists in only one file).
5. Verified all 16 `@relation` fields on the `User` model match in both files.

### Result: **✅ Schemas are IN SYNC at the field level.**

- DEV model count: **47**
- PROD model count: **47**
- Models in DEV only: **0**
- Models in PROD only: **0**
- Models with field-level differences: **0** *(all 47 models have identical fields, relations, indexes, defaults, and constraints)*
- Total stripped lines: DEV 786 = PROD 786 ✓

### The ONLY differences (all cosmetic / by-design):

| # | Difference | Type | Impact |
|---|---|---|---|
| 1 | **Datasource provider** — DEV = `sqlite`, PROD = `postgresql` | **By design** | None — this is the entire reason for having two schemas. SQLite for zero-setup local dev; Postgres for Vercel serverless. |
| 2 | **Comment richness** — DEV has fuller inline comments (e.g. the `Course` model's project-config docs, the `User` model's role docs); PROD has condensed one-liners like `"see schema.prisma for full docs"` | Cosmetic | None — comments don't affect the generated Prisma Client. |
| 3 | **Field ordering in `User` model** — `chatSessions` and `eventsCreated` are placed at slightly different positions within the relations block | Cosmetic | None — Prisma is order-insensitive. |
| 4 | **File-level ordering of `StudentAlert` model** — appears at a different position in the file | Cosmetic | None — file order doesn't affect the Prisma Client. |
| 5 | **Line counts** — DEV 1200 lines, PROD 993 lines | Cosmetic | Reflects only the stripped comments. |

### Recommendation
- **No action needed.** The schemas are functionally identical.
- If you want to make the cosmetic alignment perfect (so `diff` returns zero), strip the dev-only comments from `schema.prisma` OR copy them into `schema.prod.prisma`. Low priority.
- Consider adding a CI check (`prisma format --check` on both schemas) to catch drift early — but since Prisma itself normalizes formatting, the current setup is safe.

---

## 6. Summary + Findings

### Component inventory totals
| Group | Count |
|---|---|
| Top-level examiner components (`src/components/examiner/*.tsx`) | 22 |
| Admin sub-components (`src/components/examiner/admin/*.tsx`) | 17 (15 components + `types.ts` + nothing else) |
| Student sub-components (`src/components/examiner/student/*.tsx`) | 26 (20 components + `types.ts` + `shared.tsx` + 5 re-export shims) |
| Teacher sub-components (`src/components/examiner/teacher/*.tsx`) | 26 (22 components + `types.ts` + `computeMasteryFromInteractions.tsx` + 2 ai/ components) |
| Shared (`src/components/shared/*.tsx`) | 2 (`action-dialog`, `prominent-tabs`) |
| Landing (`src/components/landing/*.tsx`) | 1 (`modern-landing`) |
| Theme (`src/components/theme-*.tsx`) | 2 (`theme-provider`, `theme-toggle`) |
| shadcn/ui primitives (`src/components/ui/*.tsx`) | 51 |
| **Total `.tsx`/`.ts` files under `src/components/`** | **147** |

### Prisma inventory totals
- **47 models** in both `schema.prisma` and `schema.prod.prisma`
- **0 enums** (roles are stored as `String` and normalized in `src/lib/rbac.ts` to avoid SQLite migration friction)
- **0 field-level differences** between the two schemas

### Notable findings

1. **5 legacy re-export shims in `src/components/examiner/student/`** — `DailyTestPanel`, `PracticePanel`, `PostTestReflection`, `TeachingFeedbackCard`, `WeeklyTestPanel` are now one-line `export * from "@/modules/assessment/components/..."` files. They exist for backward-compat with older imports. The actual implementations live in `src/modules/assessment/components/`. **Action:** Safe to delete once all imports are updated to point directly at `@/modules/assessment/components/`.

2. **Loading/error/empty state coverage is uneven across the codebase.** Most top-level dashboards (StudentDashboard, TeacherDashboard, CounselorDashboard, PrincipalDashboard, AdminDashboard, GuardianDashboard) have all three states. But many smaller panels are missing one or more:
   - `GanttPanel.tsx`, `TeacherComments.tsx`, `ThemePreferenceControl.tsx` — no loading, error, OR empty state.
   - `ProjectProgressChart.tsx`, `StudentsRoster.tsx`, `SpatialBatchMap.tsx`, `CalibrationScatterCard.tsx`, `TeacherCourseProgressView.tsx` — no loading state.
   - `AIConnectionPanel.tsx`, `AILimitsPanel.tsx`, `FinalResultPanel.tsx`, `ProjectSuggestions.tsx`, `SecurityQuestionPanel.tsx`, `SelfPacedAdvanceButton.tsx`, `VoiceTouchpointLogger.tsx`, `AIAssistantBox.tsx` — no empty state.
   - **Action:** Consider standardizing on the existing `src/components/ui/empty-state.tsx` primitive + a shared `<LoadingState />` / `<ErrorState />` pair (these don't exist yet — would be a useful addition).

3. **`src/components/ui/empty-state.tsx` exists but is underused.** Most components roll their own inline empty-state UI ("No students yet", "No messages", etc.) rather than consuming the shared primitive. Consolidating on the shared component would improve consistency.

4. **`teaching_assistant` role is dead code.** It's defined in `UserRole` (rbac.ts) and `STAFF_ROLES`, but `AppShell.tsx`'s `STAFF_NAV_ROLES` deliberately excludes it (per the comment: "teaching_assistant role removed — teachers now handle all teaching duties directly"). It's not in the `ALL_NAV` `roles: string[]` arrays. **Action:** Consider removing `teaching_assistant` from `UserRole` + `STAFF_ROLES` if truly unused, OR document it as a legacy alias.

5. **`demo` role visibility quirk.** Demo is in `ADMIN_ROLES` (so it can preview admin dashboards) but `ADMIN_NAV_ROLES = ["admin", "administrator", "principal"]` deliberately EXCLUDES demo from the 6 admin nav items. Demo instead uses the role switcher to preview admin views. This is intentional per the inline comment but is a subtle source of confusion. **Action:** Document this clearly in onboarding docs.

6. **AppShell's "View As Role" switcher has 7 options** (L7 fix added Admin): student, teacher, course_coordinator, counselor, guardian, principal, admin. The switcher is shown to `isAdminEquivalent` users only (administrator, principal, demo, plus legacy `admin`).

7. **Schema sync is healthy.** No drift between `schema.prisma` (SQLite, dev) and `schema.prod.prisma` (Postgres, prod). All 47 models are field-identical. The only differences are cosmetic (comments, field ordering, file ordering) and the by-design provider swap.

8. **`AppShell.tsx` is the single source of truth for nav**, but it's also overridable by `RoleNavConfig` DB rows (managed by `RoleNavConfigPanel`). When a DB config exists for a role, it takes precedence over the hardcoded `ALL_NAV` `roles: string[]`. This is well-documented in inline comments but worth noting for future agents.

---

**End of inventory.**
