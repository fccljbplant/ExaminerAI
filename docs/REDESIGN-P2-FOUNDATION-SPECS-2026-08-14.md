# REDESIGN P2 — Foundation Specs (Architecture 0B · Theme 0C · Content Model 0D · Design-System Mapping · Breakpoint Grid)

> Phase 2 of the redesign (2026-08-14). Builds on [P1](./REDESIGN-P1-INVENTORY-2026-08-14.md).
> **Carried decisions**: `/learn` is the learner foundation; old `/app` student platform deleted at cutover; 4-role + demo RBAC kept; public site restyled last; tutor = new abstract in-house vector rig (orgs may upload a face; no external paid services); Radix/shadcn kit = primitive seed; theme engine rebuilt; skeleton modules deleted; **the platform AI is TEXT-ONLY** — it cannot read files or see media; Word/PDF are converted to txt in-house before any AI call (§3.4).
> Stack facts this spec is written against: Next 16 App Router, React 19, **Tailwind CSS v4** (CSS-first `@theme`), CVA, Radix, TanStack Query v5 + Table v8, zustand, RHF + zod v4, recharts, vaul, sonner, cmdk, next-themes, lucide-react (the ONE icon set), vitest.

---

## 1. Architecture spec (0B)

### 1.1 Module & folder structure (target)

```
src/
├── app/                      # THIN routes only: compose modules, no business logic
│   ├── (public)/             # marketing + marketplace (frozen now, restyled last)
│   ├── (portals)/
│   │   ├── learner/          # /home /learn /assignments /projects /exams /progress /study-plan /profile /help
│   │   ├── instructor/       # /home /studio /review /students /grading /analytics /announcements /earnings
│   │   ├── org/              # /home /people /governance /control /audit /billing /analytics
│   │   └── platform/         # /home /orgs /system /ai /marketplace /audit /maintenance
│   └── api/                  # thin HTTP wrappers → module services (P4 refactors)
├── modules/
│   ├── ui/                   # THE component library (moved from components/ui + shared)
│   ├── shell/                # adaptive shell: TopNav, CondensedNav(+More), TabRow, BottomNav,
│   │                         #   BottomActionBar, SafeArea, Breadcrumbs, ViewAsRole, ProfileMenu
│   ├── theme/                # token engine, mode switching, org-brand derivation, migration
│   ├── tutor/                # FloatingTutor: FAB, drag/dock/persist, state machine, context API,
│   │                         #   VectorTutorRig (new abstract avatar), optional uploaded-face mode
│   ├── learn/                # classroom, journey, SRS, study-flow engine (session/scheduler/planner)
│   ├── course/               # content model services, studio logic, registries, AI course config
│   ├── assessment/           # exam engine, question bank, grader, AI provider chain (kept)
│   ├── submission/           # NEW: submission-type registry, SubmissionRenderer, review/annotate,
│   │                         #   rubric grading, resubmission cycles, sign-offs,
│   │                         #   text-extract pipeline (docx/pdf→txt, in-house, §3.4)
│   ├── mentorship/           # feedback threads (text/audio/annotation), interventions
│   ├── analytics/            # aggregation services + chart wrappers + KPI builders
│   ├── gamification/         # XP ledger, badges (kept), restyled
│   ├── auth/                 # REAL module (replaces skeleton): login/register/reset flows UI+logic
│   ├── messaging/            # messages + announcements
│   ├── people/               # user/seat/RBAC matrix services (org + platform)
│   └── billing/              # seats, plans, Stripe integration surface
├── lib/                      # cross-cutting infra ONLY: db, logger, audit-log, feature-flags,
│   │                         # demo-guard, api/client.ts, api/errors.ts, constants.ts
└── hooks/                    # generic React hooks only (use-mobile, use-toast, …)
```

Rules: routes import modules; modules import `modules/ui` + `lib`; **`modules/ui` imports nothing but tokens**; no deep cross-module imports (public API via `index.ts`); old `components/examiner/*` deleted as portals land; backward-compat re-exports (P1 §2.8) deleted, not maintained.

