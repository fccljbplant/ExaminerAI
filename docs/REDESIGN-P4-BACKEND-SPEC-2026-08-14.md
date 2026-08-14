# REDESIGN P4 — Backend Spec (endpoints · schema · caching · Study-Flow Engine · Content-Model API · text pipeline)

> Phase 4 (2026-08-14). Serves [P3](./REDESIGN-P3-PAGE-SPECS-2026-08-14.md) screens. Zero-legacy-bias: v1 routes run in parallel during strangulation and are **deleted at cutover**, not wrapped.

## 1. Conventions

- **Versioning**: new surface = `/api/v2/*`. Envelope `{ data, meta: { cursor?, version: 2 } }`; errors `{ error: { code, message, retryable } }` with stable codes (`UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, AI_DEGRADED, EXTRACTION_FAILED, VALIDATION`).
- **Auth/RBAC**: existing `requireRole` / `requireAccessGrant` stay authoritative; every v2 route declares `roles[]` + scope; IDOR guards mandatory on any `[userId]`/`[studentId]` param (P1 debt cleared).
- **Contracts**: zod schemas in `modules/<m>/contracts.ts` shared by route + client; client = `lib/api/client.ts` (P2 §1.3).
- **Pagination/field-selection**: all lists/aggregates take `cursor` + `limit` (20 xs default / 50 max) and `fields=a,b` (per-endpoint zod select map) for mobile payloads.
- **Caching**: aggregate GETs → server SWR 30–60s + client `staleTime`; catalog/public → `cache-control: public, 300`; AI responses → existing `AICache`; mutations return fresh entity + declared query invalidations. No cache on resume/draft endpoints.
- **Events**: `POST /v2/events` accepts a typed union catalog (`session.start/end, slide.next, lesson.completed, submit.draft/sent, exam.start/answer/exit/resume, srs.review, plan.chose, cram.detected, absence.detected, intervention.applied`); writes `EngagementEvent`; powers analytics + study-flow.
- **Audit**: privileged mutations (RBAC change, publish, takedown, grade override, intervention apply, branding change) write `AuditLog` with before/after JSON.
- **Text-only AI**: every AI call site builds `AiContextPacket` via `modules/submission/lib/ai-packet.ts`; binaries never cross into prompts (P2 §3.4).

## 2. Endpoint spec (screen → endpoint)

Roles: L=learner I=instructor O=org_admin P=platform_admin.

### Learner (L1–L14)
| Screen | Endpoint | Notes |
|---|---|---|
| L1 | `GET /v2/learner/home` | aggregate: now/resume, plan summary, due, announcements, KPIs; SWR 60 |
| L2 | `GET /v2/courses?cursor&fields&q&category&level` | org-assigned pinned; public catalog cached |
| L3 | `GET /v2/courses/[id]?tab=` | tab-lazy: overview/syllabus/lessons/assignments/progress/grades/discussion |
| L4 | `GET /v2/lessons/[id]` · `POST /v2/lessons/[id]/complete` · `POST /v2/sessions` (budget) · `PATCH /v2/sessions/[id]` (heartbeat/autosave) · `POST /v2/sessions/[id]/end` → recommendation | resume = sessions.active + lesson payload; preload next via `?include=next` |
| L4 tutor | `POST /v2/tutor/ask` (stream SSE) | context from `tutorContext()`; text-only packet |
| L5 | `GET /v2/assignments?status&cursor` | |
| L6 | `GET /v2/assignments/[id]` · `POST /v2/assignments/[id]/draft` (debounced autosave) · `POST /v2/assignments/[id]/submit` · `POST /v2/submissions/[id]/resubmit` · `POST /v2/uploads` (multipart → partId; docx/pdf triggers extraction job) | draft/resume never cached |
| L7 | `GET /v2/projects/[id]` · `POST /v2/projects/[id]/milestones/[mid]/complete` · `POST /v2/projects/[id]/ping-mentor` | |
| L8 | `GET /v2/exams` | |
| L9 | `POST /v2/exams/[id]/start` · `GET /v2/exams/[id]/resume` · `PATCH /v2/exams/[id]/answer` (autosave) · `POST /v2/exams/[id]/complete` | resume restores question index + draft |
| L10 | `GET /v2/exams/[id]/results` | includes human-graded evidence criteria + explanations |
| L11 | `GET /v2/learner/progress` · `GET /v2/learner/achievements` | |
| L12 | `GET /v2/study-plan` · `POST /v2/study-plan/choose` (scenario option) · `GET /v2/srs/queue` · `POST /v2/srs/[cardId]/review` · `POST /v2/diagnostic/start` · `POST /v2/diagnostic/answer` | |
| L13 | `GET/PUT /v2/me/prefs` | theme mode, a11y, captions, audio-only, budget default |
| L14 | `GET /v2/help/faq?q=` | |

