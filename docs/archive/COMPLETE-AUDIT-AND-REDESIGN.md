# ExaminerAI — Complete Multi-Perspective Audit + Redesign Plan

**Date:** 2026-07-20
**Auditors:** 10 professional lenses (Feature Engineer, PM, SWE, Student Psychologist, Data Analyst, Educationist, Teacher, Course Designer, Mentor, QA)
**Method:** Physical end-to-end testing of every student, teacher, and admin flow + code-level audit of all 71 API routes + 13,000 lines of UI components

---

## Executive Summary — The Core Problem

The app is **functionally dense but emotionally surveillant and visually monotonous**. It feels like a Blackboard/LMS from 2010 wrapped in a clean Tailwind skin — not the supportive mentor the copy claims to be. The SDT rebalance improved the *words* but not the *experience*.

**Three root causes:**

1. **Surveillance UI directed at the student** — plagiarism banners, "Psychological Analysis", "Behavioral Pattern Analysis", "Career Readiness: Not Ready" all shown TO the student. A student reading their report card sees congratulations + surveillance language + career judgment in a single scroll.

2. **Too many tabs, wrong grouping** — 11 student nav items organized by *feature* (Practice, Test, Project, Report) instead of by *time* (Today, This Week, My Project, Progress). The student's mental model doesn't match the sidebar.

3. **Zero visual identity** — every card is `border-border bg-card`. No brand color, no illustrations, no animations beyond spinners, no progress visualization beyond 1.5px progress bars. A student couldn't tell you what the app's brand is after using it for a week.

---

## Critical Bugs (Fix Immediately)

| # | Bug | File:Line | Impact |
|---|---|---|---|
| 1 | Feature flag toggle in System tab calls PATCH but route only supports POST | AdminDashboard.tsx:1140 vs settings/features/route.ts:35 | Toggling flags from System tab silently does nothing |
| 2 | PM tab AI stats destructure wrong field paths (totalTokens vs tokens.total) | AdminDashboard.tsx:689-690 | All 4 PM AI stats always show "—" |
| 3 | Week selector hardcoded to W1-W6 in WeeklyTestPanel | StudentDashboard.tsx:2932 | 12-week course students can't access weeks 7-12 |
| 4 | Stat card shows "Week {currentWeek}/6" hardcoded | StudentDashboard.tsx:1409 | Visually wrong for any non-6-week course |
| 5 | FinalResultPanel rendered for every student including Week-1 newbies | StudentDashboard.tsx:3703 | Shows "Career Readiness: Not Ready" to students with zero data |
| 6 | Invisible edit-pencil on week titles (group-hover with no group class) | StudentDashboard.tsx:4750 | Can't edit week titles |
| 7 | Env var check uses NEXT_PUBLIC_DATABASE_URL (always undefined) | AdminDashboard.tsx:1084 | DB env var always shows red |
| 8 | Role change has no confirmation dialog | AdminDashboard.tsx:62-67 | One misclick demotes an admin |
| 9 | Weekly test grade overrides have no audit trail | grades/override/route.ts:44-50 | Teacher can silently change any score |
| 10 | Gantt chart task spans are invented (code comment admits "no projectStartDate") | StudentDashboard.tsx:5244-5268 | Misleading visualization |

---

## The 10-Perspective Audit

### 1. Feature Engineer — What's Missing

**Missing core features:**
- No landing page (first visit = login form)
- No email notifications (signup approval = student waits in limbo)
- No search/filter/pagination on ANY list view
- No bulk operations (can't approve 10 students, can't message a cohort)
- No calendar/scheduling
- No PDF/printable report cards or certificates
- No LMS integration (Google Classroom, Canvas)
- No parent/guardian communication
- No attendance tracking
- No audit log for compliance

**Feature overlaps:**
- 3 identical chat UIs (AI Tutor, Weekly Test, Messages) — disorienting
- Dashboard project chart = Project tab project chart (duplicate)
- Settings has "Project Settings" but Project tab also has "Edit Project" (two entry points, different UX)

### 2. Product Manager — User Journey Gaps

