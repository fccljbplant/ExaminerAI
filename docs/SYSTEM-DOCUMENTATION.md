# ExaminerAI — System Documentation

## What This Product Is

ExaminerAI is an **AI-powered bootcamp and short-course management platform** for
software training programmes (typically 8–24 weeks, up to 6 months). Students learn
by building a real capstone project — the AI teaches today's topic, connects it to the
student's project, generates week-by-week tasks with milestones, tracks progress on a
Gantt chart, and analyzes weekly project reports. Teachers triage and mentor; they
don't deliver content. The platform scales one teacher to 50–500+ students.

**See `docs/POSITIONING.md` for the full product positioning, audience, learning loop,
and differentiation vs. university LMS and AI course-builder tools.**

Three convictions define the product:

1. **Software skills are learned by building, not by watching.** Every student
   defines a capstone project on day one. The AI generates a custom week-by-week
   task plan, daily milestones, and progress reports tied to that specific project.
2. **AI is the primary teacher — human staff mentor.** The AI Tutor teaches today's
   topic in the student's own language, connects every concept to their capstone,
   and handles disengagement with empathy. Teachers triage, coach, and unblock.
3. **Institutions need signal, not noise.** Six role-specific dashboards, automated
   alerts, and a natural-language AI Assistant surface the right signal to each role
   in real time — without flooding the database or overwhelming the teacher.

## Architecture Overview

ExaminerAI is a Next.js 16 platform with role-based dashboards for 6 distinct roles.
Each role has its OWN dashboard component, API endpoints, and navigation — no shared
dashboard views between roles (except shared sidebar items: AI Assistant, Course,
Messages, Settings).

## Role Architecture

| Role | Dashboard Component | Nav Items | API Endpoint |
|------|-------------------|-----------|--------------|
| Student | StudentDashboard | Home/Study/Project/Progress | /api/stats |
| Teacher | TeacherDashboard | Today/Students/Mentorship/Assignments/Insights | /api/stats?as=teacher |
| Counselor | CounselorDashboard | Command Center | /api/counselor/overview |
| Guardian | GuardianDashboard | Overview/Report Cards | /api/guardian/overview |
| Principal | PrincipalDashboard | Institution | /api/principal/overview |
| Admin | AdminDashboard | Dashboard/Users/Courses/Features/Passwords/System | /api/stats (system) |
| Demo | (defaults to Teacher) | Same as Teacher + View As Role switcher | All APIs (read-only) |

## AI Module Separation

### AI Tutor (Student-facing)
- Module: `src/modules/ai-tutor/`
- Component: `AITutor` (chat interface)
- API: `POST /api/ai/tutor`
- Access: students + guardians only
- Purpose: teaches today's topic, connects to capstone project, handles disengagement

### AI Assistant (Staff-facing)
- Module: `src/modules/ai-assistant/`
- Components: `TeacherAITutor`, `AIAssistantBox`, `ActionDialog`
- APIs: `/api/teacher/assistant`, `/api/assistant/action-dialog`, `/api/assistant/escalation/run`
- Access: staff roles only (teacher, counselor, principal, admin, demo)
- Purpose: batch analysis, message drafting, case review, institution analytics

## AI Assistant Implementation (Sections 1-7)

> **Deep dive:** The full psychological analysis cycle (from student
> interaction → 7-dimension evidence → wellbeing tier → escalation →
> action dialog) is documented in `docs/PSYCHOLOGICAL-CYCLE.md`. The
> mentorship and mental-health response pathways (GROW coaching,
> crisis response, teacher load management, safeguarding) are
> documented in `docs/MENTORSHIP-CYCLE.md`. Per-dimension reference
> is in `docs/SEVEN-DIMENSIONS.md`.

### Section 1: Scope Resolver (`src/lib/ai-assistant/scope.ts`)
The security foundation. `resolveAssistantScope(callerId, callerRole)` returns the
exact set of entity IDs the caller can access. Called BEFORE any AI query — the AI
never receives data outside the caller's scope.

**Per role:**
- Teacher/TA: students in BatchTeacher batches only
- Counselor: all students + teachers in institution (behavior/wellbeing, NOT curriculum)
- Course Coordinator: courses/batches in institution (NOT individual behavioral data)
- Principal/Admin/Demo: entire institution

