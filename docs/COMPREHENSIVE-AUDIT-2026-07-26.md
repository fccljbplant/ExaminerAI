# ExaminerAI — Comprehensive Deep Audit Report

> **Date:** 2026-07-26
> **Scope:** Full codebase audit — API endpoints, UI components, security, AI logic, psychological pipeline, process flows, calculations, role-based access, student journey, teacher control, all role action flows.
> **Methodology:** Multi-disciplinary audit from perspectives of: Software Engineer, Senior Coder, QA Engineer, UI/UX Specialist, Features Engineer, Educationist, Psychiatrist, Psychologist, Behavior Analyst, Mentor, Teacher, Security Auditor.
> **Audit size:** 119 API route files (~175 HTTP handlers), 56 UI components, 14 AI logic files, 7 process-flow modules, 44+ data models.

---

## Executive Summary

The platform is **architecturally sound** with strong foundational design:
- ✅ Centralized RBAC (`rbac.ts`) with role normalization
- ✅ Comprehensive audit logging (`audit-log.ts`)
- ✅ Well-designed psychological pipeline (7 dimensions, 14-day wellbeing window)
- ✅ Multi-provider AI chain with reasoning_content fallback
- ✅ Per-user daily AI rate limiting (test=50, tutor=150, assistant=100)
- ✅ Demo account write protection (server + client side)
- ✅ Comprehensive report + certificate generation

However, the audit uncovered **40 critical issues** and **25 missing features** that need immediate attention. The most severe are:

1. **Safeguarding pipeline is dead code** — never invoked from message/comment creation
2. **GROW coaching backend rejects GROW touchpoint types** — the entire framework is non-functional
3. **18 IDOR vulnerabilities** — staff can read/write any student's data without batch scoping
4. **14 AI endpoints missing rate-limiting** — unlimited AI spend possible
5. **Students cannot create capstone projects** — JourneyWizard + SettingsPanel are dead code
6. **Self-paced advancement has no UI** — backend exists, no button calls it
7. **Certificate generation stores course name in courseId field** — referential integrity broken
8. **Teacher-load module uses non-existent schema field** (`fromUserId`) — always returns 0 alerts

---

## Part 1: API Endpoint Audit

### 1.1 Critical Security Gaps

#### IDOR Vulnerabilities (18 endpoints)

These endpoints allow any staff member to read/write data for ANY student, bypassing batch scoping:

| Endpoint | Method | Issue |
|---|---|---|
| `/api/crisis-flags` | GET, POST, PATCH | No `assertCanAccessStudent` — staff can read/create/update crisis flags for any student |
| `/api/psych-evidence` | GET, POST | No IDOR check — staff can read/write psych evidence for any student |
| `/api/interactions` | GET | Staff can read any student's interactions via `?userId=` |
| `/api/interactions/[id]` | PATCH, DELETE | Staff can modify/delete any interaction by ID |
| `/api/daily-logs/[id]` | PATCH, DELETE | Staff can modify/delete any daily log by ID |
| `/api/comments` | GET, POST | GET: **any authenticated user (including students!)** can read any student's comments. POST: staff can comment on any student |
| `/api/group-tasks` | PATCH, DELETE | Staff can modify/delete any group task by ID |
| `/api/group-tasks/submit` | GET, PATCH | Staff can fetch/grade any submission by ID |
| `/api/events` | POST, DELETE | Staff can create events for any batch, delete any event |
| `/api/skill-mastery` | GET | Staff can fetch mastery for any userId |
| `/api/wellbeing-state` | GET | Staff can fetch wellbeing tier for any userId |
| `/api/students/alerts` | GET, PATCH | Returns ALL alerts institution-wide (including safeguarding flags about teachers — principal-only visibility broken) |
| `/api/mentorship/touchpoints` | GET, POST | Staff can fetch/create touchpoints for any userId |
| `/api/report-cards` | GET, POST | Staff can read/create report cards for any userId |
| `/api/users/[id]/block` | PUT | Teachers can block any student by ID (no batch check) |
| `/api/peer-assessment` | GET | Staff can fetch peer assessments for any groupTaskId |
| `/api/teacher/topic-guidance` | PUT | Staff can update any CourseDay by ID |
| `/api/counselor/overview` | GET | Returns institution-wide data to any counselor, ignoring AccessGrant scoping |

