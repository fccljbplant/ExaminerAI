# TraineesAI — Stitch Prompt Library

Master prompt library for generating the full TraineesAI UI in Stitch (or similar AI UI tools). 26 screens across 4 user roles + shared components, built on a single design system.

> **How to use**: Copy each prompt block (between the triple-backtick fences) into Stitch one at a time. Start with the **Design System** prompt if Stitch supports global style tokens, otherwise paste it as a preamble before each screen prompt.

---

## 0. Design System (foundation — paste once or as preamble)

```
Design system for "TraineesAI" — a SaaS training platform for engineering internees. AI teaches, AI tests, human mentors. Calm, focused, professional. Reference: Linear dashboard + Notion home + Vercel docs.

TYPOGRAPHY
- UI font: Inter (400/500/600/700)
- Mono font: Geist Mono (code blocks, numeric data)
- Display: Inter Display for headings (or Inter with tighter tracking)
- Scale: 12/14/16/20/24/32/48px
- Line-height: 1.2 headings, 1.5 body

COLOR TOKENS
- App bg: #FAFAFA
- Card bg: #FFFFFF
- Border: #E2E8F0 (slate-200), border-subtle: #F1F5F9
- Primary: indigo-600 #4F46E5 (hover #4338CA, soft bg #EEF2FF)
- Text: slate-900 #0F172A headings, slate-600 #475569 body, slate-400 #94A3B8 muted
- Success: emerald-500 #10B981 (bg #ECFDF5)
- Warning: amber-500 #F59E0B (bg #FFFBEB)
- Danger: rose-500 #F43F5E (bg #FFF1F2)
- Info: sky-500 #0EA5E9 (bg #F0F9FF)
- Slide-type accents: video=#3B82F6, code=#10B981, visual=#8B5CF6, activity=#F97316, reflection=#EC4899

LAYOUT PRIMITIVES
- Max content width: 1280px (max-w-5xl=1024, max-w-6xl=1152, max-w-7xl=1280)
- Sidebar: w-64 (collapsed w-16)
- Card radius: rounded-xl (12px), Hero: rounded-2xl (16px), Pills/buttons: rounded-full
- Card padding: p-5 (default), p-6 (spacious)
- Section gap: 24px, intra-card gap: 16px
- Shadow: shadow-sm default, shadow-md cards, shadow-lg hover (transition 150ms ease)

COMPONENTS
- Buttons: primary (indigo bg, white text), secondary (white bg, slate-700 text, border), ghost (transparent, slate-600), danger (rose-500). All rounded-full, px-4 py-2, font-medium 14px
- Pills/chips: rounded-full, px-2.5 py-0.5, text-xs font-medium, tinted bg + matching text color
- Cards: rounded-xl, border border-slate-200, bg-white, p-5, hover:shadow-md transition
- Inputs: rounded-lg, border-slate-300, focus ring 2px indigo-500/30, h-10, px-3
- Avatar: rounded-full, 32/40/48px sizes, slate-200 bg if no image, initials fallback
- Tables: row-h 48px, hover bg-slate-50, header uppercase 11px slate-500, zebra off
- Modals: rounded-2xl, max-w-lg, p-6, backdrop bg-slate-900/40 backdrop-blur-sm
- Toasts: top-right stack, rounded-lg, shadow-lg, 4s auto-dismiss

ICONS
- Lucide line icons, 1.5 stroke, 20px default / 16px inline
- No emoji except in user-facing gamification (🔥 streak, ⚡ XP)

INTERACTION
- Transitions: 150ms ease for hover/lift, 200ms for modals, 240ms for panel collapse
- Hover lift: -translate-y-0.5 + shadow-md
- Focus ring: 2px indigo-500 with 2px offset
- Loading: skeleton (slate-200 pulse) for cards, spinner for buttons
- Empty states: illustration-optional, headline + 1-line helper + CTA

ACCESSIBILITY
- WCAG AA color contrast minimum
- Visible focus on all interactive elements
- All icon-only buttons have aria-label + tooltip
- Keyboard nav: tab order follows visual order, Esc closes modals

FORBIDDEN
- Stock photos of people, 3D illustrations, aurora/mesh gradients
- Marketing copy on logged-in screens
- More than 2 accent colors per screen
- Drop shadows on text
```

---

## 1. Auth & Onboarding (4 screens)

### 1.1 Login

```
Design the login screen for TraineesAI SaaS app. Split-screen layout, full viewport height.

LEFT PANEL (w-1/2, indigo-600 bg, white text, p-12)
- Vertical centered stack
- Logo: graduation-cap icon + "TraineesAI" wordmark (h-7)
- Headline (h2, text-4xl, font-semibold): "AI teaches. AI tests. You mentor."
- Subhead (text-indigo-100, text-lg): "The training platform built for engineering teams that don't have time to train."
- 3 mini feature bullets with check icons (indigo-200 icons):
  • Adaptive daily tests that find what your trainees don't know
  • AI tutor that explains every concept, on demand
  • You see only the students who actually need you
- Bottom: small text "Trusted by 12 engineering teams" + 3 grayscale company logos

RIGHT PANEL (w-1/2, bg-white, p-12, items-center)
- Max-w-sm card, vertically centered
- "Welcome back" (h1, text-2xl, font-semibold)
- "Sign in to your account" (text-slate-500)
- Form fields (stacked, gap-4):
  • Email input (label above, "you@company.com")
  • Password input (with show/hide eye icon button on right)
  • Row: "Remember me" checkbox (left) + "Forgot password?" text link (right, indigo)
- Primary button (full-width, indigo, rounded-full): "Sign in"
- Divider: "OR" centered with horizontal lines
- Secondary button (full-width, white, border): "Continue with SSO" (with key icon)
- Bottom: "Don't have an account? Request access" (indigo text link)

NO nav bar, NO footer. Pure auth screen. Subtle indigo glow in top-right corner of left panel.
```

### 1.2 Signup / Org creation

```
Design the signup screen for TraineesAI — only org admins create accounts (students are invited). Multi-step form, single screen with progress dots.

LAYOUT
- Centered max-w-lg card on bg-slate-50
- Card: white, rounded-2xl, p-8, shadow-xl
- Header: TraineesAI logo + "Set up your org" h1 + "Step 2 of 3" subtext
- Progress dots: 3 dots (filled, filled, empty), 8px circles, indigo filled

FORM FIELDS (step 2 — org details)
- Organization name (text input, "Acme Engineering")
- Organization type (segmented control: "Engineering team" | "University" | "Bootcamp")
- Team size (select: 1-10, 11-50, 51-200, 200+)
- Your role (text input, "Engineering Manager")
- Work email (already prefilled from invite, disabled state)
- Phone (optional, with country code dropdown)

FOOTER ROW
- Left: "Back" ghost button
- Right: "Continue" primary button (indigo, disabled until required fields valid)

TRUST ELEMENTS below card
- Lock icon + "Your data is encrypted at rest"
- No credit card required • 14-day pilot

Empty space top + bottom, no nav. Subtle indigo radial gradient behind card.
```

### 1.3 Course selection onboarding

