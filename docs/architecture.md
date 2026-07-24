# Architecture

## High-Level Design

AI Examiner is a **single Next.js 16 App Router project** with clean separation between Curriculum (fixed, shared) and Project (custom, per-student). All backend logic runs as API routes. Data lives in SQLite (dev) or PostgreSQL (prod) via Prisma. AI calls use DeepSeek.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16 + React 19)              │
│                                                                  │
│  page.tsx → ErrorBoundary → AppShell (SPA shell)                │
│    ├── Login (signup/login/forgot password)                     │
│    └── [authed] role-gated sidebar:                             │
│         ├── Student:                                             │
│         │   ├── Journey Wizard (guided onboarding)              │
│         │   ├── Dashboard (stats + 2 charts + today's tasks)    │
│         │   ├── Learning Hub (curriculum + check-in + reflections)│
│         │   ├── Practice (AI questions + evaluation)             │
│         │   ├── Weekly Test (Socratic chatbot, 10 Qs)           │
│         │   ├── Project (summary + Gantt + week plan + tasks)   │
│         │   ├── Report Card (final result + project reports)    │
│         │   └── Settings (account + project + security)         │
│         ├── Teacher: Dashboard (cohort + portfolios + comments) │
│         └── Admin: Dashboard (users + features + system)        │
│                                                                  │
│  DailyTaskReminder (floating popup, all student views)          │
│  Theme: next-themes (light/dark/system)                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ fetch /api/* (cookie auth)
┌────────────────────────────┴─────────────────────────────────────┐
│                  API LAYER (Next.js Route Handlers)              │
│                                                                  │
│  /api/auth/*          → login, signup, me, password reset       │
│  /api/project/*       → setup, plan, weeks, reports, gen-tasks  │
│  /api/curriculum/*    → progress (mark days complete)           │
│  /api/tasks/*         → task CRUD (day, milestone, time estimate)│
│  /api/daily-logs/*    → check-ins with reflection fields        │
│  /api/daily-tasks     → today's pending tasks (curriculum+proj) │
│  /api/ai/*            → generate, evaluate, weekly-test, stats  │
│  /api/students/*      → portfolio, advance-week, project-analysis│
│  /api/stats           → dashboard data (with projectDuration)   │
│  /api/comments, /messages, /users, /report-cards                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     Prisma + SQLite/PG       │
              │                              │
              │  19 models: User, DailyLog,  │
              │  ProjectTask, ProjectWeek,   │
              │  ProjectReport, Bug,         │
              │  Interaction, WeeklyTest,    │
              │  Competency, ReportCard,     │
              │  PsychologyObs, Curriculum   │
              │  Progress, Message, Comment, │
              │  PasswordResetRequest,       │
              │  Cohort, Setting, AICache,   │
              │  AIUsageLog                  │
              └──────────────────────────────┘
```

## Curriculum vs Project Separation

| Track | Storage | Tab | API |
|:---|:---|:---|:---|
| **Curriculum** | `course-topics.ts` (fixed) + `CurriculumProgress` (completion) | Learning Hub | `/api/curriculum/progress` |
| **Project** | `ProjectTask` + `ProjectWeek` + `ProjectReport` (per-student) | Project | `/api/project/*` + `/api/tasks` |

## Key Flows

### Week Advancement
1. Student completes weekly test → API auto-advances `currentWeek` (+1, max 6)
2. Or: teacher/admin calls `POST /api/students/advance-week`
3. Journey wizard steps for weeks 2-6 auto-complete when `currentWeek >= N`

### AI Task Generation
1. Student creates project → AI generates summary + key features
2. Student chooses duration (3-20 weeks) → AI generates tasks + week plan
3. Animated modal shows progress while AI works (10-90s)
4. Tasks saved with `day` column (1-5 Mon-Fri) for daily reminders

### Weekly Test
1. Student completes all week's tasks → test unlocks
2. AI asks 10 questions (max 5 replies each), conversation saved
3. On completion: psychAnalysis + score + plagiarismScore
4. `currentWeek` auto-advances
5. Student can review full conversation (not deleted)

## Security Model

- JWT in httpOnly + secure cookie (sameSite=lax)
- bcrypt password hashing (10 rounds)
- Security answers bcrypt-hashed (case-insensitive)
- Admin credentials from env vars (no hardcoded prod passwords)
- `POST /api/seed` backdoor removed (was unauthenticated admin login)
- `/api/ai/test` inline key test uses local client (never mutates process.env)
- `/api/users/[id]/approve` guards: only pending users can be approved
- Signup validates: security question requires non-empty answer
