# DELIVERABLE 0 — DEEP PLATFORM AUDIT
**ExaminerAI / TraineesAI** · 2026-08-15 · repo @ b5dc11f · authored against the live codebase

Method: full code crawl (all routes, all modules, schema, auth/RBAC, API surface, docs) with
spot-verification of every load-bearing finding. Claims below cite file:line.
**Part 2 (§9–§14) adds a logged-in UI crawl**: booted the real app, signed in as platform admin
(`admin@`), org admin (`w7.orgadmin@` — the seeded `orgadmin@demo.ai` is broken, see §9.1),
instructor (`instructor@demo.ai`), and learner (`learner@demo.ai`), and clicked through every
portal at 1440×900 and 360×640 as a real user.

---

# PART 2 — LIVE UI AUDIT (LOGGED-IN CRAWL, 2026-08-15)

## 9. Critical bugs found only by using the product

| # | Sev | Finding | Repro / evidence |
|---|---|---|---|
| 9.1 | **S0** | **Org admin without an active org membership = infinite redirect loop.** `/org` layout redirects to `homeForRole("org_admin")` which is `/org` itself → blank "Rendering…" page forever at ~14 req/s (self-DoS). **The seeded demo org admin (`orgadmin@demo.ai`) is in exactly this state — the org-admin demo experience is hard-broken today.** | `(portals)/org/layout.tsx:27` + `portal-home.ts:10-15`; DB: user `cmssud3ts…vkx4mpj31d9a` role `org_admin`, **0 OrgMember rows**; measured 86→1019 `GET /org` in seconds |
| 9.2 | **S0** | **Org "Control center" exposes GLOBAL portal rollout flags to org admins.** An org admin can switch off the Learner/Instructor/Org/Platform portal for the ENTIRE platform from `/org/control` ("Global rollout switches" — the UI even admits it). Code-level S0 surfaced as one-click UI. | `org-portal/control.tsx` "Portal flags" section, switches call global flag writes |
| 9.3 | S1 | **Misleading diagnostics: System panel shows "JWT auth: Down" while the admin is logged in via JWT.** An operator following this panel would chase a non-problem (or ignore real ones). | `/platform/system` health checks block, live crawl |
| 9.4 | S1 | **Env panel checks the wrong AI provider.** Shows `DEEPSEEK_API_KEY: missing` as a red flag but never lists `ZAI_*` — the PRIMARY provider per `.env.example`. Operator sees "missing" for a fallback and nothing about the provider that matters. | `/platform/system` Environment block |
| 9.5 | S1 | **Wrong-domain course content in seed.** "Workplace Safety Essentials (HSE)" Week 2 · Day 1 topic = *"Building a homepage with WordPress blocks"*. Kills credibility in demos and proves content is not domain-validated. | Learner home continue-card, live crawl |
| 9.6 | S2 | **Native `window.confirm` for user deletion** — blocks the page thread (it froze the browser during testing), styled unlike the app, inconsistent with the in-app `ActionDialog` used elsewhere; role changes ("Make Platform admin") fire instantly from a menu with **no confirmation and no reason prompt** although the API accepts one. | `platform-portal/users.tsx:132`; live crawl |
| 9.7 | S2 | **Demo accounts demo nothing**: instructor@demo.ai has 0 students (all KPIs zero), learner home works, org admin demo hard-broken (9.1). Sales/onboarding path is effectively dead. | live crawl |

## 10. Usability & accessibility issues (from real usage)

**Information design**
1. **Raw snake_case codes shown to users everywhere**: audit feeds render `user_logged_in` (platform home "Recent activity", platform Audit, org home "Recent activity"); Features panel shows raw flag keys (`feature_ai_enabled`, `feature_portal_learner_v2`) as labels. Needs a label map + icons.
2. **Audit log is useless as shipped**: ~95% of rows are login noise; the only filters are 4 action chips + a "Filter by actor user id" textbox — **admins don't know user IDs**. No date range, no actor-name search, no severity, no exclude-logins toggle. CSV export exists (good).
3. **Platform home KPI duplication**: "Users 8" and "Total users 8" are two separate cards.
4. **Orgs are listed but not manageable**: one org row on platform home; no org detail page, no create-org, no seats/plan editing, no dive-in.

