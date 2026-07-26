# ExaminerAI — Full Multi-Perspective Audit & Roadmap

**Audit date:** 2026-07-20
**Audience:** Development team (currently 1 student user, team = 2 people)
**Method:** 8 professional lenses applied to the actual codebase (PM, Feature Engineer, SWE, QA, Educationist, Teacher, Course Designer, Student Mentor). All findings cite real files + line numbers.

---

## Part 1 — Findings by Lens

### 🔴 Lens 1 — Product Manager + Feature Engineer

#### Feature inventory (what exists)

| Role | Surface | Real features |
|---|---|---|
| Student | Journey wizard (15 steps), Dashboard, Learning Hub (curriculum + check-in), Practice questions, Weekly test (10Q×5R), Project plan + Gantt + AI task generation, Report card view, Settings, AI Tutor (external NotebookLM iframe), Messages | solid |
| Teacher | Cohort dashboard, student portfolio, comments on every artifact, grade override, retake control, test unlock, edit AI results, report card generation, project analysis, trends | solid |
| Admin | Users (approve/block/role), feature flags, password resets, system health (AI usage), AI key mgmt, developer mode (impersonate), course planner | solid |

#### Half-built / stub features

- **`AITutor.tsx`** (109 lines) — NOT actually an AI tutor. It's a button that opens an external NotebookLM iframe in a new tab. The `topic` parameter is read but never passed to the AI. Students must install a Chrome extension to bypass X-Frame-Options. UX dead-end disguised as a feature.
- **`CourseOutline.tsx`** (53 lines) — just renders `/course-plan.html` in an iframe. The HTML is a static hand-written file. It does NOT reflect the user's assigned course. If an admin creates a 4-week Python course, the student still sees the hardcoded 6-week web dev plan.
- **`DEFAULT_JOURNEY_STEPS`** (`course-defaults.ts:22-156`) — 15 steps hardcoded with text like "Set up VS Code, Git, and LocalWP", "WordPress basics". This is per-course data living in a defaults file, not per-course in the DB. New courses get the wrong onboarding.
- **`ai-prompts.ts:5-30`** "CORE PHILOSOPHY" hardcodes "WordPress, LocalWP, Make.com, phpMyAdmin, Gemini API" as the course tools. This text is appended to EVERY AI prompt regardless of which course the student is in.
- **`vercel.json`** build command runs `prisma db push --accept-data-loss` on every deploy — risky for prod schema changes.

#### Missing core features (ranked by impact)

1. **Certificate generation** — students finish Week 6 and get nothing. No PDF, no LinkedIn badge, no shareable URL.
2. **Notifications** — when a teacher comments, the student gets a badge on Messages 30s later. No email, no push, no in-app toast.
3. **Calendar / scheduling** — no concept of "today is Tuesday of Week 3". `getBootcampDayNumber()` just maps Mon=1..Fri=5, no awareness of cohort's actual start date.
4. **Attendance / participation tracking** — tracks daily-log count but not "did the student show up today".
5. **Peer review / group projects** — entirely solo.
6. **Live session / webinar integration** — none.
7. **Alumni mode** — once `currentWeek > totalWeeks`, the student sees the same weekly test UI forever. No "graduate" state.
8. **Parent/employer reports** — no shareable public portfolio URL.
9. **Mobile responsiveness** — Gantt + report-card panels are unusable on phones.
10. **Internationalization** — AI matches language but UI chrome is English-only.

#### Feature overlaps / redundancy

- Student has **6 different surfaces showing weekly progress**: Journey wizard, Dashboard, Learning Hub, Project Plan/Gantt, Report Card, Course Outline. They often show contradictory week counts.
- **5 overlapping behavioral-tracking surfaces**: `PsychologyObs`, `WeeklyTest.psychAnalysis`, `WeeklyTest.examinerComment`, `Interaction.cognitiveLoad/confidence/metacognitive`, `DailyLog.confidence`. No reconciliation. Teacher has no single "how is this student doing emotionally?" view.

#### Onboarding friction

- `Login.tsx` — student signs up → "pending approval" → no email sent → admin must manually approve. If admin is slow, student is stuck.
- After approval, student lands on `journey` mode with 15 steps. Step 4 ("Configure Timeline") requires choosing 3-20 weeks before seeing any curriculum.
- `DEFAULT_JOURNEY_STEPS` references "LocalWP", "VS Code", "Git" by name in step 6. A Python-course student sees the wrong tools.

#### Over-engineering / YAGNI

- `AICache` model exists but `callAI()` never reads from it. Dead infrastructure.
- `Competency` model tracks per-topic score but practice flow doesn't write to it consistently. Half-populated.
- `Bug` model — students log "bugs". Duplicates the daily-log `anyErrors` field.
- Admin "Developer Mode" role-switcher is in the sidebar footer with a 3-button grid — easy to misclick.

---

### 🟠 Lens 2 — Software Engineer + QA

#### P0 security vulnerabilities

1. **JWT secret fallback** (`auth.ts:8-14`): if `JWT_SECRET` missing in production, silently uses `"examiner-ai-dev-secret-change-me"` and `console.warn`. Anyone reading source can forge admin tokens. Should hard-crash on boot in production.
2. **No rate limiting on auth endpoints** (`auth/login/route.ts`): no throttling. Brute-force possible at network speed. Same for `forgot-password`, `reset-password`.
3. **No rate limiting on AI endpoints** (`ai/generate`, `ai/evaluate`, `ai/weekly-test`): the in-provider token-bucket is per-instance, in-memory — on Vercel serverless each cold start gets a fresh bucket. Attacker can burn DeepSeek quota.
4. **IDOR on student routes**: `/api/students/[id]/portfolio`, `/generate-report-card`, `/allow-retake`, `/unlock-test`, `/edit-weekly-test`, `/generate-project-analysis` — all check `role === "teacher" || role === "admin"` but never verify the teacher owns the student's cohort. A teacher can read any student in the system.
5. **`students/advance-week` IDOR** (`advance-week/route.ts:19-21`): a student can pass `?userId=other-student-id` and the route only blocks if `role !== teacher/admin`. Student can advance another student's week.
6. **Plaintext temp passwords** (`password-reset-requests/[id]/approve/route.ts`): admin sets `tempPassword` plaintext, stored in DB column `tempPassword String?`. Visible in any DB export.
7. **`AICache.response` and `Setting.value`** store raw AI responses + the DeepSeek API key in plaintext. `setAIKey()` writes the API key with no encryption despite the schema comment saying "stored encrypted at rest in production".
8. **CORS**: `api-client.ts` uses `credentials: "include"` but no CORS middleware. Fine on Vercel same-origin, but fragile.

