# ExaminerAI — Section 2: Security Audit (V2 — Re-Audit)

> **Scope:** Every `route.ts` under `src/app/api/` (123 files, ~190 method handlers), `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/ai-assistant/scope.ts`, `src/lib/ai-assistant/data-efficiency.ts`, `src/lib/ai-rate-limits.ts`, `src/lib/demo-guard.ts`, `src/lib/batch-teachers.ts`, and both Prisma schemas.
> **Audit date:** 2026-07-26 (V2 — re-audit after batches 4-7 fixes)
> **Lenses applied:** senior coder, QA, security-focused SWE.
> **Findings:** 7 CRITICAL, 16 HIGH, 11 MEDIUM, 7 LOW.

---

## Executive Summary

This V2 audit re-verifies the C1/C2/C3/H2/H8 fixes from the prior `AUDIT-SECURITY-2026-07-26.md` and audits every API route again for residual and newly-introduced security issues. The codebase has solid central primitives (`getAuthUser` with 60-second blocked re-check, `assertCanAccessStudent` helper, `demoWriteBlock` / `isDemoAIBlocked` dual guard, `canAccessBatch` for multi-teacher batches, `enforceAIRateLimit` wrapper, `crypto.timingSafeEqual` for the CRON_SECRET on check-alerts).

**The H2 IDOR fixes are CONFIRMED CORRECT** on the 6 routes listed in `AUDIT-FIXES-BATCH5-2026-07-26.md`: `daily-logs/[id]`, `interactions/[id]`, `group-tasks` PATCH/DELETE, `group-tasks/submit` PATCH, `events` DELETE. The C2 institution-scoped delete on `admin/cleanup-psych-data` is also correct. The C1 null-institutionId fix in `scope.ts` is correct — the scope resolver now short-circuits to empty arrays when `institutionId` is null.

**However, V2 uncovers:**

1. **A NEW null-institutionId bug** at `students/check-alerts/route.ts:211` — the H3 fix introduced `institutionId: student.institutionId ?? undefined`, which is the exact anti-pattern the C1 fix eliminated. When a student has null `institutionId`, the counselor-notification query returns ALL counselors globally, and they all get crisis messages about that student.
2. **data-efficiency.ts:170 STILL has the same anti-pattern** — `userId: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined }`. When `scope.studentIds` is empty (which the C1 fix now deliberately produces for null-institutionId admins), this filter becomes "no filter" and leaks ALL student health summaries globally.
3. **CRITICAL IDORs from the original audit are STILL OPEN**: `confidence-ratings` GET (I1), `crisis-flags` PATCH (I5), `students/alerts` PATCH (I6). The P0-10 "18 IDORs fixed" claim was true for the GET/POST methods but the PATCH methods were never patched.
4. **6 of the 9 CRITICAL institution-scoping issues (C1, C4, C9, C10, C12, C13, C14, C16) from the prior audit are STILL NOT FIXED**. Only C2 (admin/cleanup-psych-data) was fixed. The institution boundary is still effectively missing on most read endpoints.
5. **`assertCanAccessStudent` itself has a correctness bug** — it checks the legacy `teacher.batchId` field, NOT the `BatchTeacher` junction. A teacher assigned to batch X via BatchTeacher (the new pattern) but with legacy `batchId=null` falls through to AccessGrant. A teacher with legacy `batchId=Y` cannot access students in batch X even when BatchTeacher says they should. This breaks multi-teacher batches on every route that uses `assertCanAccessStudent`.
6. **Plaintext temp password storage** (§7) — STILL NOT FIXED. The temp password is still persisted in `PasswordResetRequest.tempPassword`.
7. **AI debug endpoint** (C11) — API key prefix/suffix leak is fixed (C9 fix), but the endpoint still leaks the last 10 `AIUsageLog` rows globally across institutions, has no `checkUserAILimit`, no `isDemoAIBlocked`, and doesn't pass `userId` to `callAI`.

The pattern across unfixed findings: defense-in-depth is partially built (the helpers exist) but **not consistently applied**. The H2 batch fixed 6 routes; the other ~15 IDOR-flagged routes weren't touched. The C2 fix scoped one destructive endpoint; the other ~12 institution-scoped read endpoints weren't touched.

---

## 1. Verification of Previously-Applied Fixes

### 1.1 Confirmed CORRECT

| Fix ID | Route / File | Verification |
|--------|--------------|--------------|
| **C1** | `src/lib/ai-assistant/scope.ts` | ✅ Correct. `buildInstitutionFilter()` returns `null` when institutionId is null; every institution-wide role branch short-circuits to empty arrays with a `logger.warn`. The 8 sites that previously used `institutionId ?? undefined` now use `{ ...institutionFilter }` spread, where `institutionFilter` is either `{ institutionId }` or the branch returns early. |
| **C2** | `src/app/api/admin/cleanup-psych-data/route.ts` | ✅ Correct. Loads caller's `institutionId` first, refuses to run if null (`if (!caller?.institutionId) return 403`), then applies `user: { institutionId }` to every `deleteMany` and `count` (both POST and GET dry-run). `demoWriteBlock` present. |
| **C3 / I2** | `src/app/api/tasks/route.ts` DELETE | ✅ Correct. Verifies `task.userId === user.id` BEFORE running `comment.deleteMany({ where: { taskId: id } })`. The comment cascade is now safe because it only runs after ownership is verified. |
| **H2 / I3** | `src/app/api/interactions/[id]/route.ts` PATCH + DELETE | ✅ Correct. `verifyInteractionOwnership` loads the interaction's `userId`, then calls `assertCanAccessStudent(payload, interaction.userId)`. Both methods apply the check before mutating. |
| **H2 / I4** | `src/app/api/daily-logs/[id]/route.ts` PATCH + DELETE | ✅ Correct. Same pattern as I3 — `verifyDailyLogOwnership` calls `assertCanAccessStudent` on the log's `userId`. |
| **H2 / I8** | `src/app/api/group-tasks/route.ts` PATCH + DELETE | ✅ Correct. `verifyGroupTaskOwnership` checks admin bypass, then `task.teacherId === payload.sub`, then `canAccessBatch(payload.sub, payload.role, task.batchId)` for teachers. |
| **H2 / I10** | `src/app/api/group-tasks/submit/route.ts` PATCH (grading) | ✅ Correct. Loads `existingSubmission.userId`, calls `assertCanAccessStudent({ sub, role, ... }, existingSubmission.userId)` before grading. |
| **H2 / I11** | `src/app/api/events/route.ts` DELETE | ✅ Correct. Loads event, checks `event.createdById === payload.sub` OR `canAccessBatch(payload.sub, payload.role, event.batchId)`. |
| **H8** | `src/app/api/users/route.ts` GET | ✅ Correct. Students + guardians now allowed, but restricted to (a) teachers in their batch via BatchTeacher junction + legacy batchId, plus (b) all admins. Search + pagination applied. POST path unchanged (admin/teacher RBAC preserved). |
| **§8.1** | `src/app/api/assistant/escalation/run/route.ts` | ✅ Correct. CRON_SECRET now compared via `crypto.timingSafeEqual` (in `safeEqual` helper) for BOTH the Authorization header and the `?secret=` query param. |
| **H1** (rate limits) | 13 AI routes | ✅ Correct. `enforceAIRateLimit(userId, feature, isDemo?)` wraps `isDemoAIBlocked` + `checkUserAILimit` in one call. Applied on `daily-motivation`, `daily-test`, `assistant/action-dialog`, `courses/generate`, `teacher/topic-guidance`, `mentorship/case-review`, `mentorship/touchpoints/parse`, `students/final-result`, `project/setup` (POST + PATCH), `project/reports`, `students/[id]/generate-project-analysis`, `ai/evaluate`, `ai/teacher-tutor`. |
| **H12** (callAI userId) | 12 routes | ✅ Correct. Same 12 routes now pass `userId: payload.sub` (or `user.id`) to `callAI`. |

### 1.2 Fix attempted but INCOMPLETE

| Fix ID | What was fixed | What's still open |
|--------|----------------|-------------------|
| **H2 / I9** (group-tasks GET) | PATCH/DELETE have ownership check | GET still has no `canAccessBatch` — staff can pass any `batchId` and see all tasks + submission counts |
| **H2 / I10** (group-tasks/submit GET) | PATCH (grading) has IDOR check | GET still unscoped — staff can read all submissions for any `groupTaskId` across institutions |
| **H2 / I11** (events POST + GET) | DELETE has ownership check | POST still unscoped — staff can post events to ANY batch. GET also unscoped — staff can pass any `batchId`. |
| **H2 / I15** (batches/[id]) | PATCH has `canAccessBatch` check | GET still unscoped — any staff can fetch ANY batch's details |
| **H2 / I16 / R4** (batches/[id]/teachers) | POST has `canAccessBatch` check | GET still unscoped — students included, no scoping at all |
| **C11** (ai/debug) | API key prefix/suffix leak removed (now reports only "set" + length) | Still leaks last 10 AIUsageLog rows globally, still no rate limit / demo guard / userId attribution |
| **§8.1** (CRON_SECRET) | Now timing-safe in escalation/run | (Also check: check-alerts already timing-safe — OK) |

