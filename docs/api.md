# API Reference

All routes under `src/app/api/*`. Auth via httpOnly + secure cookie. **45+ routes total.**

---

## Auth

| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/api/auth/login` | Email/password login → sets cookie |
| `PUT` | `/api/auth/login` | Signup (creates pending user, validates security Q&A) |
| `POST` | `/api/auth/logout` | Clears cookie |
| `GET` | `/api/auth/me` | Current user profile + hasSecurityQuestion |
| `POST` | `/api/auth/forgot-password` | Returns security question or creates admin reset request |
| `POST` | `/api/auth/reset-password` | Self-service reset via security question |
| `POST` | `/api/auth/change-password` | Change password (verifies current) |
| `POST` | `/api/auth/set-security-question` | Set/update security question (requires current password if updating) |

## Users

| Method | Path | Role | Description |
|:---|:---|:---|:---|
| `GET` | `/api/users` | teacher, admin | List all users |
| `POST` | `/api/users` | teacher, admin | Create user |
| `PUT` | `/api/users/[id]/approve` | teacher, admin | Approve pending → student (guards: only pending users) |
| `PATCH` | `/api/users/[id]/role` | admin | Change role |
| `PATCH` | `/api/users/[id]/block` | admin | Block/unblock user |
| `DELETE` | `/api/users/[id]` | admin | Delete user |

## Project

| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/api/project/setup` | Save project definition + auto-generate AI summary + key features |
| `GET` | `/api/project/setup` | Get project definition (summary, key features, duration, URLs, notes) |
| `PATCH` | `/api/project/setup` | Update project (regenerates AI summary if core fields change) |
| `DELETE` | `/api/project/setup` | Delete project + all tasks + weeks + comments |
| `GET` | `/api/project/plan` | Get project definition + tasks grouped by week + progress |
| `POST` | `/api/project/generate-tasks` | AI generates tasks + week plan (body: weeks, tasksPerWeek, replace) |
| `GET/POST/PATCH/DELETE` | `/api/project/weeks` | CRUD for custom week titles + summaries + milestones |
| `GET/POST/DELETE` | `/api/project/reports` | Submit/list/delete project reports (POST auto-analyzes with AI) |

## Curriculum

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/api/curriculum/progress` | Full curriculum with per-day completion + today's topic |
| `POST` | `/api/curriculum/progress` | Mark a curriculum day complete (body: week, day) |
| `DELETE` | `/api/curriculum/progress` | Unmark a curriculum day (body: week, day) |

## Tasks

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/api/tasks` | List tasks (optional `?week=N`) |
| `POST` | `/api/tasks` | Create task (validates week 1-52, day 1-5/null) |
| `PATCH` | `/api/tasks` | Update task (status, description, week, day, dueDate, estimatedMinutes, isMilestone, taskNotes) |
| `DELETE` | `/api/tasks?id=...` | Delete task + cascade comments |

## Student Data

| Method | Path | Description |
|:---|:---|:---|
| `GET/POST` | `/api/daily-logs` | Daily check-ins (POST accepts learningReflection, confusionNotes, nextQuestion) |
| `PATCH/DELETE` | `/api/daily-logs/[id]` | Edit/delete check-in (teacher/admin only) |
| `GET/POST/PATCH/DELETE` | `/api/bugs` | Bug tracking |
| `GET/POST` | `/api/interactions` | Practice Q&A history |
| `DELETE` | `/api/interactions/[id]` | Delete interaction |
| `GET/POST` | `/api/weekly-tests` | Weekly test status |
| `GET/POST` | `/api/competencies` | Per-topic skill scores |
| `GET/POST` | `/api/report-cards` | Report card CRUD |
| `POST` | `/api/students/[id]/advance-week` | Advance student's current week (auto-called after test completion) |
| `GET` | `/api/students/final-result` | Aggregated final result with project reports + task stats |
| `POST` | `/api/students/[id]/generate-project-analysis` | Teacher generates final project analysis (AI) |
| `GET` | `/api/students/[id]/portfolio` | Student portfolio data |
| `POST` | `/api/students/[id]/allow-retake` | Allow/revoke retake |
| `POST` | `/api/students/[id]/unlock-test` | Bypass task lock |
| `PATCH` | `/api/students/[id]/edit-weekly-test` | Edit AI results (score, psych, comment) |
| `POST` | `/api/students/[id]/generate-report-card` | Generate report card for a week |

## Daily Tasks & Stats

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/api/daily-tasks` | Today's pending tasks (curriculum + project, separated) |
| `GET` | `/api/stats` | Dashboard aggregate stats (includes projectDurationWeeks) |
| `GET` | `/api/daily-motivation` | AI-generated daily quote (cached) |
| `GET` | `/api/journey` | Journey wizard progress |
| `POST/PUT` | `/api/journey` | Update journey progress |

## Messaging & Comments

| Method | Path | Description |
|:---|:---|:---|
| `GET/POST` | `/api/messages` | Inbox/sent/all (with `?box=`) |
| `PATCH` | `/api/messages/[id]/read` | Mark as read |
| `DELETE` | `/api/messages/[id]` | Delete message |
| `GET/POST` | `/api/comments` | Teacher comments (supports interactionId, taskId, weeklyTestId, dailyLogId) |
| `PATCH` | `/api/comments` | Edit comment |
| `DELETE` | `/api/comments?id=...` | Delete comment |

## AI

| Method | Path | Role | Description |
|:---|:---|:---|:---|
| `POST` | `/api/ai/generate` | student, admin | Generate Socratic question (cached, global topics) |
| `POST` | `/api/ai/evaluate` | student, admin | Evaluate answer (correctness, gaps, plagiarism) |
| `POST/GET` | `/api/ai/weekly-test` | student, admin | Socratic chatbot (10 questions, saves conversation, auto-advances week) |
| `GET` | `/api/ai/stats` | admin | AI usage stats |
| `POST` | `/api/ai/test` | admin | Test AI connection (inline key uses local client, no env mutation) |

## Admin

| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/api/seed` | Idempotent DB seeder (admin only) |
| `GET/POST` | `/api/admin/cleanup` | Clear test data |
| `GET/POST/PATCH` | `/api/settings/ai-key` | Manage DeepSeek API key |
| `GET/POST` | `/api/settings/features` | Feature flags |
| `GET` | `/api/password-reset-requests` | List reset requests |
| `POST/PATCH` | `/api/password-reset-requests/[id]/approve` | Approve/reject reset |
| `GET` | `/api/cohorts` | List cohorts |
| `GET` | `/api/course-outline` | Get/set course outline content |
| `GET` | `/api/grades/override` | Override student grade |