### Section 2: Data Efficiency (`src/lib/ai-assistant/data-efficiency.ts`)
- **AICache**: per-entity summaries cached for 7 days. Current-week data fetched fresh.
- **Aggregate-first**: institution-wide queries return counts/averages/distributions,
  never raw student records. Max 50 raw records per AI call.
- **Soft query budget**: per-role daily limits (teacher=50, counselor=80, principal=200).
  Flags high usage, does NOT hard-block.

### Section 3: Escalation Engine (`src/lib/ai-assistant/escalation.ts`)
One rule, two triggers, three tiers (green/amber/red):

**Trigger 1 (duration):** amber flag unresolved for 7+ days → escalate to red
**Trigger 2 (repeat):**
- 3rd+ recurrence of same issue type → immediate escalation
- 2nd recurrence → shortened 2-day timer (vs 7 days for first-time)

Runs as scheduled job (`POST /api/assistant/escalation/run`) + on-write check
(`checkOnWriteEscalation`) for immediate repeat-occurrence escalation.

### Section 4: Action Dialog (`src/components/shared/action-dialog.tsx`)
ONE reusable dialog for every flag type. Content generated by AI:
- Headline (plain language + color)
- "Why" (specific trigger data)
- Suggested action (editable)
- Required note (3 AI-drafted one-tap presets + free-text)
- Guidance (collapsed, one click to expand)
- Confirm button DISABLED until note provided
- Cancel always available, no penalty

### Section 5: Safeguarding (`src/lib/ai-assistant/safeguarding.ts`)
THE ONE EXCEPTION to "insight stays with caller":
- Teacher is NOT notified when a safeguarding flag is raised about them
- Scope: teacher-to-student communication only
- Deterministic pre-filter first (regex patterns), AI explains candidates
- Requires 2+ corroborating signals (never a single message)
- Flags go to PRINCIPAL scope only
- Dismissed flags are marked dismissed, NOT deleted
- Message references stored (NOT message text copies)

### Section 6: Teacher Load (`src/lib/ai-assistant/teacher-load.ts`)
Extends existing `/api/teacher/load` route:
- Batch-count as distinct load factor (15 points/batch, separate from student count)
- Institution-wide roster for principals (sortable by tier + trend)
- Co-teacher suggestion (NEVER suggests amber/red candidate)
- Wellbeing touchpoint (reuses GROW system)
- Fully transparent (teacher sees own tier same time as principal)

**Load score calculation:**
```
loadScore = studentCount × 1 + batchCount × 15 + openAlerts × 5 + crisisFlags × 25 + overdueTouchpoints × 3
```
- Green: score < 50
- Amber: 50 ≤ score < 100
- Red: score ≥ 100

### Section 7: In-Action Teaching (`src/lib/ai-assistant/teaching-guidance.ts`)
Per-flag-type guidance templates:
- psychological: "Ask don't tell", "Validate before solving"
- educational: "Focus on process not outcome", "GROW-stage framing"
- mentorship: "Ask don't tell", "Reality before Goal"
- teacher_load: "Frame as support not criticism", "Offer concrete help"
- safeguarding: "Review evidence references", "Consider patterns"
- crisis: "Act now document after", "Follow crisis protocol"

## Theme System

4 preset themes (switchable via sidebar palette icon):
- Modern Slate (default): slate-900 primary, amber accents
- Ocean Blue: Google-blue primary, teal accents
- Forest Sage: sage green primary, earth tones
- Sunset Rose: rose primary, amber accents

