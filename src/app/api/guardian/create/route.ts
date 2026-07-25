import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole, ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import bcrypt from "bcryptjs";

/**
 * POST /api/guardian/create — staff creates a guardian account on parent's request.
 *
 * The guardian account is OPTIONAL — it's created when a parent requests access
 * to their child's progress. The student does NOT create it themselves.
 *
 * Body:
 *   - studentId: the student this guardian is linked to (required)
 *   - guardianName: parent/guardian's full name (required)
 *   - guardianEmail: parent/guardian's email (required, must be unique)
 *   - guardianPassword: initial password (required, min 6 chars)
 *   - relationship: "father" | "mother" | "guardian" | "other" (optional)
 *
 * Flow:
 *   1. Staff member (teacher/counselor/principal/admin) fills the form
 *   2. System creates a User with role "guardian"
 *   3. Creates a GuardianLink connecting guardian → student
 *   4. Returns the guardian account details (without password)
 *   5. Staff gives the parent their login credentials
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating guardian accounts"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Only staff can create guardian accounts" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { studentId, guardianName, guardianEmail, guardianPassword, relationship } = body as {
    studentId?: string;
    guardianName?: string;
    guardianEmail?: string;
    guardianPassword?: string;
    relationship?: string;
  };

  // Validate required fields
  if (!studentId || !guardianName?.trim() || !guardianEmail?.trim() || !guardianPassword) {
    return NextResponse.json({ error: "studentId, guardianName, guardianEmail, and guardianPassword are required" }, { status: 400 });
  }
  if (guardianPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const email = guardianEmail.trim().toLowerCase();

  // Verify the student exists and is a student
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true, institutionId: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (student.role !== "student") {
    return NextResponse.json({ error: "Target user is not a student" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Check if student already has a guardian linked
  const existingLink = await db.guardianLink.findFirst({
    where: { studentId },
    include: { guardian: { select: { email: true, name: true } } },
  });
  if (existingLink) {
    return NextResponse.json({
      error: `Student already has a guardian linked: ${existingLink.guardian.name} (${existingLink.guardian.email}). Remove the existing link first.`,
      existingGuardian: { name: existingLink.guardian.name, email: existingLink.guardian.email },
    }, { status: 409 });
  }

  // Create the guardian account
  const passwordHash = await bcrypt.hash(guardianPassword, 10);
  const guardian = await db.user.create({
    data: {
      name: guardianName.trim(),
      email,
      passwordHash,
      role: "guardian",
      approvedAt: new Date(),
      institutionId: student.institutionId,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // Create the GuardianLink
  await db.guardianLink.create({
    data: {
      guardianId: guardian.id,
      studentId,
      relationship: relationship || "guardian",
    },
  });

  // Audit log
  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "guardian_account_created",
    target: { type: "user", id: guardian.id },
    metadata: {
      guardianName: guardian.name,
      guardianEmail: guardian.email,
      studentId,
      studentName: student.name,
      relationship: relationship || "guardian",
    },
    req,
  }).catch(() => {});

  return NextResponse.json({
    guardian: {
      id: guardian.id,
      name: guardian.name,
      email: guardian.email,
      role: guardian.role,
    },
    student: { id: student.id, name: student.name },
    relationship: relationship || "guardian",
    message: `Guardian account created for ${guardian.name}. Login: ${email} / [password you set]. The guardian can now view ${student.name}'s progress.`,
  });
}

/**
 * DELETE /api/guardian/create — remove a guardian link + account.
 * Body: { guardianId }
 */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("removing guardian accounts"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Only staff can remove guardian accounts" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { guardianId } = body as { guardianId?: string };
  if (!guardianId) {
    return NextResponse.json({ error: "guardianId required" }, { status: 400 });
  }

  // Remove the guardian link first
  await db.guardianLink.deleteMany({ where: { guardianId } }).catch(() => {});

  // Delete the guardian account
  await db.user.delete({ where: { id: guardianId } }).catch(() => {});

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "guardian_account_deleted",
    target: { type: "user", id: guardianId },
    req,
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: "Guardian account removed." });
}
