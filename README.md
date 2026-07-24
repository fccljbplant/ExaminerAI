# ExaminerAI — Socratic Assessment & Mentorship Platform

A comprehensive AI-powered assessment, mentorship, and student wellbeing platform for bootcamps and vocational training programs. Students get personalized AI tutoring, Socratic assessments with per-question explanations, project planning tools, and progress tracking. Teachers get full batch visibility, data-driven psychological insights, GROW-model coaching tools, and automated alerts. Administrators get institutional oversight, teacher behavior monitoring, and system health controls.

**Live demo:** https://examiner-ai-tau.vercel.app/

---

## Key Highlights

- **One unified AI Tutor** — friendly, polite, engaging teacher that adapts to the student's language (Roman English support), connects every concept to their project, and handles disengaged students with empathy
- **Per-question explanations** — after every question in daily/weekly tests, the student immediately sees the correct answer + why + encouragement (not just at end-of-test)
- **7-Dimension psychological analysis** — calibration, explanatory depth, gaming pattern, attribution/mindset, cognitive load, SRL phase, fluency — with teacher-facing explanations for every value
- **GROW coaching mentorship** — structured coaching touchpoints (Goal, Reality, Options, Will) with alert-driven actions
- **Automated alerts** — psychological, educational, and mentorship alerts fire automatically when students cross thresholds; teachers see an amber badge on their dashboard
- **Lightweight data collection** — 1 DB upsert per AI Tutor message (not 15-20 writes), designed to scale to 1000+ students without DB flooding
- **AI token cache** — opt-in response cache reduces AI costs on cacheable calls
- **10-role RBAC** — granular permissions with IDOR protection, AccessGrant scoping, and rate limiting

---

## Roles (RBAC)

| Role | Purpose | Key Access |
|:---|:---|:---|
| `pending` | New signup awaiting approval | None |
| `student` | The learner | Own data, AI Tutor, tests, projects |
| `teacher` | Mentor / examiner | Batch dashboard, portfolio, grading, course planner |
| `course_coordinator` | Manages courses | Course planner (update only, no delete) |
| `counselor` | Wellbeing staff | Batch dashboard (AccessGrant-scoped) |
| `guardian` | Parent / carer | Read-only view of linked child's progress |
| `principal` | Institution head | All admin + pastoral (crisis) access |
| `administrator` | Operations admin | All admin except crisis content |
| `developer` | Technical admin | System health, AI config, no people management |

Admins can use the **"View As Role"** switcher to test any role's dashboard in real time.

---

## Student Features

| Feature | Description |
|:---|:---|
| **Journey Wizard** | Guided step-by-step onboarding from project planning to graduation |
| **AI Tutor** | Friendly, polite chatbot that teaches today's topic, connects it to the student's project, suggests study + coding links, and handles "I don't want to study" with empathy + professional skills |
| **Daily Practice** | 3-question Socratic conversation — student picks any week + any daily topic |
| **Daily Test** | 3-question Socratic check-in on today's topic with confidence self-rating |
| **Weekly Test** | 15-question Socratic exam with plagiarism analysis, per-question explanations, and psychological assessment |
| **Per-Question Explanations** | After every question, student sees: correct answer, why it's correct, and specific encouragement — immediately, not at end-of-test |
| **Project Planning** | AI-generated tasks, Gantt chart, week plan, project reports with AI analysis |
| **Report Cards** | Auto-generated from test scores (80% weekly + 20% practice) |
| **Daily Check-in** | Confidence rating + learning reflection (what did you learn, what confused you, next question) |
| **Course Outline** | DB-backed, per-course curriculum with daily topics, objectives, and resources |
| **Messages** | Student-teacher messaging system |
| **Ask My Teacher** | Floating button for quick questions to the assigned teacher |
| **Daily Task Reminder** | Floating popup with today's curriculum topic + project tasks |
| **Post-Test Reflection** | Student-facing coaching reflection generated from psych evidence |
| **Certificates** | Auto-generated on course completion, publicly verifiable |
| **Guardian Read-Only** | Guardians see their child's progress in read-only mode (action buttons hidden) |

---

## Teacher Features