### 1.2 State-management pattern (one documented pattern)

| State class | Tool | Rule |
|---|---|---|
| Server state | TanStack Query | All reads/writes go through typed api client; query keys from per-module `queryKeys`; mutations invalidate declared keys; optimistic updates + UNDO where brief demands (toast with action). |
| Session/UI state | zustand (per-feature store) | `tutor-store` (dock pos, open, badges), `shell-store` (active portal tab, sheets), `session-store` (HUD, audio, captions). Persisted slices via `persist` middleware (localStorage, versioned). |
| Form state | react-hook-form + zod | Inline validation, errors under fields, sticky submit on mobile. |
| Theme | theme module provider | Owns `data-mode`/`data-brand` attrs; never raw context in features. |

No Redux, no data-through-Context, no prop-drilling chains >2.

### 1.3 Typed API client

- `lib/api/client.ts`: `apiFetch<T>(path, {method, body, query, schema, timeout, retry})` — attaches JWT, 15s timeout, parses JSON, validates with zod `schema`, throws typed `ApiError {code, status, message, retryable}`; GET retries once on 5xx/timeout; never throws raw.
- Endpoint registry: each module owns `modules/<m>/api.ts` exporting typed functions (`api.review.list({cursor, fields})`); **one place per endpoint**; route files call the same zod schemas for response validation (shared contract in `modules/<m>/contracts.ts`).
- Mobile payloads: cursor pagination (`?cursor=&limit=`) + field selection (`?fields=a,b`) on all list/aggregation endpoints (P4).
- Errors → UI convention: `ErrorState` + Retry (never blank screen); toasts via sonner for mutation failures; skeletons for loading; `PermissionDenied` state on 403.

### 1.4 Component library catalog (each primitive exists ONCE)

| Primitive | Variants / notes |
|---|---|
| Button / IconButton | sizes sm(32) md(40) lg(44 mobile primary); tones primary/secondary/ghost/outline/destructive; loading; icon-only ≥44px hit area on touch |
| Input / Textarea / Select / Combobox / Checkbox / Radio / Switch / Slider / OTP | correct `inputmode`/keyboard per type; error under field |
| Card / CardHeader / CardBody | flush option; elevation tokens |
| KPI | value, delta, sparkline slot, tone, tap-to-expand |
| StatStrip | horizontal snap-scroll carousel (mobile) / dense row (desktop) |
| DataTable | TanStack Table wrapper: sticky first col @lg, horizontal scroll affordance, mobile → auto `ListCard` stack (3 key fields + inline actions) |
| ListCard | mobile stacked row primitive |
| Tabs / SegmentedControl | pill + underline; ARIA tabs |
| Modal / Drawer(side) / BottomSheet(vaul) | sheet = mobile default for filters & secondary flows |
| Toast (sonner) | with UNDO action support |
| Chip / Badge / Tag | filter chips (sheet on mobile) |
| Tooltip / Popover / DropdownMenu | desktop hover+focus; mobile = tap menu, never hover-only |
| ProgressBar / ProgressRing / Sparkline / BarMini / LineChart / RadarChart / Heatmap | chart wrappers read `--chart-*` tokens; mobile simplification built-in (tap-to-expand fullscreen) |
| CommandPalette (cmdk) | desktop ⌘K; mobile renders as SearchSheet |
| Skeleton / EmptyState / ErrorState / PermissionDenied / Spinner | every data component composes these |
| PageHeader / SectionHeader / Breadcrumb | 56px mobile / 64px desktop (replaces 96px legacy header) |
| Stepper / Calendar(react-day-picker) / SwipeActions | — |
| SubmissionRenderer | renders ANY submission type from registry config |
| RubricGrader / FeedbackThread / SignOffCard | mentorship review kit |
| VectorTutorRig / FloatingTutor | §1.5 |
| MediaCapture | photo/video/file picker with `capture` hints per registry |

