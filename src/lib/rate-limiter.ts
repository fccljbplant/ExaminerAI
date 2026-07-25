/**
 * Simple in-memory rate limiter — no Redis required.
 *
 * Works on Vercel serverless (each instance has its own Map, so the
 * limit is approximate — a user might get slightly more requests if
 * they hit different instances). For strict limiting, use Upstash
 * Redis (@upstash/ratelimit). This is a pragmatic fallback that blocks
 * most brute-force attacks without infrastructure changes.
 *
 * Usage:
 *   import { checkRateLimit } from "@/lib/rate-limiter";
 *   const allowed = checkRateLimit(`login:${ip}:${email}`, 10, 600_000); // 10 per 10 min
 *   if (!allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

/** Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g. `login:${ip}:${email}`)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 10 min)
 * @returns true if allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 600_000,
): boolean {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // First request or window expired — start fresh
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

/** Get remaining requests for a key (for X-RateLimit-Remaining headers). */
export function getRemainingRequests(key: string, maxRequests: number): number {
  const entry = store.get(key);
  if (!entry || entry.resetAt < Date.now()) return maxRequests;
  return Math.max(0, maxRequests - entry.count);
}

/** Get client IP from request — works on Vercel and local dev. */
export function getClientIp(req: Request): string {
  const headers = new Headers(req.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
