# Frontend Architecture

## Framework

- **Next.js 16** (App Router, Turbopack)
- **React 19** with hooks
- **Tailwind CSS 4** + **shadcn/ui** primitives
- **next-themes** (light/dark/system)
- **Recharts** for charts (bar charts, theme-aware)
- **lucide-react** for icons

## Component Tree

```
page.tsx (server)
└── ErrorBoundary (catches + displays client-side errors)
└── AppShell (client — auth gate + sidebar + view switcher)
    ├── Login (signup/login/forgot password)
    └── [authed] role-gated views:
        ├── StudentDashboard (mode-switched via initialMode)
        │   ├── JourneyWizard — guided onboarding (14 steps)
        │   ├── Overview — stats + 2 charts + today's tasks + motivation
        │   ├── CheckInPanel (Learning Hub)
        │   │   ├── Today's curriculum topic + resources + mark complete
        │   │   ├── Learning progress chart (curriculum completion)
        │   │   ├── Weekly curriculum overview (5 clickable days)
        │   │   ├── Check-in form with 3 reflection questions
        │   │   └── Recent check-ins (with reflections)
        │   ├── QuestionPanel — AI practice (topic snapshotted)
        │   ├── WeeklyTestPanel — Socratic chatbot (10 Qs, conversation saved)
        │   ├── GanttPanel (Project tab)
        │   │   ├── ProjectDescriptionCard (AI summary + key features + generate)
        │   │   ├── ProjectProgressChart (tasks per week)
        │   │   ├── CompactGantt (multi-week task bars)
        │   │   └── ProjectWeekPlan (collapsible weeks + task CRUD)
        │   ├── ReportCardPanel
        │   │   ├── FinalResultPanel (with project reports + task stats)
        │   │   ├── ProjectReportPanel (submit + AI analyze)
        │   │   └── Weekly report cards
        │   └── SettingsPanel (account + project + security + theme)
        ├── TeacherDashboard (cohort + portfolios + comments + trends)
        ├── AdminDashboard (users + features + passwords + system)
        ├── AITutor (in-app, opens via onMode)
        ├── Messages (inbox/sent + compose)
        └── CourseOutline (iframe)
    └── DailyTaskReminder (floating popup, all student views)
```

## State Management

No global store. Each view manages its own state:
- Auth: `useState` in AppShell + httpOnly cookie
- View routing: `useState<ViewKey>` + `onMode` callback passed to children
- Theme: `next-themes` (localStorage)
- Form state: local `useState` per form
- API data: `useState` + `useEffect` fetch via `api-client.ts`

## API Client

`src/lib/api-client.ts` — typed fetch wrapper:
- Auto-attaches credentials cookie
- 8s default timeout, 60s AI timeout (configurable per-call)
- `api.get/post/put/patch/del` — all accept optional `timeoutMs`
- Throws `ApiError` with `status` + `message` on failure
- `AI_TIMEOUT_MS` exported for long-running requests

## Theme System

CSS variables in `globals.css`:
- `:root` — light (Google blue #1a73e8)
- `.dark` — dark (#8ab4f8 blue)
- All components use semantic tokens (`bg-background`, `text-foreground`, etc.)
- Toggle in sidebar header, persists via localStorage

## Key UI Patterns

- **Collapsible weeks**: `ProjectWeekPlan` — all collapsed on load except current week
- **Multi-week Gantt bars**: tasks with due dates extend across week columns
- **Animated generation modal**: progress bar + cycling status messages for AI task generation
- **Error boundary**: catches client-side errors, shows actual error message + stack trace
- **Inline editing**: week titles, project settings, task fields
- **Optimistic updates with rollback**: task status changes revert on API failure