### 1.5 FloatingTutor (primitive-level decisions; full spec lands with P4/P5)

- Abstract **vector** rig: layered SVG (head shape, eyes, brows, mouth as morphable paths, mood ring, FX particles) — same event→expression mapping concept as today but 100% vector, zero raster, zero paid services.
- Optional uploaded-face mode reuses calibration-JSON idea (org uploads one photo + reticle config).
- States: idle / listening / speaking / thinking; dock: FAB ↔ full-screen chat (mobile) ↔ panel (desktop); drag + edge-snap; position persisted (zustand persist + user prefs endpoint).
- **Text-only AI**: the tutor/grader never receives binaries. Attachments sent to the tutor are converted in-house (docx/pdf→txt) or represented as metadata + the learner's own words; the tutor states plainly that it reads text only. Media (photo/video) is for the human mentor's eyes via SubmissionRenderer.

### 1.6 Conventions

- Files kebab-case; components PascalCase; hooks `use-`; module public API via `index.ts`; JSDoc on every exported symbol; `README.md` per module (purpose, public API, owners of data).
- ESLint additions: `no-restricted-imports` (no deep module imports, no `components/examiner`), custom rule banning literal hex/rgb outside `modules/theme/tokens/*`, `react-hooks` strict. Prettier enforced. CI gate = `lint && tsc --noEmit && vitest && build`.
- Conventional commits (`feat(learner): …`, `refactor(theme): …`); PRs ≤400 lines; dead code deleted in same PR.
- **Definition of Done**: lint+typecheck clean · tokens only · responsive at 4 breakpoints · empty/loading/error/denied states · domain-neutral copy · a11y (AA, focus rings, ARIA patterns) · module README updated.

---

## 2. Theme system spec (0C)

### 2.1 Three-layer tokens (Tailwind v4 mechanics)

1. **Primitives** (`modules/theme/tokens/primitives.css`, in `@theme`): raw scales — color steps `--p-neutral-0..1000`, brand hue scale generated at build for default brand; space `--p-space-1..8` = 4/8/12/16/24/32/48/64; radius `xs4 sm6 md10 lg14 xl20 full`; elevation `--p-elev-1..3`; type `--p-type-xs12 sm13 md14 lg16 xl18 2xl20 3xl24 4xl30 5xl36`; motion `--p-dur-fast150 med200 slow250` + `--p-ease-standard/emphasized`; z `base0 raised10 sticky100 drawer200 modal300 toast400 tutor500`.
2. **Semantic** (`semantic.css`, plain CSS vars on `:root` / `[data-mode="dark"]` / `[data-mode="bed"]`, brand-overridable via `[data-brand]`): `--bg, --bg-subtle, --surface, --surface-raised, --surface-overlay, --text, --text-secondary, --text-muted, --text-inverse, --border, --border-strong, --brand, --brand-hover, --brand-active, --brand-subtle, --on-brand, --focus, --scrim, --success(-subtle/-on), --warning(-subtle/-on), --danger(-subtle/-on), --info(-subtle/-on), --chart-1..6, --tutor-ring, --tutor-fab`.
3. **Component** (`@theme inline` bridge): utilities map to semantics — `--color-bg: var(--bg)` etc., plus `--card-bg, --card-border, --input-bg, --input-border, --nav-bg, --nav-border, --tab-active, --fab-bg`. Features ONLY use utility classes (`bg-surface`, `text-secondary`, `border-default`, `bg-brand`, `text-on-brand`…).

**Law**: no hex/rgb literals outside `modules/theme/tokens/*` and the brand-derivation function (CI-enforced, §1.6).

### 2.2 Modes

| Mode | Character |
|---|---|
| light | neutral-cool surfaces, AA text ≥7:1 body |
| dark | true elevated surfaces (no pure black), reduced saturation |
| bed | warm dimmed dark: hue-shifted amber base, luminance ceiling ~40%, blue-light-minimal charts, captions ON default, lower-contrast imagery via `--scrim` boost |
| org custom | any mode + `[data-brand]` overrides from derived palette |

