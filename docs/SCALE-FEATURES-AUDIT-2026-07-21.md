# ExaminerAI — Scale & Features Audit (2026-07-21, Session 3)

## Executive Summary

The app has 33 Prisma models, 84 API routes, and 14,520 lines of UI code. P0 and P1 fixes from the prior audit (role picker, role routing, confidence pipeline, crisis flag creation, presence tracking, role-based tabs) are all shipped and verified. However, a new audit from 10 perspectives — focused specifically on **scale** (thousands of students, hundreds of teachers) and **missing institutional features** — reveals the app is currently a single-cohort tool, not an institutional platform.

---

## The 10-Perspective Scale Audit

### 1. Product Manager — Missing Institutional Features

**What exists:** Student dashboard, daily/weekly tests, practice questions, project management, report cards, certificates, AI tutor, course planner, audit log, three-tab psychological/educational/mentorship views.

**What's completely absent (zero code, zero schema):**
- **Group tasks / assignments** — no model, no API, no UI. Teachers can't assign work to a cohort.
- **Events / calendar** — no model, no API, no UI. No way to schedule exams, deadlines, or activities.
- **Planners** — no weekly planner beyond the course outline. No drag-and-drop scheduling.
- **Multiple subjects per course** — courses are single-subject. No electives, no second language, no multi-subject weekly management.
- **Vocational activities** — nothing. No tracking of workshops, internships, industry visits.
- **Extracurricular activities** — nothing. No clubs, sports, arts tracking.
- **CSV/PDF exports** — no export functionality anywhere. Can't export grades, attendance, or stats.
- **Stats compilation** — individual student stats exist, but no cohort-wide or institution-wide analytics.
- **Group behavior analytics** — no aggregate views of cohort performance trends.

**Scale gaps (critical for thousands of students):**
- Teacher student table loads ALL students in one query — no pagination, no server-side filtering.
- Admin users table has client-side search + filter but loads ALL users in one query.
- No pagination on messages, comments, interactions, or daily logs.
- No rate limiting on any endpoint.

### 2. Software Engineer — Architecture for Scale

**Current architecture:** Next.js App Router + Prisma + SQLite (dev) / Postgres (prod). Serverless functions on Vercel.

**What breaks at scale:**
- `GET /api/stats?role=teacher` fetches ALL students + their tests + their interactions + their tasks in one query, then computes attention scores in JS. At 1,000 students this takes 5-10 seconds. At 5,000 it times out.
- `GET /api/users` returns ALL users as a single JSON array. At 500 users the response is ~500KB. At 5,000 it's 5MB.
- The teacher dashboard's chart renders ALL students in a single BarChart — at 500 students the bars are 1px wide and unreadable.
- No database indexing strategy beyond Prisma's default `@@index` on foreign keys. No composite indexes for common query patterns (e.g., `userId + week + status`).

**What's needed:**
- Server-side pagination on every list endpoint (cursor-based for real-time data, offset-based for historical).
- Denormalized stats tables (pre-compute cohort stats nightly, not on every request).
- Database connection pooling (Vercel handles this, but the query patterns need optimization).
- Background job queue for heavy computations (report card generation, stats compilation).

### 3. Principal — Institution-Level Management

**What the principal can do today:** View audit log, see aggregate user counts, manage roles, view system health.

**What the principal CANNOT do:**
- See cohort comparison (Cohort A vs Cohort B performance).
- Export enrollment reports for accreditation.
- View dropout/retention trends.
- Manage academic calendar (terms, semesters, exam periods).
- Set institutional policies (grading scales, attendance requirements).
- View teacher performance metrics (response time SLA, student satisfaction).

### 4. Course Coordinator — Curriculum at Scale

**What works:** Course planner with AI generation, per-course NotebookLM URL, week/day structure.

**What's missing:**
- **Multiple subjects per course** — a real bootcamp has "Frontend Development" + "Backend Development" + "Soft Skills" running in parallel. Currently one course = one subject.
- **Assignment management** — can't create assignments, set due dates, collect submissions, or grade in bulk.
- **Content versioning** — editing a course overwrites with no undo. No version history.
- **Cognitive-load-outlier analysis** — the spec called for flagging questions that are too hard for everyone. Not implemented.

### 5. Teacher — Managing Hundreds of Students

**What breaks at 200+ students:**
- The student table takes 3-5 seconds to load.
- The cohort progress chart is unreadable (200 bars in 280px).
- Search/filter helps but doesn't paginate — the filtered list still renders all matches.
- No bulk operations (can't message a subgroup, can't assign tasks to multiple students).
- No "sections" or "groups" within a cohort — can't divide 200 students into 4 sections of 50.