**Impact:** A teacher can read crisis flags, psychological evidence, mentorship notes, and comments for students in ANY batch — not just their own. A student can read other students' comments. Safeguarding flags about teachers are visible to all staff, not just principals.

#### AI Endpoints Missing Rate-Limiting (14 endpoints)

These endpoints call `callAI()` but skip `checkUserAILimit()` + `isDemoAIBlocked()`:

| Endpoint | Feature key | In rate-limit map? |
|---|---|---|
| `/api/ai/evaluate` | `evaluate` | ✅ in map — but no check at route |
| `/api/ai/teacher-tutor` | `teacher-tutor` | ❌ NOT in map (orphan) |
| `/api/daily-test` | `daily-test`, `daily-test-reply` | ✅ in map — but no check |
| `/api/project/setup` | `project-summary-gen` | ❌ NOT in map (orphan) |
| `/api/project/reports` | `project-report-analysis` | ❌ NOT in map (orphan) |
| `/api/project/generate-tasks` | `project-task-gen`, `project-week-gen` | ❌ NOT in map (orphans) |
| `/api/students/[id]/generate-project-analysis` | `project-final-analysis` | ❌ NOT in map (orphan) |
| `/api/students/final-result` | `final-result` | ❌ NOT in map (orphan) |
| `/api/teacher/topic-guidance` | `topic-guidance` | ❌ NOT in map (orphan) |
| `/api/mentorship/case-review` | `case-review-anonymize` | ❌ NOT in map (orphan) |
| `/api/mentorship/touchpoints/parse` | `touchpoint-parse` | ❌ NOT in map (orphan) |
| `/api/assistant/action-dialog` | `action_dialog` (typo — should be `action-dialog`) | ❌ NOT in map |
| `/api/courses/generate` | `course-gen`, `course-gen-batch` | ✅ in map — but no check at route |
| `/api/daily-motivation` | `daily-motivation` | ✅ in map — but no check (cached, low impact) |

**Impact:** Unlimited AI spend on these endpoints. A student could call `/api/ai/evaluate` 10,000 times in a day without hitting any quota.

### 1.2 RBAC Gaps

| Endpoint | Issue |
|---|---|
| `/api/comments` GET | Only checks `getAuthUser()` — students can read any student's comments |
| `/api/courses` POST, PUT | Any staff role (counselor, TA) can create/edit courses — should be admin/teacher only |
| `/api/courses/seed-default` POST | Any staff can seed courses |
| `/api/assistant/escalation/run` POST | Admin branch lacks `demoWriteBlock()` — demo can trigger escalation |

### 1.3 Minor Issues