```
Design the post-signup onboarding screen: "Pick your first course". Full-screen, bg-slate-50, no nav.

HEADER (sticky top, white bg, h-16, border-b)
- Left: TraineesAI logo
- Right: "Step 3 of 4" + small avatar (current user)

MAIN (max-w-4xl, centered, py-12)
- H1 (text-3xl): "What will your trainees learn?"
- Subtitle (text-slate-500, text-lg): "Pick from our catalog or create a custom course. You can change this later."
- Search bar (full-width, h-12, with magnifier icon, placeholder "Search courses — try 'React', 'Python', 'Kubernetes'")
- Filter chips row (horizontal scroll): "All" "Frontend" "Backend" "DevOps" "Data" "Security" "Custom"

COURSE GRID (grid-cols-3, gap-5)
6 course cards, each:
- Card: rounded-xl, border, p-5, hover:shadow-md, cursor-pointer
- Top: 16:9 thumbnail with gradient bg (unique color per course), course icon centered
- Below: Course title (font-medium) + "32 lessons · 6 weeks" (text-slate-500 text-sm)
- Tags row: 2-3 small chips ("React", "Hooks", "Testing")
- Bottom: "Select" button (ghost, becomes primary indigo on hover/select)
- Selected state: indigo ring-2, checkmark badge top-right

Example courses:
1. React Fundamentals (blue gradient)
2. Python for Engineers (green)
3. Kubernetes Deep Dive (purple)
4. AWS Certified Solutions Architect (orange)
5. System Design Interview Prep (pink)
6. SQL & Databases (cyan)

FOOTER (sticky bottom, white bg, h-16, border-t, flex justify-between px-6)
- Left: "0 of N selected"
- Right: "Skip for now" ghost + "Continue →" primary (disabled until ≥1 selected)
```

### 1.4 Mentor pairing

```
Design the mentor pairing screen: "Pair students with mentors". Full-screen, bg-slate-50.

LAYOUT
- Same header as previous onboarding step
- Max-w-5xl, py-12

H1: "Pair students with mentors"
Subtitle: "Each student gets a human mentor who reviews AI-flagged struggles. Pair them now or skip and do it later."

TWO-COLUMN PAIRING UI
Left column header: "Students (8)" with search input
Right column header: "Mentors (3)" with "Add mentor" text-link button

Left column — list of student rows (8):
- Avatar + name + course tag
- Currently paired with: "Unassigned" (amber) OR "Sarah K." (green)
- Drag handle on left

Right column — list of mentors (3):
- Avatar + name + title
- Capacity: "3/5 students" with mini progress bar
- Drag handle

INTERACTION (visualized)
- Show one drag in progress: a student row (Alex R.) being dragged, ghosted from left list, hovering over Sarah K. row on right with indigo drop ring
- Other already-paired rows show small avatar stack on mentor row

AUTO-PAIR BAR (top, indigo-50 bg, rounded-xl, p-4)
- Sparkle icon + "Auto-pair by workload?" + "Auto-pair" primary button

BOTTOM NAV (sticky)
- "Back" ghost + "Skip pairing" ghost + "Finish setup →" primary indigo
```

---

## 2. Student Experience (6 screens)

### 2.1 TodayView

*(Use the prompt from chat — flagship student home screen answering "what do I do next?")*

```
Design a clean, modern SaaS dashboard screen for "TraineesAI" — the student (trainee) home screen, called "TodayView". Answers "what do I do next?" in one glance.

LAYOUT
- Top nav (sticky h-14, white, border-b): logo + course switcher dropdown + streak "🔥 12" + XP pill "+340 today" + avatar
- Main: max-w-5xl centered, px-6 py-8
- Right: AI Tutor panel w-80, collapsible, bg-slate-50

MAIN SECTIONS
1. Hero greeting card (rounded-2xl, indigo gradient bg, white text, p-6)
   - "Good morning, Alex" h1 + subtitle "62% through Week 3. 2 drills + 1 daily test due today."
   - Primary CTA: "Start today's session →" (white bg, indigo text)
   - Secondary link: "or jump back into Slide 7: useEffect cleanup"

2. "Due today" grid-cols-3
   - Card A "Daily Test" — clipboard icon, "Due in 6h" amber chip, "0/3" progress, "Start test"
   - Card B "Spaced drill" — refresh icon, "Mastered 3/5" amber chip, "Resume drill"
   - Card C "Capstone" — rocket icon, "Milestone 2 of 5" + mini Gantt, "Open project"

3. "Continue learning" horizontal slide scroll
   - 3 visible 16:9 thumbnails, gradient bg by type (video=blue, code=green, visual=purple, activity=orange, reflection=pink)
   - Below each: slide # + title + "12 min"
   - Active slide has indigo ring-2

4. "This week" 2-col
   - Left: weekly test card "Due Friday — 10 Qs"
   - Right: SVG progress ring 62% + chips "Lessons 8/12 · Drills 14/20 · Tests 2/3"

AI TUTOR PANEL (right)
- Header "AI Tutor" + green online dot
- Proactive bubble: "👋 Want me to explain useEffect cleanup from Slide 7?"
- 2-3 chat messages example
- Bottom: rounded-full input "Ask your tutor..." + mic + send

STYLE: Inter UI / Geist Mono numerics, indigo-600 primary, slate text, generous spacing, Lucide icons 1.5 stroke. Calm Linear/Notion vibe.
```

### 2.2 SlideViewer

```
Design the SlideViewer screen for TraineesAI — where students consume course content. Three-zone layout.

TOP NAV (sticky h-14, white, border-b)
- Left: back arrow + "React Fundamentals / Week 3 / Lesson 7"
- Center: slide dots (7 dots, dot 4 filled indigo, others slate-300)
- Right: progress "12:34 / 18:00" + settings gear + avatar

MAIN LAYOUT (h-[calc(100vh-3.5rem)], grid 3 cols)
- Left rail w-64 (white, border-r): slide list
- Center: slide canvas (flex-1, bg-slate-50)
- Right rail w-80 (slate-50, border-l): AI Tutor

LEFT RAIL — Slides list
- Header "Lesson 7: useEffect" (font-medium) + "8 slides · 18 min"
- Scroll list of 8 slide rows, each row:
  • Slide number circle (filled indigo if done, ring if current, slate if upcoming)
  • Slide title (text-sm) + type icon (video/code/visual/activity/reflection per palette)
  • Duration "2:30" (text-xs slate-400)
  - Current row (Slide 4): indigo-50 bg, left border-2 indigo
- Bottom: "Mark lesson complete" button (primary, full-width)

CENTER — Slide canvas
- 16:9 ratio card, white bg, rounded-2xl, shadow-md, centered
- Slide type badge top-left (e.g. "CODE" green chip)
- Slide title (h2): "useEffect cleanup function"
- Body content (varies by type — for CODE slide):
  • Code block (Geist Mono, slate-900 on slate-50 bg, rounded-lg, p-4):
    ```
    useEffect(() => {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);  // ← cleanup
    }, []);
    ```
  • Highlight on the cleanup line with indigo bg
  • Below: 2-line explanation paragraph
- Bottom of canvas: prev/next arrows (left/right, ghost buttons) + "1 / 8" counter

RIGHT RAIL — AI Tutor
- Header: "AI Tutor" + collapse chevron
- Context strip: "📍 Slide 4 — useEffect cleanup"
- Chat thread with proactive bubble:
  • Tutor (left, indigo bg, white text, rounded-2xl): "Notice the return function — that's the cleanup. It runs before the next effect. Want to see what happens without it?"
  • Student (right, white bg, border, rounded-2xl): "Yeah show me"
  • Tutor: "Without cleanup, the interval keeps running. Each re-render adds another interval. Memory leak + double-firing ticks."
- Input bar bottom: rounded-full, "Ask about this slide..." + send button

NO marketing copy. Focused, single-task screen.
```

