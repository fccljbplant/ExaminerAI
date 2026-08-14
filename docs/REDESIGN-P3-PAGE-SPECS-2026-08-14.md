# REDESIGN P3 — Page-by-Page Specs (all breakpoints)

> Phase 3 (2026-08-14). Implements [P2](./REDESIGN-P2-FOUNDATION-SPECS-2026-08-14.md) §4 mapping + §5 grid. Breakpoints: **xs <768 · md 768–1023 · lg 1024–1279 · xl ≥1280**.
> New aggregation endpoints are named `/api/v2/*` (final contract in P4).

## 0. Global rules (apply to EVERY screen below; not repeated per screen)

- States: skeleton loading · error + Retry · empty + CTA · 403 PermissionDenied — at every breakpoint.
- One primary action per screen, thumb-zone on xs (BottomActionBar/FAB); rare/destructive at top.
- Every gesture has a visible button equivalent; no hover-only; tap ≥44px, gap ≥8; safe-area insets on xs.
- Tabs over stacked sections; Drawer/BottomSheet over new pages; filters in sheet on xs, inline ≥md.
- Tables: xs → ListCard (3 key fields + inline actions); lg → sticky 1st col + visible h-scroll affordance.
- KPIs: xs → snap-scroll StatStrip; charts xs → sparkline/bar + tap-to-expand fullscreen sheet.
- "Continue where you left off" = first module on every dashboard. Body 14px desktop / 16px mobile lead.
- FloatingTutor FAB present on all portal screens (docked position persisted); never covers BottomNav/ActionBar.
- All AI surfaces obey text-only constraint (P2 §3.4); AI output labeled "AI-generated".
- Optimistic UI + UNDO toast for reversible actions; confirm sheets only for irreversible.

---

## 1. LEARNER portal (bottom tabs: Home / Learn / Exams / Progress / Profile)

### L1 Home
- **FoF**: ContinueLearningCard (course, next lesson title, Resume = primary) + time-budget chips (15m/30m/1h/∞) that start a session with that budget.
- **xs**: StatStrip carousel (per-course ring, due count, streak, XP) → DueToday ListCard → StudyPlanWidget → announcements (collapsible). **md**: 2-col (continue+plan | due+announcements). **lg/xl**: 12-col dense: continue(4) plan(4) KPI(4) / due table(6) weak-topics radar(3) announcements(3).
- **Components**: ContinueCard, StatStrip, ProgressRing, ListCard, RadarChart, Calendar chips.
- **Data**: `GET /v2/learner/home` (now + plan + due + announcements, fields-selected).
- **States**: empty (no enrollment) → catalog CTA card. **Actions**: Resume, Start(budget), open due item.

### L2 Catalog (Learn tab root)
- **FoF**: search field + category chips (registry-driven, domain-neutral) + level filter.
- **xs**: 1-col course cards (thumb, meta chips, progress if enrolled); filter sheet. **md** 2-col **xl** 3-col; ⌘K/SearchSheet jumps to course.
- **Data**: `GET /v2/courses?cursor&fields=…` + org-assigned courses pinned first.
- **States**: empty search → "no matches" + clear-filters action.

### L3 Course detail
- **Header**: CompactCourseHeader (title, category/level chips, ring, primary Continue/Enroll).
- **Tabs**: Overview / Syllabus / Lessons / Assignments / Progress / Grades / Discussion.
- Syllabus = module accordions → lesson rows (type icon, duration, status dot). Assignments tab reuses L5 list scoped. Discussion = threads + text composer.
- **xs**: scrollable tab row; sticky BottomActionBar CTA. **xl**: tabs + right rail progress summary.
- **Data**: `GET /v2/courses/[id]/overview|syllabus|…` (tab-lazy).

### L4 Learning session (classroom)
- **xs portrait**: top HUD (back, title, slide x/y ProgressBar, XP/streak chips, Focus toggle) · stage full-width · avatar mini docked · chat = BottomSheet · VoiceBar above safe area · persistent mini AudioPlayer when narration playing · captions ON by default in Bed Mode.
- **xs landscape / md**: stage + collapsible chat rail (320px). **lg/xl**: activity rail (Journey/Project/Grow/Library drawers) + stage + chat rail.
- **HUD extras**: session time + budget indicator (if budget chosen); "Saved" autosave chip; next-slide preload.
- **Session end**: recommendation sheet (next best action per study-flow engine).
- **States**: degraded-AI banner + Retry (never canned); not-enrolled → denied.
- **Gestures**: swipe slides + visible arrows; long-press drag avatar dock.

### L5 Assignments list
- **Chips**: due / in review / returned / graded (sheet on xs). **xs** ListCard (title, due, status badge, inline Submit/View); **lg** DataTable sticky-first-col.
- **Data**: `GET /v2/assignments?status&cursor`.

