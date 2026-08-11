# TraineesAI

**AI-driven training platform for engineering internees.**

AI teaches. AI tests. Human mentors. The training platform that takes the training burden off busy engineers and managers.

## What is this?

TraineesAI is the modernized successor to [ExaminerAI](https://github.com/fccljbplant/ExaminerAI). It's a Next.js SaaS platform designed for a specific problem in industry:

> When a new internee or trainee joins, engineers and management don't have time to train them. This platform shifts the training burden to AI — AI teaches, AI tests, AI tracks progress. The human mentor only steps in when AI flags a student needs help.

## Modernization status — ALL PHASES COMPLETE ✅

| Phase | What | Status |
|---|---|---|
| **Phase 1** | Strip behavioral/psychological surveillance layer (~2,368 lines removed) | ✅ Complete & deployed |
| **Phase 2** | Modern training engine (adaptive difficulty, learning signal, JSON mode, drills, TodayView) | ✅ Complete & deployed |
| **Phase 3** | Slide viewer + proactive AI tutor (on-the-fly slide generation) | ✅ Complete & deployed |
| **Phase 4** | Instructor experience (already adequate after Phase 1 cleanup) | ✅ Complete |
| **Phase 5** | Rename to TraineesAI + final polish | ✅ Complete & deployed |

See **[MODERNIZATION_PLAN.md](./MODERNIZATION_PLAN.md)** for the full execution plan.

## Key features

### Learn Platform (`/learn`) — AI-guided learning experience
- **Today's Topic flow** — 30 topics (6 weeks × 5 days), AI generates 4 slides per topic on-the-go
- **AI Tutor avatar** — sprite player + lip-sync + floating dock, driven by `tutor.say/play/caption` event bus
- **h-screen shell** — no vertical page scroll; status strip + activity bar + slide canvas + chat pane
- **4 panels** — Journey (30-topic map), Project (create + milestones + hint ladder), Grow (daily test UI + XP + badges), Library (resources + notes)
- **Gamification** — XP ledger (slide +5, probe +10, quiz +15, daily +30, weekly +100, course +500), 7 levels (Rookie → Legend), timezone-safe streaks
- **Daily tests** — 3 conversational questions with AI evaluation + feedback
- **Project guidance** — hint ladder (nudge → clue → scaffold), never gives the full answer first

### For students (trainees)
- **TodayView** — one screen answering "what do I do next?"
- **SlideViewer** — on-the-fly slide generation from course content (video, code, visual, activity, reflection)
- **Adaptive difficulty** — questions scale 1-5 based on performance + explicit confidence
- **DrillCard spaced repetition** — wrong answers come back until mastered
- **AI Tutor panel** — persistent right-side chat with proactive bubbles, knows which slide you're on
- **Socratic testing** — daily tests (3 Qs) + weekly tests (10 Qs), not MCQs
- **Project-based learning** — AI-generated capstone tasks, Gantt chart, milestones

### For instructors (mentors)
- **Today tab** — students needing attention, recent submissions
- **Students roster** — sorted by academic attention score (no psych signals)
- **Assignments** — group tasks + peer assessment
- **Insights** — operational analytics
- **Messages** — in-app messaging with students
- **Grade overrides** — human-in-the-loop on AI-graded answers

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Prisma 6 (SQLite dev / Postgres prod)
- **AI**: DeepSeek (primary) + Z.ai GLM (fallback)
- **UI**: Tailwind 4 + shadcn/ui + Radix primitives
- **Auth**: Custom JWT + bcrypt
- **Hosting**: Vercel

## Quick Start (local dev)

Prerequisites: Node.js 20+, Bun (preferred) or npm.

```bash
# 1. Install dependencies
bun install            # or: npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — for local dev, the default SQLite URL works out of the box:
#   DATABASE_URL=file:./db/custom.db

# 3. Initialize the database (SQLite dev schema)
bun run db:generate    # generate Prisma client
bun run db:push        # create/migrate SQLite schema

# 4. (optional) Seed demo data
bun run db:seed

# 5. Start the dev server
bun run dev            # http://localhost:3000
```

For production (Vercel), use Postgres and the production Prisma schema:

```bash
bun run db:generate:prod
bun run db:push:prod
```

See `.env.example` for details on switching DATABASE_URL from SQLite to Postgres.

## License

Proprietary. © fccljbplant.
