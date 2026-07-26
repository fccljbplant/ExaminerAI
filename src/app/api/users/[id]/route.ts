import { hasRole, ADMIN_ROLES, UserRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** DELETE /api/users/[id] — delete a user and ALL their data.
 *  Admin only (principal + administrator). Demo is read-only and
 *  explicitly excluded — demo is just for demo, not administration.
 *  Explicitly deletes every related record in a transaction
 *  to guarantee complete cleanup regardless of cascade state. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing users"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || payload.role === UserRole.DEMO) {
    // Defense-in-depth: demoWriteBlock already blocks demo, but make the
    // intent explicit — demo has no user-management authority.
    return NextResponse.json({ error: "Demo accounts cannot modify users" }, { status: 403 });
  }
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  // Don't allow deleting the admin account
  // HI-10 fix: also fetch institutionId for cross-institution scoping check
  const target = await db.user.findUnique({ where: { id }, select: { email: true, role: true, institutionId: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  // Protect all admin accounts (administrator, principal, legacy admin)
  if (target.email === "admin@examiner.ai" || hasRole(target.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 403 });
  }

  // HI-10 fix: principals can only delete users in their own institution.
  // Administrators (platform-level) can delete any user.
  if (payload.role === "principal") {
    const caller = await db.user.findUnique({ where: { id: payload.sub }, select: { institutionId: true } });
    if (caller?.institutionId && target.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "You can only delete users in your own institution" }, { status: 403 });
    }
  }

  try {
    // Delete everything in a transaction — guarantees complete cleanup.
    // Order matters: delete dependent records first.
    await db.$transaction([
      // Comments authored by this user (as teacher) or targeting them (as student)
      db.comment.deleteMany({ where: { teacherId: id } }),
      db.comment.deleteMany({ where: { studentId: id } }),
      // Messages sent or received
      db.message.deleteMany({ where: { fromId: id } }),
      db.message.deleteMany({ where: { toId: id } }),
      // Password reset requests
      db.passwordResetRequest.deleteMany({ where: { userId: id } }),
      // Psychology observations
      db.psychologyObs.deleteMany({ where: { userId: id } }),
      // Report cards
      db.reportCard.deleteMany({ where: { userId: id } }),
      // Competencies
      db.competency.deleteMany({ where: { userId: id } }),
      // Weekly tests
      db.weeklyTest.deleteMany({ where: { userId: id } }),
      // Interactions (AI Q&A)
      db.interaction.deleteMany({ where: { userId: id } }),
      // Tasks
      db.projectTask.deleteMany({ where: { userId: id } }),
      // Daily logs
      db.dailyLog.deleteMany({ where: { userId: id } }),
      // Finally, the user itself
      db.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, message: `User ${target.email} and all their data deleted.` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