| Feature | Description |
|:---|:---|
| **Batch Dashboard** | Student list with attention flags, sorted by who needs help most |
| **Student Portfolio** | Full detail view with Psychological, Educational, and Mentorship tabs |
| **Seven Dimensions** | 7 psych dimensions with trajectory badges, value explanations, and recommended teacher actions |
| **GROW Mentorship** | Structured coaching touchpoints (Goal, Reality, Options, Will) with alert-driven actions, outcome tracking, and follow-up scheduling |
| **Student Health Summary** | Mood score, engagement score, avg test score, engagement streak — color-coded, with signal badges (frustration/avoidance/enthusiasm counts) |
| **Automated Alerts** | Psych/educational/mentorship alerts fire automatically — amber badge on dashboard nav shows open alert count |
| **AI Assistant** | Teaching assistance chatbot for lesson prep, case review, rubrics, parent communications — with behavioral logging visible to admins |
| **Course Planner** | Course CRUD (create/read/update; delete admin-only), batch assignment, AI course generation |
| **Grade Override** | Override scores on practice questions and weekly tests |
| **Retake Control** | Allow/revoke retakes on weekly tests |
| **Test Unlock** | Bypass task-lock to unlock weekly tests |
| **Report Card Generation** | AI-assisted report card content for any week |
| **Project Analysis** | Comprehensive final project evaluation (execution, technical competence, quality, career readiness) |
| **Assignments** | Group tasks, events, peer assessment management |
| **Alert Badge** | Amber badge on "Dashboard" nav item shows count of students needing attention |

---

## Admin Features

| Feature | Description |
|:---|:---|
| **Overview Dashboard** | Enrollment funnel, institutional metrics, quick actions |
| **User Management** | Approve, block, delete, role change, batch approve |
| **Course Management** | Full CRUD, batch assignment, AI course generation |
| **Feature Flags** | Toggle features on/off (signup, practice, weekly tests, etc.) |
| **Password Resets** | Approve student password reset requests |
| **System Health** | AI usage stats, connection test, env var status, audit log |
| **Access Grants** | Scoped access for counselors (full/wellbeing_only/crisis_only/content_only) |
| **Audit Log** | All admin actions tracked (role changes, approvals, blocks, grants) |
| **Role Nav Config** | Customize which nav items each role sees |
| **Teacher Behavior Tab** | Teacher AI Assistant usage + behavioral signals (principal/admin only) |
| **Maintenance Tab** | AI token cache stats + clear, psych data cleanup (preview + run) |

---

## Psychological & Mentorship System

### Per-Message Analysis (Lightweight)
Every AI Tutor message is analyzed using pure heuristic text analysis (no AI call, <1ms). Detects frustration, avoidance, enthusiasm, and growth-mindset signals. Updates mood score + engagement score via exponential decay (70/30 weighted average).

### 7-Dimension Test Pipeline
On test completions, the full analysis pipeline writes PsychEvidence across 7 dimensions:
1. **Calibration** — Does the student know what they know? (Dunning-Kruger)
2. **Explanatory Depth** — How deeply do they explain reasoning?
3. **Gaming Pattern** — Is the student using AI to generate answers?
4. **Attribution / Mindset** — Growth vs. fixed mindset (Dweck)
5. **Cognitive Load** — How hard is the material right now? (Sweller)
6. **SRL Phase** — Self-Regulated Learning phase (Zimmerman)
7. **Fluency / Retention** — Knowledge recall stability

Each dimension value has a teacher-facing explanation with a concrete recommended action. See [docs/SYSTEM-DOCUMENTATION.md](docs/SYSTEM-DOCUMENTATION.md) for calculation details.

### Automated Alerts
Three alert types fire automatically when thresholds are crossed:
- **Psychological** — mood score < 30, frustration/avoidance patterns
- **Educational** — avg score < 40%, or score drop > 15 points week-over-week
- **Mentorship** — engagement streak broken, inactive 3+ days, engagement score < 30

### GROW Coaching
Mentorship tab uses the GROW model (Whitmore):
- **G**oal Setting — What does the student want to achieve?
- **R**eality Check — Where is the student now?
- **O**ptions — What could the student do?
- **W**ill — What WILL the student do?

Plus: general check-in, alert response, praise/recognition, escalation. Each touchpoint has outcome tracking (resolved/ongoing/escalated/follow-up) and follow-up date scheduling.

See [docs/SYSTEM-DOCUMENTATION.md](docs/SYSTEM-DOCUMENTATION.md) for the complete framework, data flow, and theoretical foundations.

---

## AI Provider Integration

Multi-provider stack with automatic fallback:

| Priority | Provider | Use case |
|:---|:---|:---|
| 1 (primary) | **Z.ai** (glm-4.6, OpenAI-compatible) | All AI features |
| 2 (fallback) | **DeepSeek** (deepseek-chat) | If Z.ai not configured |
| 3 (sandbox) | **z-ai-web-dev-sdk** (built-in) | Local dev, no key needed |

All providers expose the same `callAI()` interface. Opt-in token cache reduces costs on cacheable calls (daily motivation, project summary).

---

## Architecture

