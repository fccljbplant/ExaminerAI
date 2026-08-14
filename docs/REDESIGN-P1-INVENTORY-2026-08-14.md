# REDESIGN P1 — Legacy Inventory, Sitemaps, Role Definitions, Study-Flow Mapping, Content-Model Validation

> Phase 1 of the full-platform redesign brief (2026-08-14).
> Prime directive applied: **preserve business data & functionality; every implementation detail is disposable.**
> Facts below were verified against the live codebase (not old docs): 20 routed pages, 151 API route files, ~155 React components, 19 `src/modules/*` entries, 60+ Prisma models, dual schema (SQLite dev / Postgres prod).

---

## 1. Platform as-is (one paragraph)

Single Next.js 16 App-Router monolith on Vercel. **Two student platforms coexist**: the old SPA dashboard at `/app` (`AppShell` + `StudentDashboard` + ~30 panels) and the new AI-guided Learn Platform at `/learn` (`ClassroomShell`, `LearnerHome`, Living-Portrait avatar, 16 `/api/learn/*` routes, 17 Learn models). Staff portals (instructor / org admin / platform admin / employer) are single giant components inside the same SPA shell. Theming is a flat preset blob (hardcoded hex per preset, light+dark only). Courses are `Course → CourseWeek → CourseDay` with JSON config fields. Submissions are text+link only (`GroupTaskSubmission`). RBAC is a clean 4-role model + demo (`learner | instructor | org_admin | platform_admin | demo`) with legacy aliases normalized in one place.

---

## 2. Legacy inventory — KEEP / REPLACE / DELETE

### 2.1 Shells & navigation

| Piece | Verdict | Rationale |
|---|---|---|
| `components/examiner/AppShell.tsx` (952 L, SPA shell + sidebar + view-as-role + shortcuts) | **REPLACE** | Monolith mixes nav config, theming, role-switch; cannot express adaptive shell (top nav → bottom tabs). Rebuild as `shell/` module. |
| `LearnerTopNav.tsx` | **REPLACE** | Fold into adaptive shell; desktop-only assumptions. |
| `shared/command-palette.tsx` + `command-registry.tsx` (⌘K) | **KEEP** | Already the desktop command palette the brief demands; restyle via tokens, add mobile search-sheet mode. |
| `shared/keyboard-shortcuts-help.tsx` | **KEEP** | Small, useful on desktop/Chromebook. |
| `middleware.ts`, `lib/auth.ts` (JWT), `lib/rbac.ts` | **KEEP** | Clean, centralized, already normalized; the RBAC contract survives as-is. |

### 2.2 Old student platform (`/app`)

| Piece | Verdict | Rationale |
|---|---|---|
| `StudentDashboard.tsx` + `examiner/student/*` (~30 panels: CheckInPanel, Gantt*, ReportCard, GrowthReport, CredentialsView, SlideViewer, StreakCalendar, MyCoursesView, OnboardingGuide…) | **DELETE at cutover** | The brief's end-state; functionality is re-homed into the new learner portal (mapping in §2.3), then this code dies. |
| `modules/self-paced` | **REPLACE** | Velocity/advance logic folds into the Study-Flow Engine. |
| `modules/comprehensive-report`, `modules/user-audit` | **REPLACE** | One-off report builders → new analytics/aggregation endpoints. |
| Business data behind them (DailyLog, ReportCard, Certificate, Milestone, SkillMastery, Competency, Interaction) | **KEEP (data)** | Migrate into unified progress/mastery models; no data loss. |

### 2.3 Learn Platform (`/learn`) — the foundation

| Piece | Verdict | Rationale |
|---|---|---|
| `modules/learn` (today-topic, xp-ledger, learner-profile, tts-filter, voice-input, lesson-media, youtube-player) | **KEEP + EXTEND** | Becomes core of learner portal + Study-Flow Engine. |
| `modules/learn/components/classroom/*` (ClassroomShell, LessonStage, VideoStage, VoiceBar) | **KEEP + POLISH** | Session experience already domain-agnostic; needs mobile HUD, mini audio player, bed-mode captions. |
| `modules/learn/components/dashboard/LearnerHome.tsx` | **KEEP + EXTEND** | Becomes new learner dashboard base (continue-learning first, study-plan widget, rings). |
| Avatar: `components/learn/TutorAvatar.tsx`, `TutorBadge.tsx`, `modules/learn/components/avatar/*`, `public/assets/avatar/v1` | **KEEP** | Living-Portrait rig is code-driven, org-calibratable, asset-light — matches "floating tutor" spec; wrap it in the new FloatingTutor module (drag/dock/persist/state-machine). |
| 16 `/api/learn/*` routes | **KEEP + EXTEND** | Add session-tracking, plan-generation, resume-state endpoints (P4). |
| Learn models (LearnProfile, JourneyPlan/Step, LearnSlide, LearnNarration, TutorSession/Message, XPLedger, Badges, LearnNote, EngagementEvent) | **KEEP** | Solid base; extend with StudySession + scheduler tables. |

