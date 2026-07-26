# ExaminerAI — Section 2: Security Audit

> **Scope:** Every `route.ts` under `src/app/api/` (123 files, ~190 method handlers), `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/ai-assistant/scope.ts`, `src/lib/ai-rate-limits.ts`, `src/lib/demo-guard.ts`, and both Prisma schemas.
> **Audit date:** 2026-07-26
> **Lenses applied:** senior coder, QA, security-focused SWE.
> **Findings:** 9 CRITICAL, 23 HIGH, 17 MEDIUM, 9 LOW.

---

## Executive Summary

The codebase has solid bones in the **centralized RBAC** (`src/lib/rbac.ts`), the **`assertCanAccessStudent` IDOR helper**, the **`demoWriteBlock` / `isDemoAIBlocked` dual guard pattern**, and the **session-blocked re-check with 60-second cache** in `getAuthUser()`. The well-protected AI routes (`/api/ai/tutor`, `/api/ai/weekly-test`, `/api/ai/practice`, `/api/students/[id]/narrative`, `/api/students/[id]/comprehensive-report`, `/api/students/[id]/explain`, `/api/students/[id]/rehearse`, `/api/students/[id]/draft-checkin`, `/api/teacher/assistant`, `/api/courses/upload-outline`, `/api/project/suggestions`, `/api/project/auto-report`) demonstrate the correct pattern.

However, the audit uncovered **nine actively-exploitable CRITICAL vulnerabilities** plus a long tail of HIGH-severity defense-in-depth gaps. The most serious systemic issues are:

1. **The `institutionId ?? undefined` Prisma anti-pattern** in `src/lib/ai-assistant/scope.ts` (8 occurrences) and `src/lib/ai-assistant/data-efficiency.ts` (2 occurrences). When a legacy user has `institutionId = null`, this expression evaluates to `undefined`, which Prisma treats as **"no filter on this field"** — meaning the user sees data from ALL institutions. This propagates into the AI Assistant's context window.
2. **The `assertCanAccessStudent` helper is bypassed on a long tail of routes** that accept an entity ID (`interactionId`, `dailyLogId`, `flagId`, `alertId`, `taskId`, `submissionId`, `eventId`, `groupTaskId`, `batchId`, `toId`, `granteeUserId`, `studentId`) without first verifying the caller's batch / institution scope.
3. **16 AI-calling routes have NO `checkUserAILimit`** and **3 routes have NEITHER rate limit NOR demo guard** — confirming the inventory finding and exposing the deployment to monetary DoS.
4. **Plaintext temporary password storage** in `PasswordResetRequest.tempPassword` after admin approves a reset — a CRITICAL operational security violation.

---

## 1. Role Enforcement Accuracy

### 1.1 Correctly enforced (samples)
- `/api/users` POST — non-admin staff can ONLY create `student` accounts; admin roles (`principal`, `administrator`) required for any other role. Allowlist of `VALID_ROLES` rejects unknown roles instead of silent downgrade. (src/app/api/users/route.ts:104-116)
- `/api/users/[id]/role` PATCH — uses an **elevation matrix**; `principal` cannot assign `demo`; only `administrator` can. Prevents self-demotion. (src/app/api/users/[id]/role/route.ts:63-73)
- `/api/users/[id]/block` PUT — teachers/counselors/coordinators can only block `student`/`pending`; admins protected; self-block rejected. (src/app/api/users/[id]/block/route.ts:38-50)
- `/api/settings/ai-key` GET/POST/DELETE — actual code requires `ADMIN_ROLES` (inventory mis-labeled it "Any authed"). Verified correct.
- `/api/institutions` GET/POST — actual code requires `ADMIN_ROLES` (inventory mis-labeled it "Any authed"). Verified correct.
- `/api/crisis-flags` GET/POST — `requireRole([TEACHER, COUNSELOR, PRINCIPAL, ADMINISTRATOR, DEMO])` — matches design (teachers can flag; safeguarding alerts filter to principal-only on read). (src/app/api/crisis-flags/route.ts:13-16)

### 1.2 Findings — role mismatches

| # | Route | File:line | Issue | Severity |
|---|-------|-----------|-------|----------|
| R1 | `/api/mentorship/touchpoints/parse` | `mentorship/touchpoints/parse/route.ts:23` | Role check is `if (payload.role === "student") return 403`. This admits `guardian` and `pending` users to a staff-only AI parsing endpoint. Should be `isStaffRole(payload.role)`. | **HIGH** |
| R2 | `/api/students/[id]/rehearse` | `students/[id]/rehearse/route.ts:34` | Same anti-pattern: `if (payload.role === "student") return 403`. Guardian/pending pass through. Should be `isStaffRole()`. | **HIGH** |
| R3 | `/api/students/[id]/portfolio` | `students/[id]/portfolio/route.ts:43` | `if (payload.role === "teacher")` — only `teacher` gets batch scoping. **`teaching_assistant` falls through to the AccessGrant branch** and is therefore more restrictive than `teacher` (TAs need an explicit grant, while teachers get batch access). This contradicts `scope.ts:142` which treats teacher + TA identically. TAs are functionally broken on this route. | **MEDIUM** |
| R4 | `/api/batches/[id]/teachers` GET | `batches/[id]/teachers/route.ts:62` | Inventory says "Any authed". Code confirms: only `getAuthUser()` — **students can list teachers for ANY batch** in any institution. Should be staff-only. | **HIGH** |
| R5 | `/api/assistant/escalation/run` | `assistant/escalation/run/route.ts:21` | Allows `demo` to trigger an escalation run (a write action that auto-creates touchpoints + sends messages). No `demoWriteBlock()`. Demo is supposed to be read-only. | **MEDIUM** |
| R6 | `/api/stats` `?as=teacher` | `stats/route.ts:18,30` | Admin (`?as=teacher`) is given `getBatchFilter` = `{}` (no filter), so an admin impersonating a teacher sees **all students in all institutions** in the dashboard — even though the route is meant to preview what a teacher sees. The impersonation should also impose a representative batch filter. | **HIGH** |
| R7 | `/api/daily-motivation` | `daily-motivation/route.ts:18` | `getCurrentUser()` only — admits `pending`, `guardian`, `demo`. Probably acceptable, but if `pending` is meant to have no feature access until approved, this leaks. | **LOW** |

