# TraineesAI · UI Standards

> The rules every panel must follow.
> Updated every audit cycle. Source of truth for "what does a TraineesAI
> page look like?"

---

## 1. The header rule (max 96 px)

**Every app page uses `PageHeader`**. No exceptions.

`PageHeader` is a 96 px sticky header with:

- Breadcrumbs (crumb → crumb → current page).
- One-line title (truncated, with tooltip on hover).
- Optional subtitle (one line, truncated).
- Optional chips (meta info: Week 3/8 · 68% · ★4.8).
- Optional progress bar (0–100).
- Optional actions (buttons, on the right).

```tsx
<PageHeader
  crumbs={[
    { label: "Learn", href: "/learn" },
    { label: "Web Dev Bootcamp" },
    { label: "Week 3" },
  ]}
  title="Daily test — CSS Grid"
  subtitle="3 Socratic questions · ~5 min"
  progress={68}
  chips={<Badge variant="outline">Week 3 of 8</Badge>}
  actions={<Button size="sm">Resume</Button>}
/>
```

### Forbidden inside app pages

- `text-6xl`, `text-7xl`, `text-8xl` headings (those are for landing pages
  only).
- `min-h-[60vh]` hero sections (the audit script flags these).
- Multi-line titles (one line, truncate).
- Marketing copy in the header (belongs in the body, if anywhere).

### Course pages use `CompactCourseHeader`

`CompactCourseHeader` wraps `PageHeader` and adds an expandable meta drawer
(instructor, duration, rating). Direct fix for the "course heading eats 60%
of page" bug.

```tsx
<CompactCourseHeader
  data={{
    courseTitle: "Web Dev Bootcamp",
    trackName: "Frontend",
    week: 3,
    totalWeeks: 8,
    progress: 68,
    instructorName: "Sarah Chen",
    durationHours: 40,
    rating: 4.8,
    nextDeadline: "Weekly test · Fri",
  }}
  onResume={() => setView("study")}
/>
```

---

## 2. Spacing grid (4 px)

All spacing uses Tailwind's 4 px grid. No ad-hoc `padding: 13px` or
`margin: 7px`.

| Tailwind class | Pixels | Use |
|---|---|---|
| `p-1` | 4 | Tight icon padding |
| `p-2` | 8 | Small chip / badge padding |
| `p-3` | 12 | Button padding (sm) |
| `p-4` | 16 | Card padding (default) |
| `p-5` | 20 | Card padding (spacious) |
| `p-6` | 24 | Section padding |
| `p-8` | 32 | Page-level padding (mobile) |
| `p-10` | 40 | Page-level padding (desktop) |

**Section gaps**: `space-y-4` (16 px) is the default between cards. Use
`space-y-6` (24 px) for major section breaks. Never `space-y-3` or less
between cards — too cramped.

**Content column**: `max-w-5xl mx-auto` (1024 px). Wider content hurts
readability. Narrower feels constrained.

---

## 3. The states kit (mandatory)

Every data-loading panel handles **all four states**:

```tsx
import { SkeletonPanel, EmptyState, ErrorState } from "@/components/ui/states";

function MyPanel() {
  const { data, loading, error } = useMyData();

  if (loading) return <SkeletonPanel lines={3} />;
  if (error) return <ErrorState message="Couldn't load." onRetry={refetch} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="🌱"
        title="No items yet"
        hint="Take a test to see items here."
        action={<Button>Start a test</Button>}
      />
    );
  }
  return <LoadedView data={data} />;
}
```

### Skeleton rules

- Must visually match the loaded layout (same rough shape).
- `lines` prop controls row count.
- Use `animate-pulse` (the kit handles this).
- Never use a spinner for full-panel loading — skeletons prevent reflow.

### Empty-state rules

- Every empty state has a `action` (a button or link to the next step).
- The `hint` explains *why* the panel is empty and *what to do*.
- The `icon` is an emoji (we use a small, consistent set).

### Error-state rules

- `message` is human-readable ("Couldn't load your report cards").
- `onRetry` is always provided when the failure is retriable.
- Never show raw error messages or stack traces.

---

## 4. Typography