### 2.4 Instructor / Org Admin / Platform Admin / Employer

| Piece | Verdict | Rationale |
|---|---|---|
| `InstructorDashboard.tsx` + `examiner/instructor/*` (17 comps incl. 1251-L StudentPortfolioPage) | **REPLACE** | Rebuild as Instructor portal from jobs-to-be-done; keep backing endpoints (`/api/instructor/*`, `/api/students/[id]/*`) where sound. |
| `OrgAdminDashboard.tsx`, `AdminDashboard.tsx` (818 L), `EmployerDashboard.tsx`, `examiner/admin/*` (14 panels) | **REPLACE** | Rebuild as Org Admin + Platform Admin portals; keep `/api/admin/*`, `/api/org/*`, audit/feature-flag libs. |
| `CoursePlanner.tsx` (1454 L), `CourseCreationWizard.tsx` (794 L), `CourseOutline.tsx` | **REPLACE** | Rebuild as Course & Exam Studio on the new content model; keep generation/AI libs in `modules/course`. |

### 2.5 Public site & marketplace

| Piece | Verdict | Rationale |
|---|---|---|
| `(public)/*` landing, pricing, for-business, for-learners, support | **KEEP, RESTYLE LAST** | Business functionality; restyle with new tokens after portals ship. |
| Marketplace (courses, paths, reviews, FAQs, checkout, `/api/stripe/*`, `/api/marketplace/*`) | **KEEP** | Revenue functionality; UI restyle only. `MARKETPLACE_CATEGORIES` is tech-biased → move to configurable registry. |
| `verify/[credentialId]` public credential page | **KEEP** | Domain-neutral already. |

### 2.6 Component library & shared kit

| Piece | Verdict | Rationale |
|---|---|---|
| `components/ui/*` (52 shadcn/Radix primitives incl. drawer=vaul, dialog, tabs, table, chart wrapper, command) | **KEEP** | Accessible Radix base = the primitive library seed; re-skin to tokens, add missing primitives (KPI, DataTable, BottomSheet alias, SubmissionRenderer, Chart wrappers). |
| `components/shared/*` (stat-card, widget-card, states, prominent-tabs, action-dialog, collapsible-card, typing-indicator, learner-xp-bar, dashboard-shell) | **KEEP + PROMOTE** | Becomes the design-system kit (StatCard→KPI, WidgetCard→Card). |
| `components/examiner/*` everything else | **DELETE progressively** | One-off role panels; functionality re-homed, code removed. |

### 2.7 Theme engine

| Piece | Verdict | Rationale |
|---|---|---|
| `modules/theme` (presets.ts = flat hardcoded-hex blobs, theme-context, unified-theme-toggle) | **REPLACE** | No token layers, no Bed Mode, no org-brand derivation, no WCAG validation. Rebuild 3-layer token system; one-time migration maps saved preset id → new semantic tokens. |
| `next-themes` usage | **KEEP** | Runtime switching mechanism is fine; tokens change underneath. |

### 2.8 Backend modules & API layer

| Piece | Verdict | Rationale |
|---|---|---|
| `modules/assessment` (ai-provider chain, unified-grader, test engine, rate limits, prompts) | **KEEP** | Core AI IP; refactor into typed services, keep behavior. |
| `modules/course` (course-db/config/defaults/validation, marketplace lib, certificate) | **KEEP + EXTEND** | Grows the configurable content model (0D). |
| `modules/project` (planner, setup, weeks, reports) | **KEEP + GENERALIZE** | Becomes assignment/project workspace with submission-type registry. |
| `modules/gamification` (XP, badges, celebration) | **KEEP** | Evidence-locked XP is product differentiator; restyle only. |
| Skeleton modules (`admin, auth, communication, grading, shared, student, wellbeing` re-export stubs) | **DELETE** | Exactly the "wrap, don't replace" anti-pattern the directive bans; rebuild real modules where needed. |
| 151 API routes | **REFACTOR pattern** | Keep stable endpoints (auth, enrollments, marketplace, stripe, org, users); add typed API client + aggregation endpoints; delete legacy duplicates (`/api/daily-tasks`, old `/api/daily-test` vs `/api/learn/daily-test`, `/api/learner/xp` vs `/api/learn/me/xp`). |
| Dual schemas (`schema.prisma` / `schema.prod.prisma`) | **KEEP + FIX** | Single schema + provider switch (already planned); enforce via CI diff. |

