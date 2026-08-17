# TraineesAI · Product Blueprint

> The product vision, the role map, the feature inventory, and the roadmap.
> Updated every audit cycle. Source of truth for "what is this product?"

---

## 1. Product vision

TraineesAI is an **AI-examined, mentor-on-flag learning platform** that turns
short courses (4–12 weeks) into verifiable competencies. Every learner gets:

- A daily Socratic routine — daily check-in, daily test, drills, weekly test.
- A project they actually build, week by week, with AI examining each phase.
- A transparent learning signal (0–100) computed only from scores, completion
  and activity — no black-box behavioral scoring.
- A mentor who steps in when the AI flags confusion, overconfidence, or a
  score cliff — not on every reply.

The product is **not** a content marketplace. It is an **examination engine**:
the value is the daily assessment cadence, the spaced-repetition drill layer,
and the capstone project that proves the learner can do the work.

The B2B model serves organisations (training providers, corporate L&D,
vocational institutes) who need verifiable skill outcomes — not course
completion certificates. The B2C model serves individual learners who want a
portfolio project plus an honest learning signal.

---

## 2. Role map

The platform ships these first-class roles. Each role has its own dashboard,
its own API surface, and its own permission set (see `src/lib/rbac.ts`).

| Role | Purpose | Primary surface |
|---|---|---|
| **student** | Learns, drills, takes tests, builds a capstone | TodayView · Study · Project · Progress |
| **instructor** | Mentors a cohort, drafts replies, flags risks | Cohort dashboard · Portfolio view |
| **org_admin** | Manages org enrollments, course catalog, reports | Org dashboard · Marketplace admin |
| **platform_admin** | Platform-wide feature flags, AI budgets, audit | Admin dashboard · System settings |
| **coordinator** | Operational role: schedule, escalate, nudge | Cohort operations panel |
| **institution_admin** | Campus-level admin (B2B education) | Campus dashboard |
| **principal** | Strategic view of multiple institutions | Reports only |
| **developer** | Internal — debug access to logs and audit | Admin read-only |

The previous "counselor / guardian / principal dashboard" B2C experiments have
been retired. The platform now ships a single coherent role graph that maps
cleanly to B2B buyers and B2C self-serve.

---

## 3. Feature inventory

### Engine (the part that works)

- **Adaptive difficulty** — score ≥ 75 twice in a row → level up; score < 50 →
  level down; "sure" + wrong (< 55) → level down. Documented in
  `LOGIC-CALCULATIONS.md`.
- **Learning Signal** — transparent 0–100 score from
  `0.45 · avgScore + 0.30 · completion + 0.25 · activity − min(30, 10 · missedDeadlines)`.
- **Calibration flag** — overconfident (sure & < 55) / underconfident
  (guessing & ≥ 80). Surfaced to mentor, not to learner.
- **Drill scheduling** — wrong answers come back as DrillCards due +48 h,
  spaced +2 d per miss (max 5 retries). Owned by spaced-repetition layer.
- **AI budget** — `TOKEN_BUDGET` per feature, 1-hour cache TTL, per-user daily
  limits + RPM/RPD limits. See `src/lib/ai-rate-limits.ts`.
- **Unified grader** — every test type (practice, daily, weekly) goes through
  `gradeOneQuestion` and `gradeTest`. Same contract, same evidence pipeline.
- **Plagiarism deduction** — separate from the AI grader. Applied with a hard
  floor (configurable via `GRADING_HARD_FLOOR` env, default 40%).

### Surface (the part being rebuilt)

- **PageHeader** — 96 px sticky header, breadcrumbs + chips + actions + optional
  progress bar. Replaces every oversized hero inside app pages.
- **CompactCourseHeader** — uses PageHeader + expandable meta drawer. Direct
  fix for the "course heading eats 60% of page" bug.
