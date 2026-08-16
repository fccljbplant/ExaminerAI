import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { hashPassword, comparePassword } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/reset-password
 *
 * Self-service password reset via security question.
 * Body: { email, answer, newPassword }
 *
 * Verifies the security answer (bcrypt compare), then sets the new password.
 */
export async function POST(req: NextRequest) {
  // H10-security: rate limit — 5 per hour per IP
  const ip = getClientIp(req);
  if (!checkRateLimit(`reset:${ip}`, 5, 3_600_000)) {
    return NextResponse.json({ error: "Too many reset attempts. Please try again in 1 hour." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();
  const answer = (body.answer ?? "").trim();
  const newPassword = body.newPassword ?? "";

  // Demo accounts share one password across all visitors — never allow a
  // self-service reset to change it (CR-7, kept after demoWriteBlock
  // neutralization).
  if (email.endsWith("@demo.ai")) {
    return NextResponse.json(
      { error: "Demo accounts can't reset their password — it's shared by all demo visitors." },
      { status: 403 },
    );
  }

  if (!email || !answer || !newPassword) {
    return NextResponse.json(
      { error: "Email, answer, and new password are required" },
      { status: 400 }
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.securityQuestion || !user.securityAnswer) {
    return NextResponse.json(
      { error: "No security question set for this account. Ask an admin to reset your password." },
      { status: 400 }
    );
  }

  const answerMatch = await comparePassword(answer.toLowerCase(), user.securityAnswer);
  if (!answerMatch) {
    return NextResponse.json(
      { error: "Security answer is incorrect. Please try again." },
      { status: 401 }
    );
  }

  const newHash = await hashPassword(newPassword);
  try {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  } catch {
    // Read-only DB — non-blocking
    return NextResponse.json(
      { error: "Unable to update password right now. Please try again or contact an admin." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Password reset successfully. You can now log in." });
}
