# Security Measures

This document catalogs all security measures implemented in ExaminerAI.

## Authentication

- **JWT-based auth** — 7-day expiry, signed with `JWT_SECRET` env var
- **JWT_SECRET enforcement** — throws on module load in production if unset (R14-fix)
- **Cookie-based** — `HttpOnly`, `Secure` (in production), `SameSite=Lax`
- **Password hashing** — bcrypt with salt rounds

### Blocked user enforcement (R4-fix)

- `getAuthUser()` does a DB lookup with a 60-second cache to re-check the
  `blocked` flag and current `role`
- `invalidateAuthCache(userId)` is called in `users/[id]/block` and
  `users/[id]/role` routes so changes take effect immediately (not after
  7-day JWT expiry)

### Rate limiting (C3 + H10)

- **In-memory rate limiter** (`src/lib/rate-limiter.ts`) — no Redis required
- Applied to:
  - `auth/login` — 10 attempts per 10 min per IP
  - `auth/forgot-password` — 5 requests per hour per IP
  - `auth/reset-password` — 5 attempts per hour per IP
- **Note:** On Vercel serverless, each instance has its own Map, so the
  limit is approximate. For strict limiting, upgrade to `@upstash/ratelimit`

## Authorization (RBAC)

### Roles

| Role | Scope | Pastoral access |
|------|-------|-----------------|
| `student` | Self only | No |
| `teaching_assistant` | Own cohort | No |
| `teacher` | Own cohort | No |
| `course_coordinator` | Own cohort | With grant |
| `counselor` | With grant | With grant |
| `guardian` | Own children | No |
| `principal` | Institution-wide | Yes |
| `administrator` | Institution-wide | No (operational) |
| `developer` | Institution-wide | No |

### IDOR protection

`assertCanAccessStudent(payload, studentId)` in `src/lib/auth.ts` enforces:
- Students → only their own data
- Admins → any student
- Teachers/TAs → students in their cohort (or legacy: all if no cohort)
- Other staff → need an explicit `AccessGrant`

Applied to all staff routes that take a student ID:
- `students/final-result`
- `certificates/generate`
- `students/[id]/allow-retake`
- `students/[id]/unlock-test`
- `students/[id]/edit-weekly-test`
- `students/[id]/generate-report-card`
- `students/[id]/generate-project-analysis`
- `students/[id]/portfolio`
- `grades/override`

### Cohort ownership checks

Teachers/TAs can only modify resources in their own cohort:
- `cohorts/[id]` PATCH
- `group-tasks` POST
- `users/batch-approve`
- `password-reset-requests` (read — teachers only see their cohort's requests)

### Self-protection guards

- Users cannot delete their own account
- Users cannot change their own role

## Input validation

### Length caps on AI routes

| Route | Field | Cap |
|-------|-------|-----|
| `ai/weekly-test` | message | 8000 chars |
| `ai/weekly-test` | projectName | 500 chars |
| `ai/practice` | topic | 500 chars |
| `ai/practice` | studentReply | 8000 chars |
| `ai/tutor` | topic | 500 chars |
| `ai/tutor` | per-message content | 8000 chars |
| `ai/tutor` | messages array | 50 items |
| `ai/generate` | topic, projectType | 500 chars |
| `ai/generate` | weakAreas array | 20 items |
| `ai/generate` | per weak area | 200 chars |
| `daily-test` | studentReply | 8000 chars |
| `messages` | subject | 200 chars |
| `messages` | body | 10000 chars |

### Message spam prevention

- Recipient existence validation
- Recipient blocked check
- Subject + body length caps

## Data integrity

### Transactions

Multi-step DB operations wrapped in `$transaction`:
- `project/setup` DELETE (cascade)
- `grades/override` (update + comment)
- `daily-logs/[id]` DELETE
- `interactions/[id]` DELETE
- `tasks` DELETE

### Unique constraints

- `DailyTest` — `@@unique([userId, date])` (prevents duplicate same-day tests)
- `WeeklyTest` — `@@unique([userId, week])`
- `Cohort` — `@@unique([name])`

### Race condition mitigations

- `WeeklyTest` creation — `upsert` instead of `findUnique + create`
- `DailyTest` creation — `upsert` with `userId_date` unique
- Weekly test retake — `updateMany` with `retakeAllowed: true` in where clause (atomic flag clear)
- Cohort name — `P2002` catch returns clean 409

## Audit logging

All sensitive actions are logged via `logAudit()`:
- Grade overrides
- Role changes
- User approval/block/unblock
- Test unlocks + retake approvals
- Certificate generation

## Error handling

- Error responses do NOT leak internal details (`err.message`) to clients
- Server-side `logger.error` / `console.error` captures full errors
- Silent `catch {}` blocks have been replaced with logged catches

## Schema relations

All foreign keys have proper `@relation` with `onDelete` cascades:
- `GroupTask.teacherId` → `User` (Cascade) — R2-fix
- `Comment.{interactionId,taskId,weeklyTestId,dailyLogId}` → respective models
- All child records cascade-delete when parent is deleted

## Data scope filtering (N2-fix)

The portfolio route filters its response based on the caller's `dataScope`:

| dataScope | psychObs/psychTrend | dailyLogs | project content |
|-----------|---------------------|-----------|-----------------|
| `full` | ✅ | ✅ | ✅ |
| `wellbeing_only` | ✅ | ✅ | ❌ |
| `crisis_only` | ✅ | ❌ | ❌ |
| `content_only` | ❌ | ❌ | ✅ |

This prevents a counselor with `content_only` access from seeing a
student's psychological observations or crisis data.

## Accepted risks (documented)

These risks are known and documented — fixing them requires infrastructure
or a design decision:

### 1. DB outage fallback (N3)

During a DB outage, `getAuthUser()` falls back to JWT-only auth (returns
the JWT payload without a DB lookup). This means a blocked user with an
unexpired JWT could access the system during the outage. The alternative
(returning `null` and locking everyone out) was rejected because a DB
outage would make the entire app unusable. The 60-second cache TTL means
this only affects requests after the cache expires during an outage.

### 2. Serverless cache limitation (N4)

The in-memory `authCheckCache` is process-local. On Vercel serverless,
each function invocation may run on a different instance. When admin
(instance A) blocks user X and calls `invalidateAuthCache(X)`, only
instance A's map is cleared. If user X's next request hits instance B
(which has them cached as `blocked: false`), they get through for up
to 60s. To close this gap, migrate to Upstash Redis or Vercel KV.

### 3. Legacy teacher access (N5)

Teachers with no `cohortId` (legacy data) can access any student. This
matches the pre-existing portfolio route behavior. The safer alternative
(requiring admin intervention to grant null-cohort teachers explicit
access) was rejected to avoid breaking legacy deployments. New teachers
should always be assigned a cohort.

### 4. Rate limiter is best-effort (R15)

The in-memory rate limiter (`src/lib/rate-limiter.ts`) is process-local.
On Vercel serverless, each instance has its own Map, so the limit is
approximate. For strict rate limiting, use `@upstash/ratelimit` + Redis.

### 5. JWT_SECRET build vs runtime (N1-fixed)

The JWT_SECRET check is **lazy** — it fires inside `signToken`/`verifyToken`
at runtime, not at module load. This is critical because `next build`
evaluates server modules at build time, and Vercel scopes secrets to
Runtime only (not Build). A module-load throw would crash `next build`
even when JWT_SECRET is correctly set for runtime.