- **DueTodayCard** — inline list of due items, replaces the interrupting
  DailyTaskReminder popup. Popups now reserved for red-tier alerts only.
- **States kit** — `SkeletonPanel`, `EmptyState`, `ErrorState`. Every data
  panel must handle all three states; no silent blank screens.
- **TodayView** — the learner home. Sequences the daily routine: standup →
  learn → test → drills. Everything else is one tap away.
- **Streaming chat** — tutor/examiner routes return ReadableStream; typing
  indicator + degraded mode (planned, see roadmap).

### Operations

- **Cron jobs** — daily test generation, drill scheduling, alert checks,
  escalation. Each cron must ping `/api/health/cron` on success; missed pings
  alert the platform admin.
- **Audit log** — every privileged action lands in `AuditLog` (see
  `src/lib/audit-log.ts`). Searchable by admin.
- **Feature flags** — `feature_flags` table toggles AI features, marketplace,
  certificates, etc. Per-org overrides supported.

---

## 4. B2B / B2C model

### B2B (primary revenue)

Organisations buy seats. They get:

- A branded portal (org slug, logo, theme).
- A course catalog (their own + marketplace courses).
- Cohort management (assign instructor, set schedule).
- Verifiable competency reports per learner (exportable).
- Audit trail of all instructor/admin actions.

### B2C (growth funnel)

Individual learners self-serve from the marketplace. They get:

- A free daily test quota (rate-limited).
- A paid plan for unlimited tests + mentor access.
- A portfolio project + certificate on completion.

The B2C funnel feeds B2B: organisations see engaged learners and reach out.
The product is **not** optimised for B2C self-serve support — that's a
deliberate constraint.

---

## 5. Roadmap

Ordered by ROI. Each item is sized to ship in 1–2 weeks.

### Shipped (current state — August 2026)

1. ✅ PageHeader + CompactCourseHeader — 96px sticky header standard.
2. ✅ DueTodayCard mounted in TodayView; DailyTaskReminder popup deleted.
3. ✅ States kit (SkeletonPanel, EmptyState, ErrorState) adopted across dashboards.
4. ✅ `TEST_QUESTION_COUNT` is the single source of truth for test length.
5. ✅ `ignoreBuildErrors: false` + `reactStrictMode: true` enforced.
6. ✅ Five living docs shipped (BLUEPRINT, ARCHITECTURE, LOGIC-CALCULATIONS, ERROR-HANDLING, UI-STANDARDS).
7. ✅ Global ⌘K command palette with fuzzy search + `useRegisterCommands()` hook.
8. ✅ Keyboard shortcuts help dialog (press `?` anywhere).
9. ✅ Streaming AI tutor (`/api/ai/tutor/stream`) + TypingIndicator + `useStreamingAI()` hook.
10. ✅ Stripe checkout wired (paid courses redirect to Stripe, no more payment bypass).
11. ✅ Evidence-Locked XP system (learners only, casual-yet-professional, no leaderboards).
12. ✅ All hardcoded colors migrated to global theme tokens (growth-sage/amber/coral + destructive).
13. ✅ DashboardHeader + StatCard shared components — all 5 role dashboards unified.
14. ✅ Insights + Analytics tabs merged (were near-duplicates).
15. ✅ CertificateApprovals surfaced as its own nav entry (was buried in AssignmentsTab).
16. ✅ EmployerDashboard wired as "Sponsor ROI" sidebar entry for org_admin.
17. ✅ OrgAdmin defaults to org overview (was defaulting to course-planner).
18. ✅ MARKETPLACE_CATEGORIES deduped to single source (`src/lib/constants.ts`).
19. ✅ Dead code deleted (AdminCoursesPanel, DailyTaskReminder.tsx).
20. ✅ Casual-yet-professional voice system (`src/content/copy.ts`) — "We share the training burden."
21. ✅ Tabular numerals globally (stats stop jiggling).
22. ✅ Border-first depth (no shadows on cards — Linear/Vercel/Stripe pattern).
23. ✅ Hover-to-reveal chrome (`.chrome-reveal` utility).
24. ✅ Modern SaaS surface utilities (`.surface-card`, `.surface-muted`, `.surface-hover`, `.kbd`).

