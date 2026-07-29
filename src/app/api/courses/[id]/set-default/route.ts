import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/courses/[id]/set-default — mark a course as the default for new students.
 *
 *  Sets isDefault=true on the specified course and isDefault=false on all other
 *  courses (only one default at a time).
 *
 *  Body: { isDefault: boolean } — pass false to unset the default.
 *
 *  Auth: staff only (coordinator, admin, principal).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const wantDefault = body.isDefault !== false; // default to true if not specified

  // Verify the course exists
  const course = await db.course.findUnique({ where: { id }, select: { id: true, name: true, isDefault: true } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (wantDefault) {
    // Set this course as the default — unset all others in a transaction
    await db.$transaction(async (tx) => {
      await tx.course.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      await tx.course.update({ where: { id }, data: { isDefault: true } });
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "course_set_default",
      target: { type: "course", id },
      after: { isDefault: true, courseName: course.name },
      req,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      course: { id, isDefault: true },
      message: `"${course.name}" is now the default course for new students.`,
    });
  } else {
    // Unset the default
    await db.course.update({ where: { id }, data: { isDefault: false } });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "course_unset_default",
      target: { type: "course", id },
      before: { isDefault: true },
      after: { isDefault: false, courseName: course.name },
      req,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      course: { id, isDefault: false },
      message: `"${course.name}" is no longer the default course.`,
    });
  }
}
