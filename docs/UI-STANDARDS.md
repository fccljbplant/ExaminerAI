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

TraineesAI uses shadcn/ui's HSL-based theme tokens. **Never hardcode
hex colors** — use the tokens so light/dark mode works.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-background` | white | slate-950 | Page background |
| `bg-card` | white | slate-900 | Card background |
| `bg-muted` | slate-100 | slate-800 | Subtle backgrounds |
| `text-foreground` | slate-900 | white | Primary text |
| `text-muted-foreground` | slate-500 | slate-400 | Secondary text |
| `border-border` | slate-200 | slate-800 | Borders |
| `bg-primary` | emerald-500 | emerald-400 | Primary actions |
| `text-primary` | emerald-600 | emerald-400 | Primary text |
| `bg-destructive` | red-500 | red-500 | Destructive actions |
| `text-destructive` | red-600 | red-400 | Destructive text |

**Semantic colors** (for status, not theming):

| Status | Color | Use |
|---|---|---|
| Success | emerald | "All clear", "Passed", "Completed" |
| Warning | amber | "Due soon", "Calibration flag" |
| Danger | rose | "Overdue", "Failed", "Urgent" |
| Info | sky | "New", "Tip", "Notice" |

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

Plus: Credentials and My Courses as secondary entries (in the sidebar, not
the main nav).

### Staff nav

Instructors and admins get a richer sidebar, but the same principle: max 6
top-level items. Use a Cmd+K command palette (planned) for deeper navigation.

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

### PWA (planned)

- Manifest + icons for add-to-home-screen.
- Offline evidence queue (DB writes queued locally, synced when online).
- Field mode for HSE / lab / site trainees (phone-primary UI).

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