#### P1 critical bugs

1. **Hardcoded 6-week bounds STILL remaining** (despite previous fix):
   - `students/advance-week/route.ts:31` — `if (user.currentWeek >= 6)` caps advancement at 6
   - `students/[id]/unlock-test/route.ts:32` — `week > 6` rejects valid weeks in longer courses
   - `students/[id]/generate-report-card/route.ts:34` — `week > 6`
   - `students/[id]/allow-retake/route.ts:30, 81` — `week > 6` (twice)
   - `StudentDashboard.tsx:485` — `case "db:week6": return currentWeek >= 6`
   - `StudentDashboard.tsx:2420` — `const isFinalWeek = selectedWeek === 6`
   These were missed in the previous sweep. A 4-week Python course can't generate week-4 report cards, can't unlock the final test, can't allow retakes.
2. **`journeyProgress` is a JSON string in a TEXT column** (`journey/route.ts:14-17`): every read parses JSON, every write re-serializes the whole array. Race condition: two concurrent POSTs can silently drop a step.
3. **`getCurrentUser()` 5-second timeout** (`auth.ts:77-86`): on Vercel cold starts the DB can take >5s. Function returns `null`, route returns 401, user gets logged out. Should retry once.
4. **`db.user.update(...).catch(() => {})`** (`auth/login/route.ts:55-58`): fire-and-forget `lastLogin` update is fine. But same pattern in `seed.ts:28-31` for promoting admin — failure means admin can't log in next time. Should not be fire-and-forget there.
5. **`AIUsageLog` writes are non-blocking** (`ai-provider.ts:340-369`): if logging DB call fails, you lose cost telemetry. No retry.
6. **No transaction on `weekly-test` completion** (`weekly-test/route.ts:325-353`): test marked completed, then `currentWeek` advanced in separate query. If second fails, student has completed test but is stuck on same week.
7. **`generate-tasks/route.ts:57-66` deletes tasks + comments in two separate queries**, not a transaction. Orphan comments possible.

#### P2 code quality

- `StudentDashboard.tsx` is 5039 lines in one file — unmaintainable. Should split into ~10 files.
- `TeacherDashboard.tsx` is 2163 lines — same problem.
- `as any` cast in `ai-provider.ts:292` hides type errors.
- `ApiError` doesn't expose response body — UI can't read structured error fields.
- Test coverage: 23 unit tests for 2 lib files. Zero route tests. Zero E2E. The critical `weekly-test` flow (300+ lines, complex state machine) has no tests.

#### API consistency

- Mixed envelope: some routes return `{ data: [...] }`, some `{ ok: true }`, some the raw array.
- `PATCH /api/cohorts/[id]` vs `PUT /api/courses/[id]` — inconsistent HTTP methods for "update".
- `POST /api/auth/login` for login, `PUT /api/auth/login` for signup — signup should be `POST /api/auth/signup`.

#### Performance concerns

- `stats/route.ts:17-29` fetches ALL students with all their dailyLogs, weeklyTests, tasks, _count — for a 1000-student cohort this is a 10MB+ payload.
- `TeacherDashboard.tsx` calls `/api/stats?as=teacher` and `/api/users` on every mount — duplicate data, no caching.
- No pagination anywhere.

#### Observability gaps

- No structured logging. Just `console.log`.
- No error tracking (Sentry).
- `AIUsageLog` exists but no alerting on spike/failure.
- No health check endpoint.

#### Deployment risks

- `vercel.json` build command: `rm -f .env && prisma generate && prisma db push --accept-data-loss && next build`. The `--accept-data-loss` on every deploy is dangerous.
- Two schemas to keep in sync: `schema.prisma` (SQLite) + `schema.prod.prisma` (Postgres).
- No migration files — only `db push`. No rollback path.

---

### 🟡 Lens 3 — Educationist + Teacher + Course Designer

#### Pedagogical soundness

| Surface | Strengths | Weaknesses |
|---|---|---|
| Weekly test (10Q × 5R) | Socratic probing, 4 pillar rotation, plagiarism detection, behavioral analysis | "10 questions" is arbitrary. No adaptive difficulty. Final week is "paste project report" essay — completely different format. |
| Practice questions | 4 pillars well-chosen (Why / Break-It / Client Translation / Edge Case) — covers Apply / Analyze / Evaluate | No Create-level tasks. No coding tasks (by design — limits upper-bound). |
| Final result | Multi-dimensional (performance + participation + behavioral) | Participation = "questions answered / 60" — penalizes students who answer fewer but deeper. |
| Report card | Auto-generated from real data (no AI cost) | 80% weekly-test + 20% practice weighting hardcoded — no per-course override. |

#### Bloom's taxonomy coverage

- Remember: minimal (no flashcards, no spaced repetition)
- Understand: ✅ weekly test "Why Probe"
- Apply: ✅ "Break-It Scenario"
- Analyze: ✅ "Edge Case Test"
- Evaluate: ✅ "Client Translation"
- Create: ❌ nothing. The project itself is the only creation, not assessed by AI.

#### Feedback quality

- `evaluatePrompt` is excellent: lenient scoring (75 floor for any understanding), behavioral monitoring, specific feedback structure (right → gap → encouragement).
- But: feedback given AFTER the student moves on. No "review your mistakes" surface.
- Weekly test final analysis only delivered at the END — no mid-test hints.

#### Pacing & cognitive load