---

## 2. IDOR (Insecure Direct Object Reference)

`assertCanAccessStudent(payload, studentId)` exists in `src/lib/auth.ts:218-289` and is correctly applied on most student-id routes (`/api/students/[id]/*`, `/api/comments`, `/api/crisis-flags` GET/POST, `/api/psych-evidence`, `/api/wellbeing-state`, `/api/skill-mastery`, `/api/report-cards`, `/api/growth-reports/[userId]`, `/api/mentorship/touchpoints`, `/api/certificates/generate`, `/api/grades/override`, `/api/students/[id]/portfolio`). The pattern is **right but inconsistently applied** to the long tail of entity-id routes.

### 2.1 CRITICAL / HIGH IDOR findings

| # | Route | File:line | Issue | Severity |
|---|-------|-----------|-------|----------|
| I1 | `/api/confidence-ratings` GET | `confidence-ratings/route.ts:7-22` | **No `assertCanAccessStudent`.** A staff user can pass `?userId=X` and read ANY student's confidence ratings across any institution. The only check is `isStaff` boolean — no scope verification. This is a textbook IDOR. | **CRITICAL** |
| I2 | `/api/tasks` DELETE | `tasks/route.ts:175-194` | `db.comment.deleteMany({ where: { taskId: id } })` (line 183) runs BEFORE `db.projectTask.delete({ where: { id, userId: user.id } })` (line 188). The comment deletion is **NOT scoped by userId**. A student can pass any `taskId` and delete ALL comments (including teacher comments) on a task they don't own — even though the subsequent `projectTask.delete` fails on the userId check. The comments are already gone. | **CRITICAL** |
| I3 | `/api/interactions/[id]` PATCH/DELETE | `interactions/[id]/route.ts:12-56` | `isStaffRole` check only — **no `assertCanAccessStudent`**. Any staff member can edit or delete ANY interaction record in any institution if they have its ID. The PATCH allows changing `correctness`, `feedback`, `studentAnswer`, etc. — evidence tampering. | **HIGH** |
| I4 | `/api/daily-logs/[id]` PATCH/DELETE | `daily-logs/[id]/route.ts:12-54` | Same pattern as I3 — `isStaffRole` only, no IDOR check. A teacher can edit/delete ANY student's daily check-ins across any institution. | **HIGH** |
| I5 | `/api/crisis-flags` PATCH | `crisis-flags/route.ts:161-203` | Accepts `flagId` and updates status with **no check** that the staff member has access to the student this flag belongs to. A teacher can resolve a crisis flag for a student in another institution (or for one outside their batch). For sensitive safeguarding data this is a serious concern. | **CRITICAL** |
| I6 | `/api/students/alerts` PATCH | `students/alerts/route.ts:66-105` | Accepts `alertId` and resolves/acknowledges it with **no IDOR check**. Any staff can resolve ANY alert (including safeguarding alerts that should be principal-only — the `isPrincipal` filter is only applied on GET, not PATCH). | **HIGH** |
| I7 | `/api/students/alerts` GET (no `userId`) | `students/alerts/route.ts:46-62` | Returns open alerts across ALL students in ALL institutions. No batch or institution filter. The safeguarding-type filter (`type: { not: "safeguarding" }`) is applied for non-principals but doesn't help cross-batch. | **HIGH** |
| I8 | `/api/group-tasks` PATCH/DELETE | `group-tasks/route.ts:97-138` | `requireRole([TEACHER, PRINCIPAL, ADMINISTRATOR, DEMO])` only. **No check that the staff member has access to the batch** the task belongs to. Any teacher can close/edit/delete ANY group task by passing `taskId`. | **HIGH** |
| I9 | `/api/group-tasks` GET | `group-tasks/route.ts:13-43` | Staff can pass any `batchId` and see all tasks + submission counts for ANY batch across institutions. No `canAccessBatch` check. | **HIGH** |
| I10 | `/api/group-tasks/submit` PATCH | `group-tasks/submit/route.ts:89-116` | `submissionId` accepted with no scoping. Any teacher/admin can grade ANY submission across any institution. The student-authenticated GET (line 66-83) is also unscoped — staff can read all submissions for any group task. | **HIGH** |
| I11 | `/api/events` POST/DELETE | `events/route.ts:38-91` | POST accepts any `batchId` without `canAccessBatch` check — staff can post events to ANY batch in any institution. DELETE has no IDOR check at all — any staff can delete ANY event by `eventId`. | **HIGH** |
| I12 | `/api/peer-assessment` GET (teacher) | `peer-assessment/route.ts:62-72` | `isStaff && groupTaskId` branch returns all peer assessments for that group task with **no batch scoping**. Any staff can read peer assessments for any group task. | **HIGH** |
| I13 | `/api/peer-assessment` GET (student pending) | `peer-assessment/route.ts:74-96` | A student can pass ANY `groupTaskId` and see the list of all students who submitted it (names + user IDs) — even students in other institutions. There's no check that the calling student is in the batch this group task belongs to. | **HIGH** |
| I14 | `/api/messages` POST | `messages/route.ts:37-112` | No `toId` scoping whatsoever. A user from institution A can send a message to ANY user in institution B (including admins, principals, other students). Combined with `messages/[id]/route.ts` allowing teachers to moderate ANY message, this is a cross-institution messaging vector. | **HIGH** |
| I15 | `/api/batches/[id]` GET | `batches/[id]/route.ts:154-192` | `isStaffRole` only — no `canAccessBatch` check. Any staff can fetch ANY batch's details (name, dates, course, user count) across institutions. | **HIGH** |
| I16 | `/api/batches/[id]/teachers` GET | `batches/[id]/teachers/route.ts:58-83` | See R4 — students included. No scoping at all. | **HIGH** |
| I17 | `/api/guardian/create` POST/DELETE | `guardian/create/route.ts:30-170` | Staff can create a guardian account for ANY student across institutions (no `assertCanAccessStudent` on the `studentId`). DELETE removes any guardian account from any institution. | **HIGH** |
| I18 | `/api/comments` PATCH/DELETE | `comments/route.ts:138-187` | Ownership check (`teacherId === payload.sub`) is good, but no re-verification that the staff member still has access to that student. A teacher moved out of a batch can still edit/delete their old comments. Defense-in-depth gap. | **MEDIUM** |