**Navigation & chrome**
5. Desktop shells (non-classic) have **no breadcrumbs, no notification bell, no global search** — bell exists only in Classic mode. The Notifications system exists (region `alt+T` in the a11y tree) but has **no visible entry point in the default shell on any breakpoint**.
6. **Platform portal renders two competing navs** — TopNav (Home/Users/Audit/AI/System) + a 13-tab strip (Overview…Maintenance) on every page; "Maintenance" duplicates System's URL. The other portals use a consistent 5-tab + More pattern; Platform ignores it.
7. **Theme/mode switch is desktop-only** (`hidden lg:inline-flex`) — a phone user cannot reach **Bed mode** (the late-study reading mode) at all. Accessibility regression disguised as a cleanup.
8. **Learner entry points are inconsistent**: home "Resume" → public `/learn/<id>` (drops portal chrome), catalog card → `/learner/courses/<id>`. Two different experiences for the same course.
9. **Buried features**: Messages/Study/Help/Projects are not in the learner bottom nav or top nav (Help hangs off Profile; Study reachable only via widgets; Messages via… nothing primary). Assignments/Practice only from the Learn page header.
10. Streak notification links to `/learner/exams` — wrong target for a check-in nudge.

**Interaction safety**
11. Destructive/privilege actions: delete uses `window.confirm` (9.6); **role elevation and block have zero confirmation**; no undo anywhere except org member deactivate (which has UNDO — the only place).
12. Users panel: **no user detail view at all** — cannot see a user's org, courses, activity; actions limited to block/role/delete; no password reset, no impersonation, no invite, no export, no bulk select.

**Accessibility (structure-level, from the a11y tree)**
13. Good: skip-to-content link, radiogroup/switch/menu roles, `aria-live` toasts (sonner), 44px min-heights on primary buttons, unread announcement badges, labeled comboboxes/searchboxes.
14. Gaps: Command Palette + Notifications regions are mounted on every page including `/login` (confusing SR order); audit rows are `<button>`s with paragraph soup as names (very verbose accessible names); no visible focus style verified on tab strip links; native `window.confirm` breaks the styled-dialog contract; Bed mode unreachable on mobile (7).

## 11. Missing admin controls (verified by clicking, not guessing)

Platform admin **cannot** from the UI: create/invite a user · view a user's profile page · reset a user's password (only approve self-service requests) · impersonate/login-as · export users CSV · bulk-select users · create/edit/suspend an **organization** (orgs are read-only rows) · set per-org flag overrides or revoke per-org capabilities · see job last-run/status or trigger "Run now" · see any request log or error tracker · refund a payment, view payouts/disputes, or test webhooks · enable maintenance mode or disable Stripe · see deployment/migration state · schedule reports.
Org admin **cannot**: manage instructors as a roster · approve/publish org courses · enforce seats on invite · complete a billing upgrade (CTA is dead) · message members.
Instructor **cannot**: build/edit a course (no studio — only platform admin has the Planner) · send announcements (learner home renders them, nobody can compose them) · open Messages (no page) · configure rubrics/questions authoring.

## 12. SaaS feature-gap recommendations (what a professional platform ships that this one lacks)

**Cross-portal platform features (highest leverage)**
1. **Notification center**: bell + drawer on every shell (all breakpoints), unread badge, per-role preferences, digest settings. The backend (`/api/messages`, notifications) already exists — only chrome is missing.
2. **Command palette everywhere + mobile search sheet**: Ctrl+K exists on desktop but has no visible entry and no mobile equivalent. Add role-scoped commands (admin: "Open user…", "Flip flag…"; learner: "Resume course", "Ask tutor").
3. **Onboarding checklists** per role on first login (platform: configure AI + invite org; org: invite members + assign course; instructor: create course + review queue; learner: start first lesson). The "Action items" card on platform home is the right seed — generalize it.
4. **Global search**: admin-side federated search (users, orgs, courses, audit); learner-side (courses, topics, help).
5. **Consistent destructive-action pattern**: styled confirm dialog with typed confirmation for deletes, reason capture for role/block changes, undo toasts where possible (org deactivate already proves the pattern).
6. **Humanized event dictionary**: one map action-code → {label, icon, severity} used by every audit feed + notifications.
7. **Saved views + server-side CSV export** on all admin tables (users, audit, courses); column visibility on desktop.
8. **Status/health page + incident banner**: maintenance mode that renders a banner across portals, fed by the diagnostics suite; `status.` subdomain later.
9. **Impersonation ("Login as")** with watermark banner, time-boxed session, always audited — the single most-requested support tool.
10. **Scheduled reports**: weekly org digest (engagement, at-risk) + monthly platform digest; email via the existing webhook bridge.
11. **Realtime queue updates** for the instructor review queue and platform audit (SSE/poll) so new work appears without refresh.
12. **Announcement composer** (instructor → enrolled students; org → members; platform → everyone) feeding the learner-home feed that already exists.
13. **Calendar & deadlines** for learners (due dates, test windows, streak) — L1's missing anchor.
14. **Demo data fix + preview mode**: working seeded demo for every role (9.7), plus a "demo data" badge so production admins don't mistake seed rows for real users.

