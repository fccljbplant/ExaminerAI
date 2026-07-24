# ExaminerAI — Complete System Documentation

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control)
3. [Student Psychological Data — How It's Collected & Analyzed](#3-student-psychological-data)
4. [Educational Health — How It's Calculated](#4-educational-health)
5. [Mentorship System — How It Works](#5-mentorship-system)
6. [Teacher Health Monitoring](#6-teacher-health-monitoring)
7. [Alert System — Psych, Educational, Mentorship](#7-alert-system)
8. [How Teachers Check Student Health](#8-how-teachers-check-student-health)
9. [Data Flow Diagram](#9-data-flow-diagram)
10. [Database Schema — Health & Mentorship Tables](#10-database-schema)

---

## 1. Architecture Overview

ExaminerAI is a **modular monolith** built with Next.js 16 + Prisma + PostgreSQL (Neon).

### Modules
```
src/modules/
├── assessment/     — Tests, grading, AI, psych analysis, engagement tracking
├── course/         — Course outlines, curriculum, AI course generation
├── project/        — Student project planning, task management
├── admin/          — Users, batches, settings
├── auth/           — Authentication, RBAC
├── communication/  — Messaging, comments
├── grading/        — Grade overrides, report cards, certificates
├── shared/         — DB, logger, utilities
├── student/        — Student lifecycle (skeleton)
└── wellbeing/      — Wellbeing state (skeleton)
```

### Key Files
- `src/modules/assessment/lib/psych-analyzer.ts` — Per-message psychological analysis
- `src/modules/assessment/lib/engagement-tracker.ts` — Lightweight engagement + psych tracking
- `src/modules/assessment/lib/analysis-pipeline.ts` — Full test-completion psych pipeline
- `src/modules/assessment/lib/unified-grader.ts` — Unified grading contract
- `src/modules/assessment/lib/token-cache.ts` — AI response cache
- `src/lib/rbac.ts` — Role-based access control

---

## 2. Role-Based Access Control

### Roles (10 total)
| Role | Purpose | Key Access |
|---|---|---|
| `pending` | New signup awaiting approval | None |
| `student` | Learner | Own data, AI Tutor, tests |
| `teacher` | Mentor / examiner | Batch dashboard, portfolio, grading |
| `course_coordinator` | Manages courses | Course planner (update only, no delete) |
| `counselor` | Wellbeing staff | Batch (AccessGrant-scoped) |
| `guardian` | Parent / carer | Read-only child's progress |
| `principal` | Institution head | All admin + pastoral access |
| `administrator` | Operations admin | All admin except crisis content |
| `developer` | Technical admin | System health, AI config, no people management |

### Permission Enforcement
- Every API route calls `getAuthUser()` + checks role via `hasRole()` or `isStaffRole()`
- IDOR protection via `assertCanAccessStudent()` — teachers can only access their own batch's students
- AccessGrant model for scoped access (counselors, coordinators)

---

## 3. Student Psychological Data

### How It's Collected

Psychological data is collected at TWO levels:

#### Level 1: Lightweight Per-Message Analysis (AI Tutor messages)
**File:** `src/modules/assessment/lib/psych-analyzer.ts`

Every AI Tutor message from the student is analyzed using **pure heuristic text analysis** (NO AI call — <1ms). The analyzer detects:

| Signal Type | Detection Method | Score Impact |
|---|---|---|
| Frustration | Word matching against 25+ phrases ("frustrated", "hate this", "too hard", "stressed") | moodScore -20 per signal (max -60) |
| Avoidance | Word matching against 15+ phrases ("I don't know", "skip", "boring", "don't care") | moodScore -15, engagementScore -25 |
| Enthusiasm | Word matching against 20+ phrases ("interesting", "cool", "got it", "learned") | moodScore +15, engagementScore +20 |
| Growth mindset | Dweck's language signals ("learn", "practice", "improve", "try again") | engagementScore +10, moodScore +5 |
| Message length | >200 chars = engaged, <20 = disengaged | engagementScore ±15 |
| Question-asking | Contains "?" or "kya"/"kyun" (Urdu) | engagementScore +10 |

**Score calculation:**
- moodScore: starts at 50 (neutral), adjusted by signals, clamped 0-100
- engagementScore: starts at 50 (neutral), adjusted by signals, clamped 0-100
- Scores use **exponential decay** (70% old, 30% new) — single messages don't spike scores, but patterns over multiple messages do

**What gets stored:** The scores are aggregated into `StudentHealthSummary` (1 row per student) via a single upsert. NO per-message rows are written — just the running average.

#### Level 2: Full Test-Completion Analysis (on test completion only)
**File:** `src/modules/assessment/lib/analysis-pipeline.ts`

When a student completes a test (daily, weekly, or practice), the full analysis pipeline runs. This writes `PsychEvidence` rows across 7 dimensions:

### The 7 Dimensions

#### 1. Calibration
**Measures:** Does the student know what they know? (Dunning-Kruger effect)
**Calculation:** Compares self-rated confidence (daily tests) vs. actual score. Gap > 20 = overconfident, gap < -20 = underconfident.
**Values:** `overconfident` | `underconfident` | `well-calibrated` | `no_self_rating`

#### 2. Explanatory Depth
**Measures:** How deeply does the student explain their reasoning?
**Calculation:** Average character length of answers. <50 = surface, 50-300 = moderate, >300 = detailed.
**Values:** `surface_answers` | `moderate_depth` | `detailed_reasoning`

#### 3. Gaming Pattern
**Measures:** Is the student using AI to generate answers?
**Calculation:** Voice inconsistency analysis (plagiarism score 0-100). Weekly tests run full analysis. >50 = voice inconsistency.
**Values:** `authentic_voice` | `voice_inconsistency` | `not_analyzed`

#### 4. Attribution / Mindset
**Measures:** Growth vs. fixed mindset (Carol Dweck's theory)
**Calculation:** Language pattern detection. "learn", "practice" = growth. "can't", "not good at" = fixed. "I don't know", "skip" = avoidant.
**Values:** `growth_mindset` | `fixed_mindset` | `avoidant` | `neutral`

#### 5. Cognitive Load
**Measures:** How hard is the material for this student right now?
**Calculation:** Inferred from test score. <40% = high intrinsic load. 40-89% = moderate. ≥90% = low (mastered).
**Values:** `high_intrinsic` | `moderate_load` | `low_germane`

#### 6. SRL Phase (Self-Regulated Learning)
**Measures:** Where is the student in the self-regulated learning cycle?
**Calculation:** Answer pattern analysis. Short/tentative = forethought. Steady/moderate = performance. Long/detailed = reflection. Started strong, shortened = fatigue.
**Values:** `forethought` | `performance` | `reflection` | `performance_with_fatigue`

#### 7. Fluency / Retention
**Measures:** How stable is the student's knowledge recall?
**Calculation:** Compares first vs. last answer score. Improving = retrieval practice working. Declining = fatigue or weak consolidation.
**Values:** `fluent` | `developing` | `fragmented` | `improving` | `declining`

### Theoretical Foundations
- **Self-Determination Theory (Deci & Ryan):** Autonomy, competence, relatedness
- **Dunning-Kruger Effect:** Calibration dimension
- **Growth Mindset (Carol Dweck):** Attribution dimension
- **Cognitive Load Theory (Sweller):** Cognitive load dimension
- **Self-Regulated Learning (Zimmerman):** SRL phase dimension
- **Academic Engagement (Fredericks et al.):** Behavioral + emotional + cognitive engagement

---

## 4. Educational Health

### How Educational Health Is Calculated

Educational health is derived from **test scores** and tracked in `StudentHealthSummary`:

| Metric | Calculation | Storage |
|---|---|---|
| `avgScoreThisWeek` | Running average of all test scores this week (daily + weekly + practice) | Updated on every test completion via `trackTestCompletion()` |
| `avgScoreLastWeek` | Previous week's average (rolled over on Monday) | Lazy weekly rollover in `engagement-tracker.ts` |
| `avgScoreOverall` | Cumulative average across all tests | Updated on every test completion |
| `testsThisWeek` / `testsLastWeek` | Count of tests completed | Incremented on completion, rolled over weekly |

### Weekly Rollover (Lazy — No Cron Needed)
The weekly rollover happens **lazily** — checked on the next interaction after Monday:
1. If `weekRolloverAt` is from a previous week → move this week's counts to last week
2. Reset this week's counters to 0
3. Update `weekRolloverAt` to now

### Educational Alert Triggers
- **Red alert:** `avgScoreThisWeek < 40%` — student is struggling badly
- **Amber alert:** Score dropped > 15 points week-over-week — student may be struggling with new concepts

---

## 5. Mentorship System

### Framework: GROW Coaching Model (Whitmore)

The mentorship system is built on the **GROW model**, the most widely used coaching framework in professional development:

| Phase | Question | Touchpoint Type | Purpose |
|---|---|---|---|
| **G**oal | What does the student want to achieve? | `goal_setting` | Define specific, measurable goals |
| **R**eality | Where is the student now? | `reality_check` | Honest assessment of current state |
| **O**ptions | What could the student do? | `options_explore` | Brainstorm approaches without judging |
| **W**ill | What WILL the student do? | `will_commit` | Concrete next step + timeline |

Plus additional touchpoint types:
- `checkin` — Routine wellbeing + progress check
- `alert_response` — Responding to a psych/educational/mentorship alert
- `praise_note` — Acknowledge effort (praise effort, not ability — per Dweck)
- `escalation` — Escalate to counselor, principal, or external support

### How Mentorship Works in the App

1. **Alerts drive the conversation:** When a student triggers an alert (psych/educational/mentorship), the teacher sees it in the Mentorship tab with the specific reason + recommended action.

2. **Teacher logs a coaching touchpoint:** Using the GROW framework, the teacher logs what was discussed, the outcome (resolved/ongoing/escalated/follow-up), and an optional follow-up date.

3. **Alerts get resolved:** When the teacher takes action (logs a touchpoint or clicks "Resolve"), the alert is marked resolved and the flag on `StudentHealthSummary` is cleared.

4. **Touchpoint history:** All touchpoints are visible in chronological order, showing the coaching journey over time.

### Theoretical Foundation
- **GROW Model (Sir John Whitmore):** Structured coaching conversation
- **Self-Determination Theory (Deci & Ryan):** Support autonomy, competence, relatedness
- **Coaching psychology:** Non-directive, student-led, growth-oriented
- **Effort-based praise (Dweck):** Praise "you worked hard" not "you're smart"
- **Online mentoring best practices:** Regular touchpoints, structured outcomes, follow-up scheduling

---

## 6. Teacher Health Monitoring

### How Teacher Behavior Is Tracked

Teachers have their own AI Assistant (`/api/ai/teacher-tutor`). When a teacher uses it:
- `trackTutorEngagement()` is called (same as for students)
- A `StudentHealthSummary` row is created for the teacher (reusing the same model)
- Behavioral signals (engagement, language, topic) are tracked

### Admin "Teacher Behavior" Tab
Admins and principals can see:
- Per-teacher AI Assistant usage (session count, last active, avg session length)
- Recent sessions with expandable conversation previews
- Psych analysis badge on sessions where psych signals were detected

This is visible in the admin dashboard's "Teacher Behavior" tab — accessible to principal + administrator only (pastoral data, not technical).

### Why This Matters
- Teachers who aren't using the AI Assistant may need training
- Teachers who show frustration signals in their AI conversations may be stressed
- Principals can identify teachers who need support, not just students

---

## 7. Alert System

### Three Alert Types

#### Psychological Alerts
**Triggered when:**
- `moodScore < 30` → **Red**: "Student mood score is very low. Multiple frustration or avoidance signals detected. Consider a wellbeing check-in."
- `moodScore < 45 AND frustrationCount > 3` → **Amber**: "Student mood is below average with multiple frustration signals this week."
- `avoidanceCount > 5` → **Amber**: "Student showed multiple avoidance responses. May indicate anxiety or lack of confidence."

**Source:** Per-message heuristic analysis (psych-analyzer.ts) — frustration/avoidance word detection

#### Educational Alerts
**Triggered when:**
- `avgScoreThisWeek < 40%` → **Red**: "Average test score this week is below 40%. The student is struggling with the material."
- Score drop > 15 points week-over-week → **Amber**: "Test score dropped significantly. The student may be struggling with new concepts."

**Source:** Test completion tracking (trackTestCompletion in engagement-tracker.ts) — score averages from daily/weekly/practice tests

#### Mentorship Alerts
**Triggered when:**
- `engagementStreak === 0` → **Amber**: "Student's engagement streak is broken — they haven't been active recently."
- Inactive 3+ days → **Amber/Red**: "Student hasn't been active for N days. Consider reaching out."
- `engagementScore < 30` → **Amber**: "Engagement score is very low. The student may be losing interest."

**Source:** Engagement tracking (trackTutorEngagement in engagement-tracker.ts) — streak + activity tracking

### Alert Lifecycle
1. **Created:** When `checkAlertThresholds()` detects a threshold crossing (on every tutor message or test completion)
2. **Open:** Visible to teachers in the Mentorship tab + dashboard
3. **Resolved:** Teacher clicks "Resolve" or logs a coaching touchpoint → alert status = "resolved", flag cleared on summary
4. **Deduplication:** Only one open alert per type per student — new alerts of the same type don't duplicate

### Data Model
```
StudentAlert {
  id, userId, type (psychological|educational|mentorship),
  severity (amber|red), reason (plain English),
  metric, metricValue, status (open|acknowledged|resolved),
  createdAt, resolvedAt, resolvedBy, resolutionNote
}
```

---

## 8. How Teachers Check Student Health

### Three Views

#### 1. Batch Dashboard (Today view)
- Shows all students with attention flags (from `/api/stats`)
- Students sorted by attention score (highest need first)
- Quick-glance: who needs help today?

#### 2. Student Portfolio (Psychological tab)
- Shows the 7 dimensions with trajectory badges
- Each dimension expands to show:
  - "What this measures:" — plain-English description
  - "What '[value]' means:" — specific meaning + recommended teacher ACTION
  - Evidence rows from test completions (with source + date)
- Wellbeing tier (green/amber/red) from `WellbeingState`
- Crisis flags (if any)

#### 3. Student Portfolio (Mentorship tab) — GROW Coaching
- **Active alerts** at the top (psych/educational/mentorship) with resolve actions
- **Health summary card**: moodScore, engagementScore, avgScore, streak — color-coded
- **Signal badges**: frustration/avoidance/enthusiasm counts for the week
- **Week-over-week trend**: score improvement or decline
- **GROW coaching touchpoint logger**: structured coaching conversations
- **Touchpoint history**: chronological log with outcomes + follow-ups
- **Quick actions**: message student, log praise

### What the Teacher Sees (Example)
```
[AMBER ALERT] Psychological
"Student mood score is 35/100. Frustration signals detected."
→ [Resolve] [Message student] [Log coaching touchpoint]

[HEALTH SUMMARY]
Mood: 35/100 (red)   Engagement: 42/100 (amber)
Avg Score: 55% (amber)   Streak: 2 days (amber)
3 frustration signals · 2 avoidance signals · 1 enthusiasm signal
Score dropped from 68% to 55% this week

[COACHING TOUCHPOINTS]
Goal Setting — "Discussed completing homepage by Friday"
Outcome: Ongoing — Follow-up: Jul 25
Reality Check — "Student feels overwhelmed by CSS"
Outcome: Scheduled follow-up
```

---

## 9. Data Flow Diagram

```
Student sends AI Tutor message
         │
         ▼
┌─────────────────────────┐
│ psych-analyzer.ts       │  (<1ms, pure heuristic, NO AI call)
│ - detect frustration    │
│ - detect avoidance      │
│ - detect enthusiasm     │
│ - compute moodScore     │
│ - compute engagementScore│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ engagement-tracker.ts   │  (1 upsert — NOT 15-20 writes)
│ - update StudentHealthSummary
│   - moodScore (70/30 weighted avg)
│   - engagementScore (70/30 weighted avg)
│   - frustrationCount++
│   - avoidanceCount++
│   - enthusiasmCount++
│   - tutorMessagesThisWeek++
│   - engagementStreak update
│   - weekly rollover (lazy)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ checkAlertThresholds()  │
│ - moodScore < 30? → RED psych alert
│ - avgScore < 40%? → RED educational alert
│ - streak = 0? → AMBER mentorship alert
│ - etc.
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ StudentAlert (new row)  │  (only if no open alert of same type)
│ + alert flags on Summary│
└─────────────────────────┘
            │
            ▼
Teacher sees alert in Mentorship tab
→ Resolves alert OR logs GROW coaching touchpoint
→ Alert cleared, touchpoint recorded
```

### Test Completion Flow (separate, heavier)
```
Student completes test (daily/weekly/practice)
         │
         ▼
┌─────────────────────────┐
│ analysis-pipeline.ts    │  (full pipeline, 7 dimensions)
│ - writes PsychEvidence  │  (7 rows per test)
│ - writes ConfidenceRating│
│ - upserts SkillMastery  │
│ - upserts WellbeingState│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ trackTestCompletion()   │  (1 upsert to StudentHealthSummary)
│ - testsThisWeek++       │
│ - avgScoreThisWeek update│
│ - avgScoreOverall update│
│ - engagementStreak update│
│ - wellbeingTier sync    │
└───────────┬─────────────┘
            │
            ▼
checkAlertThresholds() → educational alerts if score < 40% or dropped > 15
```

---

## 10. Database Schema — Health & Mentorship Tables

### StudentHealthSummary (1 row per student)
```prisma
model StudentHealthSummary {
  userId                String  @unique
  // Engagement counters
  tutorMessagesThisWeek  Int
  tutorMessagesLastWeek  Int
  tutorMessagesTotal     Int
  testsThisWeek          Int
  testsLastWeek          Int
  // Score tracking
  avgScoreThisWeek       Float?
  avgScoreLastWeek       Float?
  avgScoreOverall        Float?
  // Engagement streak
  engagementStreak       Int
  lastActiveDate         DateTime?
  // Tutor metadata
  lastTutorActiveAt      DateTime?
  lastTutorLanguage      String?
  lastTutorTopic         String?
  // Wellbeing
  wellbeingTier          String  // green | amber | red
  // Psych scores (from per-message heuristic analysis)
  moodScore              Int     // 0-100
  engagementScore        Int     // 0-100
  frustrationCount       Int     // this week
  avoidanceCount         Int     // this week
  enthusiasmCount        Int     // this week
  // Alert flags
  needsPsychAlert        Boolean
  needsEducationalAlert  Boolean
  needsMentorshipAlert   Boolean
  alertReasonsJson       String  // JSON array of reasons
  // Weekly rollover
  weekRolloverAt         DateTime?
}
```

### StudentAlert (multiple rows per student)
```prisma
model StudentAlert {
  userId          String
  type            String  // psychological | educational | mentorship
  severity        String  // amber | red
  reason          String  // plain-English explanation
  metric          String  // what triggered it
  metricValue     String  // the value
  status          String  // open | acknowledged | resolved
  resolvedAt      DateTime?
  resolvedBy      String? // teacher who resolved
  resolutionNote  String? // what the teacher did
}
```

### PsychEvidence (from test completions only)
```prisma
model PsychEvidence {
  userId        String
  dimension     String  // calibration|explanatory_depth|gaming_pattern|attribution|cognitive_load|srl_phase|fluency
  value         String  // dimension-specific value
  evidenceText  String  // factual observation
  sourceType    String  // weekly_test | daily_test | practice
  sourceId      String? // test ID
  week          Int?
}
```

### MentorshipTouchpoint (coaching log)
```prisma
model MentorshipTouchpoint {
  userId       String  // student
  actorUserId  String  // teacher
  type         String  // goal_setting|reality_check|options_explore|will_commit|checkin|alert_response|praise_note|escalation
  note         String  // what happened
  outcome      String? // resolved|ongoing|escalated|scheduled_followup
  followUpDate DateTime?
}
```

### WellbeingState (1 row per student)
```prisma
model WellbeingState {
  userId      String  @unique
  tier        String  // green | amber | red
  reasonsJson String  // JSON array of concern strings
}
```

---

## Summary

ExaminerAI's psychological + educational + mentorship system is built on established research:
- **Dweck's mindset theory** → Attribution dimension + effort-based praise
- **Dunning-Kruger effect** → Calibration dimension
- **Sweller's cognitive load theory** → Cognitive load dimension
- **Zimmerman's SRL model** → SRL phase dimension
- **Whitmore's GROW model** → Coaching touchpoint framework
- **Deci & Ryan's SDT** → Autonomy-supportive coaching + engagement tracking
- **Fredericks' engagement model** → Behavioral + emotional + cognitive engagement

The system is designed to **scale to 1000+ students** without flooding the database:
- Per-message analysis: 1 upsert (not 15-20 writes)
- Full psych pipeline: only on test completions (meaningful assessment events)
- Weekly rollover: lazy (no cron needed)
- Alerts: deduplicated (1 open alert per type per student)

Teachers get **actionable, data-driven insights** — not raw data to interpret. Every alert has a plain-English reason + recommended action. Every dimension value has an explanation + what the teacher should do about it.

---

## 11. AI Tutor System

### Student AI Tutor (`/api/ai/tutor`)
A friendly, polite, engaging AI Teacher (NOT a peer or buddy) that:
- Teaches the current week's topic using the 3-step method (analogy → example → project mapping)
- Connects every concept to the student's specific project
- Suggests reputable study + coding links (MDN, W3Schools, official docs)
- Replies in Roman English if the student writes in any non-English language
- Handles disengaged students with empathy + professional skills (5-minute rule, rubber duck debugging, etc.)
- NEVER grades — purely teaches
- Keeps responses SHORT (2-8 sentences) — no essays, engages first
- NO Coherence Check section in responses
- NO emojis, NO markdown formatting (except links), NO bullet points

### Teacher AI Assistant (`/api/ai/teacher-tutor`)
Same chat pattern as student AI Tutor, but for staff:
- System prompt tuned for teaching assistance (lesson prep, case review, rubrics, parent communications)
- Staff-only access (isStaffRole gate)
- Behavioral signals logged to StudentHealthSummary (same as students)
- Visible to admins/principals in the "Teacher Behavior" tab

### Token Cache (`src/modules/assessment/lib/token-cache.ts`)
Opt-in response cache for AI calls:
- LRU cache with TTL (default 1 hour, max 500 entries)
- sha256 key hashing (messages + temperature + maxTokens)
- Hit/miss/eviction stats + estimated tokens saved
- NOT used for per-student conversations or grading (each is unique)
- Active on: daily-motivation (6h TTL), project-summary (24h TTL)
- Admin can view stats + clear cache via SystemPanel > Maintenance tab

### Markdown Renderer (`src/components/examiner/MarkdownRenderer.tsx`)
Safe (no dangerouslySetInnerHTML) markdown-to-React parser:
- Handles: headings, bold, italic, inline code, links, tables, ordered/unordered lists, code blocks, blockquotes, horizontal rules
- Links sanitized (only http(s) allowed, rel=noopener noreferrer)
- Used by AITutor + TeacherAITutor for assistant messages

---

## 12. Test System

### Unified Test Engine (`src/modules/assessment/lib/unified-test-engine.ts`)
All 3 test types share the same rules:
- **Practice**: 3 questions, 3 replies per question, test kind = "practice"
- **Daily Test**: 3 questions, 2 replies per question, test kind = "daily_test"
- **Weekly Test**: 15 questions, 5 replies per question, test kind = "weekly_test"

### Per-Question Explanations (`gradeOneQuestion()`)
After EVERY question (when the examiner advances), the AI grades that specific question:
- correctAnswer: what the right answer was (1-2 sentences)
- explanation: why the correct answer is correct (2-3 sentences, teaches the concept)
- encouragement: one-sentence specific encouragement for that question
- Rendered as a teaching card inline in the chat — student sees it immediately, not at end-of-test

### Unified Grader (`src/modules/assessment/lib/unified-grader.ts`)
All test types use the same grading contract:
- score: 0-100
- modelAnswer: what a strong response would have looked like
- missedPoints: 2-4 specific, actionable gaps
- nextTime: one-sentence coaching tip
- questionExplanations: per-question breakdown (for daily/weekly tests)

### Plagiarism Scoring (`src/modules/assessment/lib/plagiarism-scoring.ts`)
Voice consistency analysis:
- Weekly tests: full AI analysis (score 0-100)
- Daily tests: simpler estimate from answer length variance + vocabulary consistency
- Score > 50 = voice inconsistency → gaming_pattern alert
- Deduction applied to final score

---

## 13. Admin System

### Admin Dashboard Tabs
1. **Overview** — enrollment funnel, metrics, quick actions
2. **Principal** — institutional health (principal + administrator only)
3. **Teacher Behavior** — teacher AI Assistant usage + psych signals (principal + administrator only)
4. **Coordinator** — curriculum management
5. **Operations** — operational tasks
6. **Users** — approve, block, delete, role change, batch approve
7. **Courses** — CRUD, batch assignment
8. **Features** — feature flags
9. **Passwords** — password reset requests
10. **System** — AI stats, health check, audit log, access grants, nav config, maintenance (cache + cleanup)

### Maintenance Tab
- **AI Token Cache**: view stats (entries, hit rate, tokens saved) + clear button
- **Psych Data Cleanup**: preview junk data (dry run) + run cleanup (deletes old ChatSession tutor snapshots, Interaction tutor logs, PsychEvidence tutor artifacts, PsychologyObs old duplicates)

### Audit Log
All admin actions tracked: role changes, user approvals, user blocks, access grants, user deletions. Visible in System > Audit Log sub-tab.

---

## 14. Communication System

### Messages
- Student-teacher messaging with unread badge on nav
- "Ask My Teacher" floating button for quick questions
- Teacher can compose messages from the batch dashboard or mentorship tab
- Messages support read/unread tracking

### Comments
- Teachers can comment on: check-ins, practice answers, tasks, weekly tests, report cards
- Grade overrides on practice + weekly tests
- Comments visible in the student portfolio

### Notifications
- Unread message badge on Messages nav item (polls every 30s)
- Alert count badge on batch dashboard nav item (polls every 60s, staff only)
- Daily task reminder popup (auto-opens every 3 min for students with pending tasks)

---

## 15. Guardian System

### GuardianLink Model
- Links a guardian user to a student user (1:1 or 1:many)
- Guardian's `/api/stats` resolves the linked student's data server-side
- `/api/auth/me` returns `linkedStudentId` for guardians

### Read-Only Mode
When a guardian logs in:
- Sees a blue "Read-only mode" banner at the top
- Action panels hidden (Journey, Check-in, Practice, Weekly Test, Settings)
- Read-only Overview shown instead of action panels
- Report Card view available (read-only)
- Ask My Teacher FAB not shown (guardians don't have a teacher)
- Daily Task Reminder not shown

---

## 16. Course System

### Course Model
- Domain-agnostic (CS, mechanical, HR, business, etc.)
- Per-course: tools, deliverables, assessment types, AI prompts, test config, journey steps, project template
- Admin can create courses via Course Planner or AI generation
- Batches assigned to courses — all app features adapt to the course's domain

### AI Course Generation
- Admin provides: domain, level, duration, assessment type
- AI generates: full course outline (weeks + days + objectives + activities + deliverables)
- Stored in Course + CourseWeek + CourseDay models

### Course Outline (Student View)
- Shows the full curriculum with daily topics, objectives, resources
- "Mark complete" toggle for daily topics
- Learning progress chart (curriculum completion per week)

---

## 17. Project System

### Project Planning
- Student defines: project name, description, type, scope, objectives, requirements, business case
- AI generates: project summary + key features
- Student chooses: duration (3-20 weeks), start date
- AI generates: tasks (one per weekday) + week plan (titles + summaries + milestones)

### Project Management
- Gantt chart with horizontal task bars spanning multiple weeks
- Task CRUD: add, edit, delete, status change, milestone flag, day assignment, time estimate, due date, notes
- Week plan: custom titles + summaries + milestones per week
- Project reports: student submits weekly or final reports, AI analyzes (project understanding, technical depth, progress, clarity + strengths, weaknesses, feedback)

### Final Project Analysis (Teacher-triggered)
- Comprehensive evaluation: project execution, technical competence, project quality, career readiness
- AI generates: summary, strengths, weaknesses, recommendations
- Shown in the student portfolio's Educational tab

---

## 18. Multi-Teacher Batches with Rolling Intake

### Overview
The platform supports multi-teacher batches — a teacher can be attached to multiple batches, and a batch can have multiple teachers. This enables rolling admission: new intakes create new batches (reusing the same Course), not per-student date fields.

### Data Model
- **Students**: remain one-batch-each via `User.batchId` (unchanged)
- **Teachers**: get multi-batch access via the `BatchTeacher` junction table
- `User.batchId` for teachers is legacy (kept for backward compat, not used for scoping)
- `BatchTeacher` is the source of truth for teacher-batch memberships

### BatchTeacher Model
```prisma
model BatchTeacher {
  id        String   @id @default(cuid())
  batchId   String
  teacherId String
  batch     Batch    @relation(...)
  teacher   User     @relation(...)
  @@unique([batchId, teacherId])  // no duplicates
  @@index([teacherId])            // reverse lookup
}
```

### Batch Model (enhanced)
- `deliveryMode`: "online" | "physical" | "hybrid" (default "online")
- `teachers`: relation to BatchTeacher[]

### Helper Functions (`src/lib/batch-teachers.ts`)
- `getTeacherBatchIds(userId, role)`: returns batch IDs from BatchTeacher
  - null for admins (unrestricted access)
  - [] for teachers with no batch memberships (sees nothing)
  - [batchId1, batchId2, ...] for teachers with memberships
- `canAccessBatch(userId, role, batchId)`: boolean check
- `getBatchFilter(userId, role)`: Prisma where clause for student filtering

### Routes Updated for Multi-Teacher Scoping
All routes that previously gated on `teacher.batchId` now use BatchTeacher:
- `/api/stats` — teachers see only students in their BatchTeacher batches
- `/api/users/[id]/approve` — teachers can approve students in their batches
- `/api/users/batch-approve` — same
- `/api/batches/[id] PATCH` — teachers can modify batches they belong to
- `/api/password-reset-requests` — scoped by BatchTeacher
- `/api/students/[id]/portfolio` — IDOR check via BatchTeacher
- `/api/group-tasks` — permission check via canAccessBatch
- `/api/teacher/load` — student scoping via getBatchFilter
- `/api/batches/question-outliers` — scoped by BatchTeacher
- `/api/mentorship/touchpoints/parse` — scoped by BatchTeacher
- `/api/messages/teacher` — finds teachers via BatchTeacher (not batchId)
- `/api/students/check-alerts` — finds teachers via batchTeaching relation

### New Routes
- `POST /api/batches/[id]/teachers` — add a teacher to a batch
  - Allowed for ADMIN_ROLES or existing batch teachers (co-teachers can add co-teachers)
- `DELETE /api/batches/[id]/teachers/[teacherId]` — remove a teacher
- `GET /api/batches/[id]/teachers` — list teachers on a batch
- `POST /api/batches/[id]/duplicate` — create a new batch from an existing one
  - Copies: courseId, deliveryMode, all BatchTeacher rows
  - Does NOT copy: students, test/progress history, tasks, events
  - Body: { name, startDate }
  - This is the primary tool for starting a new rolling-admission intake

### Migration (20260724000000_multi_teacher_batches)
- ALTER TABLE "Batch" ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'online'
- CREATE TABLE "BatchTeacher" (with FK constraints + unique index)
- Data backfill: for every existing staff user with non-null batchId,
  insert a BatchTeacher row (preserves existing access — nobody loses access)

### Rolling Intake Workflow
1. Admin creates a Batch (or duplicates an existing one via `/api/batches/[id]/duplicate`)
2. Admin (or existing batch teacher) adds teachers via `POST /api/batches/[id]/teachers`
3. Students are assigned to the batch via `User.batchId` (one-batch-each)
4. Teachers see students from ALL their BatchTeacher batches via `/api/stats`
5. To start a new intake: duplicate the batch → new name + start date → same course + teachers
