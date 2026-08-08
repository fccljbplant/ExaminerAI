import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";
import { logger } from "./logger";

/** In production, JWT_SECRET MUST be set via env var.
 *
 *  N1-fix: The check is LAZY — it fires inside signToken/verifyToken,
 *  not at module load. This is critical because `next build` evaluates
 *  server modules at build time, and Vercel scops secrets to Runtime
 *  only (not Build). A module-load throw would crash `next build` even
 *  when JWT_SECRET is correctly set for runtime. The lazy check fires
 *  on the first authed request — which only happens at runtime. */
const DEV_JWT_SECRET = "examiner-ai-dev-secret-change-me";

/** Returns the JWT secret, or throws if missing in production.
 *  Called lazily by signToken/verifyToken — never at module load. */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is REQUIRED in production.\n" +
      "Set it in your Vercel project settings: Settings → Environment Variables → Runtime.\n" +
      "Generate one with: openssl rand -hex 32"
    );
  }
  return DEV_JWT_SECRET;
}

const JWT_EXPIRY = "7d";
export const TOKEN_COOKIE = "examiner_token";

/** Whether the request is over HTTPS — determines cookie `secure` flag. */
function isSecureContext(): boolean {
  // On Vercel, VERCEL_ENV is "production" or "preview" for deployed environments.
  // In local dev, NODE_ENV is "development". We set `secure` only for HTTPS.
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Cookie options for the JWT token — httpOnly, sameSite=lax, secure in prod. */
export function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureContext(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10);
}

export async function comparePassword(p: string, hash: string): Promise<boolean> {
  return bcrypt.compare(p, hash);
}

/** Read the JWT from the request cookie (server-side). Returns null if missing/invalid. */
// Cache for blocked/role checks — avoids hitting the DB on every request.
// Entries expire after 60 seconds. When a user is blocked or their role
// changes, the cache will reflect it within 60 seconds (instead of 7 days
// when only relying on the JWT).
const authCheckCache = new Map<string, { blocked: boolean; role: string; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = 60_000; // 60 seconds

/** Get the authenticated user from the JWT, with a DB re-check of the
 *  blocked flag and role. Cached for 60 seconds to avoid hitting the DB
 *  on every request. Returns null if:
 *  - No valid JWT
 *  - User doesn't exist in DB
 *  - User is blocked */
export async function getAuthUser(): Promise<JwtPayload | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // Check cache
  const now = Date.now();
  const cached = authCheckCache.get(payload.sub);
  if (cached && cached.expiresAt > now) {
    if (cached.blocked) return null;
    return { ...payload, role: cached.role };
  }

  // DB lookup — verify user still exists and isn't blocked
  try {
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { blocked: true, role: true },
    });
    if (!user) {
      authCheckCache.set(payload.sub, { blocked: true, role: "student", expiresAt: now + AUTH_CACHE_TTL_MS });
      return null;
    }
    authCheckCache.set(payload.sub, { blocked: user.blocked, role: user.role, expiresAt: now + AUTH_CACHE_TTL_MS });
    if (user.blocked) return null;
    // Use the DB role (authoritative) instead of the JWT role (may be stale)
    return { ...payload, role: user.role };
  } catch {
    // N3-fix: DB outage fallback. Previously returned the JWT payload
    // unconditionally — a blocked user with an unexpired JWT could
    // access the system during the outage. Now we check the cache
    // (even if expired) for a 'blocked: true' entry. If the last
    // known state was blocked, deny access. If the last known state
    // was unblocked OR there's no cache entry, allow access (better
    // than locking everyone out during a transient DB blip).
    // N3-R1-fix: also use the cached role (up to 60s stale) instead of
    // the JWT role (up to 7d stale) when available.
    const lastKnown = authCheckCache.get(payload.sub);
    if (lastKnown?.blocked) {
      // Last known state was blocked — deny even during DB outage
      return null;
    }
    // Use the cached DB role if available (more recent than JWT role)
    if (lastKnown) {
      return { ...payload, role: lastKnown.role };
    }
    // No cache entry — fall back to JWT-only auth
    return payload;
  }
}