Runtime switch: theme provider sets `data-mode`/`data-brand` on `<html>`; next-themes handles persistence + FOUC guard; **no reload**; charts re-read vars automatically (wrappers use `currentColor`/var fills).

### 2.3 Org brand derivation (one color → full palette, WCAG-guaranteed)

`deriveBrandPalette(hex)` (in-house, OKLCH math, no service):
1. Parse to OKLCH; keep hue H, clamp chroma C to [0.06, 0.16] (accessible range).
2. Generate brand steps: light-mode `--brand` = L 0.45–0.55 (pick nearest with ≥4.5:1 against white for text-on-brand else swap on-brand to near-black); dark/bed `--brand` = L 0.70–0.80 against surface.
3. `--brand-subtle` = L 0.94 (light) / L 0.25 (dark); hover/active = ∓0.05 L.
4. Semantic status colors NEVER derived from brand (fixed per mode) — brand is accent-only.
5. Chart palette: hues H, H+40, H+150, H+210, H+300 at mode-tuned L/C; bed mode C×0.6.
6. Every pair used in UI is registered in `contrast-manifest.ts`; derivation runs the WCAG check and auto-adjusts L until pass (loop ≤6 steps) — **guarantee by construction**, re-verified by §2.5 script.

### 2.4 Validation script — `scripts/validate-theme.ts` (CI gate)

- For each mode × {default brand, 12 sample org hues, edge hues (yellow, near-white, near-black)}: assert all manifest pairs ≥4.5:1 (text) / ≥3:1 (UI/large); assert every semantic token defined in every mode (completeness); assert no utility references a missing var (scan built CSS); exit non-zero on violation.

### 2.5 Migration — `scripts/migrate-org-themes.ts` (one-time)

Reads saved org theme preset ids (old `THEME_PRESETS`) + any `Setting` rows → writes new `OrgThemeConfig {orgId, mode, brandHex, derivedAt}` using nearest-hue mapping (preset accentColor → brandHex); deletes old preset storage keys client-side on next load; idempotent.

---

## 3. Content model spec (0D)

### 3.1 Entities (Course → Modules → Lessons/Assignments/Quizzes/Projects)

```
Course { id, title, blurb, categoryRef(registry), level, glossary[], aiConfig{}, branding?, published, version }
 └─ Module { order, title, outcome }
     ├─ Lesson { type: ai_taught|video|text|practical_demo, durationMin, objectives[],
     │           blocks: [richText | slides | videoRef | stepsChecklist | mediaRef], resources[] }
     ├─ Assignment { kind: assignment|project|checklist, submissionTypes[] (registry refs),
     │               rubricId, duePolicy{}, resubmission{maxCycles, cooldown}, milestones[] }
     └─ Quiz { bankRefs[], itemCount, passMark, scheduling{}, autosave:true }
QuestionBank → Question { type: mcq|short|long|evidence|checklist, rubricRef? }
Rubric { criteria[{ title, weight, levels[{label, descriptor, points}] }] }
SubmissionTypeRegistry (DATA rows): text|file|photo|video|link|checklist|live_artifact|demo_observation
   each: { accept, maxCount, captureHint, renderConfig, mobileKeyboard }
Submission { assignmentId, learnerId, parts[{type, payload}], status:
   draft→submitted→in_review→changes_requested→resubmitted→approved→signed_off }
FeedbackThread (submissionId) → FeedbackMsg { kind: text|audio|annotation{targetPart, markers[]}, author }
SignOff { milestoneId, signerId, decision, note }
```

Registries are **data**, not code: adding "welding" or "digital marketing" = inserting config rows. `SubmissionRenderer` + `MediaCapture` + `RubricGrader` are generic over registry rows.