### L6 Submission flow
- **Stepper**: Instructions → Parts → Review → Submitted. Instructions card shows rubric summary + required types + resubmission policy.
- **Parts per registry type**: text editor · MediaCapture (photo/video with captureHint) · link input (URL validation, live-artifact preview card) · interactive checklist · file drop (docx/pdf; note: "converted to text for AI assistance").
- **learnerSummary** textarea mandatory (AI text-only packet).
- **xs**: sticky BottomActionBar Submit; draft autosave debounce + "Draft saved" chip; resume banner on return.
- **States**: inline validation under fields; upload fail → retry; oversize → typed error.
- **Post-submit**: status timeline (submitted→in_review→…) + resubmission CTA when returned.

### L7 Project workspace
- **Header**: title, status badge, mentor, deadline chip. **Tabs(xs)/panes(xl)**: Milestones (stepper + SignOffCards) · Tasks (ListCard/DataTable) · Feedback (thread: text/audio/annotated entries + composer) · Evidence (SubmissionRenderer read-only).
- **Primary**: "Send update to mentor" (FAB xs). **Data**: `GET /v2/projects/[id]`.

### L8 Exams schedule (Exams tab)
- ListCard: exam title, window, duration, rules icon-row, countdown chip; **lg** table. Empty state common. **Data**: `GET /v2/exams`.

### L9 Exam runner
- **xs**: ONE question per screen; top ProgressBar; options ≥44px; Flag button; "Saved" autosave chip; BottomNav hidden; Exit → sheet "progress saved, resume anytime".
- **md/xl**: centered column (max-w 720) + question-palette Drawer.
- Evidence questions use MediaCapture; checklist questions interactive.
- **Resume**: interrupted session restores exact question + draft answer (`GET /v2/exams/[id]/resume`).
- **States**: connection loss → offline notice + local autosave + retry queue.

### L10 Exam results
- Score ProgressRing + pass Badge + plagiarism/flag notes if any. Per-question accordion: your answer / correct / explanation (text). Evidence criteria show mentor decision + notes (human-graded label).
- **xs** stacked; **xl** 2-col (summary | review). Retake CTA when allowed.

### L11 Progress (Progress tab)
- StatStrip carousel; per-course rings; weak-topics RadarChart (tap→fullscreen); streak Heatmap; achievements grid (badges, evidence-locked); credentials list → public verify link.
- **xl**: dense 12-col chart grid. **Data**: `GET /v2/learner/progress`.

### L12 Study-Flow Center
- Modules: WeeklyPlan (Calendar + planned-vs-actual BarMini) · CatchUp card (absence detected → 4 options: resume / what I missed / condensed plan / start today) · Cram card (accelerated mode + retention warning) · SRS queue ListCard ("Review now", due chips) · diagnostic banner (>1 wk absence → 10-Q quiz) · budget preference.
- Options open Modal with plan preview → Confirm. All copy encouraging, no guilt.

### L13 Profile & settings
- Cards: Account · Appearance (mode select incl Bed, org brand preview) · Notifications · Accessibility (type scale, reduced motion, captions default, audio-only mode) · Security (password, security question) · Sign out.
- **xs** stacked; **lg** 2-col. Mutations → UNDO toast where safe.

### L14 Help
- Searchable FAQ (SearchSheet), "Ask AI tutor" launch, "Message mentor", coach-marks reset, plain-language guide links.

---

## 2. INSTRUCTOR portal (bottom tabs: Home / Courses / Students / Grading / More)

### I1 Home
- **FoF**: Grading-queue KPI + At-risk KPI + queue ListCard (swipe: open / nudge). **lg/xl**: KPI row(4) + queue table(6) + at-risk(3) + exam snapshot(3).
- At-risk rows: risk reason chip + one-tap intervention (message / schedule check-in). **Data**: `GET /v2/instructor/home`.

### I2 Course & Exam Studio (Courses tab)
- Course list → editor with sub-tabs: Structure (module tree, dnd + up/down buttons) · Lessons (type select → block editor: richText/slides/videoRef/checklist; duration; objectives) · Assignments (submission-types multi-select from registry, rubric builder, resubmission policy, milestones) · Quizzes (bank picker, pass mark, scheduling) · AI config (tone, strictness 1–5, glossary editor, safetyCritical) · Versions (select + diff summary + publish stepper draft→review→published) · Preview-as-learner.
- **AI assist**: outline paste or Word/PDF upload → in-house txt extraction → generated draft (human edits before save); labeled AI-generated.
- **xs**: editor full-screen with tab bar; dnd replaced by buttons. Question bank manager = Drawer with DataTable + MCQ/short/long/evidence/checklist editors.