/** Invalidate the auth cache for a specific user. Call this when a user
 *  is blocked, unblocked, or has their role changed. */
export function invalidateAuthCache(userId: string): void {
  authCheckCache.delete(userId);
}

/** Get the full User row for the currently authenticated user.
 *  Times out after 5s so a cold DB connection never hangs the first paint. */
export async function getCurrentUser() {
  const payload = await getAuthUser();
  if (!payload) return null;
  try {
    const result = await Promise.race([
      db.user.findUnique({ where: { id: payload.sub } }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 5000)
      ),
    ]);
    return result;
  } catch (err) {
    // H11-rel: Log DB timeouts — previously silent, which meant during a
    // partial DB outage every user appeared logged out with no trace.
    logger.warn("getCurrentUser: DB lookup failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** Admin credentials — read from environment variables for security.
 *  Do NOT hardcode in source. Set ADMIN_EMAIL, ADMIN_PASSWORD in .env or Vercel.
 *  Falls back to demo values ONLY in development (not production). */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@examiner.ai";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "helloworld");
export const ADMIN_NAME = process.env.ADMIN_NAME || "Developer Admin";

/** Idempotent: ensures the admin account exists in the DB.
 *  In production, ADMIN_PASSWORD must be set via env var or admin won't be created. */
export async function ensureAdminUser(): Promise<void> {
  if (!ADMIN_PASSWORD) {
    // In production without ADMIN_PASSWORD set, skip admin creation (security)
    return;
  }
  const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) return;
  const hash = await hashPassword(ADMIN_PASSWORD);
  await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash: hash,
      role: "admin",
      approvedAt: new Date(),
    },
  });
}


// === IDOR PROTECTION ===

/** Assert that the authenticated user can access the target student's data.
 *  Throws a 403-shaped error if not. Usage:
 *
 *    await assertCanAccessStudent(payload, studentId);
 *
 *  Rules:
 *  - Students can only access their own data (payload.sub === studentId)
 *  - Admins (principal, administrator) can access any student
 *  - Instructors can access students in their courses (via CourseEnrollment)
 *  - Other staff (counselor, coordinator, demo) need an AccessGrant
 *
 *  Returns true if access is allowed, throws an API-shaped error if not.
 *  Call this at the top of any route that takes a studentId/userId param. */
export async function assertCanAccessStudent(
  payload: JwtPayload,
  studentId: string,
): Promise<boolean> {
  // Students access only their own data
  if (payload.role === "student") {
    if (payload.sub !== studentId) {
      throw { status: 403, message: "You can only access your own data" };
    }
    return true;
  }

  // Admins can access any student
  const { ADMIN_ROLES } = await import("@/lib/rbac");
  if ((ADMIN_ROLES as string[]).includes(payload.role)) {
    return true;
  }

  // Instructor — check course enrollment via CourseEnrollment
  // Instructors can access students enrolled in the same courses they teach.
  if (payload.role === "instructor") {
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { role: true },
    });
    if (!student || student.role !== "student") {
      throw { status: 404, message: "Student not found" };
    }

    // Get courses the instructor teaches
    const instructorEnrollments = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    const instructorCourseIds = instructorEnrollments.map(e => e.courseId);
    if (instructorCourseIds.length === 0) {
      throw { status: 403, message: "You are not assigned to any courses" };
    }

    // Check if student is enrolled in any of those courses
    const studentEnrollment = await db.courseEnrollment.findFirst({
      where: {
        userId: studentId,
        courseId: { in: instructorCourseIds },
        role: "student",
      },
    });
    if (studentEnrollment) return true;

    // Fall through to AccessGrant check
  }

  // Other staff (org_admin, platform_admin, demo)
  // — check AccessGrant
  const grant = await db.accessGrant.findFirst({
    where: {
      granteeUserId: payload.sub,
      scopeType: "student",
      scopeId: studentId,
      dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },
      revokedAt: null,
    },
  });
  if (grant) return true;

  throw { status: 403, message: "You need an access grant to view this student" };
}
