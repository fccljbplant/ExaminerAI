# Design Decisions — TraineesAI Learn Platform

## D-001: Today's Topic Flow (2026-08-11)
**Decision:** Slides are NOT pre-baked as part of the course. AI auto-generates slides on-the-go for each day's topic.
**Rationale:** User directive — "Don't make slides part of the course. AI will auto-generate slides on the go in today's topic."
**Implementation:** `SLIDES_PER_TOPIC = 4` (fixed). Topic source: `WEEKLY_TOPICS` (6 weeks × 5 days = 30 topics). Progress stored in `LearnProfile.masteryMap.topicProgress` JSON blob — no migration needed.

## D-002: Route Structure
**Decision:** `/learn` = learner home (Continue hero + stats). `/learn/:courseId` = session (h-screen shell). `/dashboard` → 301 redirect to `/learn`. `/login` → 301 redirect to `/app` (existing auth UI).
**Rationale:** Spec Section 0.1-0.3. Old platform (`/app`) keeps working as the admin/instructor/employer dashboard. Learners use `/learn`.

## D-003: Auth Model
**Decision:** Keep existing auth at `/app` (AppShell renders Login when unauthenticated). Add `/login` and `/register` as 301 redirects to `/app` for spec compliance.
**Rationale:** Spec Section 0.1 requires canonical routes. Existing auth works — no need to rewrite.

## D-004: Global Header
**Decision:** Create a `PublicHeader` component mounted in `(public)/layout.tsx`. Shows: logo, Browse courses, Sign in, Get started. When authenticated: "My learning" + account menu.
**Rationale:** Spec Section 0.2. Currently each page renders its own header — inconsistent.

## D-005: h-screen Shell
**Decision:** `/learn/:courseId` uses `h-screen overflow-hidden` — no vertical page scroll. All scrolling happens inside isolated panes (slide canvas, chat transcript, panels).
**Rationale:** Spec Section 9.1 + anti-junk law #5.

## D-006: Avatar System
**Decision:** Use the user-provided `TutorAvatar.tsx` (sprite player + amplitude lip-sync + event bus + floating dock). Procedural placeholder until real sprite strips exist.
**Rationale:** Spec Section 8. User provided complete implementation.

## D-007: TTS Filter
**Decision:** `prepareForTTS()` strips code blocks, URLs, tables, and markdown. Replaces with spoken descriptions ("I've included the code snippet in the chat window below.").
**Rationale:** Spec Section 8.5.

## D-008: Platform Knowledge Base
**Decision:** Hardcoded KB for billing, refunds, enrollment, certificates, navigation, privacy. Chat answers course AND platform questions.
**Rationale:** Spec Section 3.2.

## D-009: No New Dependencies
**Decision:** Use only existing dependencies (Next.js, Prisma, lucide-react, sonner, zod, etc.). No new npm packages.
**Rationale:** Anti-junk law #8.

## D-010: XP Amounts (Spec Section 7.1)
- slide +5; probe +10; quiz +15 (+5 first-try); lesson +50; module +150; course +500
- perfect quiz +100; level raised +75; streak day +20; session +25
- daily test +30; weekly test +100; badge → xp_bonus

## D-011: Learner Levels (Spec Section 7.2)
0 Rookie / 100 Learner / 300 Scholar / 700 Specialist / 1500 Expert / 3000 Master / 7000 Legend

## D-012: Enrollment Atomicity (Spec Section 1.1)
**Decision:** POST /api/learn/enroll atomically creates: LearnProfile + JourneyPlan (with full 30 topic-steps) + StudentProject (with 4 milestones). All in a Prisma transaction.
**Rationale:** Spec Section 1.1. Anti-junk law #4 (no "not found" in normal flows).

## D-013: Coding Standards Compliance (2026-08-11)
**Decision:** All learn module code follows `docs/CODING-STANDARDS.md` strictly.
**Compliance verified:**
- §1.1 Module pattern: `src/modules/learn/` with `index.ts` + `lib/` + `types/` — no React in lib
- §2.1 No `any`: all `as any` replaced with `as unknown as Prisma.InputJsonValue` for JSON fields
- §3.1 No silent catches: all `catch {}` replaced with `catch (err) { logger.warn(...) }`
- §5.1 No hardcoded colors: all `text-emerald-500` etc. replaced with theme tokens (`text-growth-sage` etc.)
- §7.1 File headers: every file starts with `// path/to/file — description`
- §6.1 Thin API handlers: routes validate + call lib + return JSON
- §6.2 Auth check first: every route starts with `getAuthUser()`

