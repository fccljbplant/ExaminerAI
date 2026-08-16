import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/forgot-password
 *
 * Two flows:
 * 1. If the user has a security question set → return the question so they
 *    can answer it and reset their own password (self-service).
 * 2. If no security question → create a PasswordResetRequest for admin to
 *    handle (admin-reset flow).
 *
 * Body: { email: string, reason?: string }
 */
export async function POST(req: NextRequest) {
  // H10-security: rate limit — 5 per hour per IP
  const ip = getClientIp(req);
  if (!checkRateLimit(`forgot:${ip}`, 5, 3_600_000)) {
    return NextResponse.json({ error: "Too many reset requests. Please try again in 1 hour." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();
  const reason = (body.reason ?? "").trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Demo accounts share one password across all visitors — never allow a
  // reset flow to change it (CR-7, kept after demoWriteBlock neutralization).
  if (email.endsWith("@demo.ai")) {
    return NextResponse.json(
      { error: "Demo accounts can't reset their password — it's shared by all demo visitors." },
      { status: 403 },
    );
  }

  const user = await db.user.findUnique({ where: { email } });

  // Always return a generic success message to prevent email enumeration
  const genericOk = { ok: true, message: "If an account exists, instructions have been sent." };

  if (!user) {
    return NextResponse.json(genericOk);
  }

  // Flow 1: security question exists → return it for self-service reset
  if (user.securityQuestion && user.securityAnswer) {
    return NextResponse.json({
      ok: true,
      flow: "security_question",
      question: user.securityQuestion,
    });
  }

  // Flow 2: no security question → create admin reset request
  // Check if there's already a pending request
  const existing = await db.passwordResetRequest.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (!existing) {
    await db.passwordResetRequest.create({
      data: { userId: user.id, reason },
    });
  }

  return NextResponse.json({
    ok: true,
    flow: "admin_request",
    message: "Your request has been sent to the admin. They will reset your password and contact you.",
  });
}