### 2.3 Daily Test (Socratic)

```
Design the Daily Test screen for TraineesAI — 3 Socratic questions, NOT multiple choice. Single question at a time, full focus.

TOP NAV (minimal, h-14, white, border-b)
- Left: "✕ Exit" ghost button (with confirm dialog warning)
- Center: progress dots "Question 2 of 3" (filled/filled/empty)
- Right: timer "04:32" (mono font, slate-600)

MAIN (max-w-2xl, centered, py-12)
- Top context strip (slate-50, rounded-lg, p-3, mb-8):
  "📍 React Fundamentals / Week 3 / Daily Test" + small "3 questions · ~5 min" muted

- Question card (white, rounded-2xl, border, p-8):
  - Question number badge top-left: "Q2" (indigo-50 bg, indigo-600 text, rounded-full, px-3 py-1)
  - Difficulty dots (1-5 scale): 3 filled indigo, 2 empty slate-200 + "Medium" label
  - Question (h2, text-2xl, font-medium, leading-snug): "Explain what happens if you skip the cleanup function in useEffect, and why React needs it."
  - Below question: textarea (min-h-32, rounded-lg, border-slate-300, p-4, placeholder "Type your answer..."), with markdown hint below: "Supports markdown · 0/500 words"
  - Bottom row of card:
    - Left: chip "Auto-saving" with spinner (or "Saved" with check)
    - Right: "Skip" ghost + "Submit answer →" primary (disabled if empty)

- Below card: hint helper (text-sm slate-500, italic):
  "💡 The AI tutor will follow up if your answer is incomplete — partial credit is fine."

FOOTER BAR (sticky bottom, white, border-t, h-16)
- Left: small "Don't refresh — your progress is saved"
- Right: "← Previous" ghost (disabled for Q1) + "Next →" primary (disabled until answered)

No sidebar, no AI tutor panel — distraction-free test mode.
```

### 2.4 Weekly Test

```
Design the Weekly Test screen for TraineesAI — 10 Socratic questions covering the entire week. Same single-question focus as daily test, but with section navigation.

TOP NAV (h-14, white, border-b)
- Left: "✕ Exit" with confirm dialog
- Center: "Weekly Test · Week 3" h1 small
- Right: timer "23:14 of 30:00" (amber when < 5 min left)

MAIN LAYOUT (max-w-6xl, centered, py-8, grid 12 cols)
- Left col-span-8: question card (same style as daily test)
- Right col-span-4: question navigator panel (sticky)

QUESTION CARD (col-span-8)
- Question badge "Q4 of 10"
- Difficulty: "4/5 — Hard"
- Section tag: "Hooks" (indigo chip)
- Question (h2): "Compare and contrast useMemo and useCallback. When would you use each, and when are they premature optimizations?"
- Textarea answer (min-h-40)
- Below textarea: live word count + "Saved" indicator
- Bottom: "Previous" ghost + "Submit & Next →" primary

RIGHT NAVIGATOR (col-span-4)
- Card with header "Questions" + "Answered 3/10" progress bar
- Grid grid-cols-5 of question number buttons:
  - Done: indigo-600 bg, white text
  - Current: ring-2 indigo, white bg, indigo text
  - Unanswered: slate-100 bg, slate-500 text
  - Flagged: rose-500 ring (right-click to flag)
- Below grid: "Flag for review" toggle button
- Helper text: "Click any number to jump"
- Bottom of panel: "Submit test" button (danger rose if unanswered > 0, with confirm modal listing unanswered question numbers)

No AI tutor panel here — this is assessment, not learning.
```

### 2.5 Drill session (spaced repetition)

```
Design the Spaced Drill screen for TraineesAI — short focused practice on past mistakes. Cards come back until mastered.

TOP NAV (minimal h-14)
- Left: "✕ End drill" ghost
- Center: "Spaced Drill" + chip "from yesterday's wrong answers"
- Right: streak "🔥 4" + "Mastered 3/5" progress

MAIN (max-w-xl, centered, py-12)

DRILL CARD STACK
- Show current drill card centered, slight card-stack shadow behind (next 2 cards visible as offsets)
- Card (white, rounded-2xl, border, shadow-lg, p-8, min-h-96):
  - Top-left: card number "Card 4 of 5" (slate-500 text-sm)
  - Top-right: mastery indicator — 3 small dots (filled = mastered previously)
  - Prompt label (uppercase, text-xs, slate-400): "EXPLAIN"
  - Prompt (h2, text-xl): "Why does React need keys in lists?"
  - Below: 1-line hint (slate-500 italic, text-sm): "Think about reconciliation."
  - Textarea (min-h-24, placeholder "Your answer...")
  - Bottom: "Show hint" ghost (reveals 1 more line below) + "Submit" primary

FEEDBACK STATE (after submit)
- Card flips or transitions to feedback view
- Top: green "✓ Strong answer" OR amber "Partial — review needed" OR rose "Requeue this card"
- AI feedback paragraph (3-4 sentences, specific to the answer)
- "What was missing" bullet list (1-3 items, rose-50 bg chips)
- "What you got right" bullet list (1-3 items, emerald-50 chips)
- Bottom: "Next card →" primary

BOTTOM PROGRESS BAR (sticky)
- 5 segments, filled = mastered, half = partial, empty = upcoming
- "Session ends when all 5 mastered OR after 10 min" helper text
```

### 2.6 Capstone project view