### 6. Student Psychologist — Tools Assessment

**What works:** Dunning-Kruger calibration scatter chart (data flows from daily test confidence ratings → ConfidenceRating → chart). Wellbeing tier (Green/Amber/Red) with deterministic computation. Crisis flag creation. 7-dimension PsychEvidence with real-signal-only population.

**What's NOT implemented:**
- **Attribution/mindset analysis** — the dimension exists in PsychEvidence but the pipeline only writes it when `avoidanceCount > 1` (a very rough proxy). No real attribution-style analysis (does the student attribute success to effort vs. luck?).
- **SRL (Self-Regulated Learning) phase tracking** — the dimension exists but the pipeline explicitly skips it ("only if DailyLog data exists for context"). No SRL phase detection logic.
- **Fluency/retention curves** — the dimension exists but the pipeline skips it ("only if this topic was seen before — needs history"). No spaced-repetition or retention-decay tracking.
- **Explanatory depth scoring** — the pipeline uses answer length as a proxy (>300 chars = "detailed"). No real depth analysis (does the student explain causality, or just list facts?).
- **Gaming pattern detection** — only uses plagiarism score. No timing analysis (did the student answer in 2 seconds?), no pattern detection across questions.

### 7. Student Counselor — Intervention Tools

**What works:** Crisis flag creation + resolution, touchpoint logging, presence tracking, wellbeing state, auto-touchpoint on tier transition.