### Instructor (I1–I10)
| Screen | Endpoint |
|---|---|
| I1 | `GET /v2/instructor/home` (queue KPI, at-risk, snapshot) |
| I2 | `POST/PUT /v2/studio/courses[/…]` · `/modules` · `/lessons` · `/assignments` · `/quizzes` · `/banks` · `/questions` · `/rubrics` · `POST /v2/studio/courses/[id]/publish` · `POST /v2/studio/courses/[id]/ai-draft` (outline txt; Word/PDF pre-converted client-side via `POST /v2/uploads`) · `GET /v2/studio/courses/[id]/versions` |
| I3/I7 | `GET /v2/review/queue?type&status&cursor` |
| I4 | `GET /v2/submissions/[id]` (parts + extracted text + thread + rubric) · `POST /v2/submissions/[id]/grade` · `POST /v2/submissions/[id]/decision` (approve/changes/signoff) · `POST /v2/submissions/[id]/feedback` (text/audio/annotation) · `POST /v2/submissions/[id]/ai-draft` (aiAssist criteria only) |
| I5/I6 | `GET /v2/instructor/students?cursor` · `GET /v2/instructor/students/[id]` |
| I6 | `POST /v2/interventions/[id]/apply` (audit-logged) |
| I8 | `GET /v2/instructor/analytics?course=` |
| I9 | `POST /v2/announcements` · `GET /v2/announcements?scope=` |
| I10 | `GET /v2/instructor/earnings` |

### Org admin (O1–O7) / Platform (P1–P7)
| Screen | Endpoint |
|---|---|
| O1 | `GET /v2/org/home` · `POST /v2/org/approvals/[id]` (approve/return+reason) |
| O2 | `GET/POST /v2/org/members` · `POST /v2/org/members/[id]/deactivate` (UNDO window) · `GET/PUT /v2/org/rbac-matrix` |
| O3 | `GET/PUT /v2/org/registries/[kind]` (submission-types / rubric-templates / categories) · `GET /v2/org/instructor-activity` |
| O4 | `GET/PUT /v2/org/flags` · `GET/PUT /v2/org/branding` (writes OrgThemeConfig; runs derivation + validator server-side) |
| O5 | `GET /v2/org/audit?cursor&filters` (+`&format=csv`) · `PUT /v2/org/alert-rules` |
| O6 | `GET /v2/org/billing` |
| O7 | `GET /v2/org/analytics` |
| P1–P7 | `/v2/platform/{home,orgs,system,ai,marketplace,audit,maintenance}` — same patterns; cache purge + maintenance toggle confirm-gated + audited |

## 3. Schema additions (Prisma; both schemas via single-source fix)

New: `ContentModule, Lesson, LessonBlock, Assignment, Quiz, QuestionBank, Question, Rubric, RubricCriterion, SubmissionTypeRow, RegistryRow, Submission, SubmissionPart, FeedbackThread, FeedbackMsg, SignOff, OrgThemeConfig, StudySession, StudyPlan, CourseVersion`.

Key fields:
- `SubmissionPart { type, payloadJson, fileUrl?, extractedText?, extractionStatus: none|pending|done|failed, learnerSummary? }`
- `Submission { status: draft|submitted|in_review|changes_requested|resubmitted|approved|signed_off, cycle Int }`
- `RubricCriterion { weight, levelsJson, aiAssist Boolean }`
- `StudySession { userId, courseId, budgetMin?, startedAt, endedAt?, lessonsDone Int[], engagementJson }`
- `StudyPlan { userId, horizonDays, itemsJson (ordered PlanItem{ref, type, estMin, reason}), scenario, generatedAt }`
- `CourseVersion { courseId, version Int, snapshotJson, publishedAt? }` — publish flips `Course.publishedVersion`.
Migrations per P2 §3.5 (Week/Day→Module/Lesson; GroupTask→Assignment; submissions→parts; Comment→FeedbackMsg; Institution→Organization backfill; test-table unification).