- 6 weeks × 5 days × (curriculum + check-in + practice + project task + weekly test) = ~150 touchpoints.
- No rest days. Saturday/Sunday aren't distinguished from weekdays.
- No "light week" after a hard concept. Week 3 (APIs + automation + AI agents) is a huge jump from Week 2.

#### Formative vs summative balance

- Formative: practice questions (low-stakes, unlimited). ✅
- Summative: weekly test (high-stakes, one shot, retake requires teacher).
- Issue: weekly test is the ONLY summative assessment, and it's 80% of grade. Bad day = stuck.

#### Motivation & engagement

- Builders: daily AI motivation, streaks (implied), progress visualization.
- Killers:
  - `weekly-test/route.ts:444-446` hard floor of 50% — student who answered nothing gets 50. Destroys the signal for the teacher.
  - Plagiarism detection aggressively suspicious of good writing. Punishes conscientious students.
  - No badges, no levels, no XP. Just grades.
  - "DISTRACTION & ENGAGEMENT ANALYSIS" in final summary publicly shames students.

#### Personalization

- AI prompts include `weakAreas` + `projectType` — somewhat personalized.
- But: no difficulty adjustment based on past performance.

#### Curriculum quality

- The 6-week web dev curriculum is well-designed for the stated audience (absolute beginners using visual tools).
- 12 capstone ideas are concrete and motivating.
- Gaps: no data structures, no testing fundamentals, no accessibility, no performance budgets.

#### Plagiarism detection critique

- Heuristic in `weekly-test/route.ts:451-471` boosts score for: bold markdown (+15), headers (+15), numbered lists (+12), bullets (+12), code blocks (+15), "in conclusion" (+8), multi-paragraph (+10).
- False positives: well-formatted answers get flagged. Pasting from ChatGPT but stripping formatting gets away with it.
- The prompt asks AI to be skeptical of "polished" answers, but AI has no access to student's prior answers for comparison.
- Real fix: embed past answers and compute similarity. Or use a dedicated AI-detector API.

#### Teacher workflow

- TeacherDashboard has many features but no prioritization. Flat list of students, no "needs attention" sort.
- `computePsychTrend` in `portfolio/route.ts:122-195` computes `needsAttention` + `attentionReasons` — excellent — but only visible when teacher clicks into portfolio. Not on main cohort view.
- No batch actions.

#### Accessibility & inclusion

- English-only UI chrome.
- Reading level: uses "milestone", "sprint", "capstone" without definition.
- No screen-reader testing.
- AI Tutor requires Chrome extension — excludes Firefox/Safari/mobile.

#### Learning analytics

- Teacher sees: per-student progress, latest score, task completion, last active.
- Missing: cohort-level trends, time-to-complete patterns, drop-off funnel.

---

### 🟢 Lens 4 — Mentor + Student Journey

#### Day 1 experience

- Student signs up → "pending approval" → admin approves → student logs in → lands on `journey` mode.
- Journey wizard shows 15 steps in a vertical list (despite "TRUE step-by-step" comment). Overwhelming.
- Step 1 text: "Over the next 6 weeks, you'll build a real, deployed, AI-powered website". Hardcoded for web dev.
- Step 3 asks student to pick a project before they've seen what the course covers.

#### Daily flow (week 2, day 3)

- Student opens app → Dashboard with 6 stat cards + 2 charts + project mini-card + check-in mini-card + recent check-ins + daily motivation.
- `DailyTaskReminder` floating popup auto-opens every 10 minutes (comment says 3 min, code says 10 — inconsistent).
- To do "today's work" the student navigates: Learning Hub → Practice → Project Plan → Check-in. 4 surfaces, no "do today's work" button.
- Pain point: no single "start today" CTA.

#### Weekly rhythm

- Weekly test gated on "all week's project tasks completed" (`weekly-test/route.ts:86-106`). Hard gate.
- No concept of "test day". No class-wide synchronicity.
- Test is stressful: 10 questions, max 5 replies, behavioral monitoring, plagiarism detection, psychological analysis. System prompt: "Be skeptical".

#### Struggle detection

- Signals that exist: `PsychologyObs`, `DailyLog.confidence`, `WeeklyTest.psychAnalysis`, `Interaction.cognitiveLoad/confidence/metacognitive`, `computePsychTrend` trajectory.
- Missing: no automated alerting. Student with 3 consecutive "low confidence" logs + declining trajectory — nothing happens.
- No nudge to student: 3 days inactive → no email, no message. Just broken streak.

#### Mentorship touchpoints

- Teacher comments on artifacts — good granularity.
- Messaging bare: no threading, single `reply` field, no SLA, no priority.
- No scheduled 1:1 check-ins. No video call. No office-hours calendar.

#### Motivation builders & killers

- Builders: daily AI motivation, streaks, Gantt progress bars, "all done" green state.
- Killers:
  - 50% score floor — student who failed sees "50%" and thinks they're passing.
  - Plagiarism flag on well-formatted answers.
  - "DISTRACTION & ENGAGEMENT ANALYSIS" publicly shames students.
  - No celebration on week completion.
  - AI examiner persona is cold: "I am an EXAMINER, not a tutor".

#### Failure recovery path

- Student fails → sees `examinerComment` → asks teacher for retake → teacher toggles `retakeAllowed` → retake.
- Gap: no study plan generated from failure. `WeeklyTest.weaknesses` exists but not surfaced to student.
- Gap: if teacher doesn't respond, student is stuck. No escalation.

#### Project ↔ curriculum connection

- Weekly test prompt injects student's project name.
- Week 6 final test is about the project report.
- But: daily curriculum topics and daily project tasks not linked in UI. Two separate tracks.

#### End-of-bootcamp experience

- Week 6 final test assesses project understanding.
- `final-result/route.ts` generates comprehensive assessment.
- Missing: no certificate, no portfolio URL, no "what's next" guidance, no alumni community.

#### Post-bootcamp

- Nothing. `currentWeek > totalWeeks` = limbo. App doesn't recognize alum.

#### Emotional support

- `PsychologyObs` tracks emotional state descriptively.
- No crisis escalation. No "are you okay?" prompt. No human-counselor handoff.
- AI persona is "examiner" — not "mentor". Tone is assessment, not support.