### 2.2 IDOR root cause

The `assertCanAccessStudent` helper is the single correct entry point — but it's only invoked when the route accepts a `studentId` / `userId` / `[id]` parameter that's obviously a student ID. Routes that accept **derived entity IDs** (`interactionId`, `taskId`, `dailyLogId`, `flagId`, `alertId`, `submissionId`, `eventId`, `groupTaskId`, `batchId`, `toId`, `granteeUserId`) skip the helper and operate on the entity directly. A defense-in-depth fix would be: **any route that mutates or reads user-attributed data must first resolve the entity to its owning userId, then call `assertCanAccessStudent` on that userId.**

---

## 3. Institution Scoping

### 3.1 The null-institutionId bug — CRITICAL

`src/lib/ai-assistant/scope.ts` resolves the caller's institution, then uses `institutionId ?? undefined` to build Prisma `where` clauses:

```ts
// scope.ts:62 (and 7 more sites in this file)
db.user.findMany({
  where: { role: "student", institutionId: institutionId ?? undefined, blocked: false },
  ...
});
```

When `institutionId` is `null` (which is the case for **all legacy users** created before the Institution feature shipped, plus any user created via `/api/users` POST which doesn't propagate `institutionId`), `null ?? undefined` evaluates to `undefined`. **Prisma treats `undefined` as "no filter on this field"** — so the query returns rows from ALL institutions. The `isInstitutionWide: true` branch then sets `scope.studentIds` to the IDs of every student in the entire database, and the AI is fed that data as context.

Same bug pattern in:
- `src/lib/ai-assistant/scope.ts:62, 66, 70, 74, 95, 99, 120, 124` (8 sites)
- `src/lib/ai-assistant/data-efficiency.ts:141, 146` (2 sites)

**Severity: CRITICAL** — A legacy principal/admin from institution A (or any user whose `institutionId` is null) gets AI Assistant responses that reference students from institution B. The scope resolver is described in its own header comment as *"if this function is correct, the assistant cannot leak data across role boundaries"* — and it is not correct for the null case.

**Fix:** Either (a) treat null `institutionId` as `null` (Prisma filter `institutionId: null` matches only null rows — much safer), or (b) reject callers with null `institutionId` outright:

```ts
if (!institutionId) {
  return { studentIds: [], teacherIds: [], courseIds: [], batchIds: [], institutionId: null, isInstitutionWide: false, callerRole, callerId };
}
```

### 3.2 Cross-institution data leaks beyond scope.ts

The same anti-pattern (no institution filter on bulk reads) recurs across the API. None of these routes scope by the caller's `institutionId`:

| # | Route | File:line | What leaks | Severity |
|---|-------|-----------|------------|----------|
| C1 | `/api/counselor/overview` GET | `counselor/overview/route.ts:33-40` | `db.user.findMany({ where: { role: "student", blocked: false } })` — loads **ALL students globally**. A counselor in institution A sees every student, every crisis flag, every alert, every health summary across all institutions. The route comment even claims "Counselors have institution-wide access via AccessGrants" but no grant check is performed. | **CRITICAL** |
| C2 | `/api/admin/cleanup-psych-data` POST | `admin/cleanup-psych-data/route.ts:57` | `db.psychologyObs.deleteMany({})` — **deletes every PsychologyObs row in the entire database**. Any admin from any institution can wipe all behavioral observations globally. Other deletes in the same route (`chatSession`, `interaction`, `psychEvidence`, `confidenceRating`) are also unscoped. | **CRITICAL** |
| C3 | `/api/admin/cleanup` POST | `admin/cleanup/route.ts:34-58` | Deletes all of the calling admin's own data — this is OK. But the route accepts no `targetUserId`, so the admin (who might be a developer previewing) can wipe their own data. By design. **No fix needed.** | OK |
| C4 | `/api/users` GET | `users/route.ts:37-52` | Teachers see all `student`/`pending` users across all institutions. Admins see all users across all institutions. **A teacher in institution A can read the email + name of every student in institution B.** | **HIGH** |
| C5 | `/api/users` GET — role filter bypass | `users/route.ts:42,52` | `{ ...roleScope, ...roleFilterClause }` — `roleFilterClause` (from `?role=`) **overwrites** `roleScope`. A teacher can pass `?role=administrator` and see ALL administrators across all institutions, defeating the "teachers see only students/pending" rule. | **HIGH** |
| C6 | `/api/users/[id]/role` PATCH | `users/[id]/role/route.ts:49-75` | No institution check. A `principal` from institution A can change the role of any user in institution B (including promoting a student to administrator in another institution). | **HIGH** |
| C7 | `/api/users/[id]/block` PUT | `users/[id]/block/route.ts:31-50` | No institution check. A teacher from institution A can block any student in institution B if they have their user ID. | **HIGH** |
| C8 | `/api/stats` GET | `stats/route.ts:52-54` | `db.user.count({ where: { role: "pending" } })` and `db.user.count({ where: { role: "teacher" } })` return global counts across all institutions — leaks total institution count to any teacher. | **HIGH** |
| C9 | `/api/audit-log` GET | `audit-log/route.ts:9-56` | Admins see audit log entries from ALL institutions. No `actor.institutionId` filter. | **HIGH** |
| C10 | `/api/ai/stats` GET | `ai/stats/route.ts:18-187` | Returns global AI usage stats, token counts, error logs, and provider breakdowns across all institutions. An admin from one institution can see another institution's AI spend. | **HIGH** |
| C11 | `/api/ai/debug` GET | `ai/debug/route.ts:19-208` | Returns the last 10 `AIUsageLog` rows globally. Also leaks **API key prefix (first 8 chars) + suffix (last 4 chars)** in the env-vars section (lines 41, 44) — unnecessary information disclosure that could aid key reconstruction. | **CRITICAL** |
| C12 | `/api/access-grants` GET/POST | `access-grants/route.ts:9-89` | GET: admins see all grants globally. POST: no check that `granteeUserId` or `scopeId` belongs to the caller's institution. A principal from institution A can grant institution B's counselor access to institution B's student. | **HIGH** |
| C13 | `/api/admin/teacher-behavior` GET | `admin/teacher-behavior/route.ts:18-115` | Returns ChatSession rows for `chatbotType: "teacher_tutor"` across all institutions — no institution filter. | **HIGH** |
| C14 | `/api/students/check-alerts` POST/GET | `students/check-alerts/route.ts:40-63` | `runAlertCheck` scans ALL students globally (line 40: `where: { role: "student", blocked: false }`), then sends messages to their teachers. A principal from institution A triggering this sends messages to teachers in institution B referencing institution B's students. | **HIGH** |
| C15 | `/api/students/alerts` GET | `students/alerts/route.ts:46-62` | See I7 — cross-institution alert listing. | **HIGH** |
| C16 | `/api/institutions/[id]` PATCH/GET | `institutions/[id]/route.ts:10-61` | Admin-only but NO check that the admin belongs to this institution. An admin from institution A can read or modify institution B's name, contactEmail, and logoUrl. | **HIGH** |
| C17 | `/api/messages` POST | `messages/route.ts:37-112` | See I14 — cross-institution messaging. | **HIGH** |
| C18 | `/api/mentorship/case-review` GET | `mentorship/case-review/route.ts:67-78` | Cross-institution case reviews are by design (peer-review across institutions) but the route returns anonymized data so the leak is partial. Acceptable. | OK |
| C19 | `/api/crisis-flags` POST notifications | `crisis-flags/route.ts:131-147` | When a crisis flag is created, the route notifies ALL `counselor`/`principal`/`administrator` users globally — not just those in the student's institution. A crisis in institution A sends messages to counselors in institution B. | **MEDIUM** |

### 3.3 Schema sync — Prisma

Both `prisma/schema.prisma` (SQLite, 1176 lines) and `prisma/schema.prod.prisma` (Postgres, 987 lines) contain the **same 46 models with the same fields and types**. Field-by-field and index-by-index comparison shows only one cosmetic difference:

```
schema.prisma:  @@unique([groupTaskId, assessorId, assesseeId]) // one assessment per pair per task
schema.prod.prisma: @@unique([groupTaskId, assessorId, assesseeId])
```

**Severity: LOW** — trailing comment only. No structural drift. The prod schema is safe to deploy.

---

## 4. Session / Blocked-Status Enforcement

### 4.1 Verified correct

`src/lib/auth.ts:94-145` — `getAuthUser()`:

- Reads JWT from cookie.
- **Re-checks the `blocked` flag and `role` from the DB on every request**, cached for 60 seconds (authCheckCache).
- If user is blocked → returns `null` (request will 401).
- Uses the DB role (authoritative) over the JWT role (may be up to 7 days stale).
- **DB outage fallback** (lines 124-143): checks the last-known cache entry — if `blocked: true` was ever observed, denies access even during DB outage. If unblocked-or-unknown, allows access (better than locking everyone out during a transient blip). Reasonable trade-off.

`invalidateAuthCache(userId)` is called on:
- `/api/users/[id]/role` PATCH (role change) ✓
- `/api/users/[id]/block` PUT (block/unblock) ✓

### 4.2 Findings

| # | Issue | Severity |
|---|-------|----------|
| S1 | The 60-second cache means a blocked user retains access for up to 60 seconds after being blocked. Acceptable but documented for incident response. | **LOW** |
| S2 | The `authCheckCache` is in-memory (module-level `Map`). On serverless (Vercel), each cold start wipes the cache and each instance has its own cache — so cache hits are rare. The DB lookup runs on most requests anyway. No issue, just performance observation. | **LOW** |
| S3 | `getCurrentUser()` calls `getAuthUser()` then re-fetches the full User row. The blocked re-check therefore happens twice per request that uses `getCurrentUser` (once in `getAuthUser`, once implicitly via the full row fetch — though the second fetch doesn't check `blocked`). The second fetch is `db.user.findUnique` without a `blocked: false` filter, so if the DB role changes between the two fetches (sub-millisecond race), the request might proceed with stale data. Theoretical only. | **LOW** |

---

## 5. Rate Limiting Gaps

### 5.1 AI routes missing `checkUserAILimit` (16 routes — confirmed from inventory §4.2)

All 16 are **HIGH severity** — a single authenticated user (or a script with stolen credentials) can spam these endpoints to incur unbounded AI provider costs.

| # | Route | Feature label | What it does | Severity |
|---|-------|---------------|--------------|----------|
| L1 | `POST /api/assistant/action-dialog` | `action_dialog` | AI generates action-dialog JSON | **HIGH** |
| L2 | `POST /api/courses/generate` (single call) | `course-gen` | 8192-token AI course generation | **HIGH** |
| L3 | `POST /api/courses/generate` (batch path) | `course-gen-batch` | Multiple 8192-token calls for >8-week courses | **HIGH** |
| L4 | `POST /api/daily-test` | `daily-test-start` / `daily-test-reply` | Daily test chat replies | **HIGH** |
| L5 | `GET /api/daily-motivation` | `daily-motivation` | AI motivational sentence (per-day DB cache mitigates but cache miss = AI call) | **HIGH** |
| L6 | `POST /api/mentorship/case-review` | `case-review-anonymize` | AI anonymization pass | **HIGH** |
| L7 | `POST /api/mentorship/touchpoints/parse` | `touchpoint-parse` | AI free-text parsing | **HIGH** |
| L8 | `POST /api/project/reports` | `project-report-analysis` | AI project report evaluation | **HIGH** |
| L9 | `POST /api/project/generate-tasks` (task gen) | `project-task-gen` | AI project task list (~2000 tokens) | **HIGH** |
| L10 | `POST /api/project/generate-tasks` (week plan) | `project-week-gen` | AI week-by-week plan (~2000 tokens) | **HIGH** |
| L11 | `POST /api/project/setup` | `project-summary-gen` | AI project summary generation (also triggered by PATCH) | **HIGH** |
| L12 | `POST /api/students/[id]/generate-project-analysis` | `project-final-analysis` | AI project analysis for report card | **HIGH** |
| L13 | `GET /api/students/final-result` | `final-result` | AI behavioral analysis of student | **HIGH** |
| L14 | `POST /api/ai/test` | `connection-test` | AI provider ping | **HIGH** |
| L15 | `POST /api/ai/evaluate` | `evaluate` | AI evaluation of practice answer | **HIGH** |
| L16 | `POST /api/ai/teacher-tutor` | `teacher-tutor` | Teacher AI tutor chat | **HIGH** |

### 5.2 Routes missing BOTH rate limit AND demo guard (3 routes)

| # | Route | File | Severity |
|---|-------|------|----------|
| L17 | `GET /api/daily-motivation` | `daily-motivation/route.ts:34` | **HIGH** — no `checkUserAILimit`, no `isDemoAIBlocked`, no `isFeatureEnabled("ai_enabled")`. Demo users can hit it even when admin has globally disabled demo AI. Any logged-in user can force an AI call before the daily cache is populated. |
| L18 | `GET /api/students/final-result` | `students/final-result/route.ts:159-192` | **HIGH** — no `checkUserAILimit`, no `isDemoAIBlocked`, no `isFeatureEnabled("ai_enabled")`. IDOR check is correct (`assertCanAccessStudent`), but the AI call is completely unguarded. |
| L19 | `GET /api/ai/debug` | `ai/debug/route.ts:156-163` | **HIGH** — admin-only via `requireRole`, but no `checkUserAILimit`, no `isDemoAIBlocked`, no `isFeatureEnabled`. Also leaks API key prefix/suffix (see C11). |

### 5.3 Routes missing `demoWriteBlock` but should have it

| # | Route | File:line | Issue | Severity |
|---|-------|-----------|-------|----------|
| L20 | `POST /api/assistant/escalation/run` | `assistant/escalation/run/route.ts:13-35` | Allows `demo` role (in the `["principal","administrator","demo","admin"]` list) to trigger the escalation engine — a write action that auto-creates MentorshipTouchpoint + Message rows. Demo is supposed to be read-only. Missing `demoWriteBlock("running escalation")`. | **MEDIUM** |
| L21 | `GET /api/ai/debug` | `ai/debug/route.ts:19` | Not a write action per se, but it makes a real `callAI` call (costs tokens) and leaks env-var info. Should reject demo via `isDemoAIBlocked` at minimum. | **MEDIUM** |
| L22 | `GET /api/daily-motivation` | `daily-motivation/route.ts:18` | GET, not a write — but should at minimum check `isFeatureEnabled("ai_enabled")` and `isDemoAIBlocked` since it triggers an AI call when the cache is cold. | **MEDIUM** |

### 5.4 `userId` not passed to `callAI` — defeats future rate-limit attribution

The `callAI()` helper accepts `options.userId` which is written to `AIUsageLog.userId`. The `checkUserAILimit` counter queries `where: { userId, feature: { in: [...] } }`. **If a route calls `callAI` without passing `userId`, the AIUsageLog row has `userId: null` and is never counted against anyone** — even if `checkUserAILimit` is later added.

Confirmed `userId` NOT passed in:

| Route | File:line | Severity |
|-------|-----------|----------|
| `/api/ai/evaluate` | `ai/evaluate/route.ts:74-76` | **HIGH** |
| `/api/ai/teacher-tutor` | `ai/teacher-tutor/route.ts:124-128` | **HIGH** |
| `/api/ai/test` | `ai/test/route.ts:64-66` | **MEDIUM** |
| `/api/ai/debug` | `ai/debug/route.ts:156-163` | **MEDIUM** |
| `/api/courses/generate` | `courses/generate/route.ts:217-223` and batch path | **HIGH** |
| `/api/daily-test` | `daily-test/route.ts:460` (via `callAILocal`) | **HIGH** |
| `/api/daily-motivation` | `daily-motivation/route.ts:34-62` | **MEDIUM** |
| `/api/mentorship/case-review` | `mentorship/case-review/route.ts:34-36` | **MEDIUM** |
| `/api/mentorship/touchpoints/parse` | `mentorship/touchpoints/parse/route.ts:52-54` | **MEDIUM** |
| `/api/project/setup` | `project/setup/route.ts:26-47` (via `generateProjectSummary`) | **HIGH** |
| `/api/project/generate-tasks` | `project/generate-tasks/route.ts:96-122` and `:233+` | **HIGH** |
| `/api/project/reports` | `project/reports/route.ts:83+` | **HIGH** |
| `/api/students/final-result` | `students/final-result/route.ts:159-192` | **HIGH** |
| `/api/assistant/action-dialog` | `assistant/action-dialog/route.ts:98-105` | **MEDIUM** |

The well-protected routes (`/api/ai/tutor`, `/api/students/[id]/narrative`, etc.) correctly pass `userId: payload.sub` or `userId: user.id`.

---

## 6. Input Validation

### 6.1 Unbounded string inputs

Routes that accept string fields with no length cap, allowing prompt-injection / cost-DoS / storage abuse:

| Route | Field | File:line | Severity |
|-------|-------|-----------|----------|
| `/api/auth/login` PUT (signup) | `name`, `email` | `auth/login/route.ts:123-124` | **MEDIUM** |
| `/api/users` POST | `name`, `email` | `users/route.ts:95-97` | **MEDIUM** |
| `/api/courses/generate` POST | `courseName`, `description`, `targetAudience`, `tools`, `deliverableTypes` | `courses/generate/route.ts:75-103` | **HIGH** (these are concatenated into the AI prompt — prompt injection + cost DoS) |
| `/api/project/setup` POST/PATCH | `projectName`, `projectScope`, `projectObjectives`, `projectRequirements`, `projectBusinessCase`, `projectNotes` | `project/setup/route.ts:86-124` | **HIGH** (also concatenated into AI prompt) |
| `/api/project/reports` POST | `reportText` | `project/reports/route.ts:36-47` | **MEDIUM** (only min-length 20 enforced, no max) |
| `/api/assistant/action-dialog` POST | `flagType`, `trigger`, `context` | `assistant/action-dialog/route.ts:40-45` | **MEDIUM** (concatenated into AI prompt) |
| `/api/journey` POST/PUT | `stepId`, `stepIds[]` | `journey/route.ts:30, 97` | **MEDIUM** (JSON array stored on User.journeyProgress with no size cap) |
| `/api/messages` POST | `body` | `messages/route.ts:43-72` | OK (capped at 10 000 chars) |
| `/api/comments` POST | `body` | `comments/route.ts:62-68` | OK (capped at 10 000 chars) |

### 6.2 Untyped inputs (no validation)

Several routes accept arbitrary JSON and cast via `as Record<string, unknown>` or `as { ... }` without runtime validation. Examples:

- `/api/ai/evaluate` POST — `body as Record<string, unknown>` then `Number(...)`, `String(...)` coercion. Prisma will reject types that don't fit the schema, but the AI prompt is built from these strings before Prisma is involved. MEDIUM.
- `/api/interactions` POST — same pattern. MEDIUM.
- `/api/daily-test` POST — `action` field is `body.action as string | undefined` with no enum check. LOW.

### 6.3 SQL/NoSQL injection

**Not exploitable.** All DB access is through Prisma's parameterized queries. Raw SQL is not used in any audited route. Prisma's `where` clauses use object syntax, not string interpolation.

### 6.4 Email enumeration

`/api/auth/forgot-password` returns a generic message for non-existent emails (good), BUT for existing emails it returns either `flow: "security_question"` (with the question text) or `flow: "admin_request"`. **The response shape itself reveals whether an email exists.** Combined with the security-question flow returning the actual question text, an attacker can enumerate emails and harvest security questions for targeted social engineering.

**Severity: MEDIUM.** Fix: return the same response shape for non-existent vs. existing-without-security-question emails.

---

## 7. CRITICAL Plaintext Password Storage

`/api/password-reset-requests/[id]/approve` POST stores `tempPassword` in **plaintext** in the `PasswordResetRequest.tempPassword` column:

```ts
await db.passwordResetRequest.update({
  where: { id },
  data: {
    status: "resolved",
    tempPassword, // stored so admin can share it with the student
    adminNote,
    resolvedAt: new Date(),
  },
});
```

**Severity: CRITICAL.** The temp password grants account access. Any DB read access (backup leak, SQL injection elsewhere, curious DBA, support engineer with read-only access) exposes plaintext passwords. Even though the password is "temporary", a user who never changes it (which is common) continues to use it indefinitely.

**Fix:**
1. Do NOT store the temp password at all — return it ONCE in the API response, display it to the admin in the UI, and let them communicate it out-of-band.
2. OR: store only a bcrypt hash and re-display the plaintext only at the moment of creation (already in the response). Add an `expiresAt` column that auto-invalidates after 24 hours and force a password change on first login with `mustChangePassword: true` flag on the User.

Additional issues in this route:
- **No institution scoping** — admin from institution A can reset passwords for users in institution B.
- **No check that target user is a student** — admins can reset other admins' passwords (privilege escalation vector if combined with session theft).

---

## 8. Other Findings

### 8.1 CRON_SECRET comparison

`/api/assistant/escalation/run/route.ts:17` uses `authHeader === \`Bearer ${cronSecret}\`` — plain string equality, **timing-attack vulnerable**. Compare with `/api/students/check-alerts/route.ts:271-279` which correctly uses `crypto.timingSafeEqual`. Apply the same pattern to the escalation route.

**Severity: LOW** (the secret is in the Authorization header, not the URL, so it's harder to leak — but timing-safe comparison is the right pattern).

### 8.2 Demo write-block coverage

`demoWriteBlock()` is correctly applied on most write routes. Spot-checked missing cases:
- `POST /api/assistant/escalation/run` — missing (see L20).
- `POST /api/courses/seed-default` — present ✓.
- All `/api/users/*` write routes — present ✓.

### 8.3 Audit log coverage

Audit logging is excellent on user-management routes (role change, block, approve, guardian create/delete, certificate generate, crisis flag, mentorship touchpoint, grade override, access grant). Notable gaps:

- `/api/admin/cleanup-psych-data` POST — destructive global operation, NOT audit-logged.
- `/api/admin/cleanup` POST — destructive, NOT audit-logged.
- `/api/password-reset-requests/[id]/approve` POST — NOT audit-logged (sensitive action — should be).
- `/api/messages` POST — NOT audit-logged (safeguarding alerts are, but the message itself isn't).
- `/api/comments` POST/PATCH/DELETE — NOT audit-logged (safeguarding signals are, but the comment edit itself isn't).

**Severity: MEDIUM** — audit log is the post-incident forensic backbone; these gaps weaken it.

### 8.4 Demo account can preview admin dashboards across institutions

`ADMIN_ROLES` includes `demo` so demo can call `/api/admin/cleanup-psych-data` (C2), `/api/admin/teacher-behavior` (C13), `/api/ai/stats` (C10), `/api/ai/debug` (C11). `demoWriteBlock()` blocks the destructive POST routes, but the GET routes leak institution-scoped data to the demo account. If the demo account credentials ever leak (they're often shared for sales demos), the entire student body is exposed.

**Severity: MEDIUM** — defense in depth. Demo should be scoped to a single demo institution.

---

## 9. Findings Index (sorted by severity)

### CRITICAL (9)

| ID | Title | File |
|----|-------|------|
| C1 | Counselor overview loads ALL students globally | `counselor/overview/route.ts:33` |
| C2 | Admin cleanup-psych-data wipes ALL PsychologyObs globally | `admin/cleanup-psych-data/route.ts:57` |
| C11 | AI debug endpoint leaks API key prefix+suffix + recent global usage | `ai/debug/route.ts:41,44,185` |
| I1 | Confidence-ratings GET has no IDOR check | `confidence-ratings/route.ts:7-22` |
| I2 | Tasks DELETE wipes comments on any task (no userId scoping) | `tasks/route.ts:183` |
| I5 | Crisis-flags PATCH has no IDOR check on flagId | `crisis-flags/route.ts:161-203` |
| §3.1 | Null-institutionId bug in scope.ts (8 sites) + data-efficiency.ts (2 sites) | `ai-assistant/scope.ts:62,66,70,74,95,99,120,124` + `data-efficiency.ts:141,146` |
| §7 | Plaintext temp password stored in PasswordResetRequest | `password-reset-requests/[id]/approve/route.ts:63` |

### HIGH (23)

| ID | Title | File |
|----|-------|------|
| R1 | mentorship/touchpoints/parse admits guardian/pending | `mentorship/touchpoints/parse/route.ts:23` |
| R2 | students/[id]/rehearse admits guardian/pending | `students/[id]/rehearse/route.ts:34` |
| R4 | batches/[id]/teachers GET admits students | `batches/[id]/teachers/route.ts:62` |
| R6 | stats `?as=teacher` bypasses batch filter for admins | `stats/route.ts:18,30` |
| I3 | interactions/[id] PATCH/DELETE no IDOR check | `interactions/[id]/route.ts:12-56` |
| I4 | daily-logs/[id] PATCH/DELETE no IDOR check | `daily-logs/[id]/route.ts:12-54` |
| I6 | students/alerts PATCH no IDOR check on alertId | `students/alerts/route.ts:66-105` |
| I7 | students/alerts GET returns cross-institution alerts | `students/alerts/route.ts:46-62` |
| I8 | group-tasks PATCH/DELETE no batch-access check | `group-tasks/route.ts:97-138` |
| I9 | group-tasks GET no batch-access check | `group-tasks/route.ts:13-43` |
| I10 | group-tasks/submit PATCH no IDOR check on submissionId | `group-tasks/submit/route.ts:89-116` |
| I11 | events POST/DELETE no batch-access or IDOR check | `events/route.ts:38-91` |
| I12 | peer-assessment GET (teacher) no batch scoping | `peer-assessment/route.ts:62-72` |
| I13 | peer-assessment GET (student pending) no batch scoping | `peer-assessment/route.ts:74-96` |
| I14 | messages POST allows cross-institution messaging | `messages/route.ts:37-112` |
| I15 | batches/[id] GET no canAccessBatch check | `batches/[id]/route.ts:154-192` |
| I17 | guardian/create POST/DELETE no IDOR check | `guardian/create/route.ts:30-170` |
| C4 | users GET no institution scoping | `users/route.ts:37-52` |
| C5 | users GET role-filter bypass via `?role=` | `users/route.ts:42,52` |
| C6 | users/[id]/role PATCH no institution check | `users/[id]/role/route.ts:49-75` |
| C7 | users/[id]/block PUT no institution check | `users/[id]/block/route.ts:31-50` |
| C8 | stats GET leaks global pending/teacher counts | `stats/route.ts:52-54` |
| C9 | audit-log GET no institution filter | `audit-log/route.ts:9-56` |
| C10 | ai/stats GET global token usage across institutions | `ai/stats/route.ts:18-187` |
| C12 | access-grants GET/POST no institution check | `access-grants/route.ts:9-89` |
| C13 | admin/teacher-behavior GET no institution filter | `admin/teacher-behavior/route.ts:18-115` |
| C14 | students/check-alerts scans ALL students globally | `students/check-alerts/route.ts:40-63` |
| C16 | institutions/[id] PATCH/GET no institution-membership check | `institutions/[id]/route.ts:10-61` |
| C17 | messages POST cross-institution (dup of I14) | `messages/route.ts:37-112` |
| L1-L16 | 16 AI routes missing `checkUserAILimit` | (see §5.1) |
| L17-L19 | 3 AI routes missing BOTH rate limit AND demo guard | (see §5.2) |

### MEDIUM (17)

| ID | Title |
|----|-------|
| R3 | TAs need AccessGrant for portfolio (inconsistency with scope.ts) |
| R5 | assistant/escalation/run allows demo to trigger write action |
| I18 | comments PATCH/DELETE no re-verification of staff access |
| C19 | crisis-flags POST notifies ALL counselors globally |
| L20 | assistant/escalation/run missing demoWriteBlock |
| L21 | ai/debug missing isDemoAIBlocked |
| L22 | daily-motivation missing isFeatureEnabled + isDemoAIBlocked |
| §6.1 | Unbounded string inputs on signup, users POST, courses/generate, project/setup, project/reports, assistant/action-dialog, journey |
| §6.2 | Untyped inputs on ai/evaluate, interactions POST, daily-test POST |
| §6.4 | Email enumeration via forgot-password response shape |
| §8.3 | Audit-log gaps on admin/cleanup-psych-data, admin/cleanup, password-reset-requests/[id]/approve, messages POST, comments POST/PATCH/DELETE |
| §8.4 | Demo account can preview admin dashboards across institutions |
| L14-L16 (subset) | callAI missing userId on ai/test, ai/debug, daily-motivation, mentorship/case-review, mentorship/touchpoints/parse, assistant/action-dialog |

### LOW (9)

| ID | Title |
|----|-------|
| R7 | daily-motivation admits pending/guardian |
| S1 | 60-second blocked-user cache window |
| S2 | In-memory auth cache wiped on serverless cold start |
| S3 | Theoretical race in getCurrentUser double-fetch |
| §3.3 | Prisma schema prod has one cosmetic trailing-comment difference |
| §8.1 | assistant/escalation/run uses non-timing-safe CRON_SECRET comparison |
| §6.2 | daily-test `action` field has no enum check |

---

## 10. Recommended Next Actions (priority order)

### Immediate (this week)

1. **Fix `scope.ts` null-institutionId bug** — change `institutionId ?? undefined` to either `institutionId` (which becomes `null` filter, much safer) OR reject null institutionId callers outright. Test with `scope.test.ts`.
2. **Add `assertCanAccessStudent` (or equivalent) to every IDOR-flagged route** in §2.1 — especially `confidence-ratings`, `crisis-flags` PATCH, `interactions/[id]`, `daily-logs/[id]`, `students/alerts` PATCH, `group-tasks` PATCH/DELETE, `group-tasks/submit` PATCH, `events` POST/DELETE, `peer-assessment` GET, `batches/[id]` GET, `batches/[id]/teachers` GET, `guardian/create`.
3. **Fix `tasks` DELETE comment scoping** — move `comment.deleteMany` inside the same userId-scoped transaction as `projectTask.delete`, or use a cascading relation in the schema.
4. **Stop storing plaintext temp passwords** — return once in API response, never persist. Force password change on first login.
5. **Add institution scoping** to: `counselor/overview`, `users` GET, `users/[id]/role`, `users/[id]/block`, `stats`, `audit-log`, `ai/stats`, `ai/debug`, `access-grants`, `admin/teacher-behavior`, `students/check-alerts`, `students/alerts` GET, `institutions/[id]`, `messages` POST.
6. **Remove API-key prefix/suffix leak** in `/api/ai/debug` — return only "set" / "not set".
7. **Add `checkUserAILimit` + `isDemoAIBlocked` + `isFeatureEnabled`** to all 16 routes in §5.1 and 3 routes in §5.2. Pass `userId: payload.sub` to every `callAI` call.
8. **Scope `admin/cleanup-psych-data`** to the caller's institution (or remove the global `deleteMany({})` on PsychologyObs entirely and require explicit student IDs).

### Short-term (next 2 weeks)

9. **Fix role checks** — `mentorship/touchpoints/parse` and `students/[id]/rehearse` should use `isStaffRole()` not `role === "student"`.
10. **Fix TA portfolio access** — change `if (payload.role === "teacher")` to `if (payload.role === "teacher" || payload.role === "teaching_assistant")` in `students/[id]/portfolio` and `assertCanAccessStudent`.
11. **Add `demoWriteBlock`** to `/api/assistant/escalation/run`.
12. **Use `crypto.timingSafeEqual`** for CRON_SECRET in `assistant/escalation/run`.
13. **Add email-enumeration mitigation** to `/api/auth/forgot-password` — return identical response shape for non-existent and existing-without-security-question flows.
14. **Add length caps** to all unbounded string inputs (especially AI-prompt-concatenated fields).
15. **Add audit-log coverage** to admin cleanup routes, password-reset-approve, messages POST, and comments POST/PATCH/DELETE.

### Ongoing

16. **Introduce a lint rule** that flags `institutionId ?? undefined` in Prisma `where` clauses.
17. **Introduce a lint rule** that flags `callAI(` calls without `userId:` in the options bag.
18. **Consider a route-level middleware** that auto-injects `assertCanAccessStudent` for any route whose filename contains `[id]` or `[userId]`.
19. **Test coverage**: add integration tests for cross-institution isolation (create two institutions + two users, verify neither can see the other's data).

---

## 11. Code Changes Made

This audit was read-only — no code changes were applied. All findings are documented above with file:line references for the implementation team to act on. The recommended fixes are described in §10 with specific code patterns.

---

*End of Section 2: Security Audit. Section 3 will cover frontend/component audit.*
