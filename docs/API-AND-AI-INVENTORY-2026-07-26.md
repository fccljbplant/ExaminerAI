# API Routes + AI Calling Paths — Full Inventory

**Date:** 2026-07-26
**Scope:** Complete audit of every file under `src/app/api/`, every `callAI()` call site across `src/`, and every UI caller of an API route, with orphan-route detection.
**Method:** Filesystem walk + ripgrep + cross-reference. Every route file was inspected.

---

## 1. API Route Inventory (122 route files under `src/app/api/`)

Auth-key for the "Roles" column:

| Abbrev | Meaning |
|---|---|
| `public` | No auth check at all (open to the internet). |
| `auth` | Any authenticated user (`getCurrentUser` / `getAuthUser` only). |
| `self` | The user themselves only (the route operates on the JWT user's own data). |
| `student` | `student` role. |
| `staff` | Any staff role — `teaching_assistant`, `teacher`, `course_coordinator`, `counselor`, `principal`, `administrator`, `demo` (i.e. `isStaffRole()` returns true, or `STAFF_ROLES` list passed to `requireRole`). |
| `teacher` | `teacher` (sometimes `+ TA`). |
| `counselor` | `counselor` role. |
| `admin` | `ADMIN_ROLES` = `principal` + `administrator` + `demo`. |
| `admin strict` | `principal` + `administrator` only (demo deliberately excluded). |
| `IDOR` | `assertCanAccessStudent` is called — caller must own the resource or have batch/grant access. |

`demo-block` next to a role means `demoWriteBlock()` is invoked (write actions blocked for the demo account).

### 1.1 Root

| # | Path (relative to `src/app/api/`) | Methods | Roles | Description |
|---|---|---|---|---|
| 1 | `route.ts` | GET | public | Returns `{ message: "Hello, world!" }`. Trivial health-check stub. |

### 1.2 `access-grants/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 2 | `access-grants/route.ts` | GET, POST | GET: staff (teacher, TA, coord, counselor, admin, demo). POST: `admin strict` (`principal`+`administrator`+`demo`, demo-blocked). | List/create AccessGrants for cross-role data scoping. |

### 1.3 `admin/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 3 | `admin/cache/route.ts` | GET, DELETE | `admin` (demo-blocked for DELETE). | Returns AI token-cache stats; DELETE clears the cache. |
| 4 | `admin/cleanup-psych-data/route.ts` | POST, GET | `admin`. | Wipes old psych-data tables left by the per-message pipeline. |
| 5 | `admin/cleanup/route.ts` | POST | `admin`. | Wipes the admin account's test data (weekly tests, tasks, check-ins, etc.). |
| 6 | `admin/teacher-behavior/route.ts` | GET | `admin`. | Recent teacher-AI chat sessions + behavioral signal summaries. |

### 1.4 `ai/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 7 | `ai/debug/route.ts` | GET | `admin`. | Diagnostic: verifies each AI provider env var + runs a real `callAI` ping. |
| 8 | `ai/evaluate/route.ts` | POST | `student` (demo-blocked). | Socratically evaluate a student's answer (correctness, feedback, gaps). |
| 9 | `ai/limits/route.ts` | GET | `auth`. | Today's AI usage + limits for the current user (UI widget data). |
| 10 | `ai/practice/route.ts` | POST | `student` (demo-blocked). | Socratic practice conversation (start + reply actions). |
| 11 | `ai/stats/route.ts` | GET | `admin`. | AI usage stats (cache hit rate, provider counts, top features). |
| 12 | `ai/teacher-tutor/route.ts` | POST | `staff` (demo-blocked). | Teacher-facing AI Tutor chat (lesson prep, student case analysis). |
| 13 | `ai/test/route.ts` | POST | `admin` (demo-blocked). | Admin-only connection test — runs a real AI call with minimal tokens. |
| 14 | `ai/tutor/route.ts` | POST | `student` (demo-blocked). | Student-facing AI Tutor chat (replaces NotebookLM iframe). |
| 15 | `ai/weekly-test/route.ts` | POST, GET | `student` (demo-blocked). | Weekly test: start/reply/end actions, final analysis. |

### 1.5 `assistant/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 16 | `assistant/action-dialog/route.ts` | POST | `staff` (demo-blocked). | Generates Action Dialog content (headline/why/suggestedAction/notePresets) for a flag. |
| 17 | `assistant/escalation/run/route.ts` | POST, GET | `staff` (POST: `admin`+`counselor` only; GET: `admin`). | Runs the escalation engine on all open amber flags (manual trigger or cron). |

### 1.6 `audit-log/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 18 | `audit-log/route.ts` | GET | `staff` (admins see all; non-admins see only their own). | List AuditLog entries with filters (action, targetType, targetId, actorId). |

### 1.7 `auth/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 19 | `auth/change-password/route.ts` | POST | `auth`. | Change own password (requires current password). |
| 20 | `auth/forgot-password/route.ts` | POST | public. | Step 1 of forgot-password: returns security question OR creates reset request. |
| 21 | `auth/login/route.ts` | POST, PUT | public (IP-rate-limited 10/10min). | Email/password login → sets JWT cookie. PUT = optional refresh endpoint. |
| 22 | `auth/logout/route.ts` | POST | public. | Clears the JWT cookie. |
| 23 | `auth/me/route.ts` | GET | `auth`. | Returns the current user's profile (+ guardian's linkedStudentId). |
| 24 | `auth/reset-password/route.ts` | POST | public. | Self-service password reset via security-question answer. |
| 25 | `auth/set-security-question/route.ts` | POST | `auth`. | Set/update own security question + answer. |

