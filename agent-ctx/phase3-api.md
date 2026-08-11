# Phase 3 — API Endpoints (16 routes under /api/learn/)

## Work record
- **Agent**: main
- **Task ID**: phase3
- **Status**: ✅ Complete

## Routes created
All use `getAuthUser()` for auth, `db` for DB access, `callAI`/`callAIJson` for AI, and `apiSuccess`/`apiError` for responses.

1. **POST /api/learn/enroll** — atomic enroll: LearnProfile + JourneyPlan (30 steps) + LearnProject (4 milestones). Idempotent.
2. **GET /api/learn/now?courseId=** — top-of-shell snapshot: next step, profile (XP/level/streak), daily-test status, active project + milestone.
3. **GET /api/learn/today?courseId=** — today's topic data + already-generated slides.
4. **POST /api/learn/today/next-slide?courseId=** — generates next slide via callAIJson (4 slides per topic). Awards 5 XP. Returns `{topicComplete:true, resources:[...]}` when all 4 done.
5. **POST /api/learn/today/complete?courseId=** — marks resources shown, completes topic, advances, awards 15 XP (+500 on course end).
6. **POST /api/learn/sessions/[id]/ask** — RAG tutor Q&A over course slides. Always cites [Week/Day/Slide].
   - **+ POST /api/learn/sessions?courseId=** — create-or-get an active TutorSession (added for shell wiring).
   - **+ GET /api/learn/sessions?courseId=** — list sessions.
7. **POST /api/learn/daily-test/[date]/start** — generates 3 questions (2 today + 1 spaced-rep). Idempotent per (user,course,date).
8. **POST /api/learn/daily-test/[date]/answer** — evaluates via AI, persists, on last answer awards 30 XP.
9. **GET /api/learn/projects** + **POST /api/learn/projects** — list + create (with 4 default milestones, idempotent on courseId).
10. **POST /api/learn/projects/[id]/help** — hint ladder (nudge → clue → scaffold), advances hintLevel per call.
11. **POST /api/learn/projects/[id]/milestones/complete** — marks milestone done, awards 15 XP, marks project complete if last milestone.
12. **GET /api/learn/me/xp?courseId=&limit=** — XP history with total + level.
13. **GET /api/learn/me/badges?courseId=** — earned badges + auto-awards streak/XP threshold badges.
14. **GET /api/learn/me/journey?courseId=** — JourneyPlan + 30 steps with statuses (pending/active/completed) + currentTopic.
15. **GET /api/learn/notes?courseId=&slideId=** + **POST /api/learn/notes** — list + create notes.
16. **GET /api/learn/resources?slideId=&courseId=** — returns WEEKLY_TOPICS resources for a slide's topic.

## Key implementation decisions
- **Slide ↔ topic mapping**: `LearnSlide.moduleId` stores `"{week}-{day}"` (e.g. "1-3"). The spec said LearnSlide has no metadata field, so I co-opted the existing `moduleId` column for this. The today route filters slides by `courseId + moduleId`.
- **AI fallbacks**: every AI call has a degraded path. If `callAIJson` fails for slide-gen, a minimal fallback slide is generated. If `callAI` (raw) fails for project help or tutor ask, a graceful message is returned. No endpoint ever returns a 500 from an AI outage.
- **JSON mode**: slide-gen, daily-test-start, and daily-test-answer all use `callAIJson` with zod schemas + one repair retry.
- **Idempotency**: enroll, daily-test/start, projects POST, sessions POST all return the existing row if one exists.
- **Auto-enroll**: `/now`, `/today`, `/me/journey` call `getOrCreateProfile` so the first page load after enroll (or even without enroll) just works.
- **Streak update**: `/today` calls `updateStreak` on each visit, awarding 20 XP on new-day activity.

## Notes for Phase 4 (UI)
- The shell will need these endpoints:
  - `/api/learn/now?courseId=X` for the status strip
  - `/api/learn/today?courseId=X` for the slide canvas
  - `/api/learn/today/next-slide?courseId=X` for the "Next Slide" CTA
  - `/api/learn/today/complete?courseId=X` for the "Complete & Next Topic" CTA
  - `/api/learn/sessions?courseId=X` (POST) to start a tutor session
  - `/api/learn/sessions/[id]/ask` for chat
  - `/api/learn/me/journey?courseId=X` for the JourneyPanel
  - `/api/learn/projects?courseId=X` (GET+POST) for the ProjectPanel
  - `/api/learn/daily-test/[date]/start` + `/answer` for the GrowPanel
  - `/api/learn/notes?courseId=X` (GET+POST) for the LibraryPanel
  - `/api/learn/resources?courseId=X&slideId=...` for the LibraryPanel resources tab