- `/api/auth/change-password` — missing `demoWriteBlock()` (demo could change password)
- `/api/auth/set-security-question` — same
- `/api/password-reset-requests/[id]/approve` — doesn't check `status === "pending"` before rejecting
- `/api/project/setup` — no role check (any authenticated user can save project setup)
- `/api/journey` — no role check
- `/api/curriculum/progress` — no role check
- `/api/confidence-ratings` GET — uses raw role array instead of `isStaffRole()`
- `/api/psych-evidence` GET — same
- `/api/group-tasks/submit` GET, PATCH — same
- `/api/peer-assessment` GET — same
- `/api/stats` GET — `?as=student` impersonation has no audit log
- `/api/students/check-alerts` GET — cron secret in query string (leaks in server logs)
- `/api/ai/debug` GET — exposes partial API keys to admin role
- `/api/teacher/rules` — includes DEMO in requireRole for writes (demo shouldn't create rules)
- `/api/mentorship/case-review` GET — `requireRole(STAFF_ROLES as any)` includes guardian (shouldn't see case reviews)

---

## Part 2: UI Component Audit

### 2.1 Critical UI Bugs (block real users)

#### C1. Students cannot create capstone projects — JourneyWizard + SettingsPanel are dead code

- `src/components/examiner/student/JourneyWizard.tsx` (907 lines) — the ONLY way to create a capstone project — is never imported.
- `src/components/examiner/student/SettingsPanel.tsx` (196 lines) — password change, security question, theme preference — is never imported.
- `src/components/examiner/student/OverviewPanel.tsx` (892 lines) — certificate generation UI — is never imported.

**Impact:** A new student logs in → clicks "Project" tab → sees "No project yet" → clicks "Plan My Project" → lands back on Home view. **Dead end.** Students cannot create projects, change passwords, set security questions, or generate certificates from the UI.

#### C2. Every `onMode` callback redirects to "home" — multiple dead-end buttons

In `StudentDashboard.tsx`, all `onMode` / `onNavigate` callbacks are redirected:
- `WeeklyTestPanel` "Go to Project →" button → goes to Home (not Project)
- `CheckInPanel` "Practice this" button → goes to Home (not Study/Practice)
- `ProjectDescriptionCard` "Plan My Project" button → goes to Home
- `DailyTaskReminder` all navigation → goes to Study (regardless of requested destination)

#### C3. `BatchView.tsx` "Save guidance" button is a no-op

Line 141: `<Button>Save guidance</Button>` — no `onClick` handler. AI-generated guidance can never be saved.

#### C4. `WeeklyTestPanel` admin check uses wrong string

Line 30: `const isAdmin = userRole === "admin"` — should be `hasRole(userRole, ADMIN_ROLES)`. Users with role `"administrator"` or `"principal"` are NOT recognized as admin, so they can't bypass the task-lock for testing.

#### C5. `StudentPortfolioPage.tsx` uses 13 raw `fetch()` calls — bypasses demo guard

Lines 190, 241, 258, 290, 352, 517, 568, 701, 827 — including all destructive DELETEs and report-card POSTs. The `api` client intercepts writes for demo accounts (`localStorage["examiner-is-demo"] === "1"`), but raw `fetch()` bypasses this. Demo users clicking "Delete task" / "Generate report card" hit the server, wait 8s timeout, get a 403, and see nothing.

#### C6. Role checks use raw strings instead of `normalizeRole` / `ADMIN_ROLES`

`grep` confirms zero matches for `normalizeRole` in `src/components/examiner/`. All role checks use raw string arrays:
- `AppShell.tsx` lines 210, 248, 395 — `["administrator", "demo", "admin", "institution_admin", "platform_admin"]` duplicated 3×
- `AdminDashboard.tsx` line 78 — `["administrator", "admin", "platform_admin"]`
- `StudentPortfolioPage.tsx` line 53 — missing `"demo"` (demo can't see Audit tab on portfolios)
- `PrincipalDashboard.tsx` line 111 — `currentUserRole === "demo"`

**Impact:** A user with legacy role `"institution_admin"` (normalized to `"principal"` server-side) never matches any client-side branch → silently falls through to student view.

#### C7. Destructive actions without confirmation dialogs

- `AdminDashboard.tsx` `reseed` — wipes DB with no confirm
- `AdminDashboard.tsx` `changeRole` — role dropdown fires on every change (misclick = silent downgrade)
- `AdminDashboard.tsx` `toggleBlock` — no confirm
- `AssignmentsTab.tsx` `deleteEvent` — no confirm
- `StudentPortfolioPage.tsx` 12 "Quick unlock" buttons — no confirm

### 2.2 Missing Features

| Feature | Status |
|---|---|
| Self-paced advancement UI | Backend exists, **zero UI** — students can't advance to next day |
| Access Grants create/revoke | Panel is read-only — "Use the API" message in UI |
| Certificate generation UI | Only in dead `OverviewPanel.tsx` — unreachable |
| Teacher rule toggle | Rules can be created/deleted but not paused (no toggle for `enabled` boolean) |
| "Mark all as read" in Messages | Must click each message individually |
| Student assignments view | `StudentAssignmentsPanel` (404 lines) is dead code — students can't see batch group-tasks |
| Onboarding flow | No "Welcome — let's set up your project" prompt after first login |

### 2.3 Student Journey Gaps

1. **CRITICAL — Students cannot create capstone projects** (see C1 above)
2. Daily Task Reminder → "Practice this" button → goes to wrong view
3. Weekly Test → "Go to Project" button → goes to Home, not Project
4. No onboarding flow after first login
5. Self-paced advancement has no UI button
6. Certificate generation has no UI (dead code)

### 2.4 Teacher Control Gaps

1. Triage queue has no "acknowledge" or "snooze" action (must open full portfolio)
2. Triage queue doesn't show plagiarism-flagged items (type exists, never pushed)
3. Mentorship alerts can't be resolved inline (must navigate into portfolio)
4. No batch-level message broadcast ("Message all struggling students")
5. Course Planner shows full course-generation form to teachers (scope creep — teachers want to VIEW, not GENERATE)

### 2.5 Accessibility Issues

- Icon-only buttons missing `aria-label`s (pervasive — 30+ instances)
- Tab strips lack ARIA tab semantics (`role="tab"`, `aria-selected`)
- Chat inputs lack `<label>` or `aria-label`
- Week-selector buttons lack context for screen readers
- `ProjectWeekPlan` clickable headers not keyboard-accessible (no `role="button"`, no `tabIndex`)
- No skip-to-content link in AppShell
- Color-only state differentiation in some places (mitigated by text labels in most)

### 2.6 Performance Issues (Missing Pagination)

| Component | Issue |
|---|---|
| `Messages.tsx` | No pagination — loads all messages at once |
| `StudentPortfolioPage.tsx` | No pagination on comments/interactions/dailyLogs |
| `AssignmentsTab.tsx` | No pagination on group-tasks/events |
| `TeacherDashboard.tsx` | `/api/stats?as=teacher` returns ALL students (API supports pagination, UI doesn't use it) |
| `AdminDashboard` Overview | Fetches 200 users (institutions >200 see wrong counts) |
| `AccessGrantsPanel.tsx` | No pagination |
| `PrincipalDashboard` | No pagination on coursePerformance/teacherPerformance lists |
| `CounselorDashboard` | No pagination on topConcerns/crisisQueue |

### 2.7 Dead Code (~3,209 lines)

| File | Lines | Status |
|---|---|---|
| `student/OverviewPanel.tsx` | 892 | Never imported — contains certificate logic |
| `student/JourneyWizard.tsx` | 907 | Never imported — the onboarding wizard |
| `student/SettingsPanel.tsx` | 196 | Never imported — password/theme/security Q |
| `student/StudentAssignmentsPanel.tsx` | 404 | Only imported by dead OverviewPanel |
| `student/CourseWizardPreview.tsx` | 95 | Only imported by dead OverviewPanel |
| `teacher/BatchView.tsx` | 264 | Never imported — replaced by TodayView |
| `teacher/MyLoadView.tsx` | 185 | Never imported |
| `teacher/MentorshipTab.tsx` | 66 | Never imported — replaced by MentorshipView |

---

## Part 3: AI Logic + Psychological Pipeline Audit

### 3.1 AI Provider Chain Bugs

1. **Z.ai fallback skips rate limiter** — only DeepSeek branch calls `waitForSlot()`. Z.ai can be hammered unbounded.
2. **z-ai-web-dev-sdk fallback also skips rate limiter**
3. **RPD limit never enforced** — `RATE_LIMIT_RPD = 10_000` defined but no check exists
4. **`waitForSlot` stale-timestamp bug** — after sleeping, `now` should be recomputed; filter + push use pre-sleep timestamp
5. **Cache marks cached responses as `provider: "zai"`** regardless of actual provider — affects usage-log accuracy
6. **Header docstring contradicts code** — top says "DeepSeek primary", JSDoc says "Z.ai → DeepSeek"

### 3.2 Psychological Pipeline Bugs

1. **`writeSkillMastery` clobbers existing level with single-test data** — a score of 30 on a new test marks a previously-mastered topic as `not-started`. **A bad day erases mastery.** Should use a rolling average or weighted blend.
2. **Wellbeing tier never decays** — `recomputeWellbeingState` returns early when no evidence exists in 14 days. A student who had a red tier 15 days ago stays red forever.
3. **Auto-touchpoint misses multi-teacher batches** — uses `User.batchId` instead of `BatchTeacher` junction. Only legacy-assigned teachers get touchpoints.
4. **Practice test doesn't run plagiarism detection** — weekly + daily do, practice doesn't.
5. **`psych-analyzer.ts` has language bias** — Roman Urdu detection only covers Hindi/Urdu keywords. Other non-English languages misclassified as English.
6. **Race condition in `engagement-tracker.ts`** — `trackTutorEngagement` reads then writes absolute value. Concurrent messages lose increments. Should use `{ increment: 1 }`.

### 3.3 Safeguarding — DEAD CODE

**The entire safeguarding pipeline is implemented but never invoked.**

- `analyzeMessageForSafeguarding()` — never called from `/api/messages` POST
- `analyzeMessageForSafeguarding()` — never called from `/api/comments` POST
- `createSafeguardingFlag()` — never called
- `getSafeguardingFlagsForPrincipal()` — never called
- `dismissSafeguardingFlag()` — never called
- `assertTeacherCannotSeeOwnSafeguardingFlags()` — stub returning `true` unconditionally

**Impact:** Section 5 of the AI Assistant spec (safeguarding mode) is completely non-functional in production. No teacher-to-student messages are scanned for aggression, trauma-inducing language, or neglect.

Additional safeguarding issues:
- `inappropriate_tone` and `dismissive_of_distress` share the SAME regex patterns — every match double-counts
- `/api/students/alerts` returns safeguarding-typed alerts to ALL staff, not just principals
- `dismissSafeguardingFlag` overwrites `resolutionNote` instead of appending

### 3.4 Self-Paced Learning Bugs

1. **Day 5 → week advance is broken** — `canAdvanceDay` returns false when `currentDay === 5`, so students can't advance to next week. The docstring says it should, the code doesn't.
2. **Anti-cheat flags are not persisted** — flags are computed in the status response but never written to DB, never audited, never shown to teachers.
3. **Weekend edge case** — `getCalendarDay()` returns null on weekends, so `daysAheadOfSchedule` is always 0 on Sat/Sun.
4. **`daysAheadOfSchedule` calculation is wrong** — compares `currentDay` to calendar weekday, not to elapsed enrollment days.

### 3.5 Process Flow Dead Ends

1. **GROW coaching is non-functional** — frontend sends `goal_setting | reality_check | options_explore | will_commit`, backend only accepts `checkin | alert_response | escalation | praise_note | scheduled_followup`. **Submitting a GROW touchpoint returns HTTP 400.**
2. **Certificate generation stores course name in courseId field** — `getCourseMetadata` returns `{ name }`, not `{ id }`. Foreign key integrity broken.
3. **Crisis response doesn't notify counselor/principal** — docs say "immediate" alert, only a touchpoint is created (no message notification).
4. **Escalation cron has no scheduler** — endpoint exists but no `vercel.json` cron config invokes it. Escalation never fires automatically.
5. **Teacher-load module is dead code** — `calculateTeacherLoad` uses non-existent `fromUserId` field (always returns 0 alerts). The actual `/api/teacher/load` endpoint uses a completely different formula.
6. **AI Assistant data-efficiency layer is dormant** — `getCachedSummary`, `setCachedSummary`, `getAggregateSummary`, `checkQueryBudget` are all exported but never called.

### 3.6 Calculation Audit

| Calculation | Status | Notes |
|---|---|---|
| Attention score | ✅ Correct | Matches spec exactly |
| Teacher load score | ❌ Dead code | Module uses non-existent field; actual endpoint uses different formula |
| Wellbeing tier | ✅ Correct | But never decays (see 3.2 #2) |
| Calibration gap | ✅ Correct | Consistent across 3 implementations |
| Skill mastery | ⚠️ Buggy | Level overwritten by single test (see 3.2 #1) |
| Escalation triggers | ✅ Correct | Duration (7d) + repeat (2nd=2d, 3rd+=immediate) |

### 3.7 TODO/FIXME Comments

| File | Line | Comment |
|---|---|---|
| `teacher-batch-summary.ts` | 8 | Migration TODO — same data computed differently in different tabs |
| `comprehensive-report/index.ts` | 404 | TODO: compute trend from multiple evidence entries |
| `comprehensive-report/index.ts` | 415 | TODO: compute from self-paced status (hardcoded to 0) |
| `growth-reports/[userId]/route.ts` | 190 | TODO: set from user's batch's course (courseId null) |
| `courses/seed-default/route.ts` | 27 | TODO: add isDefault flag to Course model |

---

## Part 4: Role-Based Action Flow Audit

### Student Role
| Action | Status | Issue |
|---|---|---|
| Sign up | ✅ | Creates pending account |
| Get approved | ✅ | Teacher/admin approves |
| Log in | ✅ | JWT + role normalization |
| Create capstone project | ❌ | JourneyWizard is dead code — can't create project |
| View daily tasks | ✅ | Self-paced currentDay used |
| Take practice test | ✅ | |
| Take daily test | ✅ | Missing rate-limit check |
| Take weekly test | ✅ | |
| Use AI Tutor | ✅ | Full rate-limit + demo check |
| Daily check-in | ✅ | |
| View progress | ✅ | Comprehensive report available |
| Generate certificate | ❌ | UI is dead code — can't generate from UI |
| Change password | ❌ | SettingsPanel is dead code |
| Set security question | ❌ | SettingsPanel is dead code |
| Advance to next day (self-paced) | ❌ | No UI button |
| View own audit trail | ✅ | |

### Teacher Role
| Action | Status | Issue |
|---|---|---|
| View batch triage queue | ✅ | |
| View student portfolio | ✅ | |
| Log GROW mentorship session | ❌ | Backend rejects GROW types |
| Use AI Assistant | ✅ | Full rate-limit + demo check |
| Draft check-in message | ✅ | |
| Rehearse conversation | ✅ | |
| View student audit | ✅ | Admin/principal only |
| Override grade | ✅ | |
| Allow retake | ✅ | |
| Unlock test | ✅ | |
| Resolve alert inline | ❌ | Must navigate into portfolio |
| Broadcast to batch | ❌ | Not implemented |
| Create course | ⚠️ | Any staff can (should be admin/teacher only) |
| View plagiarism flags in triage | ❌ | Type exists, never pushed to queue |

### Counselor Role
| Action | Status | Issue |
|---|---|---|
| View institution caseload | ✅ | |
| View crisis flags | ⚠️ | No batch scoping — sees ALL students' crisis flags |
| Create crisis flag | ⚠️ | No IDOR check — can create for any student |
| View wellbeing states | ⚠️ | No IDOR check — sees any student's tier |
| View mentorship touchpoints | ⚠️ | No IDOR check |
| Case review | ✅ | |
| AccessGrant scoping | ❌ | `/api/counselor/overview` ignores AccessGrants entirely |

### Guardian Role
| Action | Status | Issue |
|---|---|---|
| View child's progress | ✅ | |
| View report cards | ✅ | |
| View wellbeing signal | ✅ | Sanitized (tier only) |
| Hidden from internal notes | ✅ | |
| View case reviews | ⚠️ | `requireRole(STAFF_ROLES as any)` includes guardian — shouldn't see peer case reviews |

### Principal Role
| Action | Status | Issue |
|---|---|---|
| View institution overview | ✅ | |
| View academic performance | ✅ | |
| View wellbeing distribution | ✅ | |
| View audit log | ✅ | |
| View safeguarding flags | ❌ | Safeguarding pipeline is dead code — no flags exist |
| View teacher load | ❌ | Teacher-load module is dead code — wrong formula |
| Manage teacher load (co-teacher) | ❌ | `suggestCoTeacher` never called |
| Audit Log tab hidden from demo | ✅ | |

### Administrator Role
| Action | Status | Issue |
|---|---|---|
| User management (CRUD) | ✅ | Search + pagination added |
| Role assignment | ✅ | Full authority (can assign any role) |
| Course management | ✅ | |
| Feature flags | ✅ | |
| AI limits config | ✅ | |
| Demo AI toggle | ✅ | |
| System health | ✅ | |
| Audit log | ✅ | |
| User audit search | ✅ | |
| Block/unblock users | ✅ | |
| Reseed DB | ⚠️ | No confirmation dialog |

### Demo Role
| Action | Status | Issue |
|---|---|---|
| View all dashboards | ✅ | Via role switcher |
| Read-only (writes blocked) | ✅ | Server-side `demoWriteBlock()` |
| AI access (toggleable) | ✅ | Admin can enable/disable |
| Subject to rate limits | ✅ | |
| Admin panel hidden | ✅ | |
| Principal system settings hidden | ✅ | Audit Log tab hidden |
| See audit tab on portfolios | ❌ | `StudentPortfolioPage.tsx` line 53 doesn't include "demo" in privileged roles |
| Bypass demo guard via raw fetch | ❌ | `StudentPortfolioPage.tsx` uses 13 raw `fetch()` calls that bypass the client-side demo guard |

---

## Part 5: Missing Functionality Summary

### Documented but Not Implemented

1. **Safeguarding detection** — code exists, never invoked (Section 5 of AI Assistant spec)
2. **Teacher Load roster / co-teacher suggestion** — code exists, no API route uses it (Section 6)
3. **AI Assistant data-efficiency layer** — all functions exported, none called (Section 2)
4. **GROW coaching touchpoint types** — UI offers them, backend rejects them
5. **Auto-notify counselor/principal on crisis flag** — docs say "immediate", only touchpoint created
6. **Escalation cron** — endpoint exists, no scheduler config
7. **WellbeingState history/snapshots** — acknowledged as deferred
8. **Student goals** — flagged as missing for GROW coaching
9. **Self-paced advancement UI** — backend exists, zero UI surface
10. **Certificate generation UI** — only in dead code
11. **Access Grants create/revoke UI** — panel is read-only
12. **Student assignments view** — dead code
13. **Onboarding flow** — no first-time guidance
14. **Batch-level message broadcast** — not implemented
15. **Inline alert resolution** — not implemented
16. **Plagiarism items in triage queue** — type exists, never populated
17. **Teacher rule toggle** — can create/delete but not pause
18. **"Mark all as read" in Messages** — not implemented
19. **Pagination on Messages, Portfolio, Assignments** — not implemented
20. **Skip-to-content link** — not implemented
21. **Skeleton loaders** — not used anywhere
22. **Confirmation dialogs for destructive actions** — inconsistent (native `confirm()` in 19 places, `AlertDialog` never used)
23. **Raw role string → `normalizeRole` migration** — 0 components import it
24. **`FEATURE_TO_CATEGORY` map sync** — 14 orphan feature keys
25. **Cron secret → Authorization header** — still in query string

---

## Part 6: Fix Priority Matrix

### P0 — Critical (blocks real users right now)

| # | Issue | Fix |
|---|---|---|
| 1 | Students can't create capstone projects | Wire JourneyWizard or ProjectSettingsCard into Project tab |
| 2 | GROW coaching backend rejects GROW types | Add GROW types to VALID_TYPES in touchpoints endpoint |
| 3 | Safeguarding pipeline is dead code | Wire `analyzeMessageForSafeguarding` into messages + comments POST |
| 4 | Students can't generate certificates | Move certificate UI from dead OverviewPanel to live component |
| 5 | Self-paced advancement has no UI | Add "Advance to next day" button when canAdvanceDay is true |
| 6 | `/api/comments` GET lets students read other students' comments | Add role check: staff or self only |
| 7 | 18 IDOR vulnerabilities | Add `assertCanAccessStudent` to all flagged endpoints |
| 8 | `/api/students/alerts` leaks safeguarding flags | Filter by type for non-principal callers |

### P1 — High (security / correctness)

| # | Issue | Fix |
|---|---|---|
| 9 | 14 AI endpoints missing rate-limiting | Add `checkUserAILimit` + `isDemoAIBlocked` + sync FEATURE_TO_CATEGORY map |
| 10 | Teacher-load module uses non-existent field | Fix `fromUserId` → correct field or rewrite formula |
| 11 | Certificate stores course name in courseId | Fetch actual course ID via batch |
| 12 | SkillMastery overwritten by single test | Use rolling average or weighted blend |
| 13 | Wellbeing tier never decays | Add decay mechanism (e.g., auto-green after 30 days no evidence) |
| 14 | Self-paced day-5 → week advance broken | Allow advanceDay when currentDay === 5 AND all week's tasks done |
| 15 | 13 raw `fetch()` calls bypass demo guard | Replace with `api.del/post/patch` |
| 16 | `WeeklyTestPanel` admin check wrong string | Use `hasRole(userRole, ADMIN_ROLES)` |
| 17 | Role checks use raw strings, not `normalizeRole` | Import from rbac.ts in all components |
| 18 | Z.ai + z-ai-sdk skip rate limiter | Add `waitForSlot()` calls |
| 19 | RPD limit never enforced | Add check before any provider call |
| 20 | `waitForSlot` stale timestamp | Recompute `now` after sleep |
| 21 | Crisis response doesn't notify | Add `db.message.create` to crisis flag creation |
| 22 | Escalation cron has no scheduler | Add `vercel.json` cron config |
| 23 | Anti-cheat flags not persisted | Write to DB + surface in teacher attention-score |
| 24 | Confirmation dialogs missing on destructive actions | Add `confirm()` or `AlertDialog` |

### P2 — Medium (UX polish)

| # | Issue | Fix |
|---|---|---|
| 25 | Dead code (~3,209 lines) | Restore or delete |
| 26 | No pagination on Messages, Portfolio, Assignments | Add server-side pagination |
| 27 | TeacherDashboard loads ALL students | Pass page/pageSize to /api/stats |
| 28 | Access Grants panel is read-only | Add create/revoke UI |
| 29 | Teacher rule toggle missing | Add toggle for `enabled` boolean |
| 30 | No "Mark all as read" | Add button |
| 31 | Triage queue no acknowledge/snooze | Add inline actions |
| 32 | No batch broadcast | Add "Message all struggling students" |
| 33 | Plagiarism items never in triage | Push plagiarism-flagged students to queue |
| 34 | Inconsistent tab strips | Consolidate on ProminentTabs |
| 35 | Inconsistent loading/error patterns | Standardize |
| 36 | Missing aria-labels | Systematic pass |
| 37 | Missing ARIA tab semantics | Add role="tab" etc. |
| 38 | No skip-to-content link | Add to AppShell |
| 39 | No skeleton loaders | Add for key components |
| 40 | Cron secret in query string | Move to Authorization header |

### P3 — Low (nice to have)

| # | Issue | Fix |
|---|---|---|
| 41 | `psych-analyzer` language bias | Expand non-English keyword coverage |
| 42 | Practice test no plagiarism detection | Add (low-stakes, but should run) |
| 43 | Auto-touchpoint misses multi-teacher batches | Use BatchTeacher junction |
| 44 | Race condition in engagement-tracker | Use `{ increment: 1 }` |
| 45 | Cache marks all cached as "zai" provider | Use actual provider |
| 46 | `dismissSafeguardingFlag` overwrites resolutionNote | Append instead |
| 47 | `inappropriate_tone` + `dismissive_of_distress` share patterns | Separate |
| 48 | `assertTeacherCannotSeeOwnSafeguardingFlags` is a stub | Implement |
| 49 | Course seed idempotency risk | Add isDefault flag |
| 50 | Growth report courseId is null | Set from batch's course |

---

## Conclusion

The ExaminerAI platform has a **strong architectural foundation** with well-designed RBAC, audit logging, psychological pipeline, and AI provider chain. However, the audit revealed significant gaps between the documented spec and the actual implementation:

- **Safeguarding** (Section 5 of AI Assistant spec) is completely non-functional
- **Teacher Load** (Section 6) uses dead code with a schema mismatch
- **Data Efficiency** (Section 2) is dormant
- **GROW coaching** is non-functional (backend rejects the types)
- **Student onboarding** is broken (can't create projects)
- **Self-paced advancement** has no UI
- **Certificate generation** has no UI
- **18 IDOR vulnerabilities** allow cross-batch data access
- **14 AI endpoints** have no rate-limiting

The fixes are well-defined and prioritized. The P0 fixes (8 items) should be done first — they unblock real users. The P1 fixes (16 items) address security and correctness. P2 (16 items) is UX polish. P3 (10 items) is nice-to-have.

**Total estimated effort:** 3-5 days for P0+P1, 2-3 days for P2, 1-2 days for P3.