```
Design the Capstone Project screen for TraineesAI — AI-generated multi-week project with milestones, Gantt, and submission.

TOP NAV (h-14, white, border-b)
- Back arrow + "Capstone: Build a Task Tracker API" h1 + course tag chip
- Right: "Ask AI tutor" ghost + avatar

MAIN (max-w-6xl, py-8, grid 12 cols)

LEFT (col-span-8)
1. Hero card (slate-900 bg, white text, rounded-2xl, p-6)
   - "Capstone Project" eyebrow + h2 "Build a Task Tracker API with auth"
   - 1-line description
   - Stats row: "4 weeks" · "5 milestones" · "Due Sep 15"
   - Progress bar: 40% complete (emerald)

2. Milestones list (5 cards, vertical stack, gap-3)
   Each milestone card (white, rounded-xl, border, p-5):
   - Left: status circle (done=green check, current=indigo ring pulse, upcoming=slate-200)
   - Title: "Milestone 2: JWT Authentication" (font-medium)
   - Subtitle: "Implement login, signup, token refresh" (slate-500 text-sm)
   - Right: status chip — "Submitted" (emerald) / "In progress" (amber) / "Locked" (slate)
   - Expanded current milestone shows:
     • Checklist (4 items, 2 checked): "POST /auth/login", "POST /auth/signup", "Token refresh", "Logout"
     • "Submit milestone" primary button + "View AI feedback" ghost

3. Gantt chart card (white, rounded-xl, border, p-5)
   - Title: "Timeline" + week labels (W1 W2 W3 W4) across top
   - 5 horizontal bars stacked, each bar colored per status:
     • M1: emerald (W1)
     • M2: indigo (W1-W2, current marker)
     • M3: slate-200 (W2-W3, upcoming)
     • M4: slate-200 (W3)
     • M5: slate-200 (W3-W4)
   - "Today" vertical line at W2 position

RIGHT (col-span-4)
1. AI-generated tasks card
   - "Suggested next steps" header
   - 3 task chips: "Write JWT util", "Add bcrypt to signup", "Test token expiry"
   - "Regenerate tasks" ghost (with sparkle icon)

2. Resources card
   - "Project resources" header
   - 3 link rows with external-link icon: "Express auth docs", "JWT best practices", "Example repo"

3. Recent AI feedback card
   - Latest feedback snippet (truncated 2 lines)
   - "View full feedback →" link
```

---

## 3. Instructor Experience (6 screens)

### 3.1 Instructor Today tab

```
Design the Instructor Today screen for TraineesAI — home for mentors. Shows students needing attention + recent submissions in one glance.

LAYOUT
- Left sidebar w-64 (sticky, full height, white, border-r):
  • Logo top
  • Nav items: Today (active, indigo-50 bg), Students, Assignments, Insights, Messages, Settings
  • Bottom: small "Org: Acme Eng" + avatar menu
- Main: max-w-6xl, px-8 py-8

TOP BAR
- H1 "Good morning, Sarah" + subtext "3 students need your attention today"
- Right: notification bell + "New assignment" primary button

SECTION 1 — "Needs attention" (3 cards, grid-cols-3)
Each card (white, rounded-xl, border, p-5, hover:shadow-md):
- Top: avatar (48px) + name + course tag
- Big metric: "Attention score 8.4 / 10" (rose text for high)
- Reason chips (1-3): "Failed 3 drills in a row" / "Skipped 2 daily tests" / "Stuck on Slide 7"
- Last active: "2h ago"
- Bottom: "View student →" primary button

Example students:
1. Alex R. — score 8.4 — "Failed 3 drills in a row"
2. Maria T. — score 7.1 — "Stuck on Slide 7, asked AI tutor 5x"
3. Jordan K. — score 6.8 — "Skipped 2 daily tests this week"

SECTION 2 — "Recent submissions" (table)
- Header: "Recent submissions" + "View all →" link
- Table columns: Student | Assignment | Submitted | AI Grade | Action
- 5 rows:
  • Alex R. | Daily Test W3D4 | 2h ago | 67% | Review →
  • Maria T. | Milestone 2 | 5h ago | 84% | Review →
  • Jordan K. | Spaced Drill | 6h ago | 40% | Review →
  • Sam L. | Weekly Test W3 | 1d ago | 92% | Review →
  • Priya N. | Daily Test W3D4 | 1d ago | 78% | Review →
- AI grade cell color: emerald ≥80%, amber 60-79%, rose <60%
- Rows hover bg-slate-50

SECTION 3 — "This week stats" (3 stat cards, grid-cols-3)
- "Students you mentor" 8 (with +1 this week)
- "Avg time to grade" 1.2h (with -30min trend arrow)
- "Students passing weekly test" 6/8 (75%, emerald)
```

### 3.2 Students roster

```
Design the Students Roster screen for TraineesAI — sortable/filterable list of all students a mentor oversees.

LAYOUT
- Same left sidebar (Students active)
- Main: max-w-7xl, px-8 py-8

HEADER ROW
- H1 "Students" + subtext "8 active · 2 inactive"
- Right: "Export CSV" ghost + "Invite student" primary

FILTER BAR (white card, rounded-xl, p-4, mb-6)
- Row 1: Search input (with magnifier, "Search by name or email")
- Row 2 (chips, horizontal): "All" "Active" "At risk" "Top performers" + course dropdown + sort dropdown (default: "Attention score ↓")

TABLE (white card, rounded-xl, border, overflow-hidden)
Columns:
| Student | Course | Progress | Attention Score | Last Active | Streak | Status | Actions |
Rows (8 example students):
- Each row h-16, hover bg-slate-50
- Student cell: 40px avatar + name + email (small)
- Course cell: chip with course color
- Progress cell: mini progress bar + "%" (e.g. "62% [████░░░░]")
- Attention score cell: number colored (rose ≥7, amber 4-6.9, emerald <4) + sparkline mini
- Last active: relative ("2h ago")
- Streak: "🔥 12" or "—" if 0
- Status: green dot "Active" / amber "At risk" / gray "Inactive"
- Actions: kebab menu (View, Message, Override grade, Pause)

Right edge: pagination "Showing 1-8 of 8" + page controls

EMPTY STATE (if no students): illustration + "No students yet" + "Invite your first student" CTA
```

### 3.3 Student detail

```
Design the Student Detail screen for TraineesAI — drill-in on one student. Heavy on data, light on chrome.

LAYOUT
- Same left sidebar
- Main: max-w-6xl, py-8

HEADER CARD (white, rounded-2xl, border, p-6, mb-6)
- Left: large avatar (64px) + name (h1) + email + course chip + "Joined 3 weeks ago"
- Right: action buttons — "Message" secondary + "Pause student" ghost + "Override grade" primary
- Below row: 4 stat tiles in grid-cols-4
  • Overall progress 62% (with up arrow)
  • Attention score 8.4 (rose) with "↑ 1.2 this week" subtitle
  • Streak 12 days (🔥)
  • Avg test score 74% (amber, "↓ 6% vs last week")

TABS (sticky, white bg, border-b)
- Overview (active) | Activity | Submissions | Messages | Notes

OVERVIEW TAB CONTENT (grid 12 cols)

LEFT (col-span-8)
1. "Recent activity" timeline card
   - Vertical timeline with 6 events:
     • 2h ago — Submitted Daily Test W3D4 (67%)
     • 5h ago — Started Slide 7 (useEffect)
     • 1d ago — Failed Spaced Drill (3rd time)
     • 1d ago — Asked AI tutor: "What is a closure?"
     • 2d ago — Completed Weekly Test W2 (82%)
     • 3d ago — Started Milestone 2
   - Each event: time + icon (test/code/drill/chat/milestone) + description + grade chip if applicable

2. "Learning signals" card
   - 3 mini charts (sparklines):
     • Daily test scores (last 7 days) — trending down
     • Drill mastery rate — flat at 60%
     • Time per slide — increasing (stuck indicator)

RIGHT (col-span-4)
1. "AI tutor summary" card (indigo-50 bg, rounded-xl, p-5)
   - Sparkle icon + "AI summary"
   - 3-sentence paragraph: "Alex is struggling with useEffect cleanup. Skipped 2 daily tests. Strong on JSX fundamentals."
   - "Suggested intervention" chip: "1:1 on useEffect" + "Schedule" button

2. "Milestones" mini list
   - 5 milestone rows, status dots, % complete

3. "Quick notes" card
   - Textarea (placeholder "Add a private note about Alex...")
   - 2 existing notes (date + text) below

4. "Grade overrides" history (if any)
   - List of past overrides: date + test + old grade → new grade + reason
```