Light mode is default. Dark mode uses deep charcoal (#0a0a0f) with amber (#fbbf24) primary.

## Demo Account

- Login: `demo@examiner.ai` / `demo123`
- Role: `demo` (read-only)
- Defaults to Teacher interface
- Can switch to any role via "View As Role" sidebar switcher
- All write actions blocked by `demoWriteBlock()` (server) + client-side toast
- Auth routes (login/logout/me/password-reset) are exempt from demo block

## Database

- Local dev: SQLite (`prisma/schema.prisma`)
- Production: PostgreSQL via Neon (`prisma/schema.prod.prisma`)
- 44+ models including: User, Course, Batch, BatchTeacher, WeeklyTest, DailyLog,
  Interaction, Competency, SkillMastery, ReportCard, PsychologyObs, PsychEvidence,
  WellbeingState, CrisisFlag, StudentAlert, MentorshipTouchpoint, ConfidenceRating,
  StudentHealthSummary, CaseReview, AuditLog, GrowthReport, Certificate, etc.

## Project-Based Learning (the differentiator)

Every student defines a capstone project on day one. The AI generates a custom
week-by-week task plan tied to that specific project. Project tracking is mandatory
(not optional like in a typical LMS).

### Project lifecycle

1. **Project definition** (week 1) — student sets: name, type (web app / mobile /
   data pipeline / research paper), scope, objectives, requirements, business case.
   The AI generates a project summary + key features.
2. **AI task generation** — `POST /api/project/generate-tasks` reads the project
   definition and produces N weeks × 5 tasks/week, each with:
   - `description`, `week`, `day` (1-5 Mon-Fri), `estimatedMinutes`, `isMilestone`
   - Also generates `ProjectWeek` rows: title, summary, milestones (JSON array)
   - Token budget: 2000 (tasks) + 1500 (week summaries)
   - Timeout scales: `max(60s, weeks × 8s)`
   - Fallback: 6-phase generic project tasks if AI fails
3. **Daily task updates** — students move tasks through: `planned → in-progress → completed | blocked`. Updates feed the attention-score algorithm.
4. **Gantt chart** — visual timeline of all tasks across all weeks. Milestone tasks
   are highlighted. The chart is the student's primary project view.
5. **Weekly project reports** — `POST /api/project/reports` accepts a free-text
   report. The AI analyzes it on 4 dimensions: `projectUnderstanding`,
   `technicalDepth`, `progress`, `clarity`. Returns: score (0-100), strengths[],
   weaknesses[], feedback. Token budget: 600.
6. **Final capstone analysis** — `POST /api/students/[id]/generate-project-analysis`
   (teacher-triggered at course end). Reads the project definition + all weekly
   reports + task completion stats. Evaluates 4 dimensions: `projectExecution`,
   `technicalCompetence`, `projectQuality`, `careerReadiness`. Returns: score,
   summary, strengths[], weaknesses[], recommendations[]. Token budget: 800.
7. **Auto-generated report cards** — final grade = 80% weekly test scores + 20%
   practice test scores. Certificates are publicly verifiable via shareable URL.

### Project data models

- `User.projectName`, `projectDescription`, `projectType`, `projectScope`,
  `projectObjectives`, `projectRequirements`, `projectBusinessCase`,
  `projectSummary` (AI-generated), `projectKeyFeatures` (AI-generated),
  `projectDurationWeeks`, `projectStartDate` (student-defined planning fields)
- `ProjectTask` — `description`, `status`, `week`, `day`, `isMilestone`,
  `estimatedMinutes`, `taskNotes`, `dueDate`
- `ProjectWeek` — `weekNumber`, `title`, `summary`, `milestones` (JSON)
- `ProjectReport` — `week`, `reportType` (weekly|final), `reportText`,
  `aiAnalysis` (JSON: score, strengths[], weaknesses[], feedback, 4 dimensions)
- `GroupTask` — for peer-assessment group assignments

## Key Calculations

### Attention Score (teacher dashboard)
Per student, computed server-side in `/api/stats`:
- Inactivity 3+ days: +30
- Inactivity 2+ days: +15
- Never checked in (with tasks): +20
- Latest test score < 60: +25
- Score drop 15+ points: +20
- Sustained low confidence (2+ of last 5 logs ≤2): +20
- Blocked tasks: +10 each
- Sustained high cognitive load (2+ of last 3 psychObs = "high"): +15

### Wellbeing Tier
- Green: moodScore ≥ 60, no alerts, no crisis flags
- Amber: moodScore 30-59, or 1+ open alert
- Red: moodScore < 30, or crisis flag, or escalated amber

### Teacher Load Score
See Section 6 above.

### Escalation Rules
See Section 3 above.

## Complete Feature Inventory

### Student Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| Sign up (pending) | ✅ | POST /api/auth/login (PUT) |
| Login | ✅ | POST /api/auth/login |
| AI Tutor (multi-language) | ✅ | POST /api/ai/tutor |
| Socratic Practice Test | ✅ | POST /api/ai/practice |
| Socratic Daily Test | ✅ | POST /api/daily-test |
| Socratic Weekly Test | ✅ | POST /api/ai/weekly-test |
| Per-question explanations | ✅ | In all test endpoints |
| Capstone project setup | ⚠️ UI dead code | POST /api/project/setup (JourneyWizard unreachable) |
| AI task generation | ✅ | POST /api/project/generate-tasks |
| Gantt chart + milestones | ✅ | GanttPanel component |
| Weekly project reports | ✅ | POST /api/project/reports |
| Final capstone analysis | ✅ | POST /api/students/[id]/generate-project-analysis |
| Daily check-in | ✅ | CheckInPanel component |
| Self-paced day advancement | ⚠️ No UI | POST /api/self-paced (no button calls it) |
| Comprehensive private report | ✅ | GET /api/students/[id]/comprehensive-report |
| Certificate generation | ⚠️ UI dead code | POST /api/certificates/generate (OverviewPanel unreachable) |
| Report cards | ✅ | ReportCardPanel component |
| Change password | ❌ UI dead code | SettingsPanel unreachable |
| Set security question | ❌ UI dead code | SettingsPanel unreachable |
| Theme switching | ✅ | ThemePresetProvider |
| Ask my teacher | ✅ | AskMyTeacher component |

### Teacher Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| Batch triage queue | ✅ | GET /api/stats?as=teacher |
| Student portfolio (10 tabs) | ✅ | StudentPortfolioPage component |
| 7-dimension psychology | ✅ | PsychologicalTab component |
| Educational tab (skill mastery) | ✅ | EducationalTab component |
| GROW mentorship | ❌ Backend rejects GROW types | MentorshipTabV2 (POST returns 400) |
| AI Assistant (natural language) | ✅ | POST /api/teacher/assistant |
| Draft check-in message | ✅ | POST /api/students/[id]/draft-checkin |
| Rehearse conversation | ✅ | POST /api/students/[id]/rehearse |
| Explain this student | ✅ | GET /api/students/[id]/explain |
| Living-book narrative | ✅ | GET /api/students/[id]/narrative |
| Comprehensive report | ✅ | GET /api/students/[id]/comprehensive-report |
| Grade override | ✅ | POST /api/grades/override |
| Allow retake | ✅ | POST /api/students/[id]/allow-retake |
| Unlock test | ✅ | POST /api/students/[id]/unlock-test |
| Generate report card | ✅ | POST /api/students/[id]/generate-report-card |
| Course planner | ✅ | CoursePlanner component |
| Batch students (search + filter) | ✅ | StudentsRoster component |
| Assignments (group tasks) | ✅ | AssignmentsTab component |
| Inline alert resolution | ❌ Not implemented | Must navigate into portfolio |
| Batch broadcast | ❌ Not implemented | |
| Plagiarism items in triage | ❌ Type exists, never populated | |

### Counselor Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| Command center dashboard | ✅ | CounselorDashboard component |
| Caseload view | ✅ | |
| Crisis flag management | ⚠️ No IDOR check | POST /api/crisis-flags |
| Mentorship touchpoints | ⚠️ No IDOR check | POST /api/mentorship/touchpoints |
| Case reviews | ✅ | CaseReviewPanel component |
| Pattern analysis | ✅ | |
| AccessGrant scoping | ❌ Ignored | /api/counselor/overview returns all |

### Guardian Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| Child progress overview | ✅ | GuardianDashboard component |
| Report cards | ✅ | |
| Wellbeing signal (sanitized) | ✅ | Tier only, no reasons |
| Internal notes hidden | ✅ | |

### Principal Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| Institution overview | ✅ | PrincipalDashboard component |
| Academic performance | ✅ | |
| Wellbeing distribution | ✅ | |
| Audit log | ✅ | AuditView (hidden from demo) |
| Safeguarding flags | ❌ Dead code | analyzeMessageForSafeguarding never called |
| Teacher load management | ❌ Dead code | teacher-load.ts uses non-existent field |
| Co-teacher suggestion | ❌ Never called | suggestCoTeacher function unused |

### Administrator Features
| Feature | Status | Endpoint / Component |
|---|---|---|
| User management (search + pagination) | ✅ | AdminDashboard component |
| Role assignment (full authority) | ✅ | PATCH /api/users/[id]/role |
| Course management | ✅ | AdminCoursesPanel component |
| Feature flags | ✅ | FeaturesPanel component |
| AI limits config | ✅ | AILimitsPanel component |
| Demo AI toggle | ✅ | AILimitsPanel component |
| System health | ✅ | SystemPanel component |
| Audit log | ✅ | AuditLogPanel component |
| User audit search | ✅ | UserAuditSearchPanel component |
| Access grants (read-only) | ⚠️ No create/revoke UI | AccessGrantsPanel component |
| Password resets | ✅ | PasswordResetPanel component |
| Cache management | ✅ | SystemPanel component |

### Demo Features
| Feature | Status |
|---|---|
| View all dashboards | ✅ Via role switcher |
| Read-only (writes blocked) | ✅ Server + client |
| AI access (toggleable) | ✅ Admin can enable/disable |
| Subject to rate limits | ✅ |
| Admin panel hidden | ✅ |
| Principal audit tab hidden | ✅ |
| See audit tab on portfolios | ❌ Missing "demo" in privileged roles |
| Bypass demo guard via raw fetch | ❌ 13 raw fetch() calls in StudentPortfolioPage |

## AI Logic Reference

### Provider Chain
```
1. DeepSeek V4 Flash (primary — cheap + fast)
   - Model: deepseek-v4-flash
   - Base URL: https://api.deepseek.com/v1
   - Reads both content + reasoning_content (fallback for reasoning models)
2. Z.ai GLM-4.6 (fallback — OpenAI-compatible)
   - Base URL: https://api.z.ai/api/paas/v4
3. z-ai-web-dev-sdk (sandbox — only works in Z.ai sandbox)
4. Empty fallback (caller handles)
```

### Rate Limiting (per-user, per-day, UTC)
| Category | Default | Features |
|---|---|---|
| test | 50/day | practice, daily-test, weekly-test, evaluate, question-gen |
| tutor | 150/day | ai-tutor |
| assistant | 100/day | teacher_assistant, action-dialog, student-explain, narrative-week, draft-checkin, rehearse, comprehensive-report |

Admin-configurable via /api/settings/ai-limits. Demo AI can be disabled entirely.

### Token Budgets
| Feature | Budget |
|---|---|
| Question generation | 300 |
| Evaluation | 500 |
| Weekly test reply | 500 |
| Final analysis | 4000 |
| Connection test | 10 |
| AI Tutor | 600 |
| AI Assistant | 800 |
| Comprehensive report | 2000 |
| Course generation | 8000 (scales with weeks) |

### Psychological Pipeline (7 dimensions, written every test)
1. **Calibration** — confidence vs actual score (Dunning-Kruger)
2. **Explanatory Depth** — average answer length (<50c surface, 50-300c moderate, >300c detailed)
3. **Gaming Pattern** — plagiarism score >50 = voice_inconsistency
4. **Attribution / Mindset** — growth/fixed/avoidant/neutral (keyword scan)
5. **Cognitive Load** — score <40 high_intrinsic, 40-89 moderate, ≥90 low_germane (Sweller)
6. **SRL Phase** — forethought/performance/reflection (Zimmerman, answer-length pattern)
7. **Fluency / Retention** — improving/stable/declining recall (score trend across answers)

### Wellbeing Tier Algorithm
```
14-day rolling window of PsychEvidence
ratio = concerning_signals / total_signals
  > 0.60 → RED
  > 0.35 → AMBER
  else   → GREEN
Any open CrisisFlag → RED (override)
```

### Escalation Engine
```
Trigger 1 (duration): amber + 7+ days unresolved → RED
Trigger 2 (repeat):
  3rd+ occurrence → immediate RED
  2nd occurrence → shortened 2-day timer → RED
```

### Attention Score (teacher triage)
```
Inactivity 3+ days: +30
Inactivity 2+ days: +15
Never checked in (with tasks): +20
Latest test < 60: +25
Score drop 15+ points: +20
Sustained low confidence (2+ of last 5 ≤2): +20
Blocked tasks: +10 each
Sustained high cognitive load (2+ of last 3 = "high"): +15
needsAttention = score ≥ 20
```

### Teacher Load Score (spec — actual implementation differs, see audit)
```
loadScore = students × 1 + batches × 15 + alerts × 5 + crisis × 25 + overdue × 3
Green: < 50
Amber: 50-99
Red: ≥ 100
```

### Anti-Cheat Detection
1. Tasks completed in <2 minutes (impossibly fast)
2. 3+ days ahead of calendar schedule
3. All week's tasks done by day 1 or 2 (unusual pace)
4. Plagiarism score >50 on recent weekly test
5. Voice inconsistency analysis (vocabulary jumps, AI-typical phrasing)

### Safeguarding (spec — currently dead code, see audit)
1. Deterministic regex pre-filter (5 categories)
2. AI explains candidates (cannot invent flags)
3. 2+ corroborating signals required (never single message)
4. Principal-only visibility
5. Dismissed, not deleted

## Process Flows

### Student Journey
```
Sign up (pending) → Teacher approves → Login
→ [DEAD END: JourneyWizard is dead code — can't create project]
→ Daily tasks (self-paced currentDay) → Practice/Daily/Weekly tests
→ 7-dimension psych evidence per test → Wellbeing tier computed
→ Mentorship touchpoints on tier transitions
→ Comprehensive report (Progress tab)
→ [DEAD END: Certificate UI is dead code]
```

### Teacher Flow
```
Login → Today view (triage queue, attention-scored)
→ Click student → Portfolio (10 tabs)
→ AI Tools (explain, narrative, draft check-in, rehearse)
→ GROW mentorship [BROKEN: backend rejects GROW types]
→ AI Assistant (natural language batch queries)
→ Alerts → Action dialog → Mentorship touchpoint
```

### Crisis Response
```
Crisis flag created (manual or AI-detected)
→ WellbeingState forced to RED
→ Auto-touchpoint created (type: alert_response)
→ [GAP: no notification to counselor/principal]
→ Counselor/principal reviews
→ Resolve or dismiss with required note
```

### Self-Paced Advancement
```
Student completes today's tasks
→ canAdvanceDay = true (if currentDay < 5 AND all today's tasks done)
→ [GAP: no UI button to call POST /api/self-paced]
→ If currentDay === 5: [BROKEN: can't advance to next week]
→ Weekly test unlocks when all week's tasks complete (already works)
→ Weekly test completion auto-advances currentWeek
```

### Comprehensive Report Generation
```
Gather data from 14 sources (psychEvidence, confidenceRatings, skillMastery, touchpoints, interactions, weeklyTests, projectTasks, projectReports, wellbeing, crisisFlags, alerts, healthSummary, certificates)
→ AI generates: accomplishments, areas to improve, management attitude, narrative
→ Cache per-student (invalidated on new evidence)
→ 7 sections: Educational, Psychological, Behavioral, Mentor, Accomplishments, Areas to Improve, Management Attitude
```

## Known Issues (from 2026-07-26 Deep Audit)

See `docs/COMPREHENSIVE-AUDIT-2026-07-26.md` for the full audit report with 50 prioritized issues.

### Critical (P0)
1. Students can't create capstone projects (JourneyWizard dead code)
2. GROW coaching backend rejects GROW touchpoint types
3. Safeguarding pipeline is dead code (never invoked)
4. Students can't generate certificates from UI (dead code)
5. Self-paced advancement has no UI
6. `/api/comments` GET lets students read other students' comments
7. 18 IDOR vulnerabilities (cross-batch data access)
8. `/api/students/alerts` leaks safeguarding flags to all staff

### High (P1)
9. 14 AI endpoints missing rate-limiting
10. Teacher-load module uses non-existent schema field
11. Certificate stores course name in courseId field
12. SkillMastery overwritten by single test
13. Wellbeing tier never decays
14. Self-paced day-5 → week advance broken
15. 13 raw fetch() calls bypass demo guard
16. WeeklyTestPanel admin check uses wrong string
17. Role checks use raw strings, not normalizeRole
18. Z.ai + z-ai-sdk skip rate limiter
19. RPD limit never enforced
20. waitForSlot stale timestamp bug
21. Crisis response doesn't notify counselor/principal
22. Escalation cron has no scheduler
23. Anti-cheat flags not persisted
24. Destructive actions missing confirmation dialogs