## 4. Study-Flow Engine (`modules/learn/lib/study-flow.ts`)

Pure services over `StudySession, EngagementEvent, JourneyPlan, DrillCard, Event, LearnProfile`:
- `detectAbsence(u)` → none | short(3–7d) | long(>7d) (vs personal cadence baseline).
- `detectCram(session)` → lessons/hour vs baseline ×3 → flag + SRS boost + retention warning payload.
- `suggestBudget(u)` → default chip preselect from history.
- `generatePlan({u, budgetMin, horizonDays, goal?})` → scores candidates (SRS due ×2, weak topics ×1.5, deadline proximity, journey order) into ordered `PlanItem`s whose ΣestMin ≤ budget (scenario 5 never overruns); horizon plans use 2h blocks + breaks (scenario 4); accelerated mode swaps lesson blocks for condensed variants (scenario 2).
- `srsSchedule()` — replaces `drill-scheduler` cron; intervals from per-topic mastery, rescheduled by real review cadence (scenario 3).
- Crons: `study-plan-refresh` 06:00 · `absence-scan` 07:00 (creates notifications + tutor offers) · `srs-due` 03:00 (replaces old) · heartbeats per existing cron contract.
- `tutorContext(u, courseId, surface)` → `{ AiContextPacket, activeScenario, proactiveOffer? }` consumed by `/v2/tutor/ask` and session start; offers match the six scenario scripts (plain language, no guilt).

## 5. Content-Model API (`modules/course` + `modules/submission`)

- Studio CRUD services mirror §2 I2 routes; validation via zod + `validateCourse` (objectives ≥1, durations sane, registries refs exist).
- **Registries** = `RegistryRow` tables; org-scoped overrides; adding a domain/submission type = insert row (zero code).
- **Rubric engine** (`modules/submission/lib/rubric-engine.ts`): `grade(parts, rubric, entries)` → weighted score + per-criterion; `aiAssist` prefill via grader AI from extractedText/learnerSummary only, labeled; human entries always win; overrides audited.
- **Lifecycle service**: `submit/resubmit/decision/signoff` enforce cycle limits + cooldowns + sign-off chains (multi-signer ordered for HSE-style configs).
- **Feedback threads**: text/audio(url)/annotation(markersJson on partId); notifications on post.
- **Publish/versioning**: edits land on draft; `publish` snapshots `CourseVersion`, bumps pointer; learners always read `publishedVersion`.

## 6. Text-extraction pipeline (`modules/submission/lib/text-extract.ts`)

- `POST /v2/uploads` stores file, returns partId; if mime ∈ {docx, pdf} → extraction job (in-process, 10s timeout): `mammoth` (docx) / `pdfjs-dist` (pdf) — open-source, on-server, **no paid/external service**.
- Limits: 5MB docx / 10MB & 200 pages pdf; result truncated to ~20k tokens; `extractionStatus` transitions pending→done|failed; failure → human-only review path + `EXTRACTION_FAILED` notice (P2 §3.4 degradation).
- Result cached on `SubmissionPart.extractedText`; reused by grader AI, tutor, and search; never exposed to other learners.

## 7. Performance & ops

- Route-level code splitting per portal (P2); aggregation endpoints single-round-trip; N+1-free (Prisma include/select per `fields`).
- AI rate limits kept (`ai-rate-limits`), now per-feature buckets; `AIUsageLog` retained for P4 platform AI screen.
- Tests (vitest): study-flow scheduler (all 6 scenarios), exam autosave/resume, submission lifecycle + rubric math, extraction failure paths, RBAC matrix, theme validator.

## 8. Next (P5)

Implementation order + migration/cutover plan (tokens+ui lib → learner dashboard → floating tutor → study-flow → assignments/projects → instructor → org/platform → public restyle → delete old `/app` + v1 routes + skeletons), with data-migration runbook and rollback strategy.