### Modular Monolith
```
src/modules/
├── assessment/     Tests, grading, AI, psych analysis, engagement tracking
├── course/         Course outlines, curriculum, AI course generation
├── project/        Student project planning, task management
├── admin/          Users, batches, settings
├── auth/           Authentication, RBAC
├── communication/  Messaging, comments
├── grading/        Grade overrides, report cards, certificates
├── shared/         DB, logger, utilities
├── student/        Student lifecycle (skeleton)
└── wellbeing/      Wellbeing state (skeleton)
```

### Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** PostgreSQL (Neon) — SQLite for local dev
- **ORM:** Prisma 6
- **UI:** React 19, Tailwind CSS 4, shadcn/ui, Radix UI
- **AI:** Z.ai (primary), DeepSeek (fallback), z-ai-web-dev-sdk (sandbox)
- **Auth:** JWT cookies, bcrypt, rate limiting
- **Charts:** Recharts
- **Testing:** Vitest (134 tests)

### Data Models (44 models)
Key models: User, Batch, Course, CourseWeek, CourseDay, ProjectTask, ProjectWeek, WeeklyTest, DailyTest, ChatSession, StudentHealthSummary, StudentAlert, PsychEvidence, MentorshipTouchpoint, WellbeingState, CrisisFlag, ConfidenceRating, SkillMastery, AccessGrant, AuditLog, Certificate

See [docs/database.md](docs/database.md) for the full schema.

---

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Set up the database (SQLite for local dev)
cp .env.example .env
npm run db:push

# 3. Start dev server
npm run dev          # http://localhost:3000
```

Admin account auto-created: `admin@examiner.ai` / password from `ADMIN_PASSWORD` env var.

---

## Security

- JWT_SECRET enforced in production
- Rate limiting on login, forgot-password, reset-password (10 per 10 min per IP)
- IDOR protection via `assertCanAccessStudent()` — teachers can only access their own batch's students
- AccessGrant model for scoped access (counselors, coordinators)
- Input validation on all student-facing routes (10K char limits)
- No SQL injection (Prisma parameterizes all queries)
- No XSS (no `dangerouslySetInnerHTML` — custom MarkdownRenderer is safe)
- passwordHash never included in API responses
- All admin actions logged to AuditLog

See [docs/SECURITY.md](docs/SECURITY.md) for details.

---

## Deploying to Vercel

1. Push to GitHub `master` branch — Vercel auto-deploys
2. Set env vars in Vercel project settings (see `.env.example` for the full list)
3. Use `prisma/schema.prod.prisma` for PostgreSQL
4. Run `npm run db:push:prod` to sync the schema

---

## Documentation

| Document | Description |
|:---|:---|
| [SYSTEM-DOCUMENTATION.md](docs/SYSTEM-DOCUMENTATION.md) | Complete system docs: psych analysis, educational health, mentorship, alerts, data flow, schema, theoretical foundations |
| [DEEP-AUDIT-2026-07-24.md](docs/DEEP-AUDIT-2026-07-24.md) | Deep audit report — 42 findings across 7 personas |
| [MODULES.md](docs/MODULES.md) | Module structure + re-export compatibility table |
| [SECURITY.md](docs/SECURITY.md) | Security architecture, RBAC, IDOR protection |
| [AUTH-PATTERN.md](docs/AUTH-PATTERN.md) | Authentication pattern + JWT flow |
| [SEVEN-DIMENSIONS.md](docs/SEVEN-DIMENSIONS.md) | The 7 psych dimensions explained |
| [architecture.md](docs/architecture.md) | System architecture overview |
| [database.md](docs/database.md) | Database schema + models |
| [api.md](docs/api.md) | API route documentation |
| [testing.md](docs/testing.md) | Testing guide |

---

## Environment Variables

See `.env.example` for the full list with comments. Key vars:

| Var | Required | Description |
|:---|:---|:---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (prod) or SQLite file path (dev) |
| `JWT_SECRET` | Prod only | JWT signing secret (long random string) |
| `ADMIN_EMAIL` | Optional | Admin email (default: admin@examiner.ai) |
| `ADMIN_PASSWORD` | Prod only | Admin password |
| `ZAI_API_KEY` | Recommended | Z.ai API key (primary AI provider) |
| `DEEPSEEK_API_KEY` | Optional | DeepSeek API key (fallback) |
| `CRON_SECRET` | Optional | Secret for cron endpoint (check-alerts) |

---

## Scripts

| Script | Description |
|:---|:---|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to SQLite (dev) |
| `npm run db:push:prod` | Push schema to PostgreSQL (prod) |
| `npm run db:generate` | Generate Prisma client |
| `npm test` | Run Vitest test suite |
| `npm run lint` | Run ESLint |

---

## License

Private — All rights reserved.
