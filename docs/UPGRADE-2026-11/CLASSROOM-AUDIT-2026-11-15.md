# Classroom Deep Audit & Redesign — 2026-11-15

Scope: `/learn/[courseId]` (the daily learning session) — `ClassroomShell.tsx` (1446 lines), `classroom-chrome.tsx`, `LessonStage`, `VideoStage`, `VoiceBar`, `TopicPicker`, the four `panels/`, and the retired `LearnShell.tsx`.

Method: full read of every file (no sampling), cross-referenced with twelve-rules (`docs/UPGRADE-2026-11/UI-UX-RULES-2026-11-15.md`) and UI-STANDARDS. Findings below are ranked by user harm.

---

## A. Findings (the mess, precisely)

### A1. Two different topic maps for the same data — DEAD CODE + DUPLICATE
`TopicPicker.tsx` (143 lines) and `JourneyPanel` (199 lines) both fetch `/api/learn/topics?courseId=`, render weeks → days with completed/current/locked states, and POST `/api/learn/topics/jump`. Two entry points open them: the header **"Topics"** button opens `TopicPicker`; the rail **"Journey"** button opens `JourneyPanel`. Same API, same states, same jump call — two UIs to maintain and two behaviors to learn. Worse: `JourneyPanel` adds progress rings; `TopicPicker` doesn't. The duplicate was flagged in the W16 notes but never merged.

### A2. The whole avatar bus is dead — ~35 no-op calls in the learning flow
`tutor-bus.ts` still exposes `caption`/`tts`/`play` events, and the shell calls `tutor.play()` ~30 times and `tutor.caption()` for every narration — but **zero components subscribe** (`tutor.on()` has no callers; the sprite rig was removed in W16). Every "the avatar will explain" moment, every gesture cue, every caption emit is a no-op. Learners get *nothing* for those code paths: the promised narration exists only in the code. This is the single biggest honesty gap in the classroom.

### A3. Five overlapping ways to move between slides
1. Numbered dots (`LessonStage` tablist) — jump
2. `ChevronLeft`/`ChevronRight` in the QuickBar — step
3. "Next slide" CTA (generates + advances)
4. "Prev topic" button (jump to previous topic)
5. Slide dots again inside the slide footer ("Slide X of Y")
Hick's law violation: five controls where two suffice. The footer count and the dots say the same thing twice.