---

## 2. New CRITICAL Findings

### N1 — Null-institutionId bug in `students/check-alerts` (NEW, CRITICAL)

**File:** `src/app/api/students/check-alerts/route.ts:211`

```ts
const recipients = await db.user.findMany({
  where: {
    OR: [
      { role: { in: ["teacher"] }, blocked: false, batchId: student.batchId },
      { role: { in: ["administrator", "principal"] }, blocked: false },
      // H3 fix: counselors in the student's institution get notified of
      // gradual decline too (not just crisis flags).
      { role: { in: ["counselor"] }, blocked: false, institutionId: student.institutionId ?? undefined },
    ],
  },
  ...
});
```

**Bug:** When a student has `institutionId = null` (legacy user, or any user created via `POST /api/users` which doesn't propagate institutionId — see N5 below), the expression `student.institutionId ?? undefined` evaluates to `undefined`. **Prisma treats `undefined` as "no filter on this field"**, so the counselor branch returns ALL counselors across ALL institutions.

Combined with the surrounding code that sends each recipient a message about the student, this means: **a single student with null institutionId triggering a struggle-signal alert sends messages to EVERY counselor in the entire database.**

This is the exact anti-pattern the C1 fix in scope.ts was designed to eliminate — but it was reintroduced in the H3 fix in batch 4.

**Severity: CRITICAL** — cross-institution data leak (student names + emails + struggle reasons sent to wrong recipients).

**Fix:** Replace `institutionId: student.institutionId ?? undefined` with one of:
- `institutionId: student.institutionId ?? null` (Prisma `null` filter matches only null rows — much safer)
- OR omit the counselor branch entirely when `student.institutionId` is null
- OR add a lint rule that flags `?? undefined` in Prisma where clauses (see Recommendation #16 in original audit)

### N2 — Null-institutionId bug in `data-efficiency.ts:170` (CRITICAL, was missed in prior audit)

**File:** `src/lib/ai-assistant/data-efficiency.ts:170`

```ts
db.studentHealthSummary.findMany({
  where: { userId: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined } },
  select: { moodScore: true, engagementScore: true, frustrationCount: true, avoidanceCount: true, enthusiasmCount: true },
}),
```

**Bug:** Same anti-pattern. The C1 fix in scope.ts makes the resolver return `scope.studentIds = []` when institutionId is null. Then this line evaluates `length > 0 ? [] : undefined` → `undefined` → "no filter" → returns ALL `StudentHealthSummary` rows globally.

The surrounding queries on lines 159 and 164 use the safer `["nonexistent-id"]` fallback:
```ts
where: { userId: { in: scope.studentIds.length > 0 ? scope.studentIds : ["nonexistent-id"] } },
```

But line 170 (StudentHealthSummary) was missed — it falls back to `undefined` instead of the sentinel. This is a copy-paste inconsistency that creates a CRITICAL leak.

**Severity: CRITICAL** — All mood/engagement/frustration/avoidance scores across ALL institutions leak into the AI Assistant's aggregate summary context.

**Fix:** Change `: undefined` to `: ["nonexistent-id-to-force-zero-count"]` on line 170 to match lines 159 and 164. Or better: extract a helper `function scopeStudentFilter(scope) { return scope.studentIds.length > 0 ? { id: { in: scope.studentIds }, blocked: false } : { id: "nonexistent-id", blocked: false }; }` and use it for all 5 parallel queries.

### N3 — `assertCanAccessStudent` uses legacy `batchId`, NOT BatchTeacher junction (NEW, CRITICAL)

**File:** `src/lib/auth.ts:237-261`

```ts
// Teachers/TAs — check batch membership
if (payload.role === "teacher" ) {
  const teacher = await db.user.findUnique({
    where: { id: payload.sub },
    select: { batchId: true },    // ← LEGACY field, not BatchTeacher junction
  });
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { batchId: true, role: true },
  });
  ...
  if (!teacher?.batchId) {
    // Legacy teacher with no batch — fall through to AccessGrant check
  } else if (student.batchId === teacher.batchId) {
    return true;
  } else {
    throw { status: 403, message: "You can only access students in your batch" };
  }
}
```

**Bug:** This is the single most-used IDOR helper in the codebase (28 routes call it). For teachers, it ONLY checks the legacy `User.batchId` field. It does NOT call `canAccessBatch` (which checks the BatchTeacher junction).

**Two failure modes:**

1. **Multi-teacher batches broken for teachers:** A teacher assigned to batch X via `BatchTeacher` (the new pattern documented in `batch-teachers.ts`) but with legacy `batchId = null` falls through to the AccessGrant branch. They cannot access any student without an explicit AccessGrant — even students in their own BatchTeacher batches. This is a **functional regression** for multi-teacher batches.

2. **Wrong-batch access for legacy teachers:** A teacher with legacy `batchId = Y` who is ALSO in BatchTeacher for batch X can ONLY access students in batch Y, not batch X. Their BatchTeacher membership is silently ignored.

The portfolio route (`students/[id]/portfolio`) has the correct pattern — it uses `getTeacherBatchIds` (which checks BatchTeacher) at line 55. But `assertCanAccessStudent` doesn't, so all 28 routes that use `assertCanAccessStudent` get the wrong answer for multi-teacher batches.

Also note: `if (payload.role === "teacher")` — same anti-pattern as R3. **`teaching_assistant` falls through to the AccessGrant branch**, contradicting `scope.ts` which treats teacher + TA identically.

**Severity: CRITICAL** — multi-teacher batches are silently broken on every student-data route that uses `assertCanAccessStudent` (28 routes). Combined with R3, TAs are functionally locked out of student data unless explicitly granted.

**Fix:**
```ts
// Teachers AND teaching_assistants — check BatchTeacher junction
if (payload.role === "teacher" || payload.role === "teaching_assistant") {
  const { canAccessBatch } = await import("@/lib/batch-teachers");
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { batchId: true, role: true },
  });
  if (!student || student.role !== "student") {
    throw { status: 404, message: "Student not found" };
  }
  if (!student.batchId) {
    throw { status: 403, message: "Student has no batch assignment" };
  }
  const canAccess = await canAccessBatch(payload.sub, payload.role, student.batchId);
  if (canAccess) return true;
  // Fall through to AccessGrant check for legacy teachers / TAs with explicit grants
}
```

This also fixes R3 (TA consistency) for free.

---

## 3. IDOR Findings (Still Open from Prior Audit)

### 3.1 CRITICAL — `confidence-ratings` GET (I1, NOT FIXED)

**File:** `src/app/api/confidence-ratings/route.ts:7-22`

```ts
const requestedUserId = req.nextUrl.searchParams.get("userId");
const isStaff = ["teacher", ...].includes(user.role);
const userId = isStaff ? (requestedUserId || user.id) : user.id;

const ratings = await db.confidenceRating.findMany({
  where: { userId },
  ...
});
```

**Bug:** The only check is `isStaff` boolean — no `assertCanAccessStudent`. A staff user can pass `?userId=X` and read ANY student's confidence ratings across any institution. Textbook IDOR.

The P0-10 fix claim in `COMPREHENSIVE-AUDIT-2026-07-26.md` ("Added assertCanAccessStudent to all 18 endpoints") does not match the actual code — this endpoint never had the helper added.

**Severity: CRITICAL** — Confidence ratings contain calibration data (predicted vs actual scores) that's used for psych analysis. Cross-institution leak.

**Fix:** Add `assertCanAccessStudent` after the `isStaff` check.

### 3.2 CRITICAL — `crisis-flags` PATCH (I5, NOT FIXED)

**File:** `src/app/api/crisis-flags/route.ts:161-203`

```ts
export async function PATCH(req: NextRequest) {
  const auth = await requireRole([UserRole.TEACHER, UserRole.COUNSELOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  ...
  const { flagId, status } = body as { flagId?: string; status?: string };
  ...
  const flag = await db.crisisFlag.update({
    where: { id: flagId },
    data: { status, resolvedAt: status === "resolved" ? new Date() : null },
  });
  ...
}
```

**Bug:** Accepts `flagId` and updates status with NO check that the staff member has access to the student this flag belongs to. A teacher can resolve a crisis flag for a student in another institution (or for one outside their batch). For sensitive safeguarding data this is a serious concern — a malicious teacher could silently resolve a flag about a student they don't teach, hiding it from the actual responsible counselor/principal.

Note that the GET and POST methods on the same route correctly call `assertCanAccessStudent` (P0-10 fixed those). The PATCH method was missed.

**Severity: CRITICAL** — safeguarding data integrity + cross-institution unauthorized writes.

**Fix:** Resolve the flag to its `userId` first, then call `assertCanAccessStudent(auth.ctx.payload, flag.userId)` before the update.

### 3.3 HIGH — `students/alerts` PATCH (I6, NOT FIXED)

**File:** `src/app/api/students/alerts/route.ts:66-105`

```ts
export async function PATCH(req: NextRequest) {
  ...
  const { alertId, status, resolutionNote } = body as { ... };
  ...
  const alert = await db.studentAlert.update({
    where: { id: alertId },
    data: { status, resolvedAt, resolvedBy: payload.sub, resolutionNote },
  });
  ...
}
```

**Bug:** Accepts `alertId` and resolves/acknowledges it with NO IDOR check. Any staff can resolve ANY alert — including safeguarding alerts that should be principal-only. The `isPrincipal` filter is only applied on GET (line 49), not PATCH.

The GET-with-userId branch correctly calls `assertCanAccessStudent` (line 23). But the PATCH doesn't resolve the alert to its `userId` first.

**Severity: HIGH** — alert integrity + safeguarding visibility bypass.

**Fix:** Load the alert first (`db.studentAlert.findUnique`), call `assertCanAccessStudent(payload, alert.userId)`, then update.

### 3.4 HIGH — `students/alerts` GET (no userId) (I7, NOT FIXED)

**File:** `src/app/api/students/alerts/route.ts:46-62`

```ts
// Get all open alerts across all students (for teacher dashboard)
const alertWhere: any = { status: "open" };
if (!isPrincipal) {
  alertWhere.type = { not: "safeguarding" };
}
const alerts = await db.studentAlert.findMany({
  where: alertWhere,
  orderBy: { createdAt: "desc" },
  take: 50,
  include: { user: { select: { id: true, name: true, email: true, batchId: true } } },
});
```

**Bug:** When no `userId` is provided, returns ALL open alerts across ALL students in ALL institutions. No batch or institution filter. The `safeguarding` filter is principal-only on GET, but doesn't help cross-batch / cross-institution.

**Severity: HIGH** — any staff can read alert reasons + student names + emails across all institutions.

**Fix:** Apply `getBatchFilter` or institution filter to the `user` relation: `user: { ...batchFilter, ...institutionFilter }`.

### 3.5 HIGH — `group-tasks` GET (I9, NOT FIXED)

**File:** `src/app/api/group-tasks/route.ts:13-43`

```ts
const batchId = req.nextUrl.searchParams.get("batchId");
let targetBatchId = batchId;
if (user.role === "student" || user.role === "pending") {
  targetBatchId = user.batchId;
  ...
} else {
  // Staff: use the batchId param, or their own batch if not provided
  if (!targetBatchId && user.batchId) targetBatchId = user.batchId;
  ...
}
const tasks = await db.groupTask.findMany({
  where: { batchId: targetBatchId },
  ...
});
```

**Bug:** Staff can pass any `batchId` and see all tasks + submission counts for ANY batch across institutions. No `canAccessBatch` check on the staff branch. (The POST and PATCH and DELETE methods were fixed in batch 5; the GET was not.)

**Severity: HIGH** — cross-batch / cross-institution group-task metadata leak.

**Fix:** After resolving `targetBatchId`, if the user is non-admin, call `canAccessBatch(payload.sub, payload.role, targetBatchId)` and 403 if false.

### 3.6 HIGH — `group-tasks/submit` GET (I10 partial, NOT FIXED)

**File:** `src/app/api/group-tasks/submit/route.ts:66-83`

```ts
const groupTaskId = req.nextUrl.searchParams.get("groupTaskId");
const isStaff = ["teacher", ...].includes(user.role);
const submissions = await db.groupTaskSubmission.findMany({
  where: { groupTaskId, ...(isStaff ? {} : { userId: user.id }) },
  include: isStaff ? { user: { select: { id: true, name: true, email: true } } } : undefined,
  ...
});
```

**Bug:** Staff can pass any `groupTaskId` and see all submissions (with student names + emails) for that group task across institutions. No `canAccessBatch` check on the group task's batch. (The PATCH grading method was fixed in batch 5; the GET was not.)

**Severity: HIGH** — cross-institution submission content + student PII leak.

**Fix:** Load the group task to get its `batchId`, then `canAccessBatch` check before returning submissions.

### 3.7 HIGH — `events` POST + GET (I11 partial, NOT FIXED)

**File:** `src/app/api/events/route.ts:38-91` (POST), `:12-32` (GET)

POST:
```ts
const event = await db.event.create({
  data: {
    ...
    batchId: batchId || auth.ctx.user?.batchId || null,
    ...
  },
});
```

GET:
```ts
let where: { batchId?: string } = {};
if (user.role === "student" || user.role === "pending") {
  where.batchId = user.batchId ?? "none";
} else if (batchId) {
  where.batchId = batchId;
}
```

**Bug:** POST — staff can post events to ANY batch by passing `batchId`. No `canAccessBatch` check. The DELETE method was fixed in batch 5; POST was not.

GET — staff can pass any `batchId` and see all events for that batch across institutions. No `canAccessBatch` check.

**Severity: HIGH** — cross-batch write (POST) + cross-batch read (GET).

**Fix:** For POST, after parsing `batchId`, if non-admin, call `canAccessBatch` and 403 if false. For GET, same — verify access to the requested batch before returning events.

### 3.8 HIGH — `peer-assessment` GET (teacher) (I12, NOT FIXED)

**File:** `src/app/api/peer-assessment/route.ts:62-72`

```ts
const isStaff = ["teacher", ...].includes(user.role);
if (isStaff && groupTaskId) {
  const assessments = await db.peerAssessment.findMany({
    where: { groupTaskId },
    include: { assessor: { select: { id: true, name: true } }, assessee: { select: { id: true, name: true } } },
    ...
  });
  return NextResponse.json({ assessments });
}
```

**Bug:** Staff can pass any `groupTaskId` and see all peer assessments (with assessor + assessee names) for that group task across institutions. No batch scoping.

**Severity: HIGH** — cross-institution peer-feedback content + student PII leak.

**Fix:** Load the group task to get its `batchId`, then `canAccessBatch` check.

### 3.9 HIGH — `peer-assessment` GET (student pending) (I13, NOT FIXED)

**File:** `src/app/api/peer-assessment/route.ts:74-96`

```ts
const submissions = await db.groupTaskSubmission.findMany({
  where: { groupTaskId },
  include: { user: { select: { id: true, name: true } } },
});
```

**Bug:** A student can pass ANY `groupTaskId` and see the list of all students who submitted it (names + user IDs) — even students in other institutions. There's no check that the calling student is in the batch this group task belongs to.

The POST method correctly requires the student to have a submission on the task (which transitively validates batch ownership), but the GET does not.

**Severity: HIGH** — cross-institution student directory leak to any student.

**Fix:** Load the group task to get its `batchId`, then verify the student's `batchId` matches.

### 3.10 HIGH — `messages` POST (I14 / C17, NOT FIXED)

**File:** `src/app/api/messages/route.ts:37-112`

```ts
const recipient = await db.user.findUnique({
  where: { id: toId },
  select: { id: true, blocked: true },
});
...
const msg = await db.message.create({
  data: { fromId: user.id, toId, subject: subject ?? null, body: text.trim() },
  ...
});
```

**Bug:** No `toId` scoping whatsoever. A user from institution A can send a message to ANY user in institution B (including admins, principals, other students). Combined with `messages/[id]` DELETE allowing admins to moderate ANY message, this is a cross-institution messaging + moderation vector.

The H8 fix added students + guardians to `/api/users` GET specifically to make Messages compose work for them — but didn't add the corresponding `toId` scoping on the POST.

**Severity: HIGH** — cross-institution spam / phishing / social-engineering vector.

**Fix:** After loading the recipient, verify the sender has a legitimate relationship with them:
- If sender is student: recipient must be a teacher in their batch OR an admin
- If sender is guardian: recipient must be a teacher of their linked student OR an admin
- If sender is staff: recipient must be in the same institution OR be an admin

Use the same logic as the H8 fix's recipient-lookup `where` clause, inverted.

### 3.11 HIGH — `batches/[id]` GET (I15, NOT FIXED)

**File:** `src/app/api/batches/[id]/route.ts:154-192`

```ts
export async function GET(...) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const batch = await db.batch.findUnique({ where: { id }, include: { ... } });
  ...
}
```

**Bug:** `isStaffRole` only — no `canAccessBatch` check. Any staff can fetch ANY batch's details (name, dates, course, user count) across institutions. The PATCH method on the same file was fixed in batch 5 (`H9-rel`); the GET was not.

**Severity: HIGH** — cross-institution batch metadata leak.

**Fix:** After loading the batch, if non-admin, call `canAccessBatch(payload.sub, payload.role, id)` and 403 if false.

### 3.12 HIGH — `batches/[id]/teachers` GET (R4 / I16, NOT FIXED)

**File:** `src/app/api/batches/[id]/teachers/route.ts:58-83`

```ts
export async function GET(...) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ← No role check, no canAccessBatch check
  const { id: batchId } = await params;
  const teachers = await db.batchTeacher.findMany({
    where: { batchId },
    include: { teacher: { select: { id: true, name: true, email: true, role: true } } },
    ...
  });
  ...
}
```

**Bug:** Only `getAuthUser()` — **students can list teachers for ANY batch** in any institution. No `isStaffRole` check, no `canAccessBatch` check. The POST method on the same file was fixed; the GET was not.

**Severity: HIGH** — cross-institution teacher directory leak to any authenticated user (including students).

**Fix:** Add `isStaffRole` check + `canAccessBatch` check before the query.

### 3.13 HIGH — `guardian/create` POST + DELETE (I17, NOT FIXED)

**File:** `src/app/api/guardian/create/route.ts:30-170`

POST:
```ts
const student = await db.user.findUnique({
  where: { id: studentId },
  select: { id: true, name: true, role: true, institutionId: true },
});
if (!student) return 404;
if (student.role !== "student") return 400;
// ← No assertCanAccessStudent
const guardian = await db.user.create({ data: { ... institutionId: student.institutionId } });
```

DELETE:
```ts
await db.guardianLink.deleteMany({ where: { guardianId } }).catch(() => {});
await db.user.delete({ where: { id: guardianId } }).catch(() => {});
```

**Bug:** POST — staff can create a guardian account for ANY student across institutions. The route validates the studentId exists and is a student, but DOESN'T call `assertCanAccessStudent`. A teacher from institution A can create a guardian account for a student in institution B (and the guardian inherits the student's `institutionId`).

DELETE — removes any guardian account from any institution. No scoping check at all.

**Severity: HIGH** — cross-institution guardian account creation (privilege escalation vector if combined with messaging).

**Fix:** POST — add `assertCanAccessStudent(payload, studentId)` after the role check. DELETE — load the guardianLink to get the `studentId`, then `assertCanAccessStudent(payload, studentId)`.

### 3.14 MEDIUM — `comments` PATCH + DELETE (I18, NOT FIXED)

**File:** `src/app/api/comments/route.ts:143-192`

```ts
const existing = await db.comment.findUnique({ where: { id } });
if (existing.teacherId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
  return 403;
}
```

**Bug:** Ownership check (`teacherId === payload.sub`) is good, but no re-verification that the staff member still has access to that student. A teacher moved out of a batch can still edit/delete their old comments on students they no longer teach. Defense-in-depth gap.

**Severity: MEDIUM** — post-reassignment data tampering.

**Fix:** After the ownership check, also call `assertCanAccessStudent(payload, existing.studentId)`.

---

## 4. Institution Scoping Findings (Mostly Still Open)

### 4.1 CRITICAL — `counselor/overview` loads ALL students globally (C1, NOT FIXED)

**File:** `src/app/api/counselor/overview/route.ts:33-40`

```ts
const students = await db.user.findMany({
  where: { role: "student", blocked: false },
  select: { id: true, name: true, email: true, currentWeek: true, batchId: true, lastLogin: true },
  orderBy: { name: "asc" },
});
```

**Bug:** Loads ALL students globally. The route comment claims "Counselors have institution-wide access via AccessGrants" but no grant check is performed AND no institution filter is applied. All parallel queries (wellbeingState, crisisFlag, studentAlert, etc.) then use `userId: { in: studentIds }` where `studentIds` includes every student in the entire database.

A counselor in institution A sees every student, every crisis flag, every alert, every health summary across all institutions.

**Severity: CRITICAL** — full cross-institution data leak to any counselor.

**Fix:** Load the caller's `institutionId` first; refuse if null. Then filter: `where: { role: "student", blocked: false, institutionId }`. Optionally also check AccessGrant for counselors with restricted scope.

### 4.2 HIGH — `users` GET no institution scoping (C4, NOT FIXED)

**File:** `src/app/api/users/route.ts:124-159` (the staff branch — the H8 student/guardian branch is correctly scoped)

```ts
const roleScope = (payload.role === "teacher" || payload.role === "course_coordinator" || payload.role === "counselor")
  ? { role: { in: ["student", "pending"] } }
  : {};
...
const where = { ...roleScope, ...roleFilterClause, ...searchClause };
```

**Bug:** No `institutionId` filter. Teachers see all `student`/`pending` users across all institutions. Admins see all users across all institutions. The H8 fix correctly scoped students + guardians (the new branch), but the existing staff branch was untouched.

**Severity: HIGH** — a teacher in institution A can read the email + name of every student in institution B.

**Fix:** Add `institutionId: callerInstitutionId` to the where clause (after loading the caller's institutionId and refusing if null, per the C2 pattern).

### 4.3 HIGH — `users` GET role-filter bypass via `?role=` (C5, NOT FIXED)

**File:** `src/app/api/users/route.ts:143`

```ts
const where = { ...roleScope, ...roleFilterClause, ...searchClause };
```

**Bug:** `roleFilterClause` (from `?role=`) **overwrites** `roleScope`. A teacher can pass `?role=administrator` and the where clause becomes `{ role: "administrator", ...searchClause }` — bypassing the "teachers see only students/pending" rule entirely. Combined with C4 (no institution filter), this lets a teacher see ALL administrators across ALL institutions.

**Severity: HIGH** — RBAC bypass via query parameter.

**Fix:** Either (a) reject `?role=` values outside the caller's allowed scope (teachers can only filter to `student`/`pending`), or (b) intersect: `{ role: { in: [...allowedRoles] }, ...roleFilterClause }` — but only if `roleFilterClause.role` is in `allowedRoles`.

### 4.4 HIGH — `users/[id]/role` PATCH no institution check (C6, NOT FIXED)

**File:** `src/app/api/users/[id]/role/route.ts:49-75`

**Bug:** No institution check. A `principal` from institution A can change the role of any user in institution B (including promoting a student to administrator in another institution). The elevation matrix is correct (admin can assign any role, principal can't assign demo), but it doesn't enforce that the target is in the caller's institution.

**Severity: HIGH** — cross-institution privilege escalation.

**Fix:** After loading `before`, check `before.institutionId === caller.institutionId` (or admin bypass). Add `select: { role: true, name: true, email: true, institutionId: true }` to the `findUnique`.

### 4.5 HIGH — `users/[id]/block` PUT no institution check (C7, NOT FIXED)

**File:** `src/app/api/users/[id]/block/route.ts:31-50`

**Bug:** Same as C6 — no institution check. A teacher from institution A can block any student in institution B if they have their user ID. The "teachers can only block student/pending" rule is enforced, but cross-institution isn't.

**Severity: HIGH** — cross-institution denial-of-service on student accounts.

**Fix:** Load target's `institutionId` and compare to caller's. Reject if mismatch (unless caller is admin).

### 4.6 HIGH — `users/[id]` DELETE no institution check (NEW, similar to C6/C7)

**File:** `src/app/api/users/[id]/route.ts:29-66`

**Bug:** Same as C6/C7 — admin-only, but no institution check. An admin from institution A can delete users in institution B (cascading delete of all their data — comments, messages, interactions, etc.).

**Severity: HIGH** — cross-institution destructive action.

**Fix:** Load target's `institutionId` and compare to caller's. Reject if mismatch.

### 4.7 HIGH — `users/[id]/batch` PATCH no institution check (NEW, similar to C6/C7)

**File:** `src/app/api/users/[id]/batch/route.ts:13-68`

**Bug:** Admin/principal-only, but no institution check on either the target user OR the batch. A principal from institution A can assign a student from institution B to any batch (including institution B's batches), effectively moving students between institutions' batches.

**Severity: HIGH** — cross-institution student reassignment.

**Fix:** Verify both target user and target batch are in the caller's institution.

### 4.8 HIGH — `stats` GET leaks global pending/teacher counts (C8, NOT FIXED)

**File:** `src/app/api/stats/route.ts:79-80`

```ts
db.user.count({ where: { role: "pending" } }),
db.user.count({ where: { role: "teacher" } }),
```

**Bug:** Returns global counts across all institutions. A teacher sees total pending + total teacher counts across the entire database, leaking the scale of other institutions.

**Severity: HIGH** — institution-size leak to any teacher.

**Fix:** Add `institutionId` filter (after loading caller's institutionId).

### 4.9 HIGH — `stats` ?as=teacher bypasses batch filter for admins (R6, NOT FIXED)

**File:** `src/app/api/stats/route.ts:40-51`

```ts
let batchFilter = await getBatchFilter(payload.sub, payload.role);
// M1 fix: if a specific batchId was requested, narrow the filter to just that batch
if (requestedBatchId) { ... }
```

**Bug:** For an admin doing `?as=teacher`, `getBatchFilter(admin.sub, "admin")` returns `{}` (no filter) because `getTeacherBatchIds` returns null for admin roles. So an admin impersonating a teacher sees ALL students in ALL institutions in the dashboard — even though the route is meant to preview what a teacher sees.

The M1 fix added optional `batchId` support, but if admin doesn't pass one, the impersonation still bypasses all scoping.

**Severity: HIGH** — admin impersonation defeats the entire institution boundary.

**Fix:** When `asRole === "teacher"` and the caller is admin, pick a representative batch (e.g. the first batch in their institution) and apply that filter. Don't allow `{}` for admin impersonation.

### 4.10 HIGH — `audit-log` GET no institution filter (C9, NOT FIXED)

**File:** `src/app/api/audit-log/route.ts:9-56`

**Bug:** Admins see audit log entries from ALL institutions. No `actor.institutionId` filter. The non-admin branch correctly filters to `actorUserId: ctx.payload.sub`, but the admin branch (when `requestedActorId` is provided) returns any actor's entries regardless of institution.

**Severity: HIGH** — cross-institution audit trail leak.

**Fix:** Add `actor: { institutionId: callerInstitutionId }` to the where clause for admins.

### 4.11 HIGH — `ai/stats` GET global token usage across institutions (C10, NOT FIXED)

**File:** `src/app/api/ai/stats/route.ts:18-187`

**Bug:** Returns global AI usage stats — `aIUsageLog.findMany({ take: 5000 })`, `aIUsageLog.findMany({ where: { createdAt: { gte: since } } })`, etc. — with no `userId.in: [institutionStudentIds]` filter. An admin from one institution can see another institution's AI spend, error logs, and feature breakdowns.

**Severity: HIGH** — cross-institution AI spend + error leak.

**Fix:** Filter `aIUsageLog.userId` to users in the caller's institution. Use the same pattern as the C2 fix: load caller's institutionId first, refuse if null, then apply.

### 4.12 HIGH — `access-grants` GET/POST no institution check (C12, NOT FIXED)

**File:** `src/app/api/access-grants/route.ts:9-89`

GET — admins see all grants globally. No `grantee.institutionId` filter.

POST — no check that `granteeUserId` or `scopeId` belongs to the caller's institution. A principal from institution A can grant institution B's counselor access to institution B's student. The grantee's role is validated (`GRANTABLE_ROLES`), but their institution isn't.

**Severity: HIGH** — cross-institution grant manipulation.

**Fix:** Load grantee's `institutionId`; compare to caller's; reject if mismatch. For scopeId, verify the scope entity (batch/student/course) belongs to the caller's institution.

### 4.13 HIGH — `admin/teacher-behavior` GET no institution filter (C13, NOT FIXED)

**File:** `src/app/api/admin/teacher-behavior/route.ts:18-115`

```ts
const sessions = await db.chatSession.findMany({
  where: { chatbotType: "teacher_tutor" },
  ...
  include: { user: { select: { id: true, name: true, email: true, role: true, batchId: true } } },
});
```

**Bug:** Returns ChatSession rows for `chatbotType: "teacher_tutor"` across ALL institutions — no `user.institutionId` filter. An admin from one institution sees another institution's teachers' AI Assistant conversation previews (first 2 + last 2 messages) + behavioral signals + psych analysis.

**Severity: HIGH** — cross-institution pastoral / behavioral data leak.

**Fix:** Add `user: { institutionId: callerInstitutionId }` to the where clause.

### 4.14 HIGH — `students/check-alerts` scans ALL students globally (C14, NOT FIXED)

**File:** `src/app/api/students/check-alerts/route.ts:40-68`

```ts
const students = await db.user.findMany({
  where: { role: "student", blocked: false },
  include: { batch: ..., dailyLogs: ..., weeklyTests: ..., psychObs: ..., messagesSent: ..., _count: ... },
});
```

**Bug:** `runAlertCheck` scans ALL students globally with no institution filter. When triggered by an admin from institution A (or the cron), it sends messages to teachers/counselors across ALL institutions referencing students from ALL institutions.

**Severity: HIGH** — cross-institution alert spam + student PII leak to wrong recipients.

**Fix:** Pass the caller's `institutionId` into `runAlertCheck` and apply it to the student query. (For the cron path, use the system admin's institutionId or skip institution-scoped alerts and only fire global ones.)

### 4.15 HIGH — `institutions/[id]` PATCH/GET no institution-membership check (C16, NOT FIXED)

**File:** `src/app/api/institutions/[id]/route.ts:10-61`

**Bug:** Admin-only but NO check that the admin belongs to this institution. An admin from institution A can read or modify institution B's name, contactEmail, and logoUrl.

**Severity: HIGH** — cross-institution institution-metadata tampering.

**Fix:** After loading the caller's institutionId, compare to `id`. Reject if mismatch (unless caller is platform-level admin, if such a role exists).

### 4.16 HIGH — `courses` GET + POST no institution filter / wrong role scope (NEW, NOT FIXED)

**File:** `src/app/api/courses/route.ts:83-127` (GET), `:145-276` (POST)

GET — `isStaffRole` check only, no institution filter. A teacher from institution A can see ALL courses across ALL institutions.

POST — `isStaffRole` check only. Any staff role (counselor, TA) can create courses. Should be admin/teacher only (per prior audit §1.2 RBAC gaps).

**Severity: HIGH** — cross-institution course catalog leak + RBAC gap on create.

**Fix:** GET — add `institutionId` filter. POST — restrict to `[TEACHER, PRINCIPAL, ADMINISTRATOR]` (not `isStaffRole`).

### 4.17 MEDIUM — `crisis-flags` POST notifications go to ALL counselors globally (C19, NOT FIXED)

**File:** `src/app/api/crisis-flags/route.ts:131-147`

```ts
const notifyRoles = ["counselor", "principal", "administrator"];
const recipients = await db.user.findMany({
  where: { role: { in: notifyRoles }, blocked: false },
  select: { id: true },
});
```

**Bug:** When a crisis flag is created, the route notifies ALL `counselor`/`principal`/`administrator` users globally — not just those in the student's institution. A crisis in institution A sends messages to counselors in institution B. Combined with N1 above (the same anti-pattern in check-alerts), this is amplified.

**Severity: MEDIUM** — cross-institution crisis notification leak (crisis context is sensitive).

**Fix:** Add `institutionId: student.institutionId ?? null` to the recipient query. (Use `null` not `undefined`.)

---

## 5. Plaintext Password Storage (§7, NOT FIXED)

**File:** `src/app/api/password-reset-requests/[id]/approve/route.ts:59-67`

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

**Bug:** The temp password grants account access. It's stored in PLAINTEXT in the `PasswordResetRequest.tempPassword` column. Any DB read access (backup leak, SQL injection elsewhere, curious DBA, support engineer with read-only access) exposes plaintext passwords. Even though the password is "temporary", a user who never changes it (which is common) continues to use it indefinitely.

Additional issues in this route (still open from prior audit):
- **No institution scoping** — admin from institution A can reset passwords for users in institution B.
- **No check that target user is a student** — admins can reset other admins' passwords (privilege escalation vector if combined with session theft).

**Severity: CRITICAL** — plaintext credentials at rest.

**Fix:** Stop persisting `tempPassword` entirely. Return it ONCE in the API response (already done at line 77-79), display it to the admin in the UI, and let them communicate it out-of-band. Add an `expiresAt` column that auto-invalidates after 24h, plus a `mustChangePassword: true` flag on the User that forces a password change on first login.

---

## 6. AI Endpoint Gaps (Residual from Prior Audit)

### 6.1 MEDIUM — `ai/debug` still missing rate limit + demo guard + userId attribution

**File:** `src/app/api/ai/debug/route.ts:19-208`

- L19 (no `checkUserAILimit`) — STILL NOT FIXED
- L21 (no `isDemoAIBlocked`) — STILL NOT FIXED
- L21 (callAI without `userId:`) — STILL NOT FIXED (line 158-165: `callAI([...], { temperature: 0, maxTokens: 30, feature: "debug-ping" })` — no `userId` option)

The C9 fix removed the API key prefix/suffix leak. But the endpoint still:
- Makes a real `callAI` call (costs tokens) with no per-user attribution
- Returns the last 10 `AIUsageLog` rows globally across institutions (line 187-196)
- Is reachable by demo (which is in the `requireRole` list at line 20-22)

**Severity: MEDIUM** — admin-only, but demo + cross-institution leak + no rate limit.

**Fix:** Add `enforceAIRateLimit(payload.sub, "debug-ping", isDemo)` before the callAI. Pass `userId: payload.sub` to callAI. Filter `recentLogs` by `userId.in: [institutionUserIds]`.

### 6.2 MEDIUM — `ai/test` callAI without userId (L14, NOT FIXED)

**File:** `src/app/api/ai/test/route.ts:64-66`

```ts
const result = await callAI([
  { role: "user", content: connectionTestPrompt() },
], { temperature: 0, maxTokens: TOKEN_BUDGET.CONNECTION_TEST, feature: "connection-test" });
```

No `userId:` option. Admin-only, so lower impact, but breaks AIUsageLog attribution.

**Severity: MEDIUM** — admin-only, but breaks per-user attribution.

**Fix:** Add `userId: payload.sub` to the callAI options.

---

## 7. Role Enforcement Findings (Residual from Prior Audit)

### 7.1 HIGH — `mentorship/touchpoints/parse` admits guardian/pending (R1, NOT FIXED)

**File:** `src/app/api/mentorship/touchpoints/parse/route.ts:23`

```ts
if (payload.role === "student") return NextResponse.json({ error: "Staff only" }, { status: 403 });
```

**Bug:** Same anti-pattern. Guardian and pending users pass through. Should be `isStaffRole(payload.role)`.

**Severity: HIGH** — guardian/pending can call a staff-only AI endpoint (costs tokens, parses transcripts).

### 7.2 HIGH — `students/[id]/rehearse` admits guardian/pending (R2, NOT FIXED)

**File:** `src/app/api/students/[id]/rehearse/route.ts:34`

Same anti-pattern: `if (payload.role === "student") return 403`. Guardian/pending pass through. Should be `isStaffRole()`.

**Severity: HIGH** — guardian/pending can call a staff-only AI endpoint that simulates student personas.

### 7.3 MEDIUM — `students/[id]/portfolio` TA inconsistency (R3, NOT FIXED)

**File:** `src/app/api/students/[id]/portfolio/route.ts:43`

```ts
} else if (payload.role === "teacher" ) {
```

**Bug:** Only `teacher` role gets batch scoping via `getTeacherBatchIds`. `teaching_assistant` falls through to the AccessGrant branch (line 64-67). This contradicts `scope.ts:55` which treats teacher + TA identically. TAs are functionally locked out of student portfolios unless explicitly granted.

**Severity: MEDIUM** — TA functional break (not a direct security issue, but inconsistent with the spec).

**Fix:** Change to `else if (payload.role === "teacher" || payload.role === "teaching_assistant")`. Also fixed for free by N3 above (assertCanAccessStudent using canAccessBatch).

### 7.4 MEDIUM — `assistant/escalation/run` allows demo to trigger write action (R5 / L20, NOT FIXED)

**File:** `src/app/api/assistant/escalation/run/route.ts:39-44`

```ts
if (!isCronCall) {
  const payload = await getAuthUser();
  if (!payload || !["principal", "administrator", "demo", "admin"].includes(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

**Bug:** Allows `demo` role to trigger an escalation run (a write action that auto-creates MentorshipTouchpoint + Message rows). No `demoWriteBlock()`. Demo is supposed to be read-only.

**Severity: MEDIUM** — demo can create touchpoints + messages.

**Fix:** Add `const _demoBlock = await demoWriteBlock("running escalation"); if (_demoBlock) return _demoBlock;` at the top of the `if (!isCronCall)` branch.

---

## 8. Input Validation & Email Enumeration (Residual from Prior Audit)

### 8.1 MEDIUM — Email enumeration via forgot-password response shape (§6.4, NOT FIXED)

**File:** `src/app/api/auth/forgot-password/route.ts:32-65`

The response shape itself reveals whether an email exists:
- Non-existent: `{ ok: true, message: "If an account exists, instructions have been sent." }` (no `flow` field)
- Existing with security question: `{ ok: true, flow: "security_question", question: ... }`
- Existing without security question: `{ ok: true, flow: "admin_request", message: ... }`

An attacker can enumerate which emails exist + harvest security questions for targeted social engineering.

**Severity: MEDIUM** — user-enumeration vector.

**Fix:** Return the same response shape for non-existent and existing-without-security-question flows. For the security-question flow, consider requiring the email before revealing the question (e.g. send the question via email instead of returning it inline).

### 8.2 MEDIUM — Missing `demoWriteBlock` on `auth/change-password` and `auth/set-security-question` (NOT FIXED)

**Files:** `src/app/api/auth/change-password/route.ts`, `src/app/api/auth/set-security-question/route.ts`

Both routes write to the User table but don't call `demoWriteBlock()`. The demo account could change its password or set its security question, which would break the shared demo experience.

**Severity: MEDIUM** — demo account integrity.

**Fix:** Add `const _demoBlock = await demoWriteBlock("changing password"); if (_demoBlock) return _demoBlock;` at the top of each POST handler.

### 8.3 MEDIUM — Audit-log coverage gaps (§8.3, NOT FIXED)

The following sensitive write routes are still NOT audit-logged:
- `POST /api/admin/cleanup-psych-data` — destructive global operation
- `POST /api/admin/cleanup` — destructive
- `POST /api/password-reset-requests/[id]/approve` — sensitive credential action
- `POST /api/messages` — safeguarding alerts are, but the message itself isn't
- `POST /api/comments` / PATCH / DELETE — safeguarding signals are, but the comment edit itself isn't

**Severity: MEDIUM** — forensic backbone weakened.

**Fix:** Add `logAudit(...)` calls to each. The pattern is already used on `users/[id]/role`, `users/[id]/block`, `crisis-flags`, `mentorship/touchpoints`, etc.

### 8.4 LOW-MEDIUM — Unbounded string inputs (§6.1, partially fixed)

Status (re-verified):
- ✅ Capped: `messages` body (10000), `comments` body (10000), `daily-logs` fields (10000), `report-cards` fields (10000), `events` title (500) + description (10000) + location (500), `peer-assessment` ratings (1-5), `mentorship/touchpoints/parse` transcript (2000), `mentorship/case-review` rawDescription (2000), `journey` stepId (no cap but small ID strings), `project/reports` reportText (min 20 only — no max), `auth/forgot-password` reason (no cap), `users` POST (no caps on name/email), `auth/login` PUT (no caps)
- ❌ Still uncapped on AI-prompt-concatenated fields: `courses/generate` (courseName, description, targetAudience, tools, deliverableTypes), `project/setup` (projectName, projectScope, projectObjectives, projectRequirements, projectBusinessCase, projectNotes), `assistant/action-dialog` (flagType, trigger, context), `students/[id]/rehearse` (scenario, teacherReply), `ai/teacher-tutor` (messages — capped at 8000 chars per message ✓), `ai/evaluate` (answer — capped at 10000 ✓ via `studentAnswer` length check)

**Severity: MEDIUM** — prompt-injection + cost-DoS on AI-prompt-concatenated fields.

**Fix:** Add `if (field.length > MAX) return 400` for all AI-prompt-concatenated fields. Suggested cap: 5000 chars per field, 20000 total.

### 8.5 LOW — Untyped inputs (§6.2, NOT FIXED)

`/api/ai/evaluate` POST, `/api/interactions` POST, `/api/daily-test` POST — all accept `body as Record<string, unknown>` with `Number(...)` / `String(...)` coercion. No runtime validation (zod, etc.).

**Severity: LOW** — Prisma rejects type mismatches; the AI prompt is built from coerced strings, but the surface is small.

---

## 9. Session / Blocked-Status (Confirmed Correct)

`src/lib/auth.ts:94-145` — `getAuthUser()` is correct:
- Reads JWT from cookie
- Re-checks `blocked` flag + `role` from DB on every request, cached for 60 seconds
- If blocked → returns `null` (request 401s)
- Uses DB role (authoritative) over JWT role (may be 7 days stale)
- DB outage fallback: denies access if last-known state was blocked; allows if unblocked-or-unknown (reasonable trade-off)

`invalidateAuthCache(userId)` is called on:
- `/api/users/[id]/role` PATCH ✓
- `/api/users/[id]/block` PUT ✓

**Findings (same as prior audit, LOW):**
- S1: 60-second cache means a blocked user retains access for up to 60s. Acceptable for incident response.
- S2: In-memory cache wiped on serverless cold start; each instance has its own cache. Performance observation, not a security issue.
- S3: `getCurrentUser()` re-fetches the User row; the second fetch doesn't re-check `blocked`. Theoretical race only.

No new findings.

---

## 10. Demo Write Protection (Mostly Correct)

`demoWriteBlock()` is correctly applied on most write routes. Re-verified coverage:

✅ Correct: `tasks` POST/PATCH/DELETE, `daily-logs` POST + PATCH/DELETE, `interactions` POST + PATCH/DELETE, `group-tasks` POST/PATCH/DELETE, `group-tasks/submit` POST/PATCH, `events` POST/DELETE, `comments` POST/PATCH/DELETE, `crisis-flags` POST/PATCH, `mentorship/touchpoints` POST, `mentorship/touchpoints/parse` POST, `mentorship/case-review` POST/PUT, `users` POST, `users/[id]` DELETE, `users/[id]/role` PATCH, `users/[id]/block` PUT, `users/[id]/approve` PUT, `users/[id]/batch` PATCH, `users/batch-approve` POST, `batches/[id]` PATCH, `batches/[id]/teachers` POST, `guardian/create` POST/DELETE, `password-reset-requests/[id]/approve` POST/PATCH, `institutions/[id]` PATCH, `certificates/generate` POST, `report-cards` POST, `curriculum/progress` POST/DELETE, `self-paced` POST (but no demoWriteBlock — see below), `project/setup` POST/PATCH/DELETE, `project/generate-tasks` POST, `project/reports` POST, `admin/cleanup-psych-data` POST, `admin/cleanup` POST, `access-grants` POST, `assistant/action-dialog` POST, `ai/evaluate` POST, `ai/teacher-tutor` POST, `ai/test` POST

❌ Still missing (NEW + carried over):
- `POST /api/assistant/escalation/run` — R5/L20 (MEDIUM)
- `POST /api/auth/change-password` — §8.2 (MEDIUM)
- `POST /api/auth/set-security-question` — §8.2 (MEDIUM)
- `POST /api/self-paced` — NEW (LOW) — demo is admin role so blocked by role check on most paths, but defense-in-depth missing
- `POST /api/journey` / PUT / DELETE — NEW (LOW) — same as self-paced
- `GET /api/ai/debug` — L21 (MEDIUM) — not a write but costs tokens; should reject demo via `isDemoAIBlocked`
- `GET /api/daily-motivation` — FIXED (now uses `enforceAIRateLimit` which includes demo block)

---

## 11. New IDOR Gaps on Derived Entity IDs (Audit Specifically Requested)

The task asked to specifically check routes accepting derived entity IDs (submissionId, flagId, commentId, touchpointId, etc.). Verified:

| Route | Param | Ownership Check | Status |
|-------|-------|-----------------|--------|
| `comments` PATCH/DELETE | `id` (comment) | `teacherId === payload.sub` only — no `assertCanAccessStudent` on comment.studentId | MEDIUM (I18) |
| `crisis-flags` PATCH | `flagId` | NONE | CRITICAL (I5) |
| `students/alerts` PATCH | `alertId` | NONE | HIGH (I6) |
| `daily-logs/[id]` PATCH/DELETE | `id` (log) | `assertCanAccessStudent(log.userId)` | ✅ FIXED (H2) |
| `interactions/[id]` PATCH/DELETE | `id` (interaction) | `assertCanAccessStudent(interaction.userId)` | ✅ FIXED (H2) |
| `group-tasks` PATCH/DELETE | `taskId` | `task.teacherId === sub` OR `canAccessBatch(task.batchId)` | ✅ FIXED (H2) |
| `group-tasks/submit` PATCH | `submissionId` | `assertCanAccessStudent(submission.userId)` | ✅ FIXED (H2) |
| `group-tasks/submit` GET | `groupTaskId` | NONE (staff sees all) | HIGH (I10 partial) |
| `events` DELETE | `eventId` | `event.createdById === sub` OR `canAccessBatch(event.batchId)` | ✅ FIXED (H2) |
| `events` POST | `batchId` | NONE | HIGH (I11 partial) |
| `messages/[id]` DELETE | `id` (message) | `msg.fromId === sub` OR `msg.toId === sub` OR admin | ✅ OK |
| `messages/[id]/read` PATCH | `id` (message) | `where: { id, toId: payload.sub }` | ✅ OK |
| `tasks` DELETE | `id` (task) | `task.userId === user.id` (verified first) | ✅ FIXED (C3) |
| `tasks` PATCH | `id` (task) | `where: { id, userId: user.id }` (Prisma-level) | ✅ OK |
| `peer-assessment` GET (staff) | `groupTaskId` | NONE | HIGH (I12) |
| `peer-assessment` GET (student) | `groupTaskId` | NONE | HIGH (I13) |
| `batches/[id]` GET | `id` (batch) | NONE | HIGH (I15) |
| `batches/[id]` PATCH | `id` (batch) | `canAccessBatch(id)` | ✅ FIXED |
| `batches/[id]/teachers` GET | `id` (batch) | NONE | HIGH (I16/R4) |
| `batches/[id]/teachers` POST | `id` (batch) | `canAccessBatch(id)` | ✅ FIXED |
| `batches/[id]/teachers/[teacherId]` DELETE | both | `canAccessBatch(id)` | ✅ OK |
| `institutions/[id]` PATCH/GET | `id` (institution) | NONE | HIGH (C16) |
| `users/[id]` DELETE | `id` (user) | NONE (admin-only) | HIGH (NEW) |
| `users/[id]/role` PATCH | `id` (user) | NONE (admin-only) | HIGH (C6) |
| `users/[id]/block` PUT | `id` (user) | NONE (staff-only) | HIGH (C7) |
| `users/[id]/batch` PATCH | `id` (user) | NONE (admin-only) | HIGH (NEW) |
| `users/[id]/audit` GET | `id` (user) | `assertCanAccessStudent` (or admin) | ✅ OK |
| `users/[id]/approve` PUT | `id` (user) | `batchId === approver.batchId` (or admin) | ✅ OK |
| `password-reset-requests/[id]/approve` POST | `id` (request) | NONE (admin-only) | HIGH (§7) |
| `growth-reports/[userId]` GET | `userId` | `assertCanAccessStudent` (or self) | ✅ OK |
| `certificates/generate` POST | `userId` (query) | `assertCanAccessStudent` | ✅ OK |
| `grades/override` POST | `userId` | `assertCanAccessStudent` | ✅ OK |
| `students/[id]/*` (12 routes) | `id` | `assertCanAccessStudent` | ✅ OK (but see N3 — assertCanAccessStudent itself is buggy for multi-teacher batches) |

**Summary:** 6 of the previously-flagged IDORs are now FIXED (H2 batch). 9 IDORs remain OPEN (3 CRITICAL, 6 HIGH). 3 NEW IDORs found (users/[id] DELETE, users/[id]/batch PATCH, courses GET institution scope).

---

## 12. Findings Index (sorted by severity)

### CRITICAL (7)

| ID | Title | File |
|----|-------|------|
| **N1** | NEW null-institutionId bug in check-alerts counselor notification | `students/check-alerts/route.ts:211` |
| **N2** | data-efficiency.ts:170 still has `?? undefined` anti-pattern (C1 fix incomplete) | `ai-assistant/data-efficiency.ts:170` |
| **N3** | `assertCanAccessStudent` uses legacy batchId, not BatchTeacher junction (breaks multi-teacher batches on 28 routes) | `lib/auth.ts:237-261` |
| **C1** | counselor/overview loads ALL students globally | `counselor/overview/route.ts:33` |
| **I1** | confidence-ratings GET has no IDOR check | `confidence-ratings/route.ts:7-22` |
| **I5** | crisis-flags PATCH has no IDOR check on flagId | `crisis-flags/route.ts:161-203` |
| **§7** | Plaintext temp password stored in PasswordResetRequest (+ no institution scoping + no student-only check) | `password-reset-requests/[id]/approve/route.ts:59-67` |

### HIGH (16)

| ID | Title | File |
|----|-------|------|
| **C4** | users GET no institution scoping (staff branch) | `users/route.ts:124-159` |
| **C5** | users GET role-filter bypass via `?role=` | `users/route.ts:143` |
| **C6** | users/[id]/role PATCH no institution check | `users/[id]/role/route.ts:49-75` |
| **C7** | users/[id]/block PUT no institution check | `users/[id]/block/route.ts:31-50` |
| **C8** | stats GET leaks global pending/teacher counts | `stats/route.ts:79-80` |
| **C9** | audit-log GET no institution filter | `audit-log/route.ts:9-56` |
| **C10** | ai/stats GET global token usage across institutions | `ai/stats/route.ts:18-187` |
| **C12** | access-grants GET/POST no institution check | `access-grants/route.ts:9-89` |
| **C13** | admin/teacher-behavior GET no institution filter | `admin/teacher-behavior/route.ts:18-115` |
| **C14** | students/check-alerts scans ALL students globally | `students/check-alerts/route.ts:40-68` |
| **C16** | institutions/[id] PATCH/GET no institution-membership check | `institutions/[id]/route.ts:10-61` |
| **R6** | stats `?as=teacher` bypasses batch filter for admins | `stats/route.ts:40-51` |
| **R1** | mentorship/touchpoints/parse admits guardian/pending | `mentorship/touchpoints/parse/route.ts:23` |
| **R2** | students/[id]/rehearse admits guardian/pending | `students/[id]/rehearse/route.ts:34` |
| **I6** | students/alerts PATCH no IDOR check on alertId | `students/alerts/route.ts:66-105` |
| **I7** | students/alerts GET (no userId) returns cross-institution alerts | `students/alerts/route.ts:46-62` |
| **I9** | group-tasks GET no batch-access check | `group-tasks/route.ts:13-43` |
| **I10** | group-tasks/submit GET no batch-access check (PATCH fixed) | `group-tasks/submit/route.ts:66-83` |
| **I11** | events POST + GET no batch-access check (DELETE fixed) | `events/route.ts:38-91, 12-32` |
| **I12** | peer-assessment GET (teacher) no batch scoping | `peer-assessment/route.ts:62-72` |
| **I13** | peer-assessment GET (student pending) no batch scoping | `peer-assessment/route.ts:74-96` |
| **I14** | messages POST allows cross-institution messaging | `messages/route.ts:37-112` |
| **I15** | batches/[id] GET no canAccessBatch check (PATCH fixed) | `batches/[id]/route.ts:154-192` |
| **I16** | batches/[id]/teachers GET admits students + no scoping (POST fixed) | `batches/[id]/teachers/route.ts:58-83` |
| **I17** | guardian/create POST/DELETE no IDOR check | `guardian/create/route.ts:30-170` |
| **NEW** | users/[id] DELETE no institution check | `users/[id]/route.ts:29-66` |
| **NEW** | users/[id]/batch PATCH no institution check | `users/[id]/batch/route.ts:13-68` |
| **NEW** | courses GET no institution filter + POST wrong role scope | `courses/route.ts:83-276` |

### MEDIUM (11)

| ID | Title |
|----|-------|
| **R3** | TAs need AccessGrant for portfolio (inconsistency with scope.ts) — fixed by N3 |
| **R5 / L20** | assistant/escalation/run allows demo to trigger write action |
| **C19** | crisis-flags POST notifies ALL counselors globally |
| **I18** | comments PATCH/DELETE no re-verification of staff access |
| **§6.1** | Unbounded string inputs on AI-prompt fields (courses/generate, project/setup, assistant/action-dialog, students/[id]/rehearse scenario) |
| **§6.4** | Email enumeration via forgot-password response shape |
| **§8.2** | Missing demoWriteBlock on auth/change-password + auth/set-security-question |
| **§8.3** | Audit-log gaps on admin/cleanup-psych-data, admin/cleanup, password-reset-approve, messages POST, comments POST/PATCH/DELETE |
| **§6.1 (L14)** | callAI missing userId on ai/test |
| **§6.1 (L19+L21)** | ai/debug missing rate limit + demo guard + userId attribution |
| **§8.4** | Demo account can preview admin dashboards across institutions (consequence of C9/C10/C13) |

### LOW (7)

| ID | Title |
|----|-------|
| **R7** | daily-motivation admits pending/guardian (LOW — feature works for them too) |
| **S1** | 60-second blocked-user cache window |
| **S2** | In-memory auth cache wiped on serverless cold start |
| **S3** | Theoretical race in getCurrentUser double-fetch |
| **§3.3** | Prisma schema prod has one cosmetic trailing-comment difference |
| **§6.2** | Untyped inputs on ai/evaluate, interactions POST, daily-test POST |
| **§6.2** | daily-test `action` field has no enum check |
| **NEW (LOW)** | self-paced + journey missing demoWriteBlock (defense-in-depth; demo is admin role) |

---

## 13. Cross-Cutting Root Causes

### 13.1 The `institutionId ?? undefined` anti-pattern is viral

The C1 fix established the correct pattern (`buildInstitutionFilter` returning `null` + short-circuit). But the same anti-pattern keeps getting reintroduced:
- Original: 8 sites in `scope.ts` + 2 sites in `data-efficiency.ts` (FIXED in C1, mostly)
- New instance: `students/check-alerts/route.ts:211` (introduced by the H3 fix in batch 4 — N1)
- Missed by C1: `data-efficiency.ts:170` (N2)

**Root cause:** There's no lint rule. Developers copy-paste `?? undefined` because it compiles. Prisma's silent acceptance of `undefined` as "no filter" is the underlying trap.

**Fix:** Add an ESLint rule that flags `?? undefined` in any file that imports `db`. Add a unit test that asserts "when scope.studentIds is empty, getAggregateSummary returns zero-counts, not global data".

### 13.2 Institution scoping is applied inconsistently

12+ routes were flagged for missing institution scoping in the prior audit. Only 1 was fixed (C2 / `admin/cleanup-psych-data`). The pattern is well-understood (load caller's institutionId first, refuse if null, then filter), but developers haven't applied it systematically.

**Root cause:** There's no shared helper like `requireInstitutionScope()` that returns the caller's institutionId (or 403). Every route reinvents the lookup.

**Fix:** Add to `lib/auth.ts`:
```ts
export async function requireInstitutionId(payload: JwtPayload): Promise<string | NextResponse> {
  const caller = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!caller?.institutionId) {
    return NextResponse.json(
      { error: "Your account has no institution assigned. This action requires institution scoping." },
      { status: 403 }
    );
  }
  return caller.institutionId;
}
```

Then every institution-scoped route starts with:
```ts
const institutionId = await requireInstitutionId(payload);
if (institutionId instanceof NextResponse) return institutionId;
```

### 13.3 `assertCanAccessStudent` is the right idea, wrong implementation

The helper exists and is widely used (28 routes). But:
- It uses the legacy `batchId` field, not the `BatchTeacher` junction (N3)
- It treats `teacher` and `teaching_assistant` differently (R3)
- It doesn't have a test for the multi-teacher case

**Fix:** Refactor to use `canAccessBatch` (which already correctly handles BatchTeacher + admin bypass). Add tests for:
- Teacher with legacy `batchId` only
- Teacher with `BatchTeacher` only
- Teacher with both
- TA in same batch as student
- Admin from different institution

### 13.4 The H2 batch fix is a template, not a wholesale fix

The H2 fix in batch 5 fixed 6 routes (daily-logs/[id], interactions/[id], group-tasks PATCH/DELETE, group-tasks/submit PATCH, events DELETE). But the prior audit flagged 18 IDORs. The remaining 12 IDORs (and the GET methods on the same routes) weren't touched.

**Root cause:** The H2 fix was scoped to "derived entity IDs on PATCH/DELETE methods". It didn't cover:
- GET methods on the same routes (which also accept entity IDs)
- POST methods that accept entity IDs (events POST, guardian/create POST)
- Other PATCH methods on different routes (crisis-flags PATCH, students/alerts PATCH, comments PATCH)

**Fix:** Apply the H2 pattern (verify ownership via `assertCanAccessStudent` or `canAccessBatch` BEFORE the DB write) to every route in the §3 IDOR table above.

---

## 14. Recommended Next Actions (priority order)

### Immediate (this week — CRITICAL)

1. **Fix N1** — Change `institutionId: student.institutionId ?? undefined` to `institutionId: student.institutionId ?? null` in `students/check-alerts/route.ts:211`. One-line fix.
2. **Fix N2** — Change `: undefined` to `: ["nonexistent-id-to-force-zero-count"]` in `data-efficiency.ts:170`. One-line fix.
3. **Fix N3** — Refactor `assertCanAccessStudent` in `lib/auth.ts:237-261` to use `canAccessBatch` (which checks BatchTeacher). Also fix R3 (TA consistency) in the same change. Add tests.
4. **Fix §7** — Stop persisting `tempPassword` in `PasswordResetRequest`. Return it once in the API response (already done), display in admin UI, communicate out-of-band. Add `expiresAt` + `mustChangePassword` flag. Also add institution scoping + student-only check.
5. **Fix I1** — Add `assertCanAccessStudent` to `confidence-ratings` GET.
6. **Fix I5** — Resolve `flagId` to `userId`, then `assertCanAccessStudent` in `crisis-flags` PATCH.
7. **Fix C1** — Add institution scoping to `counselor/overview` (load caller's institutionId, refuse if null, filter students by it).

### Short-term (next 2 weeks — HIGH)

8. **Add institution scoping** to: `users` GET (C4+C5), `users/[id]/role` (C6), `users/[id]/block` (C7), `users/[id]` DELETE (NEW), `users/[id]/batch` PATCH (NEW), `stats` GET (C8), `audit-log` GET (C9), `ai/stats` GET (C10), `access-grants` GET/POST (C12), `admin/teacher-behavior` GET (C13), `students/check-alerts` (C14), `institutions/[id]` PATCH/GET (C16), `courses` GET (NEW).
9. **Add IDOR checks** to: `students/alerts` PATCH (I6), `students/alerts` GET (I7), `group-tasks` GET (I9), `group-tasks/submit` GET (I10), `events` POST + GET (I11), `peer-assessment` GET teacher (I12), `peer-assessment` GET student (I13), `messages` POST (I14), `batches/[id]` GET (I15), `batches/[id]/teachers` GET (I16), `guardian/create` POST+DELETE (I17).
10. **Fix role checks** — `mentorship/touchpoints/parse` (R1) and `students/[id]/rehearse` (R2) should use `isStaffRole()` not `role === "student"`.
11. **Fix stats ?as=teacher** — Pick a representative batch for admin impersonation; don't allow `{}` filter.
12. **Add `demoWriteBlock`** to `assistant/escalation/run`, `auth/change-password`, `auth/set-security-question`.
13. **Add `assertCanAccessStudent` re-verification** to `comments` PATCH/DELETE (I18).
14. **Add institution filter to crisis-flags POST notifications** (C19) — `institutionId: student.institutionId ?? null`.

### Ongoing

15. **Add ESLint rule** that flags `?? undefined` in files importing `db`.
16. **Add shared helper** `requireInstitutionId(payload)` in `lib/auth.ts` (see §13.2).
17. **Add integration tests** for cross-institution isolation (create two institutions + two users, verify neither can see the other's data).
18. **Add test for `assertCanAccessStudent`** with multi-teacher batches (BatchTeacher junction).
19. **Add `checkUserAILimit` + `isDemoAIBlocked` + `userId`** to `ai/debug` and `ai/test`.
20. **Add email-enumeration mitigation** to `auth/forgot-password` (return identical shape for non-existent vs existing-without-security-question).
21. **Add length caps** to all AI-prompt-concatenated fields (courses/generate, project/setup, assistant/action-dialog, students/[id]/rehearse).
22. **Add audit-log coverage** to admin/cleanup-psych-data, admin/cleanup, password-reset-approve, messages POST, comments POST/PATCH/DELETE.

---

## 15. Code Changes Made

This audit was read-only — no code changes were applied. All findings are documented above with file:line references for the implementation team to act on. The recommended fixes are described in §14 with specific code patterns.

The two one-line fixes (N1 + N2) are the highest-impact, lowest-effort changes — they close two CRITICAL cross-institution data leaks with single-character edits.

---

*End of Section 2 V2: Security Audit. Next: Section 3 — frontend/component audit.*