| Element | Class | Font |
|---|---|---|
| Page title (in PageHeader) | `text-base font-bold` | Inter |
| Section heading | `text-lg font-semibold` | Inter |
| Card title | `text-base font-semibold` | Inter |
| Body | `text-sm` | Inter |
| Small / muted | `text-xs text-muted-foreground` | Inter |
| Mono (code, paths) | `font-mono text-xs` | JetBrains Mono |

**Line height**: default Tailwind (1.5 for body, 1.25 for headings). Don't
override.

**Truncation**: long titles use `truncate` + a `title` attribute for the
tooltip. Never let a title wrap to two lines inside the header.

---

## 5. Color system

TraineesAI uses CSS-variable-based theme tokens. **Never hardcode
Tailwind palette colors** (`text-emerald-600`, `bg-amber-500`, etc.) —
use the tokens so light/dark mode works automatically.

### Base tokens (shadcn standard)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-background` | #fafafa | #0a0a0f | Page background |
| `bg-card` | #ffffff | #16161f | Card background |
| `bg-muted` | #f1f5f9 | #1c1c28 | Subtle backgrounds |
| `text-foreground` | #0f172a | #fafafa | Primary text |
| `text-muted-foreground` | #64748b | #9ca3af | Secondary text |
| `border-border` | #e2e8f0 | #2a2a3a | Borders |
| `bg-primary` | #0f172a | #fbbf24 | Primary actions |
| `text-primary` | #0f172a | #fbbf24 | Primary text |
| `bg-destructive` | #dc2626 | #f87171 | Destructive actions |
| `text-destructive` | #dc2626 | #f87171 | Destructive text |

### Growth palette (our semantic tokens)

Defined in `globals.css` as CSS variables with light + dark variants.
These are the **only** colors to use for semantic status. They handle
both themes automatically — no `dark:` overrides needed.

| Token class | Light value | Dark value | Semantic intent |
|---|---|---|---|
| `text-growth-sage` | #5b8a72 | #7eb39a | Success, progress, growth |
| `text-growth-sage-foreground` | #2f5d4a | #b5d9c2 | Success text on soft bg |
| `bg-growth-sage-soft` | #d8ebe0 | #2c4035 | Success background tint |
| `border-growth-sage` | var | var | Success border |
| `text-growth-amber` | #c98a2b | #e3b062 | Attention, warning, in-progress |
| `text-growth-amber-foreground` | #6b4a14 | #f1d49a | Warning text on soft bg |
| `bg-growth-amber-soft` | #fbe8c4 | #4a3818 | Warning background tint |
| `border-growth-amber` | var | var | Warning border |
| `text-growth-coral` | #d97766 | #e59a8a | Alerts, needs-care (soft) |
| `bg-growth-coral-soft` | #fadcd5 | #4a2620 | Alert background tint |
| `text-destructive` | #dc2626 | #f87171 | Danger, error, destructive |

### Mapping (what replaces what)

| Old hardcoded | New theme token | When |
|---|---|---|
| `text-emerald-600` | `text-growth-sage` | Success, passed, completed |
| `bg-emerald-500/15` | `bg-growth-sage-soft` | Success background tint |
| `border-emerald-500/30` | `border-growth-sage` | Success border |
| `text-amber-600` | `text-growth-amber` | Warning, due soon, attention |
| `bg-amber-500/15` | `bg-growth-amber-soft` | Warning background tint |
| `text-rose-600` / `text-red-600` | `text-destructive` | Danger, failed, urgent |
| `bg-rose-500/15` / `bg-red-500/15` | `bg-destructive/5` | Danger background tint |
| `border-rose-500/30` | `border-destructive/30` | Danger border |
| `bg-emerald-600 hover:bg-emerald-700` | `bg-primary text-primary-foreground hover:bg-primary/90` | Primary button |

**Rule**: if you're tempted to write `text-emerald-*`, `text-amber-*`,
`text-rose-*`, `text-red-*`, `text-orange-*`, or `text-lime-*`, use the
growth palette tokens instead. The migration script
(`scripts/migrate-colors.py`) enforces this automatically.

### Modern SaaS surface utilities

Defined in `globals.css` under `@layer utilities`:

| Utility | Use |
|---|---|
| `.surface-card` | `rounded-xl border border-border bg-card` — no shadow |
| `.surface-muted` | `rounded-xl border border-border bg-muted/40` |
| `.surface-hover` | `transition hover:border-foreground/20 hover:bg-muted/50` |
| `.chrome-reveal` | `opacity-0 group-hover:opacity-100` — hover-to-reveal |
| `.kbd` | Keyboard hint chip (⌘K, ↵, etc.) |
| `.widget-title` / `.widget-subtitle` | Star Admin widget header typography |
| `.chip-delta` (+ `-up` / `-down` / `-flat`) | Stat delta badge ("+12% vs last week") |
| `.badge-pill` (+ `-sage` / `-amber` / `-coral` / `-muted`) | Status pills for table rows |
| `.table-modern` | Star Admin table: hover rows, soft headers, progress bars |

### Widget language (Star Admin pattern)

Dashboards compose panels from the shared widget kit — never re-derive
card markup:

| Component | File | Use |
|---|---|---|
| `WidgetCard` | `@/components/shared/widget-card` | Panel with title bar, optional subtitle, `menu` ("…" dropdown), `actions`, padded or `flush` body |
| `StatCard` | `@/components/shared/stat-card` | Stat tile: uppercase label, big value, icon chip, `tone` (default/success/warning/danger/info), optional `delta` chip and `progress` bar |
| `StatStrip` | `@/components/shared/stat-card` | The row of 2–4 stat tiles at the top of a dashboard |

Rules:

- One `StatStrip` per dashboard, first thing under the header.
- Delta chips compare against a real previous period — never invent
  numbers (render no chip when there is no baseline).
- Tables inside a `WidgetCard` use `flush` + `.table-modern`; row status
  uses `.badge-pill-*` tones, not raw Badge components.

---

## 6. Button hierarchy

| Variant | Use | Example |
|---|---|---|
| `default` (primary) | One per view — the main action | "Resume", "Submit test" |
| `outline` | Secondary actions | "Details", "View report" |
| `ghost` | Tertiary / toolbar | "Filter", "Sort" |
| `destructive` | Irreversible actions | "Delete", "Archive" |

**Sizes**:

| Size | When |
|---|---|
| `sm` | Inside cards, headers, toolbars |
| `default` | Default form submit |
| `lg` | Onboarding, empty-state CTAs |
| `icon` | Icon-only buttons (always with `aria-label`) |

**Never** have two primary buttons in the same view. If two actions feel
equally important, demote one to `outline`.

---

## 7. Terminology glossary (frozen)

The product has churned through "batch / course / class" and
"trainee / student / learner". This is the frozen glossary:

| Term | Means | NOT |
|---|---|---|
| **learner** | A person taking a course | student, trainee, batch-member |
| **mentor** | A person who guides learners | instructor, teacher, counselor |
| **org** | An organisation that buys seats | school, institution, batch |
| **cohort** | A group of learners in one course run | class, batch |
| **course** | A 4–12 week learning unit | class, module, lesson |
| **week** | A 7-day unit of a course | module, unit |
| **daily test** | The 3-question Socratic test given each weekday | quiz, drill |
| **weekly test** | The 10-question Socratic test given at week end | exam, final |
| **drill** | A spaced-repetition card from a wrong answer | flashcard, quiz |
| **capstone** | The project the learner builds across the course | project (avoid — too generic) |

**In the UI**: always use the glossary term. The audit script will
eventually grep for forbidden variants.

---

## 8. Popups & modals

Popups interrupt the learner's flow. They are reserved for **red-tier
alerts only**:

- A mentor flagged the learner and needs immediate attention.
- A deadline was missed and the streak is at risk.
- A destructive action needs confirmation (AlertDialog).

**Forbidden as popups**:

- Daily task reminders (use inline `DueTodayCard`).
- Onboarding hints (use inline `OnboardingGuide`).
- Feature announcements (use a banner in `PageHeader`).
- "You have X new messages" (use the `NotificationBell` badge count).

The `DailyTaskReminder` modal is the canonical example of what NOT to do
— it interrupted sessions every 10 minutes. Replaced by the inline
`DueTodayCard` in `TodayView`.

---

## 9. Navigation

### Learner nav (4 items, max)

| Item | View | Icon |
|---|---|---|
| Today | `home` | CalendarCheck |
| Study | `study` | BookOpen |
| Project | `project` | GitBranch |
| Progress | `progress` | TrendingUp |