### 3.4 Assignments list

```
Design the Assignments screen for TraineesAI — list of all assignments a mentor has created.

LAYOUT
- Same left sidebar (Assignments active)
- Main: max-w-6xl, py-8

HEADER
- H1 "Assignments" + subtext "12 assignments · 4 active"
- Right: "Templates" ghost + "New assignment" primary (with sparkle AI icon)

FILTER BAR
- Tabs (segmented control): "All" "Active" "Drafts" "Archived"
- Right of tabs: course dropdown + "Sort by: Due date ↓"

ASSIGNMENT CARDS (vertical list, gap-4)
Each card (white, rounded-xl, border, p-5):
- Left section (w-2/3):
  • Row 1: title (font-medium, text-lg) + status chip (Active=emerald / Draft=slate / Archived=gray)
  • Row 2: course chip + type chip ("Group task" / "Individual" / "Peer assessment")
  • Row 3: description (1 line truncated, slate-500)
  • Row 4: meta chips: "Due Aug 15" + "32 students" + "Avg grade 78%"
- Right section (w-1/3, slate-50 bg, rounded-lg, p-3):
  • Submission progress bar: "24/32 submitted" + bar
  • "Needs grading" count: "8 pending" (amber)
  • Action buttons: "Grade" primary + kebab menu

3 example cards visible:
1. "Capstone: Task Tracker API" — Active, Group — 24/32 submitted — 8 pending
2. "Peer review: Code refactoring exercise" — Active, Peer assessment — 30/32 submitted — 2 pending
3. "Hooks deep dive essay" — Draft — Not assigned
```

### 3.5 Assignment grading

```
Design the Assignment Grading screen for TraineesAI — single student submission review with AI-assisted grading + human override.

LAYOUT
- Same left sidebar
- Top: breadcrumb "Assignments / Capstone: Task Tracker API / Grade Alex R."
- Main: max-w-7xl, py-6, grid 12 cols

LEFT (col-span-3) — Submission queue
- Card with header "Queue (8 pending)"
- List of 8 student rows:
  • Avatar + name + "Submitted 2h ago"
  • AI grade badge (e.g. "67%")
  - Current student (Alex R.) highlighted indigo-50, left border-2 indigo
- Bottom: "Mark all as graded" ghost button

CENTER (col-span-6) — Submission content
- Card (white, rounded-xl, p-6, max-h-screen overflow-y-auto)
  - Header: "Alex R. — Capstone Milestone 2: JWT Auth"
  - Submission metadata: "Submitted Aug 7, 2:14 PM · 4 files · Git repo link"
  - Tabs: "Code" (active) | "Written answer" | "Resources"
  - Code view:
    • File tree on left mini-panel (auth.ts, login.ts, signup.ts, etc.)
    • Selected file content (Geist Mono, syntax highlighted, line numbers)
    • AI-flagged lines: rose-50 bg with comment icon in gutter
  - Below code: "Written reflection" section (Alex's 200-word answer in prose)
  - "View on GitHub" external link

RIGHT (col-span-3) — Grading panel (sticky)
- Card with header "Grading"
- Rubric section:
  • 4 rubric items, each: title + AI score + slider (0-100) + "Override" toggle
    1. Correctness: AI 70% [slider]
    2. Code quality: AI 65% [slider]
    3. Auth best practices: AI 80% [slider]
    4. Documentation: AI 50% [slider]
- Final grade: "Overall: 67%" (auto-calculated, bold, large)
- Override section:
  • Toggle: "Override final grade" (reveals number input)
  • Reason textarea (required if overriding): "Why are you overriding?"
- AI feedback preview (read-only, indigo-50 bg, p-3): "Strong start. JWT implementation correct. Missing: refresh token rotation, rate limiting on /login..."
- "Add to feedback" button (lets mentor append)
- Bottom actions:
  • "Save draft" ghost
  • "Submit grade" primary (emerald) — disabled until rubric complete
  • "Skip to next" ghost
```

### 3.6 Insights / Analytics

```
Design the Insights screen for TraineesAI — operational analytics for instructors. Charts and KPIs, no fluff.

LAYOUT
- Same left sidebar (Insights active)
- Main: max-w-7xl, py-8

HEADER
- H1 "Insights" + subtext "Last 30 days · 8 students · React Fundamentals"
- Right: date range dropdown (default "Last 30 days") + course dropdown + "Export PDF" ghost

KPI ROW (grid-cols-4, gap-4)
Each KPI card (white, rounded-xl, border, p-5):
- Label (uppercase, text-xs, slate-500)
- Big number (text-3xl, font-semibold)
- Trend chip: emerald ↑ or rose ↓ with delta %
- Mini sparkline at bottom (24px tall)
Example KPIs:
1. Avg test score — 78% — ↑ 4% — upward sparkline
2. Drill mastery rate — 72% — ↑ 8% — upward sparkline
3. Active students — 8/8 — stable — flat line
4. Avg session length — 23 min — ↓ 3 min — slight down

CHARTS GRID (grid-cols-2, gap-6, mt-8)

Chart 1 (col-span-2, full width): "Test scores over time"
- Line chart, x-axis = days (last 30), y-axis = avg score %
- Two lines: Daily tests (indigo) vs Weekly tests (emerald)
- Hover tooltip showing date + score
- Legend top-right
- Y-axis 0-100, grid lines slate-100

Chart 2 (col-span-1): "Submission status breakdown"
- Donut chart with 4 segments: Graded (emerald), Pending (amber), Late (rose), Missing (slate)
- Center text: "248 total"
- Legend below

Chart 3 (col-span-1): "Students by attention score"
- Horizontal bar chart, 8 bars (one per student), colored by score band
- Sorted by score descending
- Score label at end of each bar

Chart 4 (col-span-2, full width): "Topic mastery heatmap"
- Heatmap: rows = topics (useEffect, Hooks, JSX, State, Props, Events, Context, Reducers), cols = students
- Cell color: emerald (mastered) → amber (learning) → rose (struggling) → slate (not started)
- Hover shows percentage

BOTTOM: "Top struggling topics" card
- 3 chips: "useEffect cleanup (5 students)", "Reducer pattern (4)", "Context vs Props (3)"
- Each chip clickable to drill into topic detail
```

---

## 4. Org Admin Experience (4 screens)

### 4.1 Org Dashboard

