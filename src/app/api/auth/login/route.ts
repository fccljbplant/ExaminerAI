import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import {
  comparePassword,
  hashPassword,
  signToken,
  TOKEN_COOKIE,
  ensureAdminUser,
  getCookieOptions,
} from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";

/** POST /api/auth/login — email/password login, sets JWT cookie. */
export async function POST(req: NextRequest) {
  // C3-security: rate limit login attempts — 10 per 10 min per IP
  const ip = getClientIp(req);
  if (!checkRateLimit(`login:${ip}`, 10, 600_000)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in 10 minutes." }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  // Best-effort admin ensure — don't block login if DB is read-only.
  try { await ensureAdminUser(); } catch (err) {
    // Log but don't block login — admin user creation is best-effort
    console.error("Failed to ensure admin user exists:", err instanceof Error ? err.message : String(err));
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (user.role === "pending") {
    return NextResponse.json(
      { error: "Account pending approval. Ask an instructor/admin to approve." },
      { status: 403 }
    );
  }
  if (user.blocked) {
    return NextResponse.json(
      { error: "Your account has been blocked. Contact your instructor or admin." },
      { status: 403 }
    );
  }

  // Update lastLogin — non-blocking, best-effort. On read-only DBs (e.g. some
  // serverless sandboxes) this may fail; we don't want it to block login.
  db.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  }).catch(err => console.error("Failed to update lastLogin:", err instanceof Error ? err.message : String(err)));

  // Normalize the role — legacy aliases like 'admin' → 'administrator',
  // 'institution_admin' → 'principal', 'platform_admin' → 'administrator'.
  // This ensures the JWT and /api/auth/me always return canonical roles,
  // so role checks throughout the app work correctly.
  const canonicalRole = normalizeRole(user.role) || user.role;

  // If the DB still has a legacy alias, fix it in the DB so future logins
  // and direct DB queries see the canonical role. Best-effort, non-blocking.
  if (canonicalRole !== user.role) {
    db.user.update({
      where: { id: user.id },
      data: { role: canonicalRole },
    }).catch(err => console.error("Failed to normalize user role:", err instanceof Error ? err.message : String(err)));
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: canonicalRole,
    name: user.name,
  });

  // Audit log: user logged in
  logAudit({
    actor: { id: user.id, name: user.name, role: canonicalRole },
    action: "user_logged_in",
    target: { type: "user", id: user.id },
    metadata: { email: user.email, ip: getClientIp(req) },
    req,
  }).catch(() => {});

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: canonicalRole },
  });
  res.cookies.set(TOKEN_COOKIE, token, getCookieOptions());
  return res;
}

/** POST /api/auth/signup — create a new pending user. */
export async function PUT(req: NextRequest) {
  // Check signup feature flag
  const { isFeatureEnabled } = await import("@/lib/feature-flags");
  if (!(await isFeatureEnabled("signup_enabled"))) {
    return NextResponse.json({ error: "New signups are currently disabled." }, { status: 403 });
  }
  let body: { name?: string; email?: string; password?: string; securityQuestion?: string; securityAnswer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const securityQuestion = (body.securityQuestion ?? "").trim() || null;
  const securityAnswer = (body.securityAnswer ?? "").trim().toLowerCase();
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  // If a security question is provided, an answer is required (and vice versa).
  // This prevents the "question set but answer is null" inconsistency that
  // would otherwise silently route the user to admin-reset on forgot-password.
  if (securityQuestion && !securityAnswer) {
    return NextResponse.json(
      { error: "Security answer is required when a security question is selected." },
      { status: 400 }
    );
  }
  if (!securityQuestion && securityAnswer) {
    return NextResponse.json(
      { error: "Security question is required when an answer is provided." },
      { status: 400 }
    );
  }
  if (securityAnswer && securityAnswer.length < 2) {
    return NextResponse.json(
      { error: "Security answer must be at least 2 characters." },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered." },
      { status: 409 }
    );
  }

  const hash = await hashPassword(password);
  const answerHash = securityQuestion && securityAnswer ? await hashPassword(securityAnswer) : null;
  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        role: "pending",
        securityQuestion: securityQuestion || null,
        securityAnswer: answerHash,
      },
    });
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
