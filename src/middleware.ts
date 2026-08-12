import { NextRequest, NextResponse } from "next/server";
import { jwtVerify as joseVerify } from "jose";

/** Verify a JWT token using the configured secret.
 *  Uses jose (Edge-compatible) instead of jsonwebtoken (Node.js crypto only). */
async function verifyJwt(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await joseVerify(token, key);
  return payload as { sub: string; email: string; role: string; name: string };
}

/**
 * src/middleware.ts — Centralized middleware for auth, RBAC, and rate limiting.
 *
 * This runs BEFORE every API route handler and page load. It handles:
 *   1. Authentication — validates JWT from cookie
 *   2. RBAC — checks role-based access for protected routes
 *   3. Rate limiting — protects public endpoints from abuse
 *   4. Public route bypass — lets public routes through without auth
 *
 * Routes that DON'T need auth (public):
 *   - / (landing page)
 *   - /for-business, /for-learners, /pricing, /support
 *   - /courses (marketplace — public read)
 *   - /signup/b2b
 *   - /api/auth/login, /api/auth/forgot-password, /api/auth/reset-password
 *   - /api/auth/logout
 *   - /api/health
 *   - /api/marketplace/* (public course catalog)
 *   - /api/certificates/verify (public verification)
 *   - /api/org/signup (B2B registration)
 *   - /verify/* (public certificate verification)
 *
 * Routes that need auth (protected):
 *   - /app/* (authenticated app shell)
 *   - /api/* (all other API routes)
 *
 * RBAC is enforced at the route handler level via assertCanAccessStudent()
 * and hasRole() — middleware only checks "is this user authenticated?"
 */

// ── Public routes (no auth required) ────────────────────────────
const PUBLIC_ROUTES = [
  "/",
  "/for-business",
  "/for-learners",
  "/pricing",
  "/support",
  "/courses",
  "/signup/b2b",
  "/verify",
  "/instructors",
  "/paths",
  "/learn", // learn catalog is public; /learn/[courseId] auto-creates profile on first visit (auth required)
  "/login",
  "/register",
  "/app", // AppShell handles both login (no token) and dashboard (with token)
  "/avatars-demo", // public avatar demo page
];

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/logout",
  "/api/health",
  "/api/marketplace",  // public course catalog
  "/api/certificates/verify",
  "/api/org/signup",
];

// ── Rate limiting (in-memory, per-Vercel-instance) ──────────────
// For production at scale, replace with Upstash Redis or Vercel KV.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Rate limits per endpoint type
const RATE_LIMITS: Array<{ pattern: RegExp; max: number; windowMs: number }> = [
  { pattern: /^\/api\/auth\/login$/, max: 10, windowMs: 600_000 },         // 10 per 10 min
  { pattern: /^\/api\/auth\/forgot-password$/, max: 3, windowMs: 3_600_000 }, // 3 per hour
  { pattern: /^\/api\/auth\/reset-password$/, max: 5, windowMs: 3_600_000 },  // 5 per hour
  { pattern: /^\/api\/org\/signup$/, max: 3, windowMs: 3_600_000 },           // 3 per hour
  { pattern: /^\/api\/ai\//, max: 60, windowMs: 60_000 },                    // 60 per min (AI routes)
  { pattern: /^\/api\//, max: 120, windowMs: 60_000 },                       // 120 per min (all other API)
];

// ── Helper: is this path public? ───────────────────────────────
function isPublicPath(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Check prefix matches
  for (const route of PUBLIC_ROUTES) {
    if (pathname.startsWith(route + "/")) return true;
  }
  return false;
}

function isPublicApiPath(pathname: string): boolean {
  for (const route of PUBLIC_API_ROUTES) {
    if (pathname === route || pathname.startsWith(route + "/")) return true;
  }
  return false;
}

// ── Helper: get client IP ──────────────────────────────────────
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

// ── Main middleware ────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Skip non-API, non-app routes (static assets, _next, etc.) ──
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── Rate limiting for API routes ─────────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    for (const { pattern, max, windowMs } of RATE_LIMITS) {
      if (pattern.test(pathname)) {
        if (!checkRateLimit(`${ip}:${pathname}`, max, windowMs)) {
          return NextResponse.json(
            {
              ok: false,
              error: "Rate limit exceeded. Please try again later.",
              code: "RATE_LIMITED",
              retryAfter: Math.ceil(windowMs / 1000),
            },
            { status: 429 }
          );
        }
        break; // Only apply the first matching rate limit
      }
    }
  }

  // ── Public routes: skip auth ─────────────────────────────────
  if (isPublicPath(pathname) || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  // ── Protected routes: check auth ─────────────────────────────
  const token = req.cookies.get("examiner_token")?.value;
  if (!token) {
    // API route → return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "NO_TOKEN" },
        { status: 401 }
      );
    }
    // Page → redirect to /app (AppShell shows login form when unauthenticated)
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // ── Verify JWT ───────────────────────────────────────────────
  try {
    const secret = process.env.JWT_SECRET || "examiner-ai-dev-secret-change-me";
    const payload = await verifyJwt(token, secret);

    // Add user info to request headers for downstream handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.sub);
    requestHeaders.set("x-user-email", payload.email);
    requestHeaders.set("x-user-role", payload.role);
    requestHeaders.set("x-user-name", encodeURIComponent(payload.name));

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    // Invalid/expired token
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Token expired or invalid", code: "INVALID_TOKEN" },
        { status: 401 }
      );
    }
    // Page → redirect to /app (AppShell shows login form when unauthenticated)
    return NextResponse.redirect(new URL("/app", req.url));
  }
}

// ── Middleware config: which routes to run on ──────────────────
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (static assets)
     * - favicon.ico, logo.svg, icons (public files)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|icon-.*|manifest|sw\\.js).*)",
  ],
};
