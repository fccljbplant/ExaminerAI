# Section 3: Role-by-Role UI Audit — ExaminerAI

> **Date:** 2026-07-26
> **Lenses:** UI specialist, features engineer, QA, PM
> **Scope:** Walked every nav item and tab for all 8 roles, traced data flow from AppShell.tsx → per-role dashboards → leaf components → backend API routes.

## Cross-cutting finding (affects multiple roles)

### Critical: `RoleNavConfigPanel` + `DEFAULT_NAV_PER_ROLE` are stale and can brick any role's nav

`/api/role-nav-config/route.ts` defines `ALL_NAV_KEYS` and `DEFAULT_NAV_PER_ROLE` that are **out of sync** with `AppShell.tsx`'s actual `ALL_NAV` array:

Missing from `ALL_NAV_KEYS` (admin can't toggle these):
- `batch-students`, `batch-mentorship`, `batch-assignments`, `batch-insights` (4 of 5 teacher tabs)
- `teacher-ai-tutor` (the staff AI Assistant — teachers lose this entirely if a config is saved)
- `counselor-dashboard`, `principal-dashboard`, `guardian-dashboard`, `guardian-progress` (every role's purpose-built dashboard)

The presets inside `RoleNavConfigPanel.tsx` (lines 207-210) reference keys that aren't in `allNavKeys`. Worse: the **"Counselor — Wellbeing focus" preset** sets `["batch", "messages", "settings"]`, which **completely removes the counselor's purpose-built `counselor-dashboard`** and forces them into the teacher dashboard.

The `teacher` default includes `"ai-tutor"` (student-only) but omits `"teacher-ai-tutor"` — so any teacher with the default config sees the wrong AI tool.

## 1. Student (8 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Home | ✅ Works | Motivation, stat cards, today's tasks, score trend, AI Tutor CTA |
| Study | ✅ Works | 4 sub-tabs (Practice/Daily Test/Weekly Test/Check-in) |
| Project | ✅ Works | GanttPanel, ProjectSettingsCard renders inline when no project |
| Progress | ✅ Works | ComprehensiveReportView + ReportCardPanel |
| AI Tutor | ✅ Works | AITutor component |
| Course | ✅ Works | CourseOutline |
| Messages | ⚠️ Broken compose | `/api/users` returns 403 for students. Compose dialog shows "No recipients available" |
| Settings | ⚠️ Renders Home | Settings nav item silently shows Home view — no settings UI |

## 2. Teacher (10 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Today | ✅ Works | Triage queue from alerts + needsAttention + silent + blocked |
| Students | ⚠️ Two filters always empty | `wellbeingTier` and `hasFlag` not in API response. "Struggling psychologically" and "Flagged" filters return zero students |
| Mentorship | ⚠️ load() is a no-op | `load()` sets loading=true then immediately false without fetching. No follow-up data shown |
| Assignments | 🔴 Cannot create tasks | `createTask()` missing required `batchId` field → 400 error |
| Insights | ✅ Works | Distribution charts, top performers, struggling students |
| Course Planner | ✅ Works | Full course CRUD |
| AI Assistant | ✅ Works | TeacherAITutor |
| Course | ✅ Works | CourseOutline |
| Messages | ⚠️ Can only message students | Teachers cannot message other teachers, principals, counselors |
| Settings | N/A | Renders Home (same bug as student) |

**Hardcoded:** `TEACHER_BOOTCAMP_PLAN` in `TeacherCourseProgressView.tsx` — hardcoded 6-week web dev plan. Any non-web-dev course shows incorrect phase names.

## 3. Counselor (5 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Command Center | ✅ Works | 4 stat cards, crisis queue, alert queue, follow-ups |
| Caseload | ✅ Works | Searchable/filterable roster |
| Sessions | ⚠️ No refresh after logging | `onLogged={() => {}}` — no-op callback. New sessions invisible until page reload |
| Patterns | ✅ Works | 7-dimension evidence breakdown |
| AI Assistant | ✅ Works | TeacherAITutor |

## 4. Course Coordinator (5 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Course Planner | ✅ Works | Full CRUD |
| AI Assistant | ✅ Works | |
| Course | ✅ Works | |

**Missing:** Coordinator has NO way to see students in their batches — no student progress, mentorship, or assignments UI.

## 5. Principal (5 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Overview | ✅ Works | 6 stat cards, wellbeing distribution |
| Academic | 🔴 All data hardcoded to zero | coursePerformance: teacher="—", studentCount=0, avgScore=0. teacherPerformance: courses=0, sessions=0, alertsRaised=0 |
| Wellbeing | ✅ Works | Tier cards, behavioral signals |
| Audit | ✅ Works (hidden for demo) | Audit log + growth reports |

**Hardcoded:** `growthReports` title uses `r.strengths.slice(0, 60)` — semantically wrong.

## 6. Administrator (10 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Overview | ⚠️ Count capped at 200 | pageSize=200 for overview stats |
| Users | ✅ Works | Search, role filter, pagination, all actions |
| Courses | ✅ Works | |
| Features | ✅ Works | |
| Passwords | ✅ Works | |
| System | ✅ Works | Health checks, AI stats, DB counts |
| System → Role Nav Config | 🔴 Broken | Missing 9 nav keys. Saving config can brick any role's sidebar |

## 7. Demo (variable, defaults to teacher's nav)

| Page | Status | Notes |
|------|--------|-------|
| All teacher pages | ✅ Works (read-only) | All writes blocked server-side |
| Role switcher | ⚠️ Can't preview admin | Banner says "preview any dashboard" but admin is missing from switcher |

## 8. Guardian (6 nav items)

| Page | Status | Notes |
|------|--------|-------|
| Overview | ✅ Works | Wellbeing banner, snapshot cards, wins/concerns |
| Report Cards | 🔴 Identical to Overview | Renders same GuardianDashboard component — no separate view |
| AI Tutor | ⚠️ Questionable fit | Student-facing practice chat — probably not what a parent wants |
| Course | ✅ Works | |
| Messages | 🔴 Cannot compose | Same `/api/users` 403 issue. "Send Message" CTA leads to dead end |

## Top 5 highest-impact bugs

1. **AssignmentsTab.createTask() missing batchId** — teachers cannot create assignments
2. **Principal Academic tab hardcoded to zero** — entirely fake data
3. **RoleNavConfigPanel missing 9 nav keys** — admin can silently break any role's navigation
4. **Messages compose broken for students + guardians** — `/api/users` returns 403
5. **Guardian "Report Cards" renders same Overview page** — duplicate rendering