### Shipped — SaaS expansion (2026-08-17)

1. ✅ Multi-tenant control plane: tenant lifecycle (status/trial/suspend), seat enforcement, per-org feature-flag overrides with rollout UI, guard asymmetry fixed (platform vs org admin).
2. ✅ Support tooling: audited login-as (sup JWT + parked admin session + exit), bans with reason, server-side audit CSV export.
3. ✅ Creator economy: course ownership, instructor course studio with drafts, Stripe Connect onboarding + payout ledger, per-instructor earnings attribution, coupon engine with checkout validation, refund webhook handling.
4. ✅ B2B ops: departments + auto-assign course rules, CSV roster import, compliance expiry matrix + nudges, seat subscriptions with dunning, org billing upgrade UI, announcements.
5. ✅ AI engine: RAG tutor (embeddings + keyword fallback, cited sources), course-material ingestion, quiz-from-module, roleplay simulator with rubric scoring, per-org AI budgets + alerts.
6. ✅ Schema single source of truth (derived prod/demo schemas), additive-only db push (no --accept-data-loss).
7. ✅ Control-plane enforcement + P&L: tenant lifecycle gate at login, approval-gated signup, revenue & payouts ledger (MRR/fees/payouts/refunds), platform tenant announcements, per-org audit server export + SIEM webhook sink, embeddings reindex cron.
 (derived prod/demo schemas), additive-only db push (no --accept-data-loss).

### Next (1–2 quarters)



1. OnboardingFlow (goal → track → baseline quiz → week-1 plan, 3 min).
2. Auto-remediation: low score → drill cards + 3-day AI study plan.
3. AI-drafted mentor replies (mentor edits + approves, 5-min day).
4. Certificate status timeline (requested → reviewed → signed).
5. Confirmation dialogs for all destructive actions (project regenerate,
  user delete, course archive).
6. Mentor Triage Inbox (Linear Intake pattern — single-key triage).
7. Slide-in Learner Drawer (Stripe pattern, shadcn Sheet).
8. Slash Commands in Lesson Editor (Notion pattern).
9. Saved Views on Roster + Analytics (Attio pattern).
10. Per-Course Color Tagging (Height/Linear pattern).

### Later

1. Mobile-first field mode (HSE, labs, sites) — phone-primary UI.
2. Mentor marketplace (paid mentor pool for B2C self-serve).
3. Org-level competency analytics (skill-gap heatmaps).
4. Course authoring tools (org admins build their own courses).

---

## 6. What we explicitly do NOT build

- **A content marketplace** — courses are the unit, not lessons. Other
  platforms do content better; we do examination better.
- **A behavioral scoring black box** — the Learning Signal is transparent and
  formula-driven. Anything else erodes learner trust.
- **A real-time collaboration tool** — mentors step in on flag, not on every
  reply. Asynchronous by design.
- **A replacement for human mentors** — the AI examines; humans mentor. The
  platform's job is to make the mentor's 5 minutes count.

---

## 7. How to read the rest of the docs

| Doc | What it covers |
|---|---|
| `BLUEPRINT.md` (this file) | Vision, roles, features, roadmap |
| `ARCHITECTURE.md` | Module map, API inventory, data model, AI chain, cron |
| `LOGIC-CALCULATIONS.md` | Every formula, one source of truth |
| `ERROR-HANDLING.md` | Failure policy: degraded mode, no silent catches, cron health |
| `UI-STANDARDS.md` | Header rule (max 96 px), spacing grid, states kit, glossary |

The audit script `scripts/ui-backend-audit.sh` is the verification gate —
re-run it before every release. Every count above zero is a red line.