```
Design the Org Admin Dashboard for TraineesAI — overview for engineering managers running the training program across their team.

LAYOUT
- Left sidebar w-64 (different from instructor — admin nav):
  • Logo + "Acme Engineering" org name
  • Nav: Dashboard (active), Members, Courses, Billing, Settings
  • Bottom: "Switch to instructor view" link + avatar
- Main: max-w-7xl, py-8

HEADER
- H1 "Acme Engineering" + subtext "12 members · 3 active courses · Pilot started Jul 15"
- Right: "Invite members" primary + "Download report" ghost

KPI ROW (grid-cols-4)
1. Active trainees — 10/12 — emerald dot
2. Avg completion rate — 68% — ↑ 12% this month
3. Total study hours — 234h — ↑ 45h
4. MRR — $480 — "Pilot (free)" chip in amber

TWO-COLUMN MAIN (grid-cols-3, gap-6, mt-8)

LEFT (col-span-2)
1. "Engagement over time" chart card
   - Stacked area chart: x=weeks, y=hours
   - Areas: Active learning (indigo), Tests (emerald), Drills (amber)
   - Legend top-right
   - 8 weeks of data shown

2. "Course progress" card
   - 3 course rows, each:
     • Course name + enrollment count
     • Progress bar (avg across students)
     • "Avg grade 74%" + completion % "62%"
     • Sparkline trend

3. "Top performers" table (top 5)
   - Rank | Student | Hours | Avg grade | Trend
   - 5 rows, medal icons for top 3 (gold/silver/bronze)

RIGHT (col-span-1)
1. "Pilot status" card (amber-50 bg)
   - "14-day pilot" + "8 days remaining"
   - Progress bar 6/14 days
   - "Upgrade to paid" primary button
   - "Talk to sales" ghost link

2. "Recent activity" feed
   - 5 events: "Maria completed Week 3", "Alex submitted capstone", "New member invited", etc.
   - Each: time + actor + action

3. "Billing snapshot" card
   - Current plan: "Pilot (free)"
   - Next billing: "Aug 22 — $480/mo (12 seats × $40)"
   - "Manage billing" link
```

### 4.2 Members management

```
Design the Members Management screen for TraineesAI — admin CRUD for org members.

LAYOUT
- Same admin left sidebar (Members active)
- Main: max-w-6xl, py-8

HEADER
- H1 "Members" + subtext "12 members · 10 trainees · 2 mentors"
- Right: "Import CSV" ghost + "Invite member" primary

FILTER BAR
- Tabs: "All" "Trainees" "Mentors" "Pending invites"
- Search input + role dropdown + status dropdown

TABLE (white card, rounded-xl, border)
Columns:
| Member | Role | Course | Mentor | Status | Last active | Actions |
Rows (12):
- Avatar + name + email
- Role chip: "Trainee" (slate) / "Mentor" (indigo) / "Admin" (rose)
- Course chip (or "—" if mentor)
- Mentor name (or "—" if mentor/admin)
- Status: green "Active" / amber "Pending" / gray "Inactive"
- Last active relative time
- Actions kebab: Edit role, Reassign mentor, Suspend, Remove

ROW EXAMPLES:
1. Alex Rivera — Trainee — React — Sarah K. — Active — 2h ago
2. Maria Torres — Trainee — Python — Sarah K. — Active — 5h ago
3. Sarah Kim — Mentor — — — Active — 1h ago
4. (You) — Admin — — — Active — now
5. Jordan Lee — Trainee — React — Sarah K. — Pending — —

BULK ACTIONS (appear when rows selected)
- Sticky bar bottom: "3 selected" + "Assign mentor" + "Change course" + "Remove"
```

### 4.3 Courses management

```
Design the Courses Management screen for TraineesAI — admin view of org's enrolled courses + catalog.

LAYOUT
- Same admin left sidebar (Courses active)
- Main: max-w-6xl, py-8

HEADER
- H1 "Courses" + subtext "3 active · 47 in catalog"
- Right: "Browse catalog" primary + "Create custom course" ghost (with sparkle icon)

TWO SECTIONS

SECTION 1 — "Your courses" (3 cards, grid-cols-3)
Each card (white, rounded-2xl, border, p-6):
- Top: course thumbnail (16:9 gradient bg + icon)
- Course title (h3) + "32 lessons · 6 weeks"
- Enrollment: "8 students enrolled" with mini avatar stack
- Progress: avg completion 62% with bar
- Stats row: "Avg grade 74%" · "234h studied"
- Bottom: "Manage course" primary + "View analytics" ghost

Example courses:
1. React Fundamentals (blue) — 8 students — 62%
2. Python for Engineers (green) — 4 students — 48%
3. Kubernetes Deep Dive (purple) — 2 students — 31%

SECTION 2 — "Catalog" (grid-cols-4, gap-4)
Header: "Browse catalog" + search input + filter chips
12 course cards (smaller than section 1):
- 16:9 gradient thumbnail
- Title (font-medium)
- "32 lessons · 6 weeks"
- Tags (1-3 chips)
- "Add to org" button (ghost → primary on hover)
- Already-added cards show "Added" disabled state with check
```

### 4.4 Billing (Stripe)

```
Design the Billing screen for TraineesAI — Stripe-powered subscription management for org admins.

LAYOUT
- Same admin left sidebar (Billing active)
- Main: max-w-5xl, py-8

HEADER
- H1 "Billing" + subtext "Manage your subscription and payment method"
- Right: "Download invoices" ghost

CURRENT PLAN CARD (gradient indigo bg, white text, rounded-2xl, p-6, mb-6)
- "Pilot plan" eyebrow + "Free for 14 days" h2
- Stats row: "8 days remaining" · "12 / 12 seats used" · "$0/mo"
- Progress bar: pilot 6/14 days
- Two buttons: "Upgrade to Team plan →" primary (white bg, indigo text) + "Compare plans" ghost (white text, white border)

PLAN COMPARISON CARD (white, rounded-2xl, border, p-6, mb-6)
- 3 columns: "Pilot" (current, highlighted) | "Team" | "Enterprise"
- Rows of features with check/x:
  • Seats: 12 max | 5-50 | Custom
  • Courses: 3 | Unlimited | Unlimited + custom
  • AI tutor: Limited | Unlimited | Unlimited
  • Analytics: Basic | Advanced | Custom reports
  • SSO: — | SAML | SAML + SCIM
  • Support: Email | Priority | Dedicated
- Price row: $0 | $40/seat/mo | Contact sales
- Buttons: "Current" disabled | "Upgrade" primary | "Contact sales" ghost

PAYMENT METHOD CARD (white, rounded-xl, border, p-5, mb-6)
- Header "Payment method" + "Edit" ghost
- Visa card mockup (gradient bg, last 4 "4242", exp 12/27)
- "Default" chip

INVOICES TABLE (white card, rounded-xl, border)
- Header "Invoice history" + "Download all" ghost
- Table: Date | Invoice # | Amount | Status | Download
- 5 rows (mostly $0 during pilot, first paid invoice upcoming)
- Status: Paid (emerald) / Upcoming (amber) / Failed (rose)

BOTTOM CARD — "Danger zone" (rose-50 bg, rounded-xl, border-rose-200, p-5)
- "Cancel subscription" ghost button (rose text)
- Helper: "Cancelling will archive all student data after 30 days."
```

---

## 5. Super Admin (3 screens)

### 5.1 Platform Overview

