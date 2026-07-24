# Auth Helper Pattern

## The two auth helpers

ExaminerAI has two auth helpers in `src/lib/auth.ts`:

### `getAuthUser()` — returns `JwtPayload | null`

**Use when:** You need to check if the user is authenticated + their role.

```typescript
const payload = await getAuthUser();
if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**What it does:**
1. Reads the JWT from the cookie
2. Verifies the JWT signature (lazy `getJwtSecret()`)
3. Does a DB lookup with a 60-second cache to re-check:
   - User exists in DB
   - User is not blocked
   - User's current role (from DB, not JWT)
4. Returns `{ sub, email, role, name }` or `null`

**Blocked enforcement:** Blocked users get `null` — every route that
calls `getAuthUser` enforces the block automatically.

### `getCurrentUser()` — returns the full `User` row or `null`

**Use when:** You need the full user row (cohortId, projectName, etc.)

```typescript
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// user.cohortId, user.projectName, user.currentWeek, etc.
```

**What it does:**
1. Calls `getAuthUser()` (so blocked check is enforced)
2. Does a DB lookup with a 5-second timeout
3. Returns the full User row or `null`

## Which to use

| Need | Use |
|------|-----|
| Just check auth + role | `getAuthUser()` |
| Need `cohortId` | `getCurrentUser()` |
| Need `projectName` or other fields | `getCurrentUser()` |
| Staff route (role check) | `requireRole()` (calls `getAuthUser` internally) |

## The mixed-use anti-pattern

7 files currently use BOTH `getAuthUser` AND `getCurrentUser`:

```
src/app/api/competencies/route.ts
src/app/api/messages/route.ts
src/app/api/students/final-result/route.ts
src/app/api/interactions/route.ts
src/app/api/weekly-tests/route.ts
src/app/api/certificates/generate/route.ts
src/app/api/report-cards/route.ts
```

This is redundant — `getCurrentUser` already calls `getAuthUser`.
If you need the full user row, just call `getCurrentUser` and use
`user.role` instead of calling `getAuthUser` separately.

**Cleanup:** When these files are next touched, remove the `getAuthUser`
call and use `getCurrentUser` alone. The `payload` from `getAuthUser`
is a subset of what `getCurrentUser` returns.

## `requireRole()` — the preferred pattern for staff routes

```typescript
import { requireRole, UserRole } from "@/lib/rbac";

const auth = await requireRole([UserRole.TEACHER, UserRole.ADMINISTRATOR]);
if (!auth.ok) return auth.response;
const { ctx } = auth;
// ctx.payload — the JwtPayload
// ctx.user — the full User row (or null if DB lookup failed)
```

`requireRole` calls `getAuthUser` internally, so blocked enforcement
is automatic. It also does a `getCurrentUser` lookup and attaches
the result to `ctx.user`.