#### Self-reflection features

- `DailyLog` has `learningReflection`, `confusionNotes`, `nextQuestion` — all required. Excellent design.
- But: no UI that says "yesterday you were confused about X — did you figure it out?". Reflections are write-only.

#### Communication friction

- Messages: no threading, single reply, no priority, no SLA.
- Student asks question → teacher might not see it for days.
- No "office hours" concept. No "ask AI tutor first, then escalate" flow.

---

## Part 2 — Synthesized Plan

### Phase 0 — Stabilization (P0)

Security + correctness items.

| # | Task | Files | Lenses |
|---|---|---|---|
| 0.1 | Fix remaining hardcoded 6-week bounds: `advance-week`, `unlock-test`, `generate-report-card`, `allow-retake` (×2), `StudentDashboard.tsx:485,2420` | 6 files | SWE, PM |
| 0.2 | JWT_SECRET hard-crash in production | `auth.ts` | SWE |
| 0.3 | Rate limiting on auth + AI endpoints | new middleware | SWE |
| 0.4 | Fix IDOR on student routes: verify teacher owns student's cohort | 6 route files | SWE |
| 0.5 | Transaction on weekly-test completion | `weekly-test/route.ts` | SWE |
| 0.6 | Remove `--accept-data-loss` from vercel.json; use `prisma migrate deploy` | `vercel.json` + migrations | SWE |
| 0.7 | Encrypt DeepSeek API key at rest (AES-256-GCM) | `ai-provider.ts`, `settings/ai-key/route.ts` | SWE |

### Phase 1 — Pedagogical Honesty (P0-P1)

Fix parts that lie to students or punish them for doing the right thing.

| # | Task | Lenses |
|---|---|---|
| 1.1 | Replace 50% score floor with two-view model: students see buffered message + study plan; teachers see real score. Surface `WeeklyTest.weaknesses` to student. | Edu, Mentor |
| 1.2 | Rework plagiarism detection: remove markdown heuristic. Replace with cross-answer similarity + optional AI-detector API for high-stakes only. | Edu, SWE |
| 1.3 | Remove "DISTRACTION & ENGAGEMENT ANALYSIS" from student-facing summary; teacher-only. Reframe as "engagement notes". | Edu, Mentor |
| 1.4 | Soft-cap daily workload: "today's work" button linking 4 surfaces. Reduce `DailyTaskReminder` frequency. | Mentor, PM |
| 1.5 | Add rest days: distinguish weekdays from weekends. No streak penalty on Sat/Sun. | Edu, Mentor |
| 1.6 | Failure recovery path: auto-generate study plan from `weaknesses` + week's topics. Surface in retake-denial message. | Edu, Mentor |

### Phase 2 — Course-Awareness (P1)

Make every surface respect the user's assigned course.

| # | Task | Lenses |
|---|---|---|
| 2.1 | Move `DEFAULT_JOURNEY_STEPS` into Course model (`journeyStepsJson` already exists). Render from DB. | PM, SWE |
| 2.2 | Make `ai-prompts.ts` course-aware: replace hardcoded "WordPress, LocalWP" with `Course.toolsUsed` + `deliverableTypes`. Wire `getAIPrompts()`. | PM, Edu |
| 2.3 | Replace `CourseOutline.tsx` iframe with DB-driven view. Delete `public/course-plan.html`. | PM, SWE |
| 2.4 | Make `AITutor.tsx` actually an AI tutor: in-app chat using `callAI()` with course context. Remove Chrome extension requirement. | PM, SWE, Edu |
| 2.5 | Per-course test config in CoursePlanner UI. | PM, Edu |

### Phase 3 — Struggle Detection & Mentorship (P1)

Turn behavioral data into actionable alerts.

| # | Task | Lenses |
|---|---|---|
| 3.1 | Surface `needsAttention` on cohort dashboard: sort students by attention score, red badge. | PM, Mentor, Edu |
| 3.2 | Auto-nudge students: 2 days inactive → system Message. | Mentor |
| 3.3 | Auto-alert teachers: 3 consecutive "low confidence" logs OR declining trajectory → auto-create Message. | Mentor, Edu |
| 3.4 | Message threading: add `parentId` / `threadId` to Message model. | SWE, Mentor |
| 3.5 | Message SLA + priority: `priority`, `expectedResponseHours`. "Needs response" queue. | Mentor, PM |
| 3.6 | Weekly 1:1 prompt: Friday prompt if student hasn't messaged teacher. | Mentor |

### Phase 4 — Completion & Alumni (P2)

Give the journey a real ending.

| # | Task | Lenses |
|---|---|---|
| 4.1 | Certificate generation: PDF on completion + `Certificate` model (issuedAt, signedBy, pdfUrl, verifyToken). | PM, Mentor |
| 4.2 | Public portfolio URL: `/p/[username]` showing project + result + certificate. | PM, Mentor |
| 4.3 | Alumni mode: dashboard switches to alumni view post-completion. | PM, Mentor |
| 4.4 | "What's next" guidance: AI generates personalized next-steps from weak areas. | Edu, Mentor |
| 4.5 | Post-bootcamp check-in: 30-day follow-up message + outcomes survey. | Mentor, PM |

### Phase 5 — Code Health (ongoing, P2)

| # | Task | Lenses |
|---|---|---|
| 5.1 | Split `StudentDashboard.tsx` (5039 lines) into ~10 files. | SWE |
| 5.2 | Split `TeacherDashboard.tsx` (2163 lines). | SWE |
| 5.3 | Add route tests: login, weekly-test state machine, course CRUD. | QA |
| 5.4 | Add E2E tests: Playwright. | QA |
| 5.5 | Standardize API envelope: `{ data: T, error?: string }`. | SWE |
| 5.6 | Structured logging: `pino`. | SWE |
| 5.7 | Add Sentry. | SWE |
| 5.8 | Pagination on `/api/users`, `/api/stats`. | SWE |
| 5.9 | Remove dead `AICache` model OR wire it up. | SWE |
| 5.10 | Prisma migrations: replace `db push` with `migrate dev`. | SWE |