### 2.9 Data model highlights

- **KEEP**: User, CourseEnrollment, Course/Week/Day, GroupTask(+Submission→generalized), PeerAssessment, Event, Message, Comment(→feedback threads), Certificate, Milestone, AuditLog, AccessGrant, Notification, Payment, Organization/OrgMember, DrillCard(→SRS engine), all Learn* models.
- **CONSOLIDATE**: `DailyTest/WeeklyTest` (old) vs `LearnDailyTest/LearnWeeklyTest` → one assessment engine; `Interaction + Competency + SkillMastery` → one topic-mastery model; `Institution` → `Organization`; `ChatSession` → `TutorSession`.
- **ADD** (P4): StudySession, StudyPlan, SubmissionAttachment, SubmissionTypeRegistry/RubricSchema, MentorFeedback (audio/annotation), OrgBrand/ThemeConfig, cram/absence detection artifacts.
- **PURGE domain bias**: `CourseDay.codeExamples`, `DailyLog.gitCommit`, `User.projectGithubUrl/projectDeployUrl`, tech-only category constants → generic registries.

---

## 3. Role definitions (one-pagers)

| Role | Jobs-to-be-done | Primary surfaces (new) |
|---|---|---|
| **Learner** | Learn any subject; finish lessons/assignments/projects; sit exams; see progress & weak topics; get help from mentor + AI tutor; earn verifiable credentials. | Home, Learn (catalog→course→session), Assignments & Projects, Exams, Progress, Study-Flow Center, Profile/Help. Bottom tabs: Home / Learn / Exams / Progress / Profile. |
| **Instructor / Mentor** | Build & publish courses/exams from blocks; review ANY submission with rubric + audio/annotated feedback; resubmission cycles & sign-offs; monitor cohort & intervene; announce; (marketplace) earnings. | Home (queues + at-risk), Course & Exam Studio, Review Center, Students, Grading, Analytics, Earnings. Bottom tabs: Home / Courses / Students / Grading / More. |
| **Org Admin** | People & seats & RBAC; content governance across ANY domain; branding via theme system; feature control; monitoring/audit; billing; org-level study analytics & interventions. | Command Center, People & Roles, Content Governance, Control Center, Monitoring & Audit, Billing, Study Analytics. Bottom tabs: Home / People / Control / Reports / More. |
| **Platform Admin** | Platform health & crons; AI providers/limits/costs; org management; marketplace governance; security audit; maintenance. | System portal (desktop-dense; mobile = alerts + approvals). |
| **Demo** | Read-only showcase with write-guards (existing `demo-guard`). | Mirrors any role, writes blocked. |

`demo` and the view-as-role preview survive (useful for sales); employer/sponsor ROI folds into Org Admin → Reports.

---

## 4. Sitemaps (new IA)

**Learner**: `/home` · `/learn` (catalog) · `/learn/[course]` (detail tabs: Overview/Syllabus/Lessons/Assignments/Progress/Grades/Discussion) · `/learn/[course]/session` (classroom) · `/assignments` (list) · `/assignments/[id]` (submission flow + mentor thread) · `/projects/[id]` (workspace: milestones, feedback, sign-offs) · `/exams` (schedule) · `/exams/[id]` (runner) · `/exams/[id]/results` (review+explanations) · `/progress` (analytics+achievements) · `/study-plan` (Study-Flow Center) · `/profile` · `/help`.

**Instructor**: `/home` · `/studio` (course & exam builder, question bank, rubric builder, templates, versioning, publish) · `/review` (queue) · `/review/[submissionId]` (preview+annotate+grade) · `/students` · `/students/[id]` · `/grading` · `/analytics` · `/announcements` · `/earnings`.

**Org Admin**: `/home` · `/people` (+RBAC matrix) · `/governance` (course approvals, block registries) · `/control` (flags, branding/theme, settings) · `/audit` · `/billing` · `/analytics`.