**Student onboarding is broken:**
- Journey Wizard is the first screen (14 sequential steps, no skip)
- Should be: dashboard first, wizard opt-in via "First time? Take the tour"
- Wizard hardcodes "6 weeks" + "VS Code, Git, LocalWP" + 12 web-dev capstone ideas
- A Python student sees the wrong onboarding

**Teacher workflow friction:**
- Psych/Edu tabs show struggling students but have NO action buttons — teacher must memorize name, go to Overview, find them, click
- No message history shown in Mentorship tab — teacher doesn't know if they already contacted this student
- Report card generation hardcoded to Weeks 1-6

**Admin friction:**
- Admin needs 3 clicks to approve a student (Overview → Users → check); teacher needs 1 (inline)
- Courses tab "Edit" link opens Course Planner in list view (doesn't pass course ID)
- Reseed button sits next to Refresh (one misclick wipes real data)

### 3. Software Engineer — Code Quality

**Architecture:**
- StudentDashboard.tsx: 5,431 lines in one file (partially extracted to student/ subfolder)
- TeacherDashboard.tsx: 2,591 lines
- AdminDashboard.tsx: 1,750 lines
- No route tests (134 tests are all pure-function unit tests)
- No E2E tests

**Consistency:**
- Mixed API client usage: some routes use `api.*`, others use raw `fetch`
- Response envelope varies: some `{ ok, data }`, some `{ courses }`, some raw array
- `PUT /api/auth/login` for signup (semantically wrong — should be `POST /api/auth/signup`)

**Security:**
- IDOR partially fixed (portfolio route) but other `/api/students/[id]/*` routes still don't check cohort ownership
- No rate limiting on auth or AI endpoints
- No 2FA for admin accounts
- DeepSeek API key stored plaintext in DB Setting table

### 4. Student Psychologist — Emotional Impact

**The most damaging finding:** The app alternates between supportive mentor and suspicious examiner within the SAME SCREEN.

A student reading their report card sees (in a single scroll):
1. "Congratulations!" (supportive)
2. "Behavioral Pattern Analysis" (surveillance)
3. "Average Plagiarism Risk: 12%" (accusation)
4. "Areas to Improve (to become a professional)" (judgment)
5. "Career Readiness: Not Ready" (verdict)

**Clinical language shown to students:**
- "Psychological Analysis" — medically loaded
- "Behavioral Pattern Analysis" — sounds like a diagnostic
- "Voice analysis" — sounds like forensic linguistics
- "Engagement & Focus Feedback" with "avoidance count" — sounds like a behavioral report

**Recommendation:** Strip ALL clinical/surveillance language from student-facing surfaces. Rename to human language. Hide plagiarism scores from students entirely (teacher-only). Show strengths FIRST, always.

### 5. Data Analyst — Analytics Gaps

**What the teacher CAN see:**
- Current snapshot of student progress/scores/attention
- Score distribution bar chart (static, no trend)
- Attention reasons (current, no history)

**What's MISSING:**
- Time-trend charts (score over weeks, engagement over time)
- Topic-level difficulty analysis (which weekly topics have lowest scores)
- Cohort comparison (Cohort A vs Cohort B)
- Completion funnel (signup → approved → week 1 → ... → certified)
- Dropout analysis (when do students stop engaging?)
- AI cost-per-student
- Teacher response-time SLA tracking

**Data quality issues:**
- "Avg Attention Score" averages across ALL students (including 0-score on-track ones) — misleading
- "Avg Score" excludes students with no test — skews up
- Gantt chart task spans are invented (no real schedule data)
- No project start date tracked → can't calculate real pacing

### 6. Educationist — Pedagogical Assessment

**Strengths:**
- 4 Socratic pillars (Why/Break-It/Client Translation/Edge Case) are well-chosen
- Lenient scoring for beginners is appropriate
- Implementation intentions in study plans (post-SDT rebalance)
- Strength signals required alongside deficits (post-SDT rebalance)

**Weaknesses:**
- No spaced repetition (practice questions don't resurface weak topics over time)
- No adaptive difficulty (all students get same difficulty regardless of performance)
- No Bloom's "Create" level tasks (AI tests understanding, not creation)
- No peer review or collaborative learning
- No formative assessment separate from summative (weekly test is the ONLY assessment)
- Reflection questions (learningReflection, confusionNotes, nextQuestion) are hidden in a collapsed section — students miss them
- No retrieval practice (flashcards, quizzes, quick recall)

### 7. Teacher — Daily Workflow

**The teacher's biggest pain point:** too many clicks for common tasks + no contextual action.

**Typical daily flow:**
1. Open app → see overview (good)
2. Notice a student needs attention (red dot)
3. Want to message them → must go to Mentorship tab → find them → click Message
4. Want to see their recent work → must click into portfolio → navigate 7 tabs
5. Want to comment on a check-in → must find it in the Check-Ins tab → click comment icon
6. Want to generate a report card → must click Report Card button → pick week → generate

**What the teacher wants:**
- Right-click or hover on a student name → quick action menu (message, view portfolio, comment)
- Batch "approve all pending" button
- "Message entire cohort" button
- Inline commenting without opening a dialog
- Recent activity feed (across all students) on the landing page

### 8. Course Designer — Curriculum Tools

**Strengths:**
- AI course generation works (with batching for long courses)
- Per-course customization (tools, deliverables, assessment type)
- DB-driven course outline (replaces static HTML)

**Weaknesses:**
- No course duplication (must regenerate from scratch)
- No template library
- No version history (editing overwrites with no undo)
- No per-day AI regeneration (must redo entire course to fix one day)
- No syllabus export (PDF/CSV)
- No curriculum comparison across cohorts
- Quality issues flagged but not actionable (can't click through to fix)
- Journey steps still hardcoded for web-dev (VS Code, LocalWP, etc.)

### 9. Mentor — Relationship Quality

**The SDT rebalance improved the WORDS but not the EXPERIENCE:**

- Nudges now reference specific progress (good) but the student still sees them in the same Messages UI as system alerts and teacher messages — no relationship context
- Teacher alerts now include strengths (good) but the teacher still has to manually act — no "suggested reply" templates
- No conversation history per student in the Mentorship tab
- No "time since last contact" indicator — teacher doesn't know if they've been absent
- No regular check-in prompts for the teacher (only alerts when something is WRONG — deficit lens persists)
- No student-initiated "I need help" button (student must navigate to Messages and compose)

**What real mentorship looks like:**
- Teacher sees "You last contacted X 5 days ago" for each student
- System suggests "Consider a quick check-in with X — they've been consistent" (positive nudge for teacher)
- Student has a persistent "Ask my teacher" button visible on every screen
- Messages have context (threaded, with the student's recent work attached)

### 10. QA — Testing Gaps

**Test coverage:** 134 tests, ALL pure-function unit tests. Zero route tests. Zero E2E tests.

**Critical untested paths:**
- Login/signup flow
- Weekly test state machine (the most complex logic in the app)
- Course CRUD + AI generation
- Certificate generation + verification
- Struggle detection
- Grade override
- Report card generation

**Manual testing findings:**
- `alert()` used for error handling in 8+ places (hostile UX)
- `confirm()` used for destructive actions (no undo)
- Form validation inconsistent (some fields validated, some not)
- No error boundaries on individual panels (one crash = blank screen)

---

## Token Efficiency Plan

### What's cached (good)
- ✅ Practice question generation (by week:topic:pillar hash)

### What's NOT cached (every call hits DeepSeek)
| Feature | Cache key | Est. savings |
|---------|-----------|-------------|
| Answer evaluation | None | 0% — can't cache (unique answers) |
| Weekly test replies | None | 0% — can't cache (unique conversations) |
| Course generation | None | 100% on regenerate (cache by form hash) |
| AI Tutor | None | 0% — can't cache (unique questions) |
| Daily motivation | Date key (already cached!) | Already efficient |
| Final result analysis | None | 80% (cache by studentId+week, invalidate on new test) |
| Project task generation | None | 100% on regenerate |

### Recommendations
1. **Cache course generation** by `hash(name + description + weeks + days)` — if someone generates the same course twice, return cached
2. **Cache final result analysis** by `studentId + week` — invalidate when a new test is completed
3. **Batch API health checks** in SystemPanel from sequential to `Promise.all` — saves ~1.5s per load
4. **Summarize weekly test conversations** before sending to final analysis (currently sends full transcript, truncated to 2000 chars) — could use a smaller summary
5. **Reduce FINAL_ANALYSIS token budget** from 1500 to 1200 — the SDT additions (strengthSignal, implementation intention) add ~300 tokens but the response structure hasn't been optimized

---

## The Redesign — From "Boring LMS" to "Growth Companion"

### Visual Identity
- **New accent color**: shift from generic Google blue to a warm growth-oriented palette (sage green for progress, warm amber for attention, soft coral for alerts — not red)
- **Card variety**: different card styles for different purposes (filled cards for stats, outlined cards for forms, gradient cards for AI-generated content)
- **Progress visualization**: radial progress for consistency, milestone markers on timelines, phase coloring on course outlines
- **Micro-interactions**: card entrance staggered (not simultaneous), button press feedback, success animations on check-in/test completion
- **Empty states**: illustrated empty states (not just "No data" text)

### Information Architecture — Student (6 tabs, not 11)
```
Today (default landing — consolidates daily curriculum + practice + check-in + tasks)
This Week (weekly test + week's curriculum overview + progress)
My Project (project description + Gantt + task manager — tasks FIRST)
My Progress (report cards + final result + competency trends — GATED on having data)
Resources (AI Tutor + Course Outline + Messages — grouped)
Account (settings + password + security)
```

### Information Architecture — Teacher (3 tabs, not 4)
```
Cohort (overview + student table with inline actions + batch operations)
Insights (psychological health + educational health merged — one analytics view)
Mentorship (student outreach + message history per student + teacher presence tracking)
```

### Information Architecture — Admin (6 tabs)
```
Overview (principal view — enrollment, health, quick actions)
Users (searchable, filterable, paginated)
Courses (coordinator view — catalog + quality + assignments)
Operations (PM view — action items + system health + AI usage)
System (dev tools — health checks + feature flags + env vars)
Settings (admin credentials + feature flags + password resets)
```

### Language Changes (Student-Facing)
| Old (surveillance) | New (mentorship) |
|---|---|
| "Psychological Analysis" | "How You Think" |
| "Behavioral Pattern Analysis" | "Your Learning Style" |
| "Engagement & Focus Feedback" | "Your Focus Today" |
| "Academic Integrity Note" | (hidden from student — teacher only) |
| "Plagiarism Risk: X%" | (hidden from student — teacher only) |
| "Voice analysis" | (hidden from student — teacher only) |
| "Career Readiness: Not Ready" | (hidden until all tests complete) |
| "Areas to Improve (to become a professional)" | "What to Try Next" |
| "Streak" | "Consistency" (already done in SDT rebalance) |

### Implementation Priority

**Phase A — Stop Harming (1 day)**
1. Hide ALL surveillance language from student-facing surfaces
2. Gate FinalResultPanel behind `weeklyTestsCompleted > 0`
3. Fix the 10 critical bugs listed above
4. Remove `alert()` calls — replace with toast notifications

**Phase B — Reduce Friction (2 days)**
5. Consolidate student nav from 11 to 6 tabs
6. Make dashboard the default landing (not Journey Wizard)
7. Add inline action buttons to Psych/Edu tabs (message + view portfolio)
8. Fix report card week selector to use dynamic course duration
9. Add search/filter to teacher student table

**Phase C — Visual Refresh (3 days)**
10. New color palette (warm growth-oriented)
11. Card variety (filled/outlined/gradient)
12. Staggered entrance animations
13. Illustrated empty states
14. Radial progress for consistency
15. Success animations on check-in/test completion

**Phase D — Token Efficiency (1 day)**
16. Cache course generation by form hash
17. Cache final result analysis by studentId+week
18. Parallelize API health checks
19. Reduce FINAL_ANALYSIS token budget to 1200

**Phase E — Missing Features (ongoing)**
20. "Ask my teacher" button on every student screen
21. Teacher presence tracking ("last contacted X days ago")
22. Batch operations (approve all, message cohort)
23. Search/filter/pagination on all list views
24. PDF export for report cards + certificates
25. Audit log for grade overrides + role changes