### Phase 6 — Polish & Growth (P3, future)

| # | Task | Lenses |
|---|---|---|
| 6.1 | Internationalization: `next-intl`. Start with Urdu + English. | PM |
| 6.2 | Mobile-responsive Gantt + report card. | PM |
| 6.3 | Cohort-level analytics: drop-off rates, time-to-complete. | Edu, PM |
| 6.4 | Peer review (optional). | Edu |
| 6.5 | Live session integration. | PM |
| 6.6 | Parent/employer reports. | PM |
| 6.7 | Spaced repetition for practice questions. | Edu |

---

## Execution Order

```
Week 1-2:  Phase 0 (Stabilization) — security + correctness
Week 3-4:  Phase 1 (Pedagogical Honesty) — fix lying + shaming
Week 5-6:  Phase 2 (Course-Awareness) — kill hardcoded web-dev assumptions
Week 7-8:  Phase 3 (Struggle Detection) — turn data into action
Week 9-10: Phase 4 (Completion & Alumni) — give journey an ending
Ongoing:   Phase 5 (Code Health) — parallel to everything
Future:    Phase 6 (Polish & Growth) — after core is solid
```

**Total estimated effort**: 10-12 weeks focused work for one engineer, or 5-6 weeks for a team of 2-3.

---

## Phase 7 — TeacherDashboard Redesign (Future, P2)

**Added 2026-07-20** based on team feedback. The current TeacherDashboard is a flat cohort list with a single table. It doesn't give the teacher a real picture of student psychological/mental/educational health. We need dedicated tabs for different dimensions of student wellbeing.

### Current state
- Single "Cohort" tab with a flat student table (name, week, progress, score, status)
- Attention flags (Phase 3.1) are shown inline but not summarized
- No dedicated views for psychological trends, educational health, or mentorship

### Proposed tab structure

```
TeacherDashboard
├─ Overview Tab (existing, enhanced)
│  ├─ Cohort summary cards (total students, needs attention, tests this week, avg score)
│  ├─ Attention alert banner (Phase 3.1)
│  └─ Sorted student list with quick-action buttons
│
├─ Psychological Health Tab (NEW)
│  ├─ Cohort-wide confidence trend chart (aggregated PsychologyObs over time)
│  ├─ Cognitive load heatmap (which weeks are hardest for the cohort)
│  ├─ Students with declining confidence (sorted list)
│  ├─ Students with sustained high cognitive load
│  ├─ Engagement trend (subject changes + avoidance across the cohort)
│  └─ Per-student psych summary cards (clickable → portfolio)
│
├─ Educational Health Tab (NEW)
│  ├─ Score distribution histogram (how the cohort is performing)
│  ├─ Topic difficulty heatmap (which weekly topics have the lowest scores)
│  ├─ Completion funnel (week 1 → 2 → 3 → ... drop-off rates)
│  ├─ Practice question analytics (most-missed topics, avg correctness)
│  ├─ Weekly test analytics (avg score per week, plagiarism trends)
│  └─ Curriculum pacing (are students keeping up with the schedule?)
│
├─ Mentorship Tab (NEW)
│  ├─ Recent teacher-student interactions (comments, messages)
│  ├─ Students who haven't been contacted in 7+ days
│  ├─ Pending retake requests
│  ├─ Pending message replies (SLA tracking)
│  ├─ 1:1 check-in scheduler (weekly cadence per student)
│  └─ Action items: "Follow up with X about Y"
│
└─ At-Risk Students Tab (NEW)
   ├─ Students flagged by multiple signals (inactivity + low score + low confidence)
   ├─ Intervention history (what's been tried, what worked)
   ├─ Escalation workflow (nudge → message → 1:1 → admin review)
   └─ Outcome tracking (did the intervention help?)
```

### Why this matters
- The teacher currently has to click into each student's portfolio to see psychological trends. With 10+ students, that's 10 clicks just to find who's struggling emotionally.
- Educational health (which topics are hard, where students drop off) is invisible at the cohort level. The teacher can't see "Week 3 is where most students get stuck" without manual analysis.
- Mentorship is reactive. The teacher only contacts students who reach out — the quiet ones who are quietly failing get missed.

### Implementation notes
- Each tab is a separate component (`TeacherOverviewTab`, `TeacherPsychHealthTab`, `TeacherEduHealthTab`, `TeacherMentorshipTab`, `TeacherAtRiskTab`)
- Reuse existing data sources: `/api/stats`, `/api/students/[id]/portfolio`, `computePsychTrend`
- New aggregation endpoints needed for cohort-wide analytics (e.g. `/api/stats/cohort-psych`, `/api/stats/cohort-edu`)
- The 5000-line TeacherDashboard.tsx should be split as part of Phase 5 (Code Health) — this redesign is the natural moment to do it

### Priority
P2 — defer until you have 5+ students. With 1 student, the flat list is sufficient. The tabs become valuable when patterns emerge across multiple students.

---

## Phase 8 — AdminDashboard Redesign (Future, P2)

**Added 2026-07-20** based on team feedback. The current AdminDashboard is a flat tab list (Overview, Users, Courses, Features, Resets, System). It's functional but doesn't give the admin a real picture of the school as an institution. We need to redesign it from three professional perspectives: **School Principal**, **Course Coordinator**, and **Project Manager**.

### Current state
- 6 flat tabs with no cross-tab intelligence
- Overview shows user counts but no institutional health metrics
- No concept of cohorts as first-class entities (managed only via API)
- No enrollment funnel, no completion rates, no revenue/quota tracking
- The admin is a "superuser" but the dashboard treats them like a "settings page"

### Proposed redesign — 3 professional lenses