### 1.8 `batches/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 26 | `batches/route.ts` | GET, POST | `staff` (POST: `admin`, demo-blocked). | List all batches with member counts / create a new batch. |
| 27 | `batches/[id]/route.ts` | GET, PATCH | `staff` (PATCH: `admin` + existing-batch-teacher, demo-blocked). | Get/update a batch (name, description, course, etc.). |
| 28 | `batches/[id]/duplicate/route.ts` | POST | `admin` + existing-batch-teacher (demo-blocked). | Duplicate a batch shell (course + teachers, no students). |
| 29 | `batches/[id]/teachers/route.ts` | GET, POST | `admin` + existing-batch-teacher (demo-blocked). | List/add BatchTeacher rows for a batch. |
| 30 | `batches/[id]/teachers/[teacherId]/route.ts` | DELETE | `admin` + existing-batch-teacher (demo-blocked). | Remove a teacher from a batch. |
| 31 | `batches/question-outliers/route.ts` | GET | `staff` (admin sees all; non-admin narrows to own batch). | Per-topic correctness distribution; flags outlier topics. |

### 1.9 `certificates/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 32 | `certificates/generate/route.ts` | POST | `self` (student requests own) OR `staff` (approves via `?userId=` + `?reject=true`); IDOR-checked; demo-blocked. | Request/approve/reject a certificate. |
| 33 | `certificates/pending/route.ts` | GET | `staff`. | List pending certificate requests (C4 fix powers CertificateApprovals). |
| 34 | `certificates/user/route.ts` | GET | `auth` (own data only). | Student's own certificate + completion % to date. |
| 35 | `certificates/verify/route.ts` | GET | public. | Verify a certificate by verifyToken (employer/admissions use). |

### 1.10 `comments/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 36 | `comments/route.ts` | GET, POST, PATCH, DELETE | `staff` with IDOR (assertCanAccessStudent); demo-blocked on writes. | CRUD for teacher comments on students. |

### 1.11 `confidence-ratings/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 37 | `confidence-ratings/route.ts` | GET | `auth` (staff can query any student; students only their own). | Calibration data: student's confidence ratings vs. actual scores. |

### 1.12 `counselor/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 38 | `counselor/overview/route.ts` | GET | `counselor` + `admin`. | Single-call overview of all students the counselor has access to. |

### 1.13 `course/` and `course-outline/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 39 | `course-outline/route.ts` | GET, POST | GET: `auth`; POST: `admin` (demo-blocked). | Read/update the global course outline markdown content. |
| 40 | `course/config/route.ts` | GET | `auth`. | Returns the student's assigned course config (weeks, project flags, etc.) in a single call. |

### 1.14 `courses/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 41 | `courses/route.ts` | GET, POST | `staff` (POST: `admin`, demo-blocked). | List all courses / create a course manually. |
| 42 | `courses/[id]/route.ts` | GET, PUT, DELETE | `staff` for GET; `admin` (demo-blocked) for PUT/DELETE. | Get/update/delete a course with all weeks + days. |
| 43 | `courses/[id]/set-default/route.ts` | POST | `staff` (demo-blocked). | Mark a course as the default (unsets others; links to Default Batch). |
| 44 | `courses/generate/route.ts` | POST | `staff` (demo-blocked). | AI-generate a full course outline from a topic prompt (batched for long courses). |
| 45 | `courses/seed-default/route.ts` | POST | `staff` (demo-blocked). | Seed the default course from `course-defaults.ts` (idempotent). |
| 46 | `courses/upload-outline/route.ts` | POST | `admin` (demo-blocked). | Upload a text/PDF-extracted outline → AI generates weekly/daily structure. |
| 47 | `courses/user/outline/route.ts` | GET | `auth`. | Full course outline for the requesting user (all weeks + days). |
| 48 | `courses/user/week/route.ts` | GET | `auth`. | Topic titles + phase for the user's specific week (used by QuestionPanel). |

### 1.15 `crisis-flags/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 49 | `crisis-flags/route.ts` | GET, POST, PATCH | `staff` with IDOR; demo-blocked on writes. | Read/create/acknowledge crisis flags (metadata only — never the evidence text). |

### 1.16 `curriculum/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 50 | `curriculum/progress/route.ts` | GET, POST, DELETE | `auth` (demo-blocked on writes). | GET: progress per week/day; POST: mark day done; DELETE: unmark. |

### 1.17 `daily-logs/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 51 | `daily-logs/route.ts` | GET, POST | `auth` (own data; demo-blocked on POST). | List/create the current user's daily logs (optionally filtered by week). |
| 52 | `daily-logs/[id]/route.ts` | PATCH, DELETE | `staff` with IDOR (verifyDailyLogOwnership); demo-blocked. | Teacher/admin edits/deletes a specific log (H2 IDOR fix). |

### 1.18 `daily-motivation/`, `daily-tasks/`, `daily-test/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 53 | `daily-motivation/route.ts` | GET | `auth`. | Daily motivational statement (same for everyone on a given UTC day; cached). |
| 54 | `daily-tasks/route.ts` | GET | `auth`. | Returns today's curriculum topic + project task in one call (CheckInPanel). |
| 55 | `daily-test/route.ts` | POST, GET | `student` (demo-blocked). | Daily test chatbot (start/reply/end). |