```
Design the Super Admin Platform Overview for TraineesAI — internal dashboard for the TraineesAI team running the platform itself.

LAYOUT
- Left sidebar w-64 (super admin nav):
  • TraineesAI logo + "Super Admin" red badge
  • Nav: Overview (active), Organizations, Users, Courses, Feature Flags, Logs, Settings
  • Bottom: avatar
- Main: max-w-7xl, py-8

HEADER
- H1 "Platform overview" + subtext "Last 30 days · 47 orgs · 412 users"
- Right: date range dropdown + "Export report" ghost

KPI ROW (grid-cols-5, gap-4)
1. Total orgs — 47 — ↑ 8 this month — sparkline
2. Total users — 412 — ↑ 67 — sparkline
3. MRR — $18,240 — ↑ $2,400 — sparkline
4. Active orgs (DAU) — 38/47 — 81% — emerald
5. Avg NPS — 47 — ↑ 4 — sparkline

CHARTS GRID (grid-cols-2, gap-6)

Chart 1 (col-span-2): "Growth over time"
- Stacked bar chart, x=months (12), y=users
- Stacks: Trainees (indigo) / Mentors (emerald) / Admins (slate)
- Line overlay: MRR (right axis)

Chart 2 (col-span-1): "Orgs by plan"
- Donut: Pilot (amber) 24 / Team (indigo) 19 / Enterprise (rose) 4
- Center: "47 orgs"

Chart 3 (col-span-1): "Top orgs by usage"
- Horizontal bar chart, top 8 orgs by study hours
- Each bar: org name + hours

BOTTOM ROW (grid-cols-3, gap-6)
1. "Recent signups" feed (5 latest orgs with name + plan + date)
2. "Health alerts" card (rose-50 bg):
   • "2 orgs with 0 active users in 7 days"
   • "1 failed payment"
   • "3 trial expiring this week"
3. "System status" card (emerald-50 bg):
   • API: Operational (green dot)
   • Database: Operational
   • AI service (DeepSeek): Operational
   • AI service (GLM fallback): Operational
   • Last incident: 14 days ago
```

### 5.2 Organizations list

```
Design the Organizations list screen for TraineesAI super admin.

LAYOUT
- Same super admin sidebar (Organizations active)
- Main: max-w-7xl, py-8

HEADER
- H1 "Organizations" + subtext "47 total · 38 active · 9 churned"
- Right: "Create org" primary (rarely used) + "Export CSV" ghost

FILTER BAR
- Tabs: "All" "Pilot" "Team" "Enterprise" "Churned"
- Search input + sort dropdown + "Filter" button

TABLE (white card, rounded-xl, border)
Columns:
| Org | Plan | Members | MRR | Status | Created | Health | Actions |
Rows (15 visible, paginated):
- Org name + logo + domain
- Plan chip (Pilot=amber / Team=indigo / Enterprise=rose)
- Member count
- MRR (or "Pilot" if free)
- Status: green "Active" / amber "At risk" / gray "Churned"
- Created date
- Health score: 0-100 with color band
- Actions kebab: View, Suspend, Change plan, Delete

EXAMPLE ROWS:
1. Acme Engineering — Team — 12 — $480 — Active — Jul 15 — 92
2. Globex Corp — Enterprise — 87 — $3,480 — Active — May 2 — 88
3. Initech — Pilot — 8 — $0 — At risk — Jul 28 — 41
4. Hooli — Team — 24 — $960 — Active — Jun 11 — 76
5. Pied Piper — Pilot — 4 — $0 — Churned — Jun 1 — 12

PAGINATION
- "Showing 1-15 of 47" + page controls
```

### 5.3 Feature flags / settings

```
Design the Feature Flags screen for TraineesAI super admin — toggle platform features per org or globally.

LAYOUT
- Same super admin sidebar (Feature Flags active)
- Main: max-w-5xl, py-8

HEADER
- H1 "Feature flags" + subtext "Control feature visibility across the platform"
- Right: "New flag" primary

ENVIRONMENT SWITCHER (segmented control)
- "Production" (active, red dot) | "Staging" | "Development"

FLAGS TABLE (white card, rounded-xl, border)
Columns:
| Flag | Description | Default | Override (selected org) | Last changed | Actions |
- "selected org" dropdown above table: "All orgs" or specific org
- Each row:
  • Flag key in mono font (e.g. `ai_tutor_proactive_bubbles`)
  • 1-line description
  • Default toggle (slate)
  • Override toggle (indigo, overrides default for selected org)
  • Last changed: "3d ago by Sarah"
  • Actions: Edit, Audit log

EXAMPLE FLAGS:
1. `ai_tutor_proactive_bubbles` — Show proactive AI tutor prompts — ON — ON — 3d ago
2. `capstone_ai_generated` — AI generates capstone projects — ON — OFF — 1w ago
3. `spaced_repetition_v2` — New drill algorithm — ON — (inherit) — 2w ago
4. `peer_assessment` — Enable peer review feature — ON — ON — 1mo ago
5. `legacy_psych_signals` — DEPRECATED, forced off — OFF (locked) — OFF — 3mo ago
6. `sso_saml` — SAML SSO for Enterprise — OFF — ON (Globex only) — 6d ago

BOTTOM CARD — "Audit log" (slate-50 bg, rounded-xl, p-5)
- Last 5 flag changes: timestamp + user + flag + old → new
- "View full audit log" link
```

---

## 6. Shared Components (3 screens)

### 6.1 Messages / Inbox

```
Design the Messages screen for TraineesAI — in-app messaging between mentors and students.

LAYOUT
- Same left sidebar (Messages active, with red "3" badge)
- Main: 3-column full-height layout

COLUMN 1 (w-80, white, border-r) — Conversation list
- Header: "Messages" h2 + "Compose" icon button
- Search input
- Filter chips: "All" "Unread" "Mentor" "Students"
- Conversation list (8 items), each row:
  • Avatar (40px) + name + last message preview (1 line)
  • Time on right ("2h")
  • Unread indicator: indigo dot bottom-right of avatar
- Selected conversation: indigo-50 bg, left border-2 indigo

COLUMN 2 (flex-1, white) — Active conversation
- Header bar (sticky, h-16, border-b):
  • Avatar + name + role chip ("Trainee")
  • Right: "View profile" ghost + kebab
- Message thread (scrollable, p-6):
  • Date separator: "Today" centered, slate-400
  • 8-10 messages alternating:
    - Mentor (left, white bg, border, rounded-2xl rounded-bl-sm): "Hi Alex — saw you failed 3 drills. Want a 1:1 on useEffect?"
    - Student (right, indigo bg, white text, rounded-2xl rounded-br-sm): "Yeah that'd help. Tomorrow 2pm?"
    - Time below each message (text-xs slate-400)
  • 1 message has an attachment card: "Daily Test W3D4 — 67%" with link icon
- Composer bar (sticky bottom, white, border-t, p-4):
  • Textarea (auto-resize, placeholder "Write a message...")
  • Left: paperclip + emoji icon buttons
  • Right: "Send" primary (disabled if empty)

COLUMN 3 (w-72, slate-50, border-l) — Context panel
- "About this conversation" header
- Student mini-card: avatar + name + course + attention score
- Quick actions: "Schedule 1:1" / "View submissions" / "Pause student"
- Shared resources (files shared in this thread): 2 file chips
```