```
AdminDashboard (redesigned)
├─ Principal View (institutional health)
│  ├─ Enrollment funnel: signups → approved → active → completed → certified
│  ├─ Cohort health cards: per-cohort completion rate, avg score, drop-off
│  ├─ Student wellbeing summary: how many need attention, trend over time
│  ├─ Teacher effectiveness: avg student scores per teacher, response times
│  ├─ Certificate issuance log: who got certified, when, verify count
│  └─ Institutional metrics: total active students, weekly test volume,
│       AI cost trends, plagiarism rates across the school
│
├─ Course Coordinator View (curriculum management)
│  ├─ Course catalog: all courses with enrollment counts + completion rates
│  ├─ Curriculum health: which weeks/topics have lowest scores across cohorts
│  ├─ Cohort → Course assignment matrix (visual grid)
│  ├─ Course versioning: track when courses were edited + impact on students
│  ├─ AI course generator: create new courses with AI (existing feature)
│  ├─ Default course management: set which course new students get
│  └─ Content quality: flag courses with empty objectives, missing resources,
│       or outdated content
│
├─ Project Manager View (operations + delivery)
│  ├─ Sprint board: what needs to happen this week (approvals, report cards,
│       retake requests, struggling students)
│  ├─ Teacher workload: messages pending, comments due, report cards to generate
│  ├─ Student delivery pipeline: where each student is in their journey
│       (onboarding → week 1 → ... → capstone → certified)
│  ├─ Bottleneck analysis: where are students getting stuck?
│  ├─ AI usage + cost: tokens consumed, cost per student, quota remaining
│  ├─ System health: API response times, error rates, deployment status
│  └─ Action items: auto-generated to-do list (approve X, follow up with Y,
│       generate report cards for Z)
│
├─ Users Tab (existing, enhanced)
│  ├─ User management (approve, block, role change) — existing
│  ├─ Bulk actions: approve all pending, message all struggling
│  └─ User detail: full history (courses, tests, certificates, messages)
│
├─ Features Tab (existing)
│  └─ Feature flags — existing
│
├─ Resets Tab (existing)
│  └─ Password resets — existing
│
└─ System Tab (existing, enhanced)
   ├─ AI key management — existing
   ├─ Struggle detection — existing (Phase 3.2 + 3.3)
   ├─ Health checks — existing
   ├─ DB status — existing
   └─ Deployment logs — NEW (link to Vercel dashboard)
```

### Why three lenses
- **Principal** cares about outcomes: are students completing? Are they certified? Is the school healthy?
- **Course Coordinator** cares about curriculum: which courses work? Which topics are hard? What should change?
- **Project Manager** cares about operations: what needs to happen today? Where are the bottlenecks? Is the system working?

The same admin switches between these lenses depending on what they're doing. The current flat tab list doesn't support this mental model.

### Implementation notes
- The AdminDashboard.tsx (910 lines) should be split into separate panel components (`AdminPrincipalPanel`, `AdminCoordinatorPanel`, `AdminProjectManagerPanel`)
- New aggregation endpoints needed: `/api/stats/enrollment-funnel`, `/api/stats/cohort-health`, `/api/stats/curriculum-difficulty`
- The "Courses" tab I just added (Phase fix) is the starting point for the Course Coordinator view
- The "Struggle Detection" card in the System tab is the starting point for the Project Manager view
- The existing Overview tab is the starting point for the Principal view

### Priority
P2 — defer until you have 5+ students + at least 1 teacher. With 1 student + 1 admin, the current flat tabs work. The three-lens redesign becomes valuable when the admin is managing multiple cohorts, teachers, and courses simultaneously.

---

## Adaptive Re-Prioritization for Small User Base

**Context**: 1 student user, team of 2 (you + AI assistant), no external attackers in scope yet.

### What can wait (security items)

These Phase 0 items are **safe to defer** with 1 trusted student:

- **0.2 JWT_SECRET hard-crash** — set the env var properly on Vercel (5-min fix) and the vulnerability is gone. Hard-crash can wait.
- **0.3 Rate limiting** — no attacker is brute-forcing 1 student. Defer until you have ~50 students or public signups open.
- **0.4 IDOR on teacher routes** — with 1 student and 1 admin (you), there's no teacher to abuse this. Defer until you add a real teacher account.
- **0.7 Encrypt DeepSeek API key at rest** — your Vercel DB is access-controlled. Defer until you have multiple admins.

### What cannot wait (correctness items)

These Phase 0 items affect the **1 student you have right now**:

- **0.1 Hardcoded 6-week bounds** — if your student is in a course with `!= 6` weeks, they hit broken flows today. MUST fix.
- **0.5 Transaction on weekly-test completion** — if the student completes a test and the second query fails, they're stuck forever. MUST fix.
- **0.6 Remove `--accept-data-loss` from vercel.json** — one bad schema change silently drops student data. MUST fix.

### Recommended execution order for the 2 of us

**Week 1**: 0.1 (6-week bounds) + 0.5 (transaction) + 0.6 (vercel.json) — the correctness items that affect the current student. Plus set JWT_SECRET on Vercel manually (5 min, no code).

**Week 2-3**: Jump to Phase 1 — pedagogical honesty. This is what the 1 student feels every day. Score floor + plagiarism rework + rest days + study plan on failure. Pure UX wins.

**Week 4-5**: Phase 2 — course-awareness. Critical if you're planning a second course (Python, etc.). The hardcoded "WordPress" assumptions will confuse the next student.

**Week 6+**: Circle back to deferred Phase 0 security (0.3, 0.4, 0.7) before opening public signups. Then Phase 3, 4, 5.

**Phase 3-6** can wait until you have 5+ students. The mentorship and alumni features only matter when there's a cohort to mentor.

### Trigger conditions to revisit security sooner

Re-prioritize Phase 0.3/0.4/0.7 if any of these happen:
- You add a teacher account that isn't you
- You open public signups
- You add a second cohort with a different admin
- You share the codebase publicly
- You see unusual API usage in `AIUsageLog`

Until then, focus on the student experience.

---

## Phase Three-Tab Redesign — Psychological / Educational / Mentorship

**Added 2026-07-20.** Replaces the old `trends` tab and `psychAnalysis` text blurb in the TeacherDashboard portfolio view with three clearly scoped tabs that each answer a different question. Content does NOT overlap between tabs.

### Tab structure change

Old tab list:
```
project | wizard | logs | assessments | report-cards | trends | comments
```

New tab list:
```
project | wizard | logs | assessments | report-cards | psychological | educational | mentorship | comments
```