## D-014: No New Dependencies (Spec Anti-Junk Law #8)
**Decision:** The learn platform adds zero new npm dependencies. Uses only:
- Existing `@prisma/client` (Prisma JSON types)
- Existing `sonner` (toast notifications)
- Existing `lucide-react` (icons)
- Existing `@/lib/logger`, `@/lib/db`, `@/lib/auth`, `@/lib/api-client`, `@/lib/api-response`
- Existing `@/modules/assessment/lib/ai-provider` (callAI)
- Existing `@/modules/course/lib/course-topics` (WEEKLY_TOPICS)

## D-015: Test Coverage (Spec Section 10 — commit + green tests each phase)
**Decision:** 123 tests passing across 6 test files.
**Test files:**
- `src/modules/learn/__tests__/today-topic.test.ts` (19 tests — topic picking, next/prev, curriculum integrity)
- `src/lib/__tests__/grading-and-topics.test.ts` (41 tests)
- `src/lib/__tests__/course-validation.test.ts` (26 tests)
- `src/lib/__tests__/course-normalization.test.ts` (20 tests)
- `src/lib/__tests__/auth.test.ts` (8 tests)
- `src/lib/__tests__/logger.test.ts` (9 tests)

## D-016: Batches Removal (2026-08-11)
**Decision:** Removed all `batches`/`cohort` references from `CoursePlanner.tsx`.
**Rationale:** The batches model was already removed from the API (replaced by `CourseEnrollment`), but `CoursePlanner.tsx` still had dead batches code: a `Batch` interface, `batches` state (always empty), `assignBatch` function (calling non-existent `/api/batches/[id]`), cohort assignment UI (hidden when `batches.length === 0`), and a warning banner that never showed. This violated anti-junk law #1 (no dead UI) and #3 (no empty state without helpful CTA).
**What was removed:**
- `Batch` interface
- `batches` field from `Course` interface
- `batches` state + `setBatches([])` call
- `assignBatch` function (called non-existent API endpoint)
- Batches deletion handling (409 response with `assignedBatches`)
- Cohort assignment UI section
- "No batches assigned" warning banner
- "No batches assigned" text in course list view
- "Default Batch" text in set-default success message
- Unused `ApiError` import
**What replaced it:** The course list view now shows domain + level badges (useful information) instead of "No batches assigned" (dead text).

## D-017: Living Portrait Tutor Badge (2026-08-12)
**Decision:** Replaced the baked-3D sprite system with a "Living Portrait" approach — ONE locked face photo + 100% code-driven animation via SVG overlays.
**Rationale:** The baked-3D sprite approach had persistent consistency issues (different faces, sizes, colors per pose) despite multiple regeneration attempts. The Living Portrait approach guarantees 100% consistency because the face photo never changes — only the code-driven overlays (brows, eyes, mouth, FX, mood ring) animate.
**Implementation:**
- ONE locked face photo: `public/assets/avatar/v1/face.png`
- 20 expression recipes in `expressions.json` (idle, hello, talk, listen, think, idea, praise, celebrate, comfort, oops, surprised, wink, determined, laugh, focus, streak, levelup, confused, proud, shy, bye)
- 10-layer anatomy: mood ring → backdrop → face photo → brows SVG → eyes SVG → mouth SVG → FX emoji → props emoji → shine → caption
- Event bus: `tutor.play()`, `tutor.say()`, `tutor.caption()`, `tutor.emit()` — same API as before
- Calibration tool: `public/assets/avatar/v1/calibration.html` — drag reticles to align eyes/mouth/brows for any face photo
- `face-config.json`: pluggable — any real teacher photo works with zero code changes
- Natural blinking (every 3-6s), amplitude-synced mouth while talking, breathing idle
- Mood ring colors per emotion, CSS particles for celebrations, glasses glint on "idea"
- Dock: full/mini/dot modes, drag+snap, auto-shrink, focus dim, reduced-motion