### A4. Duplicate chat CTAs with different behavior
QuickBar "Ask AI" copies `checkQuestion` into chat input + focuses it; header area has none, but the chat rail sits *always visible on desktop* — so on md+ "Ask AI" is a third way to reach a control the learner can already see and click. Meanwhile "Notes" opens the Library panel (same as the rail's "Library" button) — a duplicate of the rail in the QuickBar.

### A5. `ClassroomShell.tsx` is a 1446-line monolith
State (23 `useState`/refs), six post-stages, three drawers, chat, video, slides, stepper, project stage, check-in stage, coach marks — one file. Unmaintainable: any change risks unrelated regressions (the off-by-one slide bug at line 349 proves it). The sub-components (`PostFlowStepper`, `ProjectStage`, `CheckinStage`, `CoachMarks`, `ActivityRailButton`) already live in the same file — extraction is mechanical.

### A6. Two drawer shells copy-pasted 3×
Panel drawer, Topics drawer — identical fixed/backdrop/header/close markup, twice in the shell. And neither matches `modules/ui` sheet/slide-over conventions (the site header's mobile sheet solved this with an absolute-positioned child; these use `fixed inset-0` + a heading in raw `uppercase tracking-wide` — not the design system's `PageHeader`/drawer tokens).

### A7. Mixed token systems — the "two classrooms" look
Within one file: `text-primary`, `bg-muted`, `text-muted-foreground`, `border-input`, `bg-background` (shadcn/legacy) alongside `text-fg`, `bg-surface`, `border-line`, `bg-brand` (v2 tokens). The chat rail, drawers, media switcher, and focus toggle use legacy; the stage and post-flow use v2. This is why the classroom "feels" inconsistent — two palettes, two focus-ring languages (`focus:ring-2 focus:ring-primary` vs `focus-visible:outline-2`).

### A8. Header action overflow + sub-44px controls in the shell
Header actions: theme toggle + Topics + Focus + Exit = 4 controls; on xs the `PageHeader` actions row wraps and the sticky `md:pt-14` chrome bar is hidden — fine — but `Focus`/`Topics`/`Exit` are `px-2.5 py-1.5 text-xs` (~30px targets), below the 44px floor the rest of the app now enforces. Chat header mic/close buttons are `h-7 w-7` (28px). QuickBar prev/next icons `h-10 w-10` (40px). "Ask AI"/"Notes" `py-1.5` (~30px).

### A9. Coach marks reference a UI that no longer exists
`CoachMarks` tells first-time learners to "Click **Start learning** to begin" and points at a "left rail" and an avatar "beside the board" — none of which exist anymore (slides auto-generate; the avatar was removed). Instructions that describe dead UI destroy trust on first contact.

### A10. "test open" desktop-only badge in the rail
A `<div>` with a literal `<br/>` — text-only, `text-[9px]`, not a control, not focusable, duplicates the stepper's state. Pure noise.

---

## B. Redesign (what a designer would do)

Principle: **one job per surface, one control per job, one token system** (twelve rules 1–4, 11–12). Bottom-up order so each layer lands stable before the next.

### Layer 0 — delete the dead foundation
- Delete `LearnShell.tsx` (776 lines, zero importers).
- Reduce `tutor-bus` to what's real: keep `caption` **wired to the chat transcript** (narration becomes a visible tutor message — the honest replacement for the dead avatar), keep TTS helpers, delete the no-op `play()` calls in the classroom.

### Layer 1 — dedupe controls
- **Topics drawer → deleted**; the rail Journey panel (already better: progress rings) is the only topic map. Header "Topics" button removed.
- **QuickBar** reduced to: prev / next slide chevrons, the one contextual CTA ("Next slide" → "Daily test" → "Finish topic"), and "Ask AI" only on mobile (where chat is hidden behind the FAB). "Notes" dies (rail Library button already does it).
- **Slide footer count** removed (dots + header progress already communicate position).
- Rail "test open" badge removed.

### Layer 2 — one drawer primitive
`PanelDrawer` (modules/ui): backdrop + ESC + focus-trap-free simple slide-over, header with proper v2 tokens, shared by Journey/Project/Grow/Library.

### Layer 3 — split the monolith
`ClassroomShell.tsx` becomes an orchestrator (<300 lines):
- `classroom/QuickBar.tsx` — slide + CTA controls
- `classroom/PostFlow.tsx` — stepper + test/results/weekly/project/check-in/next stages
- `classroom/TutorChat.tsx` — chat rail + FAB + VoiceBar (one place, xs overlay included)
- `classroom/CoachMarks.tsx` — rewritten copy for the real UI
- `ActivityRailButton` → shared `classroom/ActivityRail.tsx`

### Layer 4 — token unification
Every legacy class in the classroom surfaces → v2 tokens: `text-muted-foreground`→`text-fg-muted`, `bg-muted`→`bg-bg-subtle`, `bg-background`→`bg-bg`, `border-input`/`border-border`→`border-line`, `text-primary`→`text-brand`, `bg-primary`→`bg-brand`, `focus:ring-2 focus:ring-primary`→`focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus`. All controls ≥44px.

### What we deliberately keep
The post-lesson flow (stepper + five stages) is good UX and stays — it only moves out of the monolith. The chat's voice Q&A loop stays. VideoStage stays. The slide's content design (W16) stays.

---

## C. Ship order & guards

1. **Slice A (foundation):** delete LearnShell, rewire narration→chat transcript, remove no-op `play()` calls. Guard: source-scan test asserting no `tutor.play(` in classroom + narration appears in transcript.
2. **Slice B (dedupe):** delete TopicPicker + Topics drawer, dedupe QuickBar, PanelDrawer primitive. Guard: no `TopicPicker` import anywhere; one `<PanelDrawer` per drawer.
3. **Slice C (structure):** split the monolith into the five files. Guard: `ClassroomShell.tsx` < 400 lines (source-scan).
4. **Slice D (tokens + 44px):** unify tokens, raise all classroom controls to the floor. Guard: extend `target-size` scope to include `modules/learn/components/classroom`.
