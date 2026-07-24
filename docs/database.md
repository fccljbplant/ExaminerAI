# Database Schema

## Overview

Dual backend — same models, two engines:

| Environment | Provider | Schema file | DATABASE_URL |
|:---|:---|:---|:---|
| Local dev | SQLite | `prisma/schema.prisma` | `file:./db/custom.db` |
| Production | PostgreSQL | `prisma/schema.prod.prisma` | `postgresql://...` |

---

## Models (19 total)

### User
Central account + project definition.

| Field | Type | Notes |
|:---|:---|:---|
| id, email, name, passwordHash | | bcrypt 10 rounds |
| role | String | pending \| student \| teacher \| admin |
| currentWeek | Int | 1-6, auto-advances after weekly test |
| projectName, projectScope, projectObjectives, projectRequirements, projectBusinessCase | String? | Student-authored project definition |
| projectSummary | String? | AI-generated 2-3 sentence summary |
| projectKeyFeatures | String? | JSON array of key feature strings |
| projectDurationWeeks | Int? | 3-20 (default 6) |
| projectStartDate | DateTime? | When the student starts |
| projectNotes, projectGithubUrl, projectDeployUrl | String? | Project metadata |
| journeyProgress | String | JSON array of completed journey step IDs |
| securityQuestion, securityAnswer | String? | For self-service password reset |

### ProjectTask
Student's custom project tasks.

| Field | Type | Notes |
|:---|:---|:---|
| id, userId, description | | |
| week | Int | 1-52 |
| day | Int? | 1-5 (Mon-Fri), null = unscheduled |
| status | String | planned \| in-progress \| completed \| blocked |
| dueDate | String? | For Gantt multi-week bars |
| estimatedMinutes | Int? | Time estimate |
| isMilestone | Boolean | Highlighted in Gantt + week plan |
| taskNotes | String? | Student's notes |

### ProjectWeek
Custom week titles + summaries (AI-generated, editable).

| Field | Type | Notes |
|:---|:---|:---|
| id, userId | | |
| weekNumber | Int | 1-N |
| title | String | Custom week title (editable inline) |
| summary | String | AI-generated or student-edited |
| milestones | String | JSON array of milestone strings |

### ProjectReport
Student's weekly/final project reports with AI analysis.

| Field | Type | Notes |
|:---|:---|:---|
| id, userId, week | | week=0 for final report |
| reportType | String | weekly \| final |
| reportText | String | Student's report |
| aiAnalysis | String? | JSON: score, 4 dimensions, strengths, weaknesses, feedback |
| submittedAt, analyzedAt | DateTime | |

### CurriculumProgress
Tracks which curriculum days a student has completed.

| Field | Type | Notes |
|:---|:---|:---|
| id, userId | | |
| week | Int | 1-6 |
| day | Int | 1-5 |
| completedAt | DateTime | |
| @@unique([userId, week, day]) | | One row per day |

### DailyLog
Daily check-ins with learning reflections.

| Field | Type | Notes |
|:---|:---|:---|
| whatDidYouDo, anyErrors, confidence (1-5), gitCommit | | Original fields |
| learningReflection | String | "What did you LEARN today?" |
| confusionNotes | String | "What CONFUSED you?" |
| nextQuestion | String | "What's your NEXT question?" |

### Interaction
AI Q&A exchange with plagiarism detection.

### WeeklyTest
Socratic test — conversation is now SAVED (not deleted).

| Field | Type | Notes |
|:---|:---|:---|
| conversation | String | JSON: full Q&A history (was "[]" on completion, now saved) |
| currentQuestion, replyCount | Int | 10 questions, max 5 replies each |
| psychAnalysis, examinerComment, score, plagiarismScore | | AI-generated on completion |
| retakeAllowed | Boolean | Teacher must explicitly allow |

### Other Models
- **Bug** — bug tracking
- **Competency** — per-topic skill scores
- **ReportCard** — auto-generated report cards
- **PsychologyObs** — psychology observations
- **Message** — student ↔ teacher messaging
- **Comment** — teacher comments on any entity (cascade deletes)
- **PasswordResetRequest** — admin-reset workflow
- **Cohort** — student groups
- **Setting** — app-wide settings (key/value)
- **AICache** — AI response cache (avoids redundant API calls)
- **AIUsageLog** — every AI call logged with tokens, provider, latency

---

## Seeding

`src/lib/seed.ts` runs via `GET /api/seed` (admin only, idempotent):
- Creates admin account if missing
- No demo student/teacher data (fresh installs start empty)

---

## Migrations

Uses `prisma db push` (schema-first). The `vercel.json` build command auto-runs:
```
npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss
```