Plus: Credentials and My Courses as secondary entries.

### Shell split: learners get a top bar, staff keep the sidebar

- **Learners** render `LearnerTopNav` (`src/components/examiner/LearnerTopNav.tsx`)
  — a Star Admin-style horizontal bar: brand, primary nav with active
  underline, course switcher (when enrolled in >1 course), ⌘K search,
  theme picker, `NotificationBell`, and a profile menu. Below `lg:` the
  nav collapses into a hamburger drawer.
- **Staff roles** (instructor, org admin, platform admin, demo) keep the
  sidebar shell in `AppShell`.

### Staff nav

Instructors and admins get a richer sidebar, but the same principle: max 6
top-level items. Deeper navigation lives in the global ⌘K command palette
(`@/components/shared/command-palette`, mounted once at the app root —
register page-specific commands via `@/components/shared/command-registry`).

### Breadcrumbs

Every deep page (more than 2 levels from home) has breadcrumbs in
`PageHeader`. Example: `Learn › Web Dev Bootcamp › Week 3 › Daily test`.

---

## 10. Mobile / responsive

- **Breakpoints**: Tailwind defaults (`sm: 640`, `md: 768`, `lg: 1024`).
- **Mobile-first**: write the mobile layout, then enhance for desktop.
- **Touch targets**: minimum 44 × 44 px (Tailwind `h-11 w-11`).
- **Tables**: wrap in a horizontal-scroll container on mobile; never let
  tables break the layout.
- **Forms**: stack labels above inputs on mobile; side-by-side only on
  `sm:` and up.

---

## 11. Accessibility

- Every interactive element has an `aria-label` if it's icon-only.
- Color is never the sole indicator of state (use icons + text + color).
- Focus rings are visible (don't disable `focus:ring`).
- `role="progressbar"` on progress bars, with `aria-valuenow` /
  `aria-valuemin` / `aria-valuemax`.
- Keyboard navigation works for every action (tab order is logical).

---

## 12. The audit gate

Before tagging a release, run:

```bash
bash scripts/ui-backend-audit.sh
```

Every count above zero is a red line. The script checks:

- (A) Build config is safe (`ignoreBuildErrors: false`, `reactStrictMode: true`).
- (B) No dead/redirect components.
- (C) No oversized headings inside app pages.
- (D) States kit adoption (skeleton + empty-state counts).
- (E) No interrupting popups (DailyTaskReminder references).
- (F) No silent catches, no `console.log`, no test-count mismatch.
- (G) IDOR guards on every `?userId` route.
- (H) `tsc --noEmit && lint && test && build` all pass.

Only ship when every gate is green.

---

## 13. Classroom patterns (Modern Class)

`/learn/[courseId]` renders `ClassroomShell`
(`src/modules/learn/components/classroom/`) — the full-screen lesson
experience. Layout rules:

- **PageHeader stays** — 96 px header with topic crumbs, XP/streak/level
  badge pills, Focus + Exit actions.
- **Stage center, avatar beside it** — `AvatarStage` (sprite-rig teacher)
  sits next to the stage on `lg:` and up; the rig is shared with the
  `TutorBadge` dock via `src/modules/learn/components/avatar/avatar-rig.tsx`.
- **Media switcher** — `LessonStage` shows slides (`visualSpec` renders as
  a token-colored visual block) or `VideoStage` (curated YouTube embed via
  `lesson-media` resolver). Video flow: avatar introduces → video plays →
  on end the avatar recaps and moves to the slides.
- **Voice Q&A** — `VoiceBar` wraps the Web Speech API
  (`lib/voice-input.ts`): barge-in (speaking stops TTS), interim
  transcript in the input row, final transcript auto-sends. Unsupported
  browsers degrade to text-only — never hard-fail.
- **Client import caveat** — the learn barrel mixes server code; client
  components import from specific paths (`@/modules/learn/types`,
  `@/modules/learn/components/...`), never the barrel root.

The learner dashboard (`LearnerHome`, `src/modules/learn/components/dashboard/`)
follows the widget language from §5: `StatStrip`, continue-learning CTA,
assignments `table-modern`, project progress, course coverage, activity
feed — each handling empty states inline.