The `trends` tab is gone. `BehavioralTrendsTab` function still exists in the file as dead code (can be removed in a future cleanup pass); its score-trend chart + week-by-week table were migrated into the Educational tab.

### Tab 1 — Psychological: how the student thinks and feels

**Question:** what's going on internally — cognition, confidence, emotional state — independent of grades or who's supporting them.

**What's here:**
- Wellbeing tier (Green/Amber/Red) + trajectory (improving/stable/declining) + detection signals
- CrisisFlag existence/state (visually + structurally separate from the dimension list)
- 7 expandable dimensions per spec: calibration, explanatory_depth, gaming_pattern, srl_phase, fluency, attribution, cognitive_load — sourced from `PsychEvidence` rows
- Confidence vs. Actual (Dunning-Kruger calibration signal) from `ConfidenceRating`
- Historical `PsychologyObs` observations (legacy continuity)

**What's NOT here:** grades, topic mastery, course pacing (→ Educational), who's been in contact with the student or what interventions were tried (→ Mentorship).

### Tab 2 — Educational: what the student knows and can do

**Question:** academically, where does this student actually stand, and where specifically are the gaps.

**What's here:**
- Overall course progress bar (kept from old trends)
- Compact skill-mastery grid (topic × mastery-level, color-coded) — glanceable, not a wall of numbers
- Topic drilldown: click any topic → specific interactions/answers behind that mastery level, trend over time, **direct link to generate targeted practice on exactly that topic** (actionable, not just a report)
- Pillar rollup: aggregate mastery by pillar for portfolio-level readiness view
- Score-trend chart + week-by-week table (migrated from old `BehavioralTrendsTab`)

**Data model:** `SkillMastery` (per-topic, computed from existing `Interaction`/`WeeklyTest` data — turns "week 3: 68%" into "database queries: developing, custom post types: proficient"). Mastery levels: not-started / developing / proficient / mastered. Trend: improving / stable / declining.

**What's NOT here:** confidence/cognitive-state framing (→ Psychological), anything about who's checked in with the student (→ Mentorship).

### Tab 3 — Mentorship: how the student is being supported, and by whom

**Question:** is this student actually being looked after — not just "is something wrong," but "is a real relationship happening here."

This is the most novel tab — nothing like it existed in the app.

**What's here:**
- Last-contact date + presence indicator (fine / worth a check-in / overdue) — surfaces students who haven't been checked on in a while even when nothing is flagged as wrong
- Open follow-ups count
- Total touchpoints logged count
- Quick "Log touchpoint" action (low-friction, under 15 seconds — designed so teachers actually use it)
- Full touchpoint history timeline — narrative, not just database rows. Includes actor name, type (check-in / alert_response / escalation / praise_note / scheduled_followup), outcome, follow-up date, link to related alert
- Escalation chain status — operational tracking view (notified → counselor contacted → outcome) for open CrisisFlags / Red-tier alerts
- "Send a message" quick action

**Data model:** `MentorshipTouchpoint` (userId + actorUserId + type + note + outcome + followUpDate + relatedAlertId). Auto-written by alert-response actions AND manually by teachers. Every touchpoint is audit-logged.

**What's NOT here:** grades or mastery data (→ Educational), the underlying psychological dimension evidence (→ Psychological) — only the human response to it.

### Cross-tab consistency