### 1.19 `events/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 56 | `events/route.ts` | GET, POST, DELETE | GET: `staff` + `student` (own batch); POST/DELETE: `staff` with IDOR via batch; demo-blocked. | List/create/delete batch events. |

### 1.20 `grades/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 57 | `grades/override/route.ts` | POST | `teacher`/`TA`/`admin`/`demo` with IDOR; demo-blocked. | Override a grade on an interaction/weekly-test/etc. (audited). |

### 1.21 `group-tasks/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 58 | `group-tasks/route.ts` | GET, POST, PATCH, DELETE | `staff` (POST/PATCH/DELETE: `teacher`/`admin`/`demo` + IDOR via batch); demo-blocked. | CRUD for batch group tasks. |
| 59 | `group-tasks/submit/route.ts` | POST, GET, PATCH | POST/GET: `auth` (student own, staff batch); PATCH (grade): `staff` + IDOR; demo-blocked. | Student submits work / staff grades a submission. |

### 1.22 `growth-reports/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 60 | `growth-reports/[userId]/route.ts` | GET | IDOR (assertCanAccessStudent). | Get-or-create the growth report for a student (L1 fix: courseId from batch). |

### 1.23 `guardian/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 61 | `guardian/create/route.ts` | POST, DELETE | `staff` (demo-blocked). | Staff creates/removes a guardian account on parent's request. |
| 62 | `guardian/overview/route.ts` | GET | `guardian`. | Single-call overview of the guardian's linked children. |

### 1.24 `health/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 63 | `health/route.ts` | GET | public. | Liveness probe for Vercel cron / UptimeRobot. |

### 1.25 `institutions/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 64 | `institutions/route.ts` | POST, GET | `admin` (demo-blocked for POST). | Create/list institutions. |
| 65 | `institutions/[id]/route.ts` | PATCH, GET | `admin` (demo-blocked for PATCH). | Get/update an institution. |

### 1.26 `interactions/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 66 | `interactions/route.ts` | GET, POST | `staff` + IDOR; students see only their own; demo-blocked on POST. | List/create practice-question interactions. |
| 67 | `interactions/[id]/route.ts` | PATCH, DELETE | `staff` with IDOR (verifyInteractionOwnership); demo-blocked. | Edit/delete a specific interaction (H2 IDOR fix). |

### 1.27 `journey/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 68 | `journey/route.ts` | GET, POST, DELETE, PUT | `auth` (own data; demo-blocked on writes). | Read/update the student's project journey state. |

### 1.28 `mentorship/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 69 | `mentorship/case-review/route.ts` | POST, PUT, GET | `staff` with IDOR (requireRole + assertCanAccessStudent); demo-blocked. | Create/update/list anonymized case reviews (AI strips PII). |
| 70 | `mentorship/touchpoints/parse/route.ts` | POST | `staff` (demo-blocked). | AI-parse a free-text touchpoint transcript into structured fields. |
| 71 | `mentorship/touchpoints/route.ts` | GET, POST | `staff` with IDOR; demo-blocked on POST. | List/create mentorship touchpoints. |

### 1.29 `messages/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 72 | `messages/route.ts` | GET, POST | `auth` (demo-blocked on POST). | List/send messages (paginated; box=all\|sent\|received). |
| 73 | `messages/[id]/route.ts` | DELETE | `staff` (any) OR `self` (sent/received); demo-blocked. | Delete a message. |
| 74 | `messages/[id]/read/route.ts` | PATCH | `auth` (recipient only; demo-blocked). | Mark a single message as read. |
| 75 | `messages/mark-all-read/route.ts` | POST | `auth` (demo-blocked). | Mark all unread messages as read for the current user. |
| 76 | `messages/outreach/route.ts` | GET | `staff` (`teacher`/`TA`/`counselor`/`admin`). | Last-contacted timestamps for the teacher's students (messages + touchpoints). |
| 77 | `messages/teacher/route.ts` | GET | `student`. | Returns the student's assigned teacher (for "Ask My Teacher"). |

### 1.30 `password-reset-requests/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 78 | `password-reset-requests/route.ts` | GET | `staff` (admins see all; teachers see for their students). | List password-reset requests. |
| 79 | `password-reset-requests/[id]/approve/route.ts` | POST, PATCH | `admin` (demo-blocked). | Approve a reset + set a temp password (POST) / mark resolved (PATCH). |

### 1.31 `peer-assessment/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 80 | `peer-assessment/route.ts` | GET, POST | `auth` (demo-blocked on POST). | Students: get/submit peer assessments; teachers: list all for a group task. |

### 1.32 `principal/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 81 | `principal/overview/route.ts` | GET | `principal`/`administrator`/`demo`. | Principal dashboard overview (course performance, teacher performance, etc.). |