### I3 Review queue (Grading tab root)
- Chips: assignment type / status / SLA. ListCard: learner, assignment, type icons, submitted-at, SLA chip; swipe open/nudge. **lg** DataTable sticky-first-col. Bulk select → "nudge unsubmitted" sheet.

### I4 Review detail
- **Left/main**: SubmissionRenderer per part — text; file → extracted-txt view + original download; photo → lightbox + annotation markers; video → player + timestamped comments; link → preview card; checklist → state view.
- **Right rail (xl) / tab (xs)**: RubricGrader (criteria levels; `aiAssist` criteria show AI draft with "machine draft — verify" label + Accept/Edit) · Feedback composer (text / audio record / annotate mode) · history timeline (cycles).
- **Decision bar**: Approve / Request changes / Sign-off milestone — BottomActionBar xs, header buttons xl. Request-changes requires feedback text (inline validation).

### I5 Students
- Roster: filters course/risk; **xs** ListCard (name, engagement spark, risk badge, inline view/message); **lg** DataTable; bulk select → message sheet. **Data**: `GET /v2/instructor/students`.

### I6 Student drill-down
- Tabs: Overview (KPI + rings) · Patterns (session heatmap, cram flags, absence markers) · Submissions (history + scores) · Interventions (AI suggestions list, one-tap apply, every apply audit-logged).

### I7 Grading center
- Score-entry focused view of I3: **xs** swipe sets quick score (with UNDO); **xl** inline score cells + rubric Drawer.

### I8 Analytics
- Score distribution LineChart · item-analysis DataTable (per-question correct%, time) · completion funnel bars. Filter sheet; tap-to-expand.

### I9 Announcements (More)
- Composer (text + audience picker course/group) + sent list with read stats. Attachments human-only (not AI-processed).

### I10 Earnings (More; marketplace instructors only)
- KPI (lifetime, pending), payments DataTable, per-course split BarMini. Hidden for org-only instructors (permission state).

---

## 3. ORG ADMIN portal (bottom tabs: Home / People / Control / Reports / More)

### O1 Command Center (Home)
- **Mobile order**: approvals queue + alerts FIRST, then KPI carousel (active users, seats used, live sessions, health). **xl**: KPI row + live-sessions Heatmap + alerts ListCard(ack) + approvals chips.
- **Data**: `GET /v2/org/home`.

### O2 People & Roles
- Members DataTable→ListCard (role badge, status, seat chip); Invite Modal (email + role); deactivate → UNDO toast (grace period).
- **RBAC matrix**: role × capability grid of Switches; dangerous toggles → confirm sheet; every change audit-logged.

### O3 Content governance (More)
- Approvals ListCard (instructor-submitted courses) → preview (read-only course detail) → Approve / Return-with-reason (required text).
- **Registries editors**: submission types, rubric templates, categories — DataTable + add/edit Sheet (config rows = zero code).
- Instructor activity audit table (publishes, grading SLA).

### O4 Control Center
- Feature flags Switch list (env badge, rollout %); **Branding**: brand-color input + live preview Card + default mode select → derives palette live (P2 §2.3) + "AA guaranteed" badge from validator; settings groups. Changes → audit + UNDO.

### O5 Monitoring & Audit (Reports)
- Logs DataTable (actor/action/target/time) + filter sheet + CSV export; alert rules list (threshold inputs).

### O6 Billing & seats (More)
- Plan Card, seats KPI + usage bar, payments history table, upgrade CTA → Stripe checkout (existing).

### O7 Study Analytics (Reports)
- Org engagement Heatmap · cram/dropout-risk ListCard with bulk-message intervention · weekly planned-vs-actual aggregate chart.

---

## 4. PLATFORM ADMIN portal (desktop-dense; mobile = alerts + approvals)

### P1 Home — platform KPI (orgs, active users, AI spend, health) + cron heartbeat table (missed = danger row) + incidents ListCard.
### P2 Orgs — DataTable (plan, seats, health) + suspend/restore (UNDO) + view-only drill-down.
### P3 System — health panels, cache purge action (confirm), maintenance-mode toggle, global flags.
### P4 AI — provider config (keys masked), limits editor (per-role RPM/RPD), usage/cost LineChart + per-feature table, cache hit stats.
### P5 Marketplace — governance table (feature/unfeature, takedown w/ reason), categories registry editor.
### P6 Audit — global logs DataTable + export.
### P7 Maintenance — demo seed/reset (demo-guard aware), backup status card, schema-drift check status.

---

## 5. Density & fold verification notes

- Every dashboard keeps primary KPIs + continue/queue card above the fold at 360×640 and 1024×600 (verified in P6 device matrix).
- xl grids never exceed 4 KPI + 3 panels per row; whitespace separates, never swells.
- All lists cursor-paginated (20 xs / 50 xl); no infinite scroll without "jump to top".