### 6.2 Settings / Profile

```
Design the Settings screen for TraineesAI — user profile + app preferences. Tabbed single-page layout.

LAYOUT
- Same left sidebar (Settings active)
- Main: max-w-3xl, py-8

HEADER
- H1 "Settings"

TABS (sticky, white bg, border-b)
- Profile (active) | Notifications | Appearance | Security | API keys

PROFILE TAB CONTENT
1. Profile photo card (white, rounded-xl, border, p-6)
   - Avatar (96px) + "Upload new" button + "Remove" ghost
   - Helper: "JPG or PNG, max 2MB"

2. Personal info card (white, rounded-xl, border, p-6)
   - Form grid grid-cols-2 gap-4:
     • First name (input)
     • Last name (input)
     • Email (disabled, with "Change" link)
     • Role (disabled, "Mentor")
     • Bio (textarea, col-span-2, optional)
     • Timezone (dropdown)
   - Footer: "Save changes" primary + "Cancel" ghost

NOTIFICATIONS TAB CONTENT
- Card with toggles (rows of label + description + switch):
  • "Daily digest email" — Get a summary of student activity each morning — ON
  • "Student needs attention" — Instant alert when a student's score crosses 7 — ON
  • "New submission" — Notify when a student submits work — ON
  • "Mentions" — When someone @mentions you in a note — ON
  • "Product updates" — TraineesAI newsletter — OFF
  • "Marketing" — Promotional emails — OFF

Each toggle has section labels: "Email" / "In-app" / "Slack (connected)"

APPEARANCE TAB CONTENT
- Theme: 3-card radio (Light / Dark / System)
- Density: segmented control (Comfortable / Compact)
- Font size: slider (Small / Medium / Large)
- Reduce motion: toggle
- Preview pane on right showing sample card

SECURITY TAB CONTENT
- Password section: "Change password" button (opens modal)
- 2FA section: "Authenticator app" — OFF — "Enable" button
- Active sessions: 3 device rows (browser + location + last active) with "Revoke" buttons
- "Sign out everywhere" danger button

API KEYS TAB CONTENT
- "Personal access tokens" card
- "Generate new token" primary + table of existing tokens (name, created, last used, scopes, revoke)
- Helper: "Treat tokens like passwords. They grant API access on your behalf."
```

### 6.3 Notifications

```
Design the Notifications screen for TraineesAI — full-page feed of all notifications, accessible from bell icon.

LAYOUT
- Same left sidebar (no item active, this is a side page)
- Main: max-w-3xl, py-8

HEADER
- H1 "Notifications" + subtext "8 unread"
- Right: "Mark all as read" ghost + "Notification settings" ghost (link to settings)

FILTER TABS
- "All" (active) | "Mentions" | "Submissions" | "Alerts" | "System"

NOTIFICATION FEED (vertical list, gap-2)
Each notification row (white, rounded-lg, border, p-4, hover:slate-50):
- Left: icon circle (32px, tinted bg by type):
  • Submission (emerald) — file icon
  • Alert (rose) — alert-triangle
  • Mention (indigo) — at-sign
  • System (slate) — info
  • Achievement (amber) — trophy
- Middle: content
  • Bold action line: "Alex R. submitted Daily Test W3D4"
  • Context line: "React Fundamentals · 67% — needs review"
  • Timestamp: "2h ago"
- Right: action chips + unread dot
  • Quick action: "Review →" primary mini-button
  • Unread: indigo dot
- Selected state: indigo-50 bg

EXAMPLE NOTIFICATIONS (show 8):
1. (emerald) Alex R. submitted Daily Test W3D4 — 67% — needs review — 2h ago — Review →
2. (rose) Maria T. attention score crossed 7.5 — 3h ago — View student →
3. (indigo) Sarah K. mentioned you in a note about Jordan L. — 5h ago — View note →
4. (amber) 🔥 Sam L. hit a 14-day streak — congrats them! — 8h ago — Send kudos
5. (emerald) Priya N. completed Weekly Test W3 — 92% — 1d ago
6. (slate) System: New feature — AI tutor now generates practice problems — 1d ago — Read more
7. (rose) Failed payment from Initech org — 2d ago — View billing
8. (emerald) Jordan K. mastered all drills in React Hooks module — 2d ago

INFINITE SCROLL helper at bottom: "Loading more..." skeleton
```

---

## Appendix A — Mobile responsive notes

For each screen above, Stitch should auto-generate mobile breakpoints. Critical rules:

```
MOBILE (< 768px)
- Left sidebar → hamburger drawer (overlay, slides in from left)
- Right AI Tutor panel → floating action button (FAB), opens bottom sheet
- 3-column layouts → single column stack
- Tables → card list (each row becomes a card)
- Top nav collapses: hide course switcher, show only logo + avatar
- Touch targets minimum 44×44px
- Forms: stack labels above inputs, full-width buttons

TABLET (768-1024px)
- Sidebar collapses to icon-only (w-16)
- 3-column → 2-column where applicable
- AI Tutor panel becomes collapsible drawer
```

## Appendix B — Empty / loading / error states

Standard patterns to apply across all screens:

```
EMPTY STATE
- Center vertically in container
- Subtle illustration (line art, slate-400) OR icon in circle 64px
- Headline (text-lg font-medium): "No [items] yet"
- Helper (text-sm slate-500): "When you [action], they'll show up here."
- Primary CTA button if actionable

LOADING STATE
- Card skeletons: rounded-xl, slate-200, animate-pulse, matching layout shape
- Inline spinners: 16px Lucide loader-2, animate-spin
- Page load: 3-5 skeleton cards stacked
- Button load: spinner replaces text, button disabled

ERROR STATE
- Rose-tinted alert card (rose-50 bg, rose-200 border, rounded-lg, p-4)
- Alert-circle icon + headline + 1-line description
- "Try again" primary button + "Contact support" ghost link
- Network errors: also show offline banner at top of screen
```

## Appendix C — Stitch iteration tips

When iterating in Stitch after pasting these prompts:

1. **Tighten spacing**: "reduce vertical padding by 30%, gaps to 12px"
2. **Dark mode**: "invert to dark theme — bg #0F172A, cards #1E293B, text slate-100"
3. **Swap primary color**: "change primary from indigo to violet-600"
4. **Make it denser**: "compact density — reduce card padding to p-3, row heights to 40px"
5. **Add a section**: "add a 'Recent activity' card below the hero, showing 5 events"
6. **Remove a section**: "remove the AI Tutor panel — full-width main column"
7. **Component-ize**: "extract the stat tile as a reusable component with props: label, value, trend, color"
8. **Real data**: "replace placeholder names with realistic ones — diverse, mixed genders"
9. **Add interactivity**: "make the course switcher open to a dropdown with 3 courses + 'Browse all'"
10. **Accessibility pass**: "add visible focus rings, ensure all interactive elements have aria-labels"

---

**End of prompt library.** 26 screens + 3 appendices covering the full TraineesAI platform across all 4 user roles.