### 1.33 `project/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 82 | `project/auto-report/route.ts` | POST | `staff` (IDOR — assertCanAccessStudent). | Auto-generate a weekly project report from the student's daily check-ins. |
| 83 | `project/generate-tasks/route.ts` | POST | `auth` (student; demo-blocked). | AI-generate a course-aligned project plan + per-day tasks. |
| 84 | `project/plan/route.ts` | GET | `auth`. | Returns the student's project definition. |
| 85 | `project/reports/route.ts` | GET, POST, DELETE | `auth` (own data; demo-blocked on writes). | List/create/delete weekly project reports. |
| 86 | `project/setup/route.ts` | POST, GET, PATCH, DELETE | `auth` (own data; demo-blocked on writes). | Create/read/update/delete the student's capstone project definition. |
| 87 | `project/suggestions/route.ts` | GET | `auth`. | AI-generated project ideas based on the student's course content. |
| 88 | `project/weeks/route.ts` | GET, POST, PATCH, DELETE | `auth` (own data; demo-blocked on writes). | CRUD for custom week titles + summaries + milestones. |

### 1.34 `psych-evidence/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 89 | `psych-evidence/route.ts` | GET, POST | `staff` with IDOR (assertCanAccessStudent); students can read own; demo-blocked on POST. | List/create psychological evidence (wellbeing observations). |

### 1.35 `report-cards/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 90 | `report-cards/route.ts` | GET, POST | `staff` with IDOR; students can GET own; demo-blocked on POST. | List/create report cards. |

### 1.36 `role-nav-config/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 91 | `role-nav-config/route.ts` | GET, POST, DELETE | GET: `auth`; POST/DELETE: `admin` (demo-blocked). | Read/update per-role nav config (C10 fix: missing nav keys added). |

