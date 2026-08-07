# TraineesAI Modernization — Master Plan

## Project context

TraineesAI is the modernized successor to ExaminerAI (https://github.com/fccljbplant/ExaminerAI). It's a Next.js 16 SaaS platform for training fresh engineering internees.

**The core model:** AI does the training (teaching, Socratic testing, project task generation). Instructors (busy engineers) only monitor progress and mentor struggling students via in-app messages.

---

## Non-negotiable principles

1. **AI trains. Humans mentor.** Never blur these roles.
2. **Instructors are collaborators**, not subjects to be monitored.
3. **Students are learners**, not psychological subjects.
4. Every feature must answer: *"Does this help a busy engineer mentor with minimum time?"*
5. **Never break production.** Each phase ships independently.

---

## Progress (updated August 2026)

### Phase 1: Strip the surveillance layer — ✅ COMPLETE & DEPLOYED

Removed ~2,368 lines of behavioral/psychological monitoring code:
- Deleted 11 Prisma models (PsychologyObs, PsychEvidence, WellbeingState, CrisisFlag, StudentAlert, StudentHealthSummary, ConfidenceRating, MentorshipTouchpoint, CaseReview, CaseReviewResponse, GrowthReport)
- Stripped psych fields from 6 models (Interaction, WeeklyTest, DailyTest, DailyTestAnswer, ReportCard, ChatSession)
- Deleted Counselor + Guardian roles entirely
- Deleted 35+ files (psych lib, API routes, components, dashboards)
- Rewrote AI prompts to remove all behavioral/psychological instructions
- Re-enabled strict TypeScript
- Removed Vercel crons

### Phase 2: Modern training engine core — ✅ COMPLETE & DEPLOYED

Built 5 new files + 1 new Prisma model + 1 new API endpoint:

| File | Purpose |
|---|---|
| `src/lib/assessment/adaptive.ts` | 5-level adaptive difficulty engine |
| `src/lib/learning-signal.ts` | Transparent 0-100 signal from academic facts only |
| `src/lib/ai-json.ts` | JSON mode + zod validation + repair retry |
| `src/app/api/today/summary/route.ts` | Single endpoint feeding TodayView |
| `src/components/examiner/student/TodayView.tsx` | "What do I do next?" landing screen |
| `src/app/api/daily-test/route.ts` | Modernized: adaptive + JSON mode + drills + degraded mode |

**Prisma additions:** DrillCard model (spaced repetition), DailyTest.difficultyState field

### Phase 3: Slide viewer + proactive AI tutor — ✅ COMPLETE & DEPLOYED

- Added CourseDay fields: `videoUrl`, `videoTitle`, `codeExamples` (JSON), `webImages` (JSON)
- Updated courses API (GET/POST/PUT) to parse/persist the new fields
- **NEW SlideViewer.tsx** (672 lines) — pure render function that generates slides on-the-fly from CourseDay fields. Six slide types: Video → Concept → Code → Visual → Activity → Reflection. Features: topic strip, horizontal flow chips, keyboard nav, centered viewport.
- **NEW AIPanel.tsx** (306 lines) — right-side persistent chat panel with proactive bubbles, "AI is reading: {slide}" awareness, quick-action chips, / to focus, Enter to send.
- Modified CourseOutline.tsx to use SlideViewer + AIPanel instead of flat day-card list.

### Phase 4: Instructor experience — ✅ ADEQUATE (no changes needed)

The instructor dashboard already has 4 focused tabs (Today / Students / Assignments / Insights) which is sufficient. The psych-specific tabs (Mentorship, Psychological) were removed in Phase 1. No further simplification needed.

### Phase 5: Rename to TraineesAI — ✅ COMPLETE & DEPLOYED

Renamed "ExaminerAI" → "TraineesAI" across 11 files:
- AppShell (brand, loading, welcome, footer)
- Login (heading)
- modern-landing (navbar, hero, CTAs, footer)
- TestChatUI (chat labels)
- verify page (certificate issuer)
- constants, theme-context, presets, globals.css (comments)
- course-defaults (AI prompt)
- package.json (name field)

---

## Architecture: AI trains, humans mentor

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   AI Train   │────▶│  AI Assess   │────▶│ Human Mentor │
│              │     │              │     │              │
│ • SlideView  │     │ • Socratic   │     │ • TodayView  │
│   (video,    │     │   tests      │     │   dashboard  │
│   code,      │     │ • Adaptive   │     │ • Messages   │
│   visual,    │     │   difficulty │     │   struggling │
│   activity,  │     │ • Plagiarism │     │   students   │
│   reflection)│     │   detection  │     │ • Overrides  │
│ • AIPanel    │     │ • DrillCard  │     │   grades     │
│   (proactive │     │   spaced     │     │              │
│   bubbles)   │     │   repetition │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

**AI trains. Humans mentor. Never blur these roles.**

---

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Prisma 6 (SQLite dev / Postgres prod)
- **AI**: DeepSeek (primary) + Z.ai GLM (fallback)
- **UI**: Tailwind 4 + shadcn/ui + Radix primitives
- **Auth**: Custom JWT + bcrypt
- **Hosting**: Vercel

## License

Proprietary. © fccljbplant.
