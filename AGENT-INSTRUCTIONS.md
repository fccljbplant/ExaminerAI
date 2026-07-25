# Agent Instructions — READ THIS FIRST at the start of every session

> **CRITICAL:** This file exists because the sandbox environment can reset
> between sessions, wiping the working directory and rolling back git.
> This file is committed to GitHub and survives resets. Read it FIRST.

## The Problem

The sandbox environment resets between sessions:
- Working directory gets wiped (all source files disappear)
- Git gets rolled back to old commits
- Uncommitted changes are lost
- The agent forgets its own workflow rules

This has caused code destruction, old+new code mixing, and lost work.

## The Workflow (FOLLOW STRICTLY)

### 1. At the start of EVERY session, run this check first:

```bash
cd /home/z/my-project
echo "=== Git state ===" && git log --oneline -3
echo "=== Source files exist? ===" && ls src/components/examiner/TeacherDashboard.tsx
echo "=== Working directory clean? ===" && git status --short
echo "=== Dev server running? ===" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app
```

### 2. If the environment has reset (files missing, git rolled back):

- **STOP. Tell the user what happened BEFORE doing anything.**
- Say: "The sandbox environment has reset. I need to restore from GitHub."
- Then: `git fetch origin main && git reset --hard origin/main`
- Then: `bun install && bun run db:push -- --force-reset && bun run scripts/seed-demo.ts`
- Then: verify everything works before continuing.

### 3. After EVERY meaningful change:

```bash
git add -A
git commit -m "description of change"
git remote set-url origin https://fccljbplant:GITHUB_TOKEN@github.com/fccljbplant/ExaminerAI.git
git push origin main
git remote set-url origin https://github.com/fccljbplant/ExaminerAI.git
```

**Commit + push after EVERY change, not at the end of a batch.**
This way, if the environment resets, only the current line is lost — not hours of work.

### 4. Never do these silently:
- `git reset --hard` — always explain why first
- `rm -rf` on source directories — never do this
- Bulk file replacements — always show the user what changed

## Project: ExaminerAI

- **GitHub:** https://github.com/fccljbplant/ExaminerAI
- **Vercel:** examiner-ai-tau.vercel.app (stable URL)
- **Operator:** Inzet Enterprises · inzet.enterprises@gmail.com
- **Tech stack:** Next.js 16, Prisma, PostgreSQL (Neon on Vercel), shadcn/ui
- **Demo login:** demo@examiner.ai / demo123 (developer role, read-only)
- **Teacher login:** s.khan@fccl.com.pk / demo123

## Key Architecture

- `src/components/examiner/AppShell.tsx` — main app shell with sidebar nav + role switcher
- `src/components/examiner/TeacherDashboard.tsx` — teacher dashboard with 5 views
- `src/components/examiner/teacher/` — teacher sub-components (TodayView, MentorshipView, InsightsView, etc.)
- `src/modules/theme/` — global theme system (4 presets: Modern Slate, Ocean Blue, Forest Sage, Sunset Rose)
- `src/lib/demo-guard.ts` — server-side demo write-block (blocks all writes for demo@examiner.ai)
- `src/lib/api-client.ts` — client-side demo write-block
- `scripts/seed-demo.ts` — comprehensive demo data seed (50 students, 2 courses, alerts, mentorship, psych data)

## Teacher Dashboard — 5 Views (in sidebar nav)

| Nav Item | View Key | Tab | Purpose |
|----------|----------|-----|---------|
| Today | `batch` | `today` | Triage queue + batch health pulse + wins |
| Students | `batch-students` | `students` | Searchable roster with attention flags |
| Mentorship | `batch-mentorship` | `mentorship` | GROW coaching queue + follow-ups |
| Assignments | `batch-assignments` | `assignments` | Group tasks + peer assessment |
| Insights | `batch-insights` | `insights` | Batch analytics + AI Assistant |

## Known Issues (as of last session)

- All teacher dashboard views have defensive guards (Array.isArray checks)
- Demo account has `developer` role (not admin) — all writes blocked
- AccessGrants seeded for demo → all students (so portfolio loads)
- PsychEvidence values match what PsychologicalTab.tsx expects
- Cache-busting headers added to next.config.ts (no-cache on HTML pages)

## Vercel Deployment

```bash
# Set VERCEL_TOKEN env var before running (ask user for token)
cd /home/z/my-project
vercel --prod --yes --token "$VERCEL_TOKEN"
```

Build command: `bash scripts/vercel-build.sh` (uses prisma/schema.prod.prisma for Postgres)

## Token Storage

Tokens are NOT stored in this file (GitHub rejected it when they were).
Ask the user for tokens if needed, or check environment variables.

- GitHub repo: `fccljbplant/ExaminerAI`
- Vercel Project ID: `prj_YfSKQdv5AXTBJ08Czh9EDxtN8DBU`
- Vercel Stable URL: `examiner-ai-tau.vercel.app`