## 13. UI redesign recommendations per portal (concrete)

**Platform admin → "Mission control"**
- Collapse to **one sidebar (desktop) / 5-tab + More (mobile)**: Overview · Orgs · Users · Diagnostics · Money, with More holding Features/Resets/B2C/Nav-Config. Kill the 13-tab strip and the dead Maintenance tab.
- New **Orgs page**: searchable table (plan, seats, health dot), row → org detail (members, courses, flags-per-org override switches, audit scoped to org, "impersonate owner").
- New **Diagnostics hub** (merges System + AI + health): health cards with latency (p50/p95) not just up/down, **live request/error feed**, job monitor with last-run + Run now, incident panel (maintenance mode, disable AI, disable Stripe), migration/deploy status. Fix JWT/env checks (9.3/9.4).
- Users table → row click opens **user drawer**: profile, orgs, courses, activity, actions (role with reason dialog, block, reset password, impersonate, delete with typed confirm). Add invite + CSV export + bulk select.
- Home: dedupe KPIs, add platform-wide alerts feed (errors, abuse, cost spikes), "add organization" primary CTA.

**Org admin → "within Your Org" scope made visible**
- Scope badge ("W7 Test Org · within your org") in the shell next to the org name.
- Remove global flags from Control (9.2) — replace with **org-scoped capability switches** (course creation, AI tutor, Stripe checkout for this org), clearly labeled.
- People → full member management: role editor, seat enforcement on invite, member detail (courses, activity), CSV import/export of members.
- New **Instructors** view (roster, assigned courses, performance) and **Content** view (org course approval).
- Mobile-first approvals: pending items (invites accepted, course approvals, at-risk alerts) as a swipeable queue.

**Instructor → teach, don't administrate**
- Add **Studio** (course builder): reuse the platform Course Planner components (they already exist!) scoped to own courses; blocks/weeks editor, question bank, rubric builder, publish flow with versioning.
- Add **Messages** page (API exists) and **Announcements** composer (12.12).
- Review queue → keyboard-first grading (j/k navigate, 1–5 rubric scores, a audio reply), mobile swipe actions.
- Home: add today's schedule + earnings snapshot; keep AI assistant (it's good).