### 3.2 Per-course AI config (domain adaptation)

`aiConfig { plainLanguage: true, tone, strictness(1-5), terminology: glossaryRef, checkQuestionDensity, safetyCritical?: bool }` → consumed by tutor + grader + slide generator. HSE sets `strictness:5, safetyCritical:true`; eBay sets `tone: entrepreneurial`.

### 3.3 Zero-code-change proof (three samples, config-only)

**HSE certification** — Lessons: `text` (regulation theory, strict AI) + `practical_demo` (site inspection); Assignments: `checklist` submissionType=checklist (PPE steps, all-required) + photo (evidence, captureHint "hazard area, wide angle"); Rubric: safety criteria weight 60%, any critical fail → changes_requested; SignOff chain: mentor → org safety officer. ✔ expressible.

**eBay store program** — Lessons: `ai_taught` + `video`; Assignment: live_artifact (store URL, renderConfig = iframe/screenshot snapshot) + link; milestones: store live / first listing / first sale; Rubric: business criteria; FeedbackThread: text+audio. ✔ (already seeded course migrates to this shape).

**Mobile repair** — Lessons: `practical_demo` (teardown steps checklist) + video; Assignment: photo+video evidence (captureHint "board close-up, good light"), rubric levels for soldering quality; assessment type practical; resubmission cycles 3. ✔.

All three = rows in registries + JSON config; **zero new component code**. In all three, the AI consumes only extracted text + metadata (§3.4); photo/video/live evidence is graded by the mentor via inline preview.

### 3.4 AI text-only pipeline (hard constraint)

The platform AI processes **text only** — no vision, no native file reading. Every AI feature (tutor, grader, plan generator, review assist) consumes a normalized `AiContextPacket { extractedText, structuredMetadata, rubric, glossary, aiConfig }` and nothing else.

- **Word/PDF**: converted to txt in-house before any AI call — `mammoth` (docx→text) and `pdfjs-dist` (pdf→text); open-source, run on our servers, no paid/external service. Limits (size/pages/time) + cached result in `SubmissionPart.extractedText`. Existing outline-upload course generation is formalized onto this same pipeline.
- **Photo / video / demo_observation / live_artifact / checklist**: the AI receives ONLY the learner's mandatory `learnerSummary` text + structured metadata (checklist states, counts, titles, link URL, capture hints). The original artifact is rendered for the **human mentor** in `SubmissionRenderer` (inline preview, annotation layer).
- **Rubric criteria carry `aiAssist: boolean`**: AI may draft scores/feedback only for text-grounded criteria; evidence criteria are human-graded (AI may summarize metadata, clearly labeled as machine-generated).
- **Graceful degradation**: extraction failure or unsupported type → review proceeds human-only with a toast notice; AI panels show `EmptyState("Text-only AI — nothing readable here yet")`; never a blank screen, never a fake AI read.
- **Tutor chat uploads**: same pipeline; the tutor quotes from extracted txt and says so; it never pretends to have seen a photo or opened a binary.

### 3.5 DB mapping

New tables: `ContentModule, Lesson, LessonBlock, Assignment, Quiz, QuestionBank, Question, Rubric, RubricCriterion, SubmissionTypeRow, Submission, SubmissionPart, FeedbackThread, FeedbackMsg, SignOff, OrgThemeConfig, StudySession, StudyPlan`. Migrations: `CourseWeek/CourseDay` → `ContentModule/Lesson` (day→lesson, topicsCovered→objectives, videoUrl→videoRef block, codeExamples dropped); `GroupTask`→`Assignment`, `GroupTaskSubmission`→`Submission(+parts)`, `Comment`→`FeedbackMsg`; old/new test tables unified into assessment engine (P4); `Institution`→`Organization` backfill.

---

## 4. Design-system mapping (screen → primitives)

Conventions: every screen = `PageHeader` + content grid; "Continue where you left off" first module everywhere; tabs over stacks; drawers/sheets over pages.

