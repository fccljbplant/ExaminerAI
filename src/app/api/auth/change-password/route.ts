import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, comparePassword } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/change-password
 *
 * Logged-in user changes their password. Requires current password for
 * verification. Sets the new password if the current one matches.
 *
 * CR-7 fix (audit 2026-07-26 FINAL): added demoWriteBlock — the demo account
 * shares a password across all visitors. Without this block, any visitor could
 * change the demo password and lock out all future demo visitors.
 *
 * Body: { currentPassword: string, newPassword: string }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("changing password"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current password and new password are required" },
      { status: 400 }
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Verify current password
  const match = await comparePassword(currentPassword, user.passwordHash);
  if (!match) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  // Set new password
  const newHash = await hashPassword(newPassword);
  try {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update password. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Password changed successfully." });
}