**Platform Admin**: `/home` · `/orgs` · `/system` (health, crons, cache) · `/ai` (providers, limits, usage/cost) · `/marketplace` · `/audit` · `/maintenance`.

**Public**: unchanged IA, restyled last.

---

## 5. Study-Flow scenario mapping (today vs gap)

| # | Scenario | Exists today | Gap → engine capability (P4) |
|---|---|---|---|
| 1 | Catch-up after 3–7 d | `LearnProfile.lastActivityDate` + streaks; `/api/learn/now` = resume point | Missed-lesson detector (journey vs calendar), welcome-back chooser, 10-min condensed summary (AI), mark-missed-optional. |
| 2 | Cramming (3 d in 1) | Self-paced advance (`SelfPacedAdvanceButton`) | Intensive-session detector, Accelerated mode (condensed slides, skip optional), retention warning, SRS boost scheduling. |
| 3 | Irregular patterns | Streaks only | Pattern inference from `EngagementEvent`/sessions; "you have 30 min" planner; weekend-plan suggestion; SRS rescheduled from real cadence. |
| 4 | Exam in N days | `Event` (deadlines) exist | Emergency plan generator: mastery-prioritized sequence, 2-h blocks + breaks, milestones + rest reminders. |
| 5 | "I have 15 minutes" | Nothing | Time-budget selector (15m/30m/1h/∞) at session start; micro-lesson / quick-review / quick-quiz picker that never overruns the window. |
| 6 | Absence > 1 week | Nothing | Decay assumption + 10-Q diagnostic quiz → route to review or jump-ahead; encouraging copy. |

**Reusable seeds**: `DrillCard` (SRS), `JourneyPlan/Step` (sequencing), `EngagementEvent` (tracking), `LearnProfile.masteryMap`, self-paced velocity. **New**: `StudySession` (start/end/budget/lessons/engagement), adaptive scheduler, cram/absence detectors, plan generator, tutor context API extension (scenario → proactive offer).

---

## 6. Content-model validation (zero-code-change proof)

Current model: `Course(domain, level, subjects, toolsUsed, deliverableTypes, assessmentType+ConfigJson, aiPromptsJson, testConfigJson, projectTemplateJson, reportCardTemplateJson) → CourseWeek → CourseDay(topics, activity, deliverable, resources, videoUrl, codeExamples)`. Submissions: `GroupTaskSubmission(content, link)` + `Comment` thread.

| Sample domain | Verdict today | Blocking gaps |
|---|---|---|
| **eBay store program** (already seeded) | PARTIAL | Link/live-artifact submission works; but no annotated review of a live store, no milestone sign-off model on GroupTask, mentor thread is text-only. |
| **HSE certification** | FAIL | No checklist submission type, no photo-evidence capture, no safety-critical strictness flag beyond free-text prompts, no mandatory-sign-off chain. |
| **Mobile repair** | FAIL | No photo/video evidence submission, no practical-demo assessment type, no rubric-based grading (scores are single int). |

**Conclusion**: keep `Course → Week → Day` as the *scheduling skeleton*; REPLACE the lesson/submission layer with registries (0D in P2): lesson types (ai-taught / video / text / practical-demo), submission types (text / file / photo / video / link / checklist / live-artifact), grading methods (rubric / score / sign-off), per-course AI config (tone, strictness, glossary). Domain bias fields listed in §2.9 get purged.

---

## 7. Decisions taken & open questions

**Taken** (from the brief + code facts): 4-role model + demo stays; `/learn` is the learner-portal foundation; old `/app` student platform deleted at cutover; Radix/shadcn kit is the primitive base; theme engine rebuilt; skeletons deleted; marketplace & gamification = business functionality → kept.

**Open (asked alongside this doc)**: (a) ordering/scope of the public marketing restyle; (b) tutor visual identity (Living Portrait vs new neutral avatar).

**Resolved (approval 2026-08-14)**: P1 approved as-is · public marketing/marketplace = **restyle last** (functionality frozen meanwhile) · tutor = **new abstract, domain-neutral vector tutor**, fully in-house (no external paid services), orgs may still upload a real face (calibration concept retained); the current Living-Portrait rig is dropped.

## 8. Next (P2)

Architecture spec (0B) · theme system spec (0C) · content model spec (0D) · design-system mapping (screen → primitives) · breakpoint grid — all consistent with the verdicts above.