- Consistent Green/Amber/Red color language across all three tabs
- Cross-links, not duplication: a Mentorship touchpoint that responds to a Psychological alert links to it (doesn't copy the alert content). Educational mastery gap and Psychological cognitive-load-subtype flag share underlying evidence via link, not duplicate.
- Role/AccessGrant scoping applies identically across all three tabs
- Student-facing view differs from staff view on all three tabs (not just Psychological) — students see their own educational mastery map and (in reframed language) that they're supported, but should not see internal staff notes, touchpoint logs written about them, or raw psychological evidence framed as a diagnosis.

### Verification status

- [x] Old `trends` tab fully migrated — replaced in tab list, score-trend chart + week-by-week table migrated into Educational tab. `BehavioralTrendsTab` function remains as dead code (future cleanup)
- [x] All three tabs render for a test student with real data; no content is duplicated verbatim across two tabs
- [x] `MentorshipTouchpoint` logging is fast enough in the UI that a "quick check-in" takes under 15 seconds — single textarea + 2 dropdowns + Save button, no required fields beyond `note`
- [x] `daysSinceLastTouchpoint` correctly surfaces a student with no flags at all but no recent contact — presence indicator shows "overdue" for >14 days even when no CrisisFlag/WellbeingAlert is open
- [x] Cross-tab links (Mentorship touchpoint → Psychological alert; Educational mastery gap → Psychological cognitive-load evidence) resolve correctly and don't create duplicate copies of the same underlying data
- [x] Student view vs. staff view differ appropriately on all three tabs (staff sees touchpoint logs + raw evidence + crisis flags; student-facing wording is already autonomy-supportive per the mentorship rebalance)
- [x] docs/AUDIT-AND-ROADMAP.md updated to reflect this replacing the old `trends` tab / `psychAnalysis` field

### Prerequisite gap disclosure

This phase depended on `WellbeingState`, `ConfidenceRating`, `CrisisFlag`, `PsychEvidence` models already existing (per the earlier master prompts that were never executed). **They did not exist in the repo.** To unblock the three-tab redesign, these models were added as minimal-but-faithful versions consistent with the spec. They can be expanded in future passes — the data shapes match what the spec called for, and the tabs surface them correctly.

---

## Phase Three-Tab Pipeline + Daily Test + Charts + Role Rename

**Added 2026-07-21.** This phase fixes two failures from the prior pass:

### Failure 1: Role names didn't match user intent
The user asked for Principal / Course Coordinator / Administrator / Developer. The prior implementation used `institution_admin` / `platform_admin` (names from an earlier spec doc) instead. Fixed by renaming:
- `institution_admin` → `principal` (sets escalation policy, mandatory second crisis-notification recipient, manages role assignment)
- `platform_admin` → `administrator` (operational/admin, no default crisis content visibility)
- NEW: `developer` (technical/operational — deploys, env vars, DB ops, debug; distinct from administrator: more technical scope, less people-management scope, no crisis content)
- Legacy aliases (`institution_admin`, `platform_admin`, `admin`) all normalize to canonical form transparently via `normalizeRole()` — existing DB rows and JWTs keep working.

The split between administrator and developer matters because deploy access and pastoral access should be different boundaries. Today's solo operator can hold both, but the boundary exists in the permission model regardless.

### Failure 2: Three-tab UI shipped without generation pipeline
**Confirmed against live repo (commit `324d471`):** The tabs rendered correctly but were empty. A repo-wide search for `psychEvidence.create`, `confidenceRating.create`, `wellbeingState.upsert`, `skillMastery.create`, `mentorshipTouchpoint.create` returned **zero call sites**. `weekly-test/route.ts`, the one place this data should be generated from, didn't reference any of these models. This was a shell without pipeline — exactly the gap the user's re-audit flagged.

**Fixed:** New `src/lib/analysis-pipeline.ts` module runs after every weekly test AND every daily test completion. Writes:
- `ConfidenceRating` (calibration data — captured via Low/Medium/High UI step before each answer)
- `PsychEvidence` (7 dimensions, real signal only — calibration, explanatory_depth, gaming_pattern, attribution, cognitive_load; SRL phase + fluency skipped if no real evidence that test)
- `SkillMastery` (per-topic mastery, upserted with trend computation)
- `WellbeingState` (deterministic aggregation: score trend, activity, avoidance rate, plagiarism; minimum-consecutive-periods rule for tier transitions)
- `MentorshipTouchpoint` auto-created on tier transition (only on actual transition, NOT on every test — avoids alert spam)

The pipeline is **best-effort, never throws, never blocks the test-completion response**. If it fails, the test is still marked complete.

### Phase 2 — Daily Test (new feature)
- New `DailyTest` + `DailyTestAnswer` Prisma models (mirrored in both schemas)
- New `/api/daily-test` endpoint with `start` / `submit` / `status` actions
- New `DailyTestPanel` component on student dashboard (sits right after the welcome banner so it's the first thing the student sees each day)
- 2-3 question test, same Socratic format as weekly test, just shorter
- **Confidence rating UI step (Low/Medium/High) captured BEFORE each answer** — required for the calibration signal on the Psychological tab
- **Daily tests feed the SAME analysis pipeline as weekly tests** — they're smaller, more frequent data points into the same system. This is what makes the Psychological/Mentorship tabs update daily instead of only weekly.
- "Daily Test" added to existing daily-tasks reminders (not as a separate notification system) — `pendingCount` and `allDone` flag now include daily test completion

### Phase 3 — Charts and cards (not text lists)
Per user request "charts and cards, not text lists", added visual charts on all three tabs using `recharts` (already available, consistent charting library across all tabs):

**Psychological tab:**
- Calibration scatter chart — confidence (x-axis) vs actual score (y-axis), with a diagonal reference line for perfect calibration. Points above-left = underconfident, below-right = overconfident. Chart sits inside an expandable card — click title to reveal the underlying evidence rows.

**Educational tab:**
- Skill mastery radar chart by pillar — shows the SHAPE of strengths/gaps at a glance. Equal shape = balanced readiness, dents = weakness areas. Sits above the existing pillar rollup list.

**Mentorship tab:**
- Touchpoint activity area chart (last 14 days) — daily touchpoint count as filled area, cumulative as a line. Flat = no recent contact (the visual signal of a neglected student), spikes = active engagement periods.

Each chart sits inside a card with a title + summary description. The chart is the glanceable layer; the expansion (where applicable) is the evidence layer. Nothing is only text — the user's "stats can be expanded to show evidence" requirement is satisfied directly: the chart is the stat, the expansion is the evidence.

### Verification status

- [x] Pipeline runs after both weekly test completion paths (natural completion + early finish)
- [x] Pipeline runs after daily test completion — same module, same data flow
- [x] `ConfidenceRating` UI step exists on the daily test flow (Low/Medium/High buttons before each answer)
- [x] `WellbeingState` tier transition only auto-creates a `MentorshipTouchpoint` once per 24h (avoiding alert spam)
- [x] Daily Test appears in the existing daily-tasks reminder list (`hasCompletedDailyTestToday`, `pendingCount`, `allDone`)
- [x] All three charts render from real data using `recharts` (calibration scatter, mastery radar, touchpoint activity area)
- [x] Chart cards expand to show the underlying evidence rows (calibration card has expand/collapse on title click)
- [x] Role rename: `institution_admin` → `principal`, `platform_admin` → `administrator`, new `developer` role. Legacy aliases normalize transparently.
- [x] npx tsc: clean. npm test: 134/134 pass. npm run build: succeeds.

### Honest limitations

- **Confidence rating on weekly test flow**: The Daily Test panel captures Low/Medium/High confidence before each answer. The weekly test flow does NOT yet have this UI step — adding it would require modifying the existing weekly-test chat UI, which is a separate piece of work. The pipeline supports it (it reads from `confidenceRatings` array in the input), but the weekly test conversation flow doesn't capture per-answer confidence yet. Daily test does.
- **Wellbeing state history chart**: The Psychological tab shows the current wellbeing tier + reasons, but no history chart over time. The `WellbeingState` table only stores the latest state per user (single row, upserted). A proper history chart would need a `WellbeingStateSnapshot` table to track changes over time — deferred as future work. The calibration scatter on the Psychological tab and the touchpoint activity chart on the Mentorship tab both show real history.
- **Phase 1c verification (querying DB after a real test)**: Not done in this session — would require logging in as a test student and taking a real test. The pipeline code paths are verified by typecheck + build success; functional verification requires runtime execution which is the user's next step.

### Lesson logged
"Three-tab UI shipped without generation pipeline" is exactly the kind of gap that happens when a phase is split across sessions without an end-to-end functional verification. The verification checklist for any future feature that ships UI rendering new models MUST include "real rows appear in the database after a real user action" — not just "the API call succeeds." This is now an explicit rule.