**Learner**: Home = KPI StatStrip(snap) + ContinueCard(Card+ProgressBar) + StudyPlanWidget(ListCard) + deadlines(Calendar chip) + weak-topics RadarChart + announcements(ListCard). Catalog = SearchSheet/CommandPalette + Card grid/ListCard + Chip filters(sheet). Course detail = Tabs(Overview/Syllabus/Lessons/Assignments/Progress/Grades/Discussion). Session = ClassroomShell + HUD(ProgressBar+chips) + mini AudioPlayer + VoiceBar + tutor rail. Assignments list = DataTable→ListCard + Chip status filter. Submission flow = Stepper + MediaCapture + Checklist + sticky BottomActionBar submit. Project workspace = milestone Stepper + FeedbackThread + SignOffCard + resubmission Badge. Exams = schedule ListCard; runner = one-question-per-screen + top ProgressBar + autosave chip; results = score Ring + per-question accordion + explanations. Progress = rings + Sparkline + RadarChart + Heatmap(streak) + badges. Study-Flow Center = weekly plan Calendar + plan-vs-actual BarMini + catch-up/cram choosers(Modal) + SRS queue ListCard.

**Instructor**: Home = grading-queue ListCard(swipe) + at-risk KPI + exam snapshot. Studio = block assembler(dnd-kit) + registry pickers(Select) + RubricGrader builder + version Select + publish Stepper. Review Center = queue DataTable→ListCard; review page = SubmissionRenderer preview + annotation layer + FeedbackThread(compose audio) + RubricGrader + resubmission/sign-off actions(BottomActionBar). Students = DataTable→ListCard + drill-down tabs(patterns/engagement/interventions). Grading = SwipeActions list. Analytics = LineChart(dist) + item-analysis DataTable + funnel Bars.

**Org Admin**: Command Center = KPI StatStrip + live-sessions Heatmap + alerts ListCard. People = DataTable + RBAC matrix grid(Switch cells) + invite Modal. Governance = approvals ListCard + registry editors(DataTable). Control = feature flags(Switch list) + branding(brand color Input + live preview Card) + mode Select. Audit = DataTable + export. Billing = seats KPI + plan Cards. Study Analytics = aggregate Heatmap + dropout-risk ListCard.

**Platform Admin**: system health KPI + cron table + AI usage LineChart + orgs DataTable + maintenance toggles.

---

## 5. Breakpoint grid & density rules

| Class | Range | Shell | Grid | Data-viz | Tables | Filters/Actions |
|---|---|---|---|---|---|---|
| xs mobile | <768 | top app bar + BottomNav(5) + BottomActionBar/FAB | 4-col, 16px gutter | KPI snap carousel; sparklines; tap-to-expand fullscreen chart | → ListCard (3 fields + inline actions) | BottomSheet; sticky submit |
| md tablet | 768–1023 | app bar + secondary TabRow; side panels = Drawers | 8-col | half-size charts | 2-col cards or compact table | Sheets or inline |
| lg chromebook | 1024–1279 | condensed top nav + More overflow | 12-col tight | full charts, tighter | sticky 1st col + visible h-scroll | inline + popover |
| xl desktop | ≥1280 | full horizontal role nav + ⌘K | 12-col | full + dense | full DataTable | inline, command palette |

Density law: body 14px (desktop) / 16px (mobile body lead), captions 12; tap targets ≥44 with ≥8 gap; card padding 16 (mobile) / 12–16 (lg+); **hierarchy via weight/contrast/space, not size**; above-the-fold = primary KPIs + continue card on every dashboard; no horizontal page overflow at 360px and 1024×600; no hover-only interactions; safe-area insets on xs.

---

## 6. Next (P3)

Page-by-page specs at all four breakpoints for every screen in §4 (layout wireframe decisions, above-the-fold, component tree, data + endpoints consumed, actions/gestures, empty/loading/error/denied states, responsive rules), starting with Learner portal.
