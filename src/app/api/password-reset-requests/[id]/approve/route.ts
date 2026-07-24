import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hashPassword } from "@/lib/auth";

/**
 * POST /api/password-reset-requests/[id]/approve
 *
 * Admin approves a password reset request and sets a temporary password.
 * The student uses the temp password to log in, then should change it.
 *
 * Body: { tempPassword: string, adminNote?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tempPassword = (body.tempPassword ?? "").trim();
  const adminNote = (body.adminNote ?? "").trim() || null;

  if (!tempPassword || tempPassword.length < 6) {
    return NextResponse.json(
      { error: "Temporary password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const request = await db.passwordResetRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `Request is already ${request.status}` },
      { status: 400 }
    );
  }

  // Hash the new password and update the user
  const newHash = await hashPassword(tempPassword);
  try {
    await db.user.update({
      where: { id: request.userId },
      data: { passwordHash: newHash },
    });

    await db.passwordResetRequest.update({
      where: { id },
      data: {
        status: "resolved",
        tempPassword, // stored so admin can share it with the student
        adminNote,
        resolvedAt: new Date(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Password reset for ${request.user.name}. Share this temporary password with them: ${tempPassword}`,
    tempPassword,
  });
}

/** PATCH — reject a request (admin decides not to reset) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const adminNote = (body.adminNote ?? "").trim() || null;

  await db.passwordResetRequest.update({
    where: { id },
    data: { status: "rejected", adminNote, resolvedAt: new Date() },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