**Learner → one shell, all the way through**
- Route classroom through the portal (`/learner/courses/<id>/learn`) so Resume keeps the shell; keep public `/learn` only for preview.
- Add calendar/deadlines widget + page; surface Study Center and Messages in the nav (swap Profile→More on mobile: Home/Learn/Exams/**More**, with Profile inside More).
- Keep the excellent continue-card + timed-session + check-in + announcements composition — it's the best screen in the product.
- Make Bed mode reachable on mobile (a small moon toggle in the profile sheet).

## 14. Updated priority list (merges Part 1 §8 with live findings)

**P0-A — Stop the bleeding (same day):** fix the `/org` self-redirect loop (9.1) and the org-admin global-flag leak (9.2); fix JWT/env diagnostics (9.3/9.4); block/role/delete confirmations (9.6); reseed working demo data incl. HSE/WordPress topic fix (9.5/9.7); forgot-password route; mount Toaster for the 8 silent-error call sites.
**P0-B — RBAC hardening:** elevation matrix (org_admin → learner/instructor only, within org), org-scope the 12+ cross-tenant endpoints from §5, kill v1 `org/members/[memberId]`, `CRON_SECRET` fail-closed, audit block/delete.
**P0-C — Foundation:** CI + typecheck, notification bell + drawer on all shells, one nav pattern per portal (kill the 13-tab strip), humanized audit/event labels, consistent confirm dialogs, breadcrumbs on desktop, token-adoption pass, delete dead code (§4).
**P1 — Platform admin portal** (orgs page, diagnostics suite, user drawer + invite + impersonation, Stripe console, incident response).
**P2 — Org portal** (scope badge, capability switches, instructors/content, seats/billing, approvals).
**P3 — Instructor portal** (studio, messages, announcements, keyboard grading, mobile swipe).
**P4 — Learner portal** (portal-native classroom, calendar, nav rebalance, mobile Bed toggle).
**P5→P8** — unchanged from §8 (backend spec, tutor module, QA device matrix + RBAC penetration suite, launch checklist).

---

## 0. Platform state in one screen

- Next.js 16 App Router · Prisma 6 (sqlite dev / postgres prod dual schema) · Tailwind v4 +
  3-layer token theme · zustand · TanStack Query/Table · sonner · recharts · framer-motion.
- **73 Prisma models · 236 API route files · 71 pages · 4 portals + public marketplace + legacy surfaces.**
- **Feature flags (Setting table, live DB): all four portals are LIVE** (`feature_portal_learner_v2`,
  `_instructor_v2`, `_org_v2`, `_platform_v2` = `"true"`) plus `exams_v2`, `study_flow_v2`,
  `submissions_v2` = `"true"`. Code default for portals is **fails CLOSED** (fresh DB ⇒ portals off)
  — and the fail-closed path itself is broken (§1.5).
- **No `src/pages` (pure App Router). No `/app` directory** — already deleted in the cutover.
  Legacy surfaces = public `/learn*`, `/dashboard` stub, and ~30 legacy API endpoints still consumed.
- **RBAC:** 4 canonical roles (`learner | instructor | org_admin | platform_admin` + `demo`).
  The scope resolver is **`src/lib/rbac.ts`** — there is **no `src/lib/ai-assistant/scope.ts`**.
- **No CI of any kind.** 19 vitest unit test files (node env), zero component tests, zero e2e.

Verdict up front: the portal shells, theme engine, and per-role feature coverage are in far better
shape than feared (all four portals are real, live, responsive, and state-complete). The platform's
real debt is concentrated in **RBAC enforcement (two verified privilege-escalation holes), platform
diagnostics (8 of 13 tools missing), payments (instructors are never paid), instructor portal
(studio/announcements/messages absent), token adoption (primitives 0% used), and QA infra (zero)**.

---

## 1. Broken features inventory (exists but does not work / hidden / lost)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | **S0** | **Privilege escalation — any org_admin can mint platform_admins.** The elevation matrix grants `org_admin` the `platform_admin` target and the target user is never org-scoped → any org admin can promote any user platform-wide, breaking the Tier-1 boundary. Audited, but legal. | `src/app/api/users/[id]/role/route.ts:66-69` (matrix), `:52-53` (no org check) |
| 2 | **S0** | **Cross-org member tampering.** `PATCH/DELETE /api/org/members/[memberId]` checks only the role, then updates any `orgMember` by id — any org_admin can demote/remove members of *any* org. The v2 twin is correctly scoped; v1 is not. | `src/app/api/org/members/[memberId]/route.ts:6-30` vs `v2/org/members/[id]/route.ts:39-55` |
| 3 | S1 | **Silent error toasts.** 8 call sites fire into the custom `use-toast` store, but its `<Toaster>` is never mounted → errors in practice/weekly-test panels render nowhere. | `modules/assessment/components/PracticePanel.tsx:96,129,149`, `WeeklyTestPanel.tsx:255,307`; no `<Toaster` mount in `src` |
| 4 | S1 | **Forgot-password page unreachable.** `/forgot-password` missing from middleware `PUBLIC_ROUTES` → GET redirects to `/login`. API is public; page is a dead end. | `src/middleware.ts:43-58` |
| 5 | S1 | **Portal flag-off paths are broken.** Learner/instructor flag-off redirects to `homeForRole` = the same page (infinite redirect loop); org/platform redirect to `/app`, which 404s. Flipping any portal flag OFF bricks the portal with an error instead of a graceful fallback. | `(portals)/learner/layout.tsx:28`, `org/layout.tsx:21`, `platform/layout.tsx:20` |
| 6 | S2 | **System panel lies.** "Purge cache" POST is a no-op reporting success; cron list is a hardcoded array, not live data. | `api/v2/platform/system/route.ts` POST; `platform-portal/system.tsx:99-115` |
| 7 | S2 | **Nav Config panel is an admitted read-only stub** displayed as though configurable. | `platform-portal/nav-config.tsx:30-37` |
| 8 | S2 | **Dead "Maintenance" tab** duplicates `/platform/system`; no maintenance feature exists. | `platform-portal/tabs.tsx:52` |
| 9 | S2 | **Cron endpoints fail open.** `isCronAuthorized` returns `true` when `CRON_SECRET` is unset → any authenticated user can trigger SRS/study-plan/absence jobs from a browser (study-plan refresh runs AI generation = cost vector). | `src/lib/cron-auth.ts:13-14` |
| 10 | S2 | **Instructor earnings are unfunded bookkeeping.** Webhook books a 20/80 split, but there is no Stripe Connect, no transfer, no payout — instructors can never actually be paid. Earnings dashboards show fiction. | `src/lib/stripe.ts` (59 lines: checkout+webhook only); `api/stripe/webhook/route.ts:16-59` |
| 11 | S2 | **Employer dashboard leaks cross-tenant.** org_admin without legacy `institutionId` falls into `courseWhere = {}` → sees every institution's trainee/skills data. | `api/employer/dashboard/route.ts:45-56` |
| 12 | S2 | **Block/delete not audited** despite constants existing. | `api/users/[id]/block/route.ts` (no `logAudit`), `api/users/[id]/route.ts`; `AuditAction.USER_BLOCKED/USER_DELETED` unused |
| 13 | S2 | **Org billing upgrade CTA dead; seats not enforced** on invite. | `org-portal/billing.tsx:10-12` (self-declared); `org-db.ts inviteMember` (no `seatsUsed < seats`) |
| 14 | S2 | **v2 exams surface orphaned.** `/api/v2/exams/*` (start/resume/answer/complete/results) + `exam-runner.tsx`/`exam-results.tsx` exist, but the hub declares the runner "removed" and `/learner/exams/[id]` redirects to Socratic pages. Dead API + dead components — wire back or delete. | `learner-portal/exams.tsx:10-14`; `(portals)/learner/exams/[id]/page.tsx` (redirect stub) |
| 15 | S2 | **Any org_admin can rotate the platform-wide AI key** and toggle global feature flags (fails-open via `ADMIN_ROLES` gate). | `api/settings/ai-key`, `api/settings/features` (requireRole `ADMIN_ROLES` incl. org_admin) |
| 16 | S3 | **Learner profile null-user redirect → `/app` (dead 404).** | `(portals)/learner/profile/page.tsx:17` |
| 17 | S3 | **`/dashboard` is a redirect stub** to `/learn`; old bookmarks degrade. | `src/app/dashboard/page.tsx:12-14` |

---

## 2. Missing features per role

### Tier 1 — Platform admin (has 17 real panels: home KPIs+orgs table, users, courses mgmt + planner + AI wizard + thumbnail editor, features/flags, resets, AI usage/limits/connection, B2C, access grants, global audit + CSV, db/ai/jwt health)
Missing:
- Orgs management page (orgs table exists on Home; no dedicated manage/dive-into-org view)
- **Per-org capability revocation** ("disable course creation / AI tutor / Stripe for org X") — the brief's Tier-1 non-negotiable; only portal rollout flags exist (`feature_portal_*_v2_org:<orgId>` read, no UI)
- User impersonation ("login as", audited)
- Diagnostics suite: live request log, error tracker, background-job monitor, performance profiler, deployment/migration panel (§7)
- Stripe console: payouts, refunds, disputes, webhook log
- Incident response: maintenance mode, disable-Stripe, one-click bundle
- Per-org flag override UI, webhook console, scheduled report generator, anomaly detection, status page

### Tier 2 — Org admin (has 8 panels: home, people, registries, control/branding, audit+CSV, billing, analytics, more)
Missing:
- First-class instructor management (OrgCourseAssigner is embedded in People; no instructor roster/perf view)
- Content governance (approve/publish org courses; only platform has course moderation)
- Seat enforcement + working billing upgrade (Stripe subscription)
- Notifications UI; mobile approvals queue
- Org-scoped AI limits; org-scoped earnings
- Audit scoping is fragile by construction: rows are filtered by *actor still being an org member*, so resignations erase history and non-member actors' rows are invisible (`org-db.ts:227-236`)

### Tier 3 — Instructor (has: home w/ queue+at-risk, students roster + drill-down (incl. Growth/Psychology), review queue + review detail, analytics (partial), earnings (read-only), certificates, assignments)
Missing:
- **Course/Exam Studio** (P3 promised; absent — course building exists only in platform admin)
- Announcements (I9); Messages UI (API exists, no page)
- Rubric builder + question bank authoring (rubric engine exists for grading only)
- Versioning/publish flow for own courses
- Independent-instructor mode (org vs freelance distinction; Stripe Connect earnings)
- Mobile grading swipe actions; bulk messaging / interventions (nudge endpoint exists)

### Tier 4 — Learner (has: home w/ continue-card+rings+streak+weak topics+study widget+tutor launch, catalog + course detail, classroom w/ post-lesson flow (Socratic test → results → project → check-in → next), assignments + project workspace w/ milestones + mentor threads, Socratic practice/daily/weekly, study-flow center (S1–S6), progress/analytics, badges+XP, profile/settings, help, messages)
Missing:
- Calendar / upcoming-deadlines view (promised L1; no route exists)
- Course detail tab set incl. Discussion (no discussion route)
- Achievements page (badges shown on profile only)
- PWA/offline shell (promised; absent)
- Exam schedule view

---

## 3. UI inconsistency list (desktop bottom-bar first)

0. **Public site had NO footer and no consistent header** (found on user review, 2026-08-15 —
   missed in the first pass, which covered the authenticated portals only). Each public page
   hand-rolled its own banner; `/pricing`, `/support`, `/for-learners`, `/signup/b2b`, `/verify`
   had no header at all; nothing had a footer. Fixed with shared `modules/site` chrome
   (SiteHeader + SiteFooter) mounted via `(public)/layout.tsx`; the classroom moved to the
   `(classroom)` group so it keeps its full-screen layout (commit dfebfb5).

1. **Desktop bottom bar:** absent at md+ *by design* (TopNav at lg). The genuine desktop shell gaps are:
   - **No breadcrumbs anywhere in the four portals** — the `Breadcrumb` component is used only on two public marketplace pages (`(public)/courses/[id]/page.tsx:152-165`, `category/[...]/page.tsx:101-118`).
   - **Notifications bell only in classic mode** (`classic-topbar.tsx:94-105`). Non-classic desktop TopNav trailing = ModeToggle + UserMenu only — the single biggest desktop chrome gap.
   - **Platform tab strip duplicates the TopNav** on every platform page (`platform-portal/tabs.tsx` under `portal-shell.tsx:44-46`); both also render on tablet.
2. **Theme controls unreachable below lg** — `ModeToggle` is `hidden lg:inline-flex` in all four portal shells (user-requested mobile removal, but Bed Mode / classic become desktop-only; flagged because the brief wants runtime switching everywhere).
3. **Mixed toast systems:** sonner (live; 32 files, ~134 call sites, mounted once in root layout) vs custom `use-toast` store (unmounted ⇒ silent failures, §1.3) + dead themed wrapper `modules/ui/sonner.tsx`.
4. **Token adoption is incomplete:**
   - **Primitives layer 100% unused** — `--p-space-*`, `--p-type-*`, `--p-radius-*`, `--p-brand-*` have **0 usages** outside `primitives.css`.
   - **281 arbitrary-value classes** (`text-[10px]` ×117, `text-[11px]` ×48, radii `[3px]` ×17, fixed heights `h-[600px]` ×4, classic chrome `pl-[236px]`/`w-[220px]`/`w-[244px]`).
   - **639 legacy shadcn token usages** remain (ClassroomShell 52, ForgotPassword 51, LearnerHome 28, plus every `modules/ui/*` base component); 111 legacy vars still defined in `globals.css` pending cutover.
   - **64 hex literals** (use-chart-theme 24 — hardcoded Google palette; theme-pack-picker 16; modern-landing 12 — dead file) and **240 Tailwind palette classes** (modern-landing 179 — dead; MarketplaceCourseCard 31).
   - `--growth-amber` defined in `globals.css:170-221`, outside the token files.
5. **Inconsistent empty states:** `EmptyState` component used only in b2b/b2c/LearnerHome/data-table; every portal list hand-rolls its own empty visuals.
6. **Inconsistent tables:** `ui/data-table` is mobile-aware (dual render); hand-rolled `overflow-x-auto` tables in review-queue, users, audit, registries, catalog, messages, course-wizard, resets — usable but cramped on xs.
7. **Exams hub mixed state:** Socratic hub declares the v2 runner "removed" while runner components + API + routes still exist (§1.14).
8. **Route/name mismatch:** `/instructor/courses` mounts `assignments.tsx`.
9. **Mobile:** AppBar + BottomNav both present at xs (the "mobile missing top bar" fear does not exist). No hover-only interactions in critical paths; no clipping found; classroom and exam runner are mobile-correct. PlatformTabs stack with TopNav on tablet (minor).

---

## 4. Legacy vs v2 inventory

**Flag state (live DB):** learner / instructor / org / platform / exams / study-flow / submissions — all `v2 = true`. Code default fails closed; fresh DB serves legacy `/learn` + redirects.

**Legacy still served:**
- `(public)/learn` + `(public)/learn/[courseId]` — public catalog + classroom rendering the **v2** ClassroomShell without portal chrome (in-page auth block; students can bypass the portal shell).
- `src/app/dashboard` redirect stub.
- Legacy APIs still consumed by v2 UI: `/api/students/*` (instructor StudentProfile, learner reports), `/api/org/*` (OrgCourseAssigner, b2b signup), `/api/ai/practice`, `/api/ai/weekly-test`, `/api/ai/instructor-tutor`, `/api/users*`, `/api/audit-log`, `/api/password-reset-requests`, `/api/access-grants`, `/api/courses*`, `/api/admin/*`, `/api/settings/*`, `/api/enrollments*`, `/api/certificates*`.

**Dead / orphaned code:**
- `modules/b2c/` — 0 importers (platform B2C uses `platform-portal/b2c.tsx`)
- `modules/tutor/` (FloatingTutor, TutorPanel, vector rig, dock) — 0 importers; replaced by bus-only tutor in `modules/learn`
- `modules/self-paced/` + `/api/self-paced` — 0 callers
- `components/learn/LearnShell.tsx` — 0 importers (its panels live on via ClassroomShell)
- `components/landing/modern-landing.tsx` — 0 importers (storefront is hand-rolled)
- `modules/student/` — admitted skeleton
- `modules/ui/sonner.tsx`, `modules/ui/toast.tsx` + `toaster.tsx` — unmounted
- `/api/ai/tutor` + `/api/ai/tutor/stream` — no client callers
- Dead redirect targets: `/app` ×3 (org layout, platform layout, learner profile)

**Docs reality check:**
- `PROJECT-STRUCTURE.md` is **stale** (documents deleted `components/examiner`, `/app`, dual-schema status).
- Dual schema **persists** (`schema.prod.prisma`) despite P1 §2.8 "keep + fix".
- **P6 QA infra does not exist** — no Playwright, no `.github`, no CI; promised device matrix/axe/Lighthouse are unimplemented.
- **P7 fixtures/scripts absent** (no `seed-p7-courses.ts`, no domain-neutrality script); only the six study-flow unit tests exist.
- `MODERNIZATION_PLAN.md` sits at repo root; `AUDIT-*.md` (2026-07-26) superseded, keep for history.

---

## 5. RBAC gaps (severity-ranked, all spot-verified)

| Sev | Gap | Evidence |
|---|---|---|
| **S0** | org_admin → platform_admin elevation (matrix + no org scoping on target) | `users/[id]/role/route.ts:66-69` |
| **S0** | Cross-org member tampering via v1 `org/members/[memberId]` | `org/members/[memberId]/route.ts:6-30` |
| **S0** | org_admin can write **global** settings: AI key, feature flags, AI limits, admin caches/cleanup, all-orgs list | `settings/ai-key`, `settings/features`, `settings/ai-limits`, `admin/orgs`, `admin/cache`, `admin/cleanup` (all `ADMIN_ROLES`) |
| **S0** | org_admin reads platform-wide: full user directory (name/email), global audit log, all earnings, all orgs | `api/users/route.ts:111-113`, `api/audit-log/route.ts:22-23`, `instructor/earnings/route.ts:31-55` + v2 twin, `admin/orgs` |
| S1 | org_admin → **any student in any org** via v1 `students/[id]/*` (by design in `assertCanAccessStudent`; violates Tier-2 boundary) | `src/lib/auth.ts:235-238` |
| S1 | Block/delete unscoped (instructor blocks any learner platform-wide) + unaudited | `users/[id]/block/route.ts:39-47` |
| S1 | `org/assign-course`, `enrollments/batch`, `access-grants` — platform-wide writes for any org_admin | `org/assign-course/route.ts:8-19`, `enrollments/batch/route.ts:22`, `access-grants/route.ts:38` |
| S1 | Employer dashboard cross-tenant leak | `employer/dashboard/route.ts:45-56` |
| S1 | Cron fail-open without `CRON_SECRET` (authenticated job triggering + AI cost) | `cron-auth.ts:13-14` |
| S2 | JWT carries **no orgId**; `org_admin` is a *global* role (`ADMIN_ROLES` checks ignore org); `hasAccessGrant` returns true for all admins without consulting grants | `rbac.ts:61-65,211` |
| S2 | Middleware accepts dev-secret-signed tokens if `JWT_SECRET` unset in prod (`auth.ts` throws, middleware doesn't — inconsistent fail-open) | `middleware.ts:177`, `auth.ts:27-33` |
| S2 | Logout stateless; token valid 4h (mitigated by 60s blocked-cache) | `auth/logout/route.ts:5-9` |
| S3 | v1/v2 route twins with different scoping (drift risk) | `org/members` vs `v2/org/members` |

**Missing entirely (the brief's non-negotiables):**
- Per-org capability revocation (Tier-1 right) — no mechanism at all
- User impersonation ("login as") — zero code
- Org-scoped role semantics (Tier boundaries) — org_admin is global
- Payment scoping: `Payment` has no `orgId`/stripe id; org_admin sees all payments platform-wide; no refunds; no Connect/payouts; org plan is a static string; seats unenforced

---

## 6. Performance + UX debt

Strong baseline: every portal page has skeleton + error/retry + empty states; shells are responsive; classroom and exam runner are mobile-correct; no clipping, no hover-only gates in critical paths.

Debt:
1. Exam-runner retry is a full `window.location.reload()`; inconsistent hand-rolled skeletons vs `ui/Skeleton` (23 usages).
2. Marketplace thumbnails are **data-URLs stored in the DB** (≤500KB each) — course list payloads ship base64; lists should field-select or serve a thumbnail endpoint; 500KB cap also means poor quality at large sizes.
3. `picsum.photos` remote stock images (external dependency at runtime).
4. recharts on org/instructor analytics — no route-level code-splitting verification; bundle budget unknown.
5. No PWA/offline shell; no i18n; no perf profiling or request tracing (logger has requestId concept, unused at surface).
6. Middleware rate limits are in-memory per-instance (fine for MVP, self-documented).
7. **No CI, no typecheck script, no e2e, no Lighthouse run, zero component tests** (19 node-env unit files: auth, course validation, grading, study-flow S1–S6, exam-session, submission engine, theme validate, tutor dock).

---

## 7. Platform diagnostic gaps (has vs needs)

| Wanted (brief) | Status |
|---|---|
| System health (DB/API latency P50/P95/P99, AI provider latency/error) | **Partial** — DB/AI/JWT checks exist (`/api/health`, `/api/v2/platform/system`); **no latency measurement**, AI check is "configured?" only; latency data exists in legacy `/api/ai/stats` but no panel consumes it |
| Live request log | **Missing entirely** — no table/endpoint/middleware logging |
| Error tracker (grouped, stacks, affected users) | **Missing** — only last-5-AI-failures in `/api/ai/stats` |
| Background job monitor (crons, Stripe webhooks) | **Missing** — static hardcoded schedule list; no run history; webhook only logs |
| Feature-flag control panel (global + per-org override) | **Exists** (global toggles + 7 portal flags; **no per-org override UI**) |
| User impersonation (audited, watermarked) | **Missing** |
| Cross-org audit viewer + CSV export | **Exists** (CSV is client-side; no server-side export endpoint) |
| Performance profiler (slow routes/queries) | **Missing** |
| Stripe payout/refund console | **Missing** — checkout + completed-webhook only |
| One-click incident response (disable AI/Stripe, maintenance mode) | **Partial** — disable-AI via features panel; **no maintenance mode, no disable-Stripe** |
| Deployment + DB migration status | **Missing** |
| Org health view / anomaly detection / webhook console / status page / scheduled reports | **Missing** |

**Count: 5 exist (2 partial), 8 missing.**

---

## 8. Proposed priority list

**P0-A — Security hardening (before any new UI; the brief's Tier hierarchy is violated today):**
1. Fix elevation matrix: org_admin may assign only `learner|instructor` (within their org).
2. Org-scope every admin API: users dir, audit-log, earnings, block/delete, assign-course, batch-enroll, access-grants, settings/* (AI key → platform_admin only), admin/* (→ platform_admin only), employer dashboard.
3. Kill or fix v1 `org/members/[memberId]` (adopt the correct v2 twin).
4. Enforce `CRON_SECRET` (fail closed), audit block/delete, fix forgot-password route, fix flag-off fallbacks (graceful "portal unavailable" page instead of loops/404), mount a Toaster or migrate the 8 silent-error call sites to sonner, make system-panel purge honest.
5. Delete dead code (§4) — b2c, tutor, self-paced, modern-landing, LearnShell, dead APIs, `/app` redirects.

**P0-B — Foundation:** CI (lint + typecheck + tests + tokens audit + schema diff) with a `typecheck` script; token-adoption pass (primitives + kill 639 legacy vars + 281 arbitrary values in portals; leave public marketing for later); breadcrumbs + notifications bell in non-classic desktop; platform tab dedup; rewrite `PROJECT-STRUCTURE.md`; delete or rewire the orphaned v2 exams surface.

**P1 — Platform admin portal (brief D1):** diagnostics suite (§7 missing 8), orgs management, per-org capability revocation, impersonation (audited + watermarked), Stripe console, incident-response panel, per-org flag overrides.

**P2 — Org admin (D2):** seat enforcement + billing upgrade, content governance, instructor management, audit-scoping fix, mobile approvals.

**P3 — Instructor (D3):** Course/Exam Studio (blocks, question bank, rubric builder, versioning), announcements, messages UI, independent mode + Stripe Connect payouts, mobile grading, interventions.

**P4 — Learner (D4):** desktop shell polish, calendar/deadlines, course-detail tab set + discussion, PWA offline shell.

**P5 — Backend spec (D5)** incl. study-flow API + hardened scope resolver (`orgId` in JWT, org-scoped roles).

**P6 — Floating AI tutor (D6)** — resurrect `modules/tutor` properly as a self-contained module (it is already built and dead; port to tokens + context API).

**P7 — QA pass (D7):** Playwright device matrix (360×640, 390×844, 768×1024, 1024×600, 1366×768, 1440×900), axe + contrast, Lighthouse ≥90, 200% zoom, screen-reader smoke, RBAC penetration suite (every role cannot escape scope), tokens audit, density review.

**P8 — Launch checklist:** broken-features-zero, missing-features-zero, diagnostics green.

Definition of done per module (from the brief, restated as the gate): lint+typecheck clean · tokens only · all four breakpoints · empty/loading/error/permission states · domain-neutral · documented · WCAG 2.2 AA · role-scope enforced.