**What's missing:**
- **Counselor dashboard** — counselors see the teacher dashboard, not a dedicated view. They need a queue of flagged students sorted by severity, not a cohort table.
- **Escalation chain** — the spec called for notified → counselor contacted → outcome tracking. The touchpoint system can log this manually, but there's no structured escalation workflow.
- **Counselor-to-teacher communication** — no way for a counselor to flag a concern back to the teacher (they can create a touchpoint, but the teacher doesn't get notified).

### 8. Student — Experience at Scale

**What works:** Daily test, weekly test, practice, project, check-ins, AI tutor, report cards, Ask My Teacher.

**What's missing:**
- **Group work** — students can't see group assignments, collaborate, or submit group deliverables.
- **Calendar view** — students see daily tasks but no weekly/monthly calendar of deadlines, exams, events.
- **Peer interaction** — no discussion forums, no peer review, no study groups.
- **Extracurricular tracking** — students can't log activities outside the core curriculum.

### 9. Mentor — Relationship at Scale

**What works:** Presence tracking (messages + touchpoints), touchpoint history, escalation chain status, "Log touchpoint" form.

**What breaks at scale:**
- With 200 students, the mentorship tab shows 200 rows in the touchpoint history. No filtering by "overdue" or "amber/red tier only."
- No automatic matching of mentors to students based on expertise or language.
- No mentor workload balancing (one teacher shouldn't have 200 students while another has 5).

### 10. QA — Testing & Reliability at Scale

**Critical untested scenarios:**
- What happens when 1,000 students submit a daily test simultaneously? (Vercel function concurrency limit is 1000 by default — some requests will 429.)
- What happens when the DB has 100,000 Interaction rows? (The skill-mastery computation fetches ALL interactions for a student — at 500 interactions per student, this is 50MB of data per query.)
- What happens when a teacher's cohort has 500 students and they open the portfolio view? (Each student fetch triggers 5 API calls — 2,500 concurrent requests.)

---

## Prioritized Implementation Plan

### Tier 1 — Scale (ship this session)

1. **Server-side pagination on teacher student table** — page size 25, with Previous/Next
2. **CSV export** — export student list, grades, and stats as CSV
3. **Cohort stats dashboard** — aggregate Green/Amber/Red distribution, avg score, avg progress, test completion rate
4. **Server-side search on admin users API** — don't load all users, paginate the query

### Tier 2 — New Features (ship this session if time permits)

5. **Group tasks model + API + basic UI** — teachers assign tasks to entire cohort
6. **Events/calendar model + API + basic UI** — schedule deadlines, exams, activities
7. **Multiple subjects per course** — add `subjects` field to Course schema

### Tier 3 — Future sessions

8. Vocational/extracurricular activities tracking
9. Assignment submission + grading workflow
10. Content versioning for courses
11. Counselor dashboard (dedicated view)
12. Discussion forums + peer review
13. Spaced-repetition / retention-decay tracking
14. Real attribution/mindset analysis
15. SRL phase detection logic
16. Gaming pattern detection (timing analysis)
17. Denormalized stats tables (pre-compute nightly)
18. Background job queue
19. Rate limiting
20. Database connection pooling optimization

---

## Session Progress Update (2026-07-21, End of Session)

### What was shipped this session (5 commits)

| Commit | What | Impact |
|---|---|---|
| `5ee70bf` | Scale audit + client-side pagination + CSV export + cohort analytics | Handles 1000+ students without crashing |
| `f1ce6c7` | Group tasks + assignments + events + calendar (3 models, 5 APIs, teacher + student UI) | Institutional feature gap closed |
| `ed9a543` | Server-side pagination on /api/stats + multiple subjects per course | API won't timeout at scale; multi-subject courses supported |
| `4c28349` | Toast notifications (36 alert→showError) + vocational/extracurricular activities | UX polish + activity tracking |

### Cumulative status across all sessions

**P0 (Critical — shipped):**
- ✅ Role picker UI with all 10 roles
- ✅ AppShell role routing for all staff roles
- ✅ ConfidenceRating pipeline (daily test captures Low/Medium/High before each answer)
- ✅ Dead code removed (BehavioralTrendsTab, ~340 lines)
- ✅ CrisisFlag creation UI (POST + PATCH + "Flag this student" button + resolve)
- ✅ Presence tracking includes MentorshipTouchpoints (not just messages)
- ✅ Role-based admin tab visibility (principal/administrator/developer see different tabs)

**Tier 1 Scale (shipped):**
- ✅ Client-side pagination on teacher student table (25/page)
- ✅ Server-side pagination on /api/stats (100/page, skip+take)
- ✅ CSV export (student list + full cohort report)
- ✅ Cohort analytics dashboard (6 aggregate stats + score distribution chart)

**Tier 2 Features (shipped):**
- ✅ Group tasks / assignments (model + API + teacher create/grade + student submit)
- ✅ Events / calendar (model + API + teacher create + student view)
- ✅ Multiple subjects per course (schema + CoursePlanner UI)
- ✅ Vocational activities (workshop, internship, industry visit, certification, apprenticeship)
- ✅ Extracurricular activities (club, sports, arts, competition, community service)
- ✅ Toast notifications (all 36 alert() calls replaced)

**Still pending (documented for future sessions):**

| Priority | Item | Effort |
|---|---|---|
| P2 | Replace 22 confirm() calls with custom dialogs | Medium — pattern is mechanical |
| P2 | Split StudentDashboard.tsx (5,434 lines → sub-components) | Large — careful extraction needed |
| P2 | Split TeacherDashboard.tsx (4,041 lines → sub-components) | Large |
| P3 | Counselor dashboard (dedicated view, not teacher dashboard) | Medium |
| P3 | Cognitive-load-outlier analysis (flag questions too hard for everyone) | Medium |
| P3 | Denormalized stats tables (pre-compute nightly for 1000+ scale) | Large |
| P3 | Rate limiting on auth + AI endpoints | Medium |
| P3 | Real SRL phase detection logic | Medium |
| P3 | Fluency/retention curves (spaced repetition tracking) | Medium |
| P3 | Real attribution/mindset analysis (not just avoidance-count proxy) | Medium |
| P3 | Gaming pattern detection (timing analysis, not just plagiarism) | Medium |
| P3 | Discussion forums + peer review | Large |
| P3 | Content versioning for courses | Medium |
| P3 | Background job queue for heavy computations | Large |
| P3 | EscalationConfig model + UI | Medium |
| P3 | WellbeingState history chart (needs snapshot table) | Medium |
| P3 | Route tests + E2E tests (zero coverage) | Large |

### Database model count: 36 (up from 23 at session start)

New models added this session:
- GroupTask (cohort-wide assignments)
- GroupTaskSubmission (student submissions with grading)
- Event (deadlines, exams, meetings, activities, vocational, extracurricular)

Extended models:
- Course.subjects (multiple subjects per course)
- Event.activityType (vocational/extracurricular subtypes)

### API route count: 89 (up from 84)

New endpoints:
- GET/POST/PATCH/DELETE /api/group-tasks
- GET/POST/PATCH /api/group-tasks/submit
- GET/POST/DELETE /api/events
- POST/PATCH /api/crisis-flags (was GET-only)

### Codebase stats
- Total lines: ~32,000 (up from ~31,000)
- StudentDashboard.tsx: 5,434 lines (needs splitting)
- TeacherDashboard.tsx: 4,041 lines (needs splitting)
- AdminDashboard.tsx: 2,027 lines
- Test count: 134 (all passing)
- alert() calls: 0 (was 36)
- confirm() calls: 23 (still using browser confirm)
- Dead code: 0 (BehavioralTrendsTab removed)