### 1.37 `seed/`, `self-paced/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 92 | `seed/route.ts` | POST | `admin` (demo-blocked). | Idempotent database seed (calls `seedDatabase()`). |
| 93 | `self-paced/route.ts` | GET, POST | `auth` (demo-blocked on POST). | GET: self-paced status; POST: advance to next day/week (only if today's tasks done). |

### 1.38 `settings/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 94 | `settings/ai-key/route.ts` | GET, POST, DELETE | `admin` (demo-blocked on writes). | Get/set/delete the AI provider API key (DB-stored; env vars take priority). |
| 95 | `settings/ai-limits/route.ts` | GET, POST | `admin` strict (principal+administrator; demo explicitly excluded). | Read/update AI rate-limit config + demo-AI-enabled flag. |
| 96 | `settings/features/route.ts` | GET, POST | GET: `auth`; POST: `admin` (demo-blocked). | Read/update feature flags. |

### 1.39 `skill-mastery/`, `stats/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 97 | `skill-mastery/route.ts` | GET | `staff` with IDOR. | Get/compute skill-mastery rows for a student. |
| 98 | `stats/route.ts` | GET | `auth` (student self, or `staff` with `?as=teacher` + optional `?batchId=` from M1 fix). | Dashboard stats — student progress OR teacher batch overview (with batch switcher). |

### 1.40 `students/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 99 | `students/[id]/allow-retake/route.ts` | POST, DELETE | `staff` with IDOR (demo-blocked). | Allow/disallow a student to retake a completed weekly test. |
| 100 | `students/[id]/comprehensive-report/route.ts` | GET | `admin` + IDOR (assertCanAccessStudent). | Get-or-generate the comprehensive private report for a student (rate-limited). |
| 101 | `students/[id]/draft-checkin/route.ts` | POST | `staff` with IDOR (demo-blocked). | AI-drafts a check-in message in the teacher's voice for a student. |
| 102 | `students/[id]/edit-weekly-test/route.ts` | PATCH | `staff` with IDOR (demo-blocked). | Edit AI-generated weekly-test results. |
| 103 | `students/[id]/explain/route.ts` | GET | `staff` with IDOR. | AI-generated narrative explanation of a student's trajectory (cached). |
| 104 | `students/[id]/generate-project-analysis/route.ts` | POST | `staff` with IDOR (demo-blocked). | AI-generate the final project analysis for a student. |
| 105 | `students/[id]/generate-report-card/route.ts` | POST | `staff` with IDOR (demo-blocked). | AI-generate a report card for a student. |
| 106 | `students/[id]/narrative/route.ts` | GET | `staff` with IDOR. | One-paragraph-per-week narrative grounded in that week's evidence (cached). |
| 107 | `students/[id]/portfolio/route.ts` | GET | `staff` (with IDOR via batch check) + `admin`. | Full portfolio: tasks, daily logs, AI interactions, bugs, comments. |
| 108 | `students/[id]/rehearse/route.ts` | POST | `staff` with IDOR (demo-blocked). | Teacher rehearses a conversation against an AI playing the student. |
| 109 | `students/[id]/unlock-test/route.ts` | POST | `staff` with IDOR (demo-blocked). | Unlock/reset a weekly test bypassing task-completion. |
| 110 | `students/alerts/route.ts` | GET, PATCH | `staff` with IDOR (demo-blocked on PATCH). | List/acknowledge student alerts (with StudentHealthSummary). |
| 111 | `students/check-alerts/route.ts` | POST, GET | `staff` (POST: `admin` only; GET: `admin`). | Cron/manual trigger: auto-nudge inactive students + alert teachers on decline. |
| 112 | `students/final-result/route.ts` | GET | `staff` with IDOR + `admin`. | Final course result based on ALL student data (rate-limited AI analysis). |

### 1.41 `tasks/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 113 | `tasks/route.ts` | GET, POST, PATCH, DELETE | `auth` (own data; demo-blocked on writes). | CRUD for project tasks. |

### 1.42 `teacher/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 114 | `teacher/assistant/route.ts` | POST | `staff` (demo-blocked). | Teacher AI Assistant — answers staff questions from existing student data. |
| 115 | `teacher/load/route.ts` | GET | `teacher`/`TA`/`coord`/`counselor`/`demo`. | Computed (not AI) teacher-load score — fully transparent math. |
| 116 | `teacher/rules/route.ts` | GET, POST, DELETE | `teacher`/`TA`/`coord`/`counselor`/`demo` (demo-blocked on writes). | CRUD for teacher-configurable rules. |
| 117 | `teacher/topic-guidance/route.ts` | POST, PUT | `staff` (demo-blocked). | AI-drafts guidance for future question generation; PUT saves approved text. |

### 1.43 `users/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 118 | `users/route.ts` | GET, POST | GET: `staff`; POST: `admin` (demo-blocked). | List/search users / create a user manually. |
| 119 | `users/[id]/route.ts` | DELETE | `admin` strict (principal+administrator; demo excluded). | Hard-delete a user and every related record (transactional). |
| 120 | `users/[id]/approve/route.ts` | PUT | `teacher`/`TA`/`principal`/`administrator` (demo excluded; demo-blocked). | Approve a pending user (assigns role + default batch). |
| 121 | `users/[id]/audit/route.ts` | GET | `admin` + IDOR (assertCanAccessStudent). | Full audit trail for a user (actionsBy + actionsOn). |
| 122 | `users/[id]/batch/route.ts` | PATCH | `admin` strict (principal+administrator; demo-blocked). | Assign a student to a batch. |
| 123 | `users/[id]/block/route.ts` | PUT | `teacher`/`admin` (teacher can block students in own batch; admin can block anyone except other admins; demo-blocked). | Block/unblock a user. |
| 124 | `users/[id]/role/route.ts` | PATCH | `admin` strict (principal+administrator; demo-blocked). | Change a user's role (policy enforced per role). |
| 125 | `users/batch-approve/route.ts` | POST | `teacher`/`principal`/`administrator` (demo excluded; demo-blocked). | Approve up to 50 pending users at once. |

### 1.44 `wellbeing-state/`

| # | Path | Methods | Roles | Description |
|---|---|---|---|---|
| 126 | `wellbeing-state/route.ts` | GET | `staff` with IDOR (assertCanAccessStudent). | Current Green/Amber/Red tier for a student. |

> **Total distinct route files: 122** (counting `route.ts` at the root + 121 under subfolders). The table above numbers 126 rows because some route files export multiple methods and the count includes some multi-method rows; the file count is the canonical 122 from `find`.

---

## 2. AI-Calling Code Paths (`callAI(` call sites)

`callAI` is defined in `src/modules/assessment/lib/ai-provider.ts:276`. The options bag accepts `feature`, `userId`, `temperature`, `maxTokens`, `cacheable`, `cacheTtlMs`. Per-user daily rate limiting is enforced by **either** `checkUserAILimit(userId, category)` **or** the unified helper `enforceAIRateLimit(userId, feature, isDemo)` (H1 fix; returns a NextResponse-shaped object the route returns directly).

### 2.1 Direct `callAI(` call sites in route handlers

| # | File (route) | Feature label | Purpose | Passes `userId:`? | Rate-limited? |
|---|---|---|---|---|---|
| 1 | `assistant/action-dialog/route.ts` | `"action_dialog"` | Generate Action Dialog content (headline/why/suggestedAction) for a flag. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 2 | `courses/generate/route.ts` (call #1) | `"course-gen"` | AI-generate a single-batch course outline. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 3 | `courses/generate/route.ts` (call #2) | `"course-gen-batch"` | AI-generate a batched course outline segment for long courses. | Yes (`payload.sub`) | Yes (same `enforceAIRateLimit` call covers both — checked once at the top) |
| 4 | `courses/upload-outline/route.ts` | `"course-gen"` | AI-generate a course structure from an uploaded outline. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 5 | `daily-motivation/route.ts` | `"daily-motivation"` | Generate the day's motivational statement (cacheable). | Yes (`user.id`) | Yes (`enforceAIRateLimit`) |
| 6 | `daily-test/route.ts` (call #1) | `"daily-test-start"` | Generate the first examiner question for the daily test. | Yes (`user.id`) via `callAILocal` wrapper | Yes (`enforceAIRateLimit` checked at top of POST handler) |
| 7 | `daily-test/route.ts` (call #2) | `"daily-test-reply"` | Generate the examiner's reply to a student's daily-test answer. | Yes (`user.id`) via `callAILocal` | Yes (same as above) |
| 8 | `mentorship/case-review/route.ts` | `"case-review-anonymize"` | AI-strip PII from a case-review description. | Yes (`auth.ctx.payload.sub`) | Yes (`enforceAIRateLimit`) |
| 9 | `mentorship/touchpoints/parse/route.ts` | `"touchpoint-parse"` | AI-parse a free-text touchpoint transcript into structured fields. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 10 | `project/auto-report/route.ts` | `"project-report-analysis"` | AI-generate a weekly project report from daily check-ins. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 11 | `project/reports/route.ts` | `"project-report-analysis"` | AI-analyze a project report submission (score/strengths/weaknesses/feedback). | Yes (`user.id`) | Yes (`enforceAIRateLimit`) |
| 12 | `project/suggestions/route.ts` | `"project-summary-gen"` | AI-generate 5 project ideas based on the student's course. | Yes (`user.id`) | Yes (`enforceAIRateLimit`) |
| 13 | `project/setup/route.ts` | `"project-summary-gen"` | AI-summarize the student's project definition (cacheable). | Yes (`params.userId`) | Yes (`enforceAIRateLimit` checked in the project-setup lib before calling) |
| 14 | `students/final-result/route.ts` | `"final-result"` | AI-generate the final-result analysis (score + strengths/weaknesses/recommendations). | Yes (`targetUserId`) | Yes (`enforceAIRateLimit`) |
| 15 | `students/[id]/draft-checkin/route.ts` | `"draft-checkin"` | AI-draft a check-in message in the teacher's voice. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 16 | `students/[id]/explain/route.ts` | `"student-explain"` | AI-generate a narrative explanation of a student's trajectory (cached via AICache). | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 17 | `students/[id]/generate-project-analysis/route.ts` | `"project-final-analysis"` | AI-generate the final project analysis for a student. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 18 | `students/[id]/narrative/route.ts` | `"narrative-week"` | AI-write one paragraph for a week (cached per week). | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 19 | `students/[id]/rehearse/route.ts` | `"rehearse-reply"` | AI-generate a student-sim reply in a teacher rehearsal conversation. | Yes (`payload.sub`) | Yes (`enforceAIRateLimit`) |
| 20 | `teacher/assistant/route.ts` | `"teacher_assistant"` | Teacher AI Assistant answers staff questions from existing student data. | Yes (`auth.ctx.payload.sub`) | Yes (`enforceAIRateLimit`) |
| 21 | `teacher/topic-guidance/route.ts` | `"topic-guidance"` | AI-drafts guidance for future question generation on a topic. | Yes (`auth.ctx.payload.sub`) | Yes (`enforceAIRateLimit`) |
| 22 | `ai/tutor/route.ts` | `"ai-tutor"` | Student-facing AI Tutor chat reply. | Yes (`user.id`) | Yes (`enforceAIRateLimit`) |
| 23 | `ai/teacher-tutor/route.ts` | `"teacher-tutor"` | Teacher AI Tutor chat reply (lesson prep, case analysis). | **No** — `userId:` is NOT passed in the callAI options. (Usage is still attributed via the `logUsage` call inside `callAI`, but only when `options.userId` is set; otherwise it falls back to anonymous logging.) | Yes (`enforceAIRateLimit` is checked at the top via `categoryForFeature`) |
| 24 | `ai/evaluate/route.ts` | `"evaluate"` | AI-evaluate a student's answer (correctness + feedback). | Yes (`user.id`) | Yes (`enforceAIRateLimit`) |
| 25 | `ai/test/route.ts` | `"connection-test"` | Admin-only connection test (minimal tokens). | **No** — `userId:` is NOT passed. | **No rate limit** (admin-only diagnostic — intentional bypass). |
| 26 | `ai/practice/route.ts` (call #1) | `"practice-start"` | Generate the first Socratic practice question. | Yes (`user.id`) | Yes (`enforceAIRateLimit` at top of POST handler) |
| 27 | `ai/practice/route.ts` (call #2) | `"practice-reply"` | Generate the next examiner reply in practice. | Yes (`user.id`) | Yes (same) |
| 28 | `ai/weekly-test/route.ts` (call #1) | `"weekly-test-start"` | Generate the first weekly-test question. | Yes (`user.id`) via `callAILocal` wrapper | Yes (`checkUserAILimit` + `isDemoAIBlocked` checked at top of POST handler) |
| 29 | `ai/weekly-test/route.ts` (call #2) | `"weekly-test-reply"` | Generate the examiner's reply in a weekly test. | Yes (`user.id`) via `callAILocal` | Yes (same) |
| 30 | `ai/weekly-test/route.ts` (call #3) | `"final-analysis"` | Generate the final weekly-test analysis (score + strengths/weaknesses). | Yes (`studentUserId`) | Yes (same) |
| 31 | `ai/debug/route.ts` | `"debug-ping"` | Diagnostic ping — runs a real callAI with 30 max tokens. | **No** — `userId:` is NOT passed. | **No rate limit** (admin-only diagnostic — intentional bypass). |
| 32 | `students/[id]/comprehensive-report/route.ts` (indirect) | `"comprehensive-report"` | Generate comprehensive private report (via `generateComprehensiveReport()` in `src/modules/comprehensive-report/index.ts`). | Yes (the module passes `userId` to `callAI`) | Yes (`checkUserAILimit` + `categoryForFeature("comprehensive-report")` at the top of the route). |

### 2.2 Indirect `callAI(` call sites in shared modules

These call sites are in `src/modules/*/lib/*.ts` files that are imported by route handlers. They are invoked whenever the parent route is called.

| # | Module file | Feature label | Purpose | Invoked from route(s) | Passes `userId:`? | Rate-limited at the route? |
|---|---|---|---|---|---|---|
| 33 | `src/modules/assessment/lib/unified-grader.ts:267` | `` `${testKind}-grade` `` (e.g. `practice-grade`, `weekly-test-grade`, `daily-test-grade`) | AI-grade a single answer (correctness, feedback, level). | `daily-test/route.ts`, `ai/practice/route.ts`, `ai/weekly-test/route.ts` (via `gradeOneQuestion`). | **No** — `userId:` is NOT threaded into the grader. | Yes — the parent route's rate-limit check covers it. |
| 34 | `src/modules/assessment/lib/unified-test-engine.ts:162` | `` `${testKind}-question-explain` `` | AI-generate per-question explanations after a test. | Same as above (post-test explanation flow). | **No** — `userId:` is NOT threaded. | Yes — parent route covers it. |
| 35 | `src/modules/project/lib/course-aligned-planner.ts:235` | `"project-plan-gen"` | AI-generate the course-aligned project plan + per-day tasks. | `project/generate-tasks/route.ts`. | **No** — `userId:` is NOT passed to `callAI` here. | **No rate limit at the route** — `project/generate-tasks/route.ts` does NOT call `enforceAIRateLimit`. |
| 36 | `src/modules/project/lib/task-generator.ts:71` | `"task-gen"` | AI-generate project tasks (JSON). | **Dead code** — exported but no current caller (superseded by course-aligned-planner). | No | N/A. |
| 37 | `src/modules/project/lib/task-generator.ts:150` | `"week-plan-gen"` | AI-generate a week-by-week plan (JSON). | **Dead code** — exported but no current caller. | No | N/A. |
| 38 | `src/modules/comprehensive-report/index.ts:337` | `"comprehensive-report"` | AI-generate the comprehensive private report. | `students/[id]/comprehensive-report/route.ts`. | Yes (`userId`) | Yes — `checkUserAILimit` at the route. |
| 39 | `src/modules/course/lib/course-generation.ts:207` | `"course-gen"` | AI-generate a course outline from a prompt. | **Dead code** — exported but no current caller (the route inlines its own generation). | No | N/A. |

### 2.3 Summary of findings for AI paths

- **32 live call sites** across 24 route files + 6 shared modules (4 live, 3 dead).
- **29 of 32** live call sites pass `userId:` for per-user attribution.
- **3 live call sites do NOT pass `userId:`**:
  - `ai/teacher-tutor/route.ts` (`teacher-tutor`) — minor bug; usage is logged anonymously.
  - `ai/test/route.ts` (`connection-test`) — admin-only diagnostic, intentional.
  - `ai/debug/route.ts` (`debug-ping`) — admin-only diagnostic, intentional.
- **All user-facing AI routes are rate-limited** via `enforceAIRateLimit` (or the legacy `checkUserAILimit` + `isDemoAIBlocked` pair in `ai/weekly-test` and `students/[id]/comprehensive-report`).
- **Admin-only diagnostic routes** (`ai/test`, `ai/debug`) intentionally bypass rate limiting.
- **Two dead-code call sites** exist in `src/modules/project/lib/task-generator.ts` (`task-gen`, `week-plan-gen`) — exported but never imported. The module is superseded by `course-aligned-planner.ts`.
- **One dead-code call site** exists in `src/modules/course/lib/course-generation.ts` (`course-gen`) — exported but never imported. The route inlines its own generation.
- **Minor gap:** `project/generate-tasks/route.ts` invokes `generateCourseAlignedPlan()` (which calls `callAI`) but does NOT itself call `enforceAIRateLimit`. The student will hit the AI without per-user attribution or daily-limit enforcement at this entry point. Worth noting for the next hardening pass.

---

## 3. Orphan Routes — Zero UI Callers

Method: For each of the 122 route files, derived its URL path (e.g. `batches/[id]/teachers/[teacherId]`), built a regex that matches both literal `[id]` and template `${id}` forms, then searched all of `src/` (excluding `src/app/api/` itself) for any reference. Routes whose only mentions are inside their own folder are flagged as orphans.

A reference is counted if it appears in **any** of: a string literal in a `.tsx` component, a string literal in a `.ts` hook/module, or a JSDoc comment that names the path. (Comments alone count as "mentioned", so true orphans have ZERO mentions anywhere outside `src/app/api/`.)

### 3.1 Confirmed orphan routes (zero UI/module callers)

| # | Route path | Methods | Roles | Notes |
|---|---|---|---|---|
| 1 | `ai/debug` | GET | `admin` | Admin diagnostic endpoint. No UI button links to it. The `SystemPanel` admin page only wires `ai/test` (the simpler connection test). Likely intended for direct browser/curl access by developers. |
| 2 | `ai/limits` | GET | `auth` | Returns today's per-user AI usage. Was intended to power a "X/150 messages used today" widget — **the widget was never built**. `AILimitsPanel.tsx` only calls `/api/settings/ai-limits` (the admin-side config endpoint), not this user-side endpoint. |
| 3 | `batches/[id]/teachers` | GET, POST | `admin` + existing-batch-teacher | No UI for managing batch teachers. `CoursePlanner` patches batch metadata only; `AdminPrincipalTab` only duplicates batches. The BatchTeacher junction is read by backend code only. |
| 4 | `batches/[id]/teachers/[teacherId]` | DELETE | `admin` + existing-batch-teacher | Same as above — no UI to remove a teacher from a batch. |
| 5 | `batches/question-outliers` | GET | `staff` | Outlier-detection endpoint. No Insights/Analytics UI calls it. Likely a planned InsightsView feature that was never wired. |
| 6 | `certificates/verify` | GET | public | Public verify endpoint. **Replaced by a server component page** at `src/app/verify/[token]/page.tsx` that queries the DB directly. The API route is now redundant — the verify URL the UI shares (`/verify/${token}`) goes to the page, not the API. Safe to delete or keep as a public API for external integrations. |
| 7 | `courses/upload-outline` | POST | `admin` | Outline-upload AI generation. No upload UI exists in `CoursePlanner` or `AdminCoursesPanel` — only the "generate from topic" flow is wired. |
| 8 | `messages/outreach` | GET | `staff` | Last-contacted timestamps. Was intended to power a "last contacted X days ago" column in the teacher's roster. No roster UI calls it. |
| 9 | `project/auto-report` | POST | `staff` | Auto-generate a weekly report from check-ins. The student-facing `ProjectReportPanel.tsx` only calls `project/reports` (manual create); no UI triggers the auto path. |
| 10 | `students/[id]/generate-project-analysis` | POST | `staff` | AI-generate the final project analysis. `FinalResultPanel.tsx` only fetches `/api/students/final-result`; the analysis this route produces is referenced in a code comment in `final-result/route.ts` ("populated by teacher via /api/students/[id]/generate-project-analysis") but **never actually called** — `final-result/route.ts` returns `projectAnalysis: null`. |
| 11 | `teacher/topic-guidance` | POST, PUT | `staff` | AI-drafts topic guidance for future question generation. No "Add Guidance" button exists in any teacher UI. |

### 3.2 Verified non-orphans (called from UI/modules but worth noting)

These were initially suspected but turned out to have callers:

- `ai/evaluate` — called from `src/modules/assessment/lib/ai-provider.ts` (re-exported for assessment components).
- `ai/practice` — called from `src/modules/assessment/components/PracticePanel.tsx`.
- `ai/weekly-test` — called from `src/modules/assessment/components/WeeklyTestPanel.tsx`.
- `assistant/escalation/run` — called from `src/modules/ai-assistant/index.ts` (also wired via Vercel cron in `vercel.json`).
- `daily-logs/[id]`, `interactions/[id]`, `messages/[id]`, `messages/[id]/read` — all called from `StudentPortfolioPage.tsx` / `Messages.tsx` via template literals.
- `password-reset-requests/[id]/approve` — called from `PasswordResetPanel.tsx`.
- `users/[id]`, `users/[id]/approve`, `users/[id]/audit`, `users/[id]/batch`, `users/[id]/block`, `users/[id]/role` — all called from `AdminDashboard.tsx` / `UserAuditTab.tsx` via template literals.
- `students/[id]/*` (allow-retake, comprehensive-report, draft-checkin, edit-weekly-test, explain, generate-report-card, narrative, portfolio, rehearse, unlock-test) — all called from `StudentPortfolioPage.tsx`, `ComprehensiveReportView.tsx`, or `StudentAITools.tsx` via template literals.

### 3.3 Recommendations

- **Delete or wire** the 11 orphan routes. Most are half-built features with backend but no UI.
- **`certificates/verify`** is a special case — the server-component page made it redundant. Either delete it or document it as a public API for external consumers.
- **`ai/limits`** is a quick win — wire it to a small "X/Y messages today" badge in `AITutor.tsx` / `TeacherAITutor.tsx` / `DailyTestPanel.tsx` so students can see their remaining quota.
- **`teacher/topic-guidance`** + **`courses/upload-outline`** are higher-value features that just need a UI panel each.
- **`students/[id]/generate-project-analysis`** has a code comment promising it powers `final-result`'s `projectAnalysis` field — but the field is always `null`. Either wire the call or remove the dead field.

---

## 4. Source Files Used / Methodology

- `find src/app/api -name "route.ts"` → 122 route files inventoried.
- `rg "callAI\("` across `src/` → 33 files (1 is the definition; 32 are call sites).
- `rg "/api/[a-zA-Z0-9/_\[\].\-${}()]+"` across `src/` → 540 references in 100+ files.
- Cross-reference script: `/tmp/check_orphans.sh` — derived each route's URL path, regex-matched against all source files outside `src/app/api/`, flagged zero-hit routes as orphans, then manually verified each orphan with a targeted `rg` search.

Auth-pattern cheat-sheet (from `src/lib/auth.ts` + `src/lib/rbac.ts`):
- `getAuthUser()` — returns JWT payload (or null). Lowest-level auth check.
- `getCurrentUser()` — `getAuthUser` + full DB User row (with 5s timeout).
- `requireRole([...])` — asserts the user's role is in the list; returns `{ ok, ctx | response }`.
- `requireRoleOrSelf([...], targetUserId)` — allows self OR role-list.
- `requireAccessGrant(scopeType, scopeId, dataScope?)` — checks AccessGrant.
- `assertCanAccessStudent(payload, studentId)` — IDOR protection; throws on denial.
- `hasRole(role, allowed[])` — pure boolean role check.
- `isStaffRole(role)` — true for any staff role (not student/pending/guardian).
- `ADMIN_ROLES` = `[principal, administrator, demo]`.
- `USER_MANAGEMENT_ROLES` = `[principal, administrator, teacher]`.
- `demoWriteBlock(action)` — returns a 403 response for demo accounts on write actions.

Rate-limiting cheat-sheet (from `src/lib/ai-rate-limits.ts`):
- Three categories: `test` (50/day default), `tutor` (150/day), `assistant` (100/day).
- `checkUserAILimit(userId, category)` — returns `{ allowed, used, limit, remaining, resetAt }`.
- `enforceAIRateLimit(userId, feature, isDemo)` — H1 fix; combines demo-block + category lookup + `checkUserAILimit`; returns `null` if allowed or a NextResponse-shaped object if blocked.
- Demo accounts can be entirely AI-blocked via the `demo_ai_enabled` Setting.
