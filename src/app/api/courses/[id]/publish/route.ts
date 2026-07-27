import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** POST /api/courses/[id]/publish — toggle the course plan's published state.
 *
 *  Body: { published: boolean }
 *    - true:  set status = "published" — locks AI regeneration
 *    - false: set status = "draft" — re-enables AI regeneration
 *
 *  Auth: staff only (course_coordinator, admin, principal).
 *
 *  Rules:
 *  - A course MUST have a teacher assigned before it can be published.
 *    Publishing a course without a teacher would orphan any enrolled students.
 *  - A course MUST have at least 1 week before it can be published.
 *    An empty course plan is not ready for students.
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
  const published = body.published !== false; // default to true if not specified

  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      teacherId: true,
      weeks: { select: { id: true } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (published) {
    // Pre-publish validation: teacher required, at least 1 week required.
    if (!course.teacherId) {
      return NextResponse.json(
        { error: "Cannot publish: assign a teacher to this course first." },
        { status: 400 }
      );
    }
    if (course.weeks.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish: add at least one week to the course plan first." },
        { status: 400 }
      );
    }
  }

  const newStatus = published ? "published" : "draft";
  await db.course.update({
    where: { id },
    data: { status: newStatus },
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: published ? "course_published" : "course_unpublished",
    target: { type: "course", id },
    after: { courseName: course.name, status: newStatus },
    req,
  }).catch(() => {});

  logger.info("Course publish state changed", { courseId: id, status: newStatus, by: payload.sub });

  return NextResponse.json({ ok: true, status: newStatus });
}
