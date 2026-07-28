import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/events?courseId=X — list events for a course (or all upcoming).
 *   - Students: see events for their enrolled courses only
 *   - Staff: see events for the specified course (or all if no courseId)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseIdParam = req.nextUrl.searchParams.get("courseId");

  let where: { courseId?: string } = {};
  if (user.role === "student" || user.role === "pending") {
    // Students see events for their enrolled courses only
    const enrollments = await db.courseEnrollment.findMany({
      where: { userId: user.id, role: "student" },
      select: { courseId: true },
    });
    const courseIds = enrollments.map(e => e.courseId);
    where.courseId = courseIds.length > 0 ? { in: courseIds } as any : "none";
  } else if (courseIdParam) {
    where.courseId = courseIdParam;
  }

  const events = await db.event.findMany({
    where,
    orderBy: { startDate: "asc" },
    take: 50,
  });

  return NextResponse.json({ events });
}

/**
 * POST /api/events — create a new event (teachers/admins only).
 * Body: { title, description?, type?, startDate, endDate?, location?, courseId?, isAllDay? }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating events"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { title, description, type, startDate, endDate, location, courseId, isAllDay, activityType } = body as {
    title?: string; description?: string; type?: string;
    startDate?: string; endDate?: string; location?: string;
    courseId?: string; isAllDay?: boolean; activityType?: string;
  };

  if (!title?.trim() || !startDate) {
    return NextResponse.json({ error: "title and startDate required" }, { status: 400 });
  }
  if (title.length > 500) return NextResponse.json({ error: "title too long (max 500 chars)" }, { status: 400 });
  if (description && description.length > 10_000) return NextResponse.json({ error: "description too long" }, { status: 400 });
  if (location && location.length > 500) return NextResponse.json({ error: "location too long" }, { status: 400 });

  // Find the caller's course enrollment if no courseId provided
  let targetCourseId = courseId;
  if (!targetCourseId) {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: auth.ctx.payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    targetCourseId = enrollment?.courseId ?? null;
  }

  const event = await db.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || "",
      type: type || "deadline",
      activityType: activityType || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location: location?.trim() || null,
      courseId: targetCourseId,
      createdById: auth.ctx.payload.sub,
      isAllDay: isAllDay ?? false,
    },
  });

  return NextResponse.json({ event });
}

/**
 * DELETE /api/events — delete an event.
 * Body: { eventId }
 *
 * H2 fix (audit 2026-07-26): teachers can only delete events in courses they
 * can access. Admins can delete any event.
 */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating events"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { eventId } = body as { eventId?: string };
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { courseId: true, createdById: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (event.createdById !== auth.ctx.payload.sub && event.courseId) {
      const instructorAccess = await db.courseEnrollment.findFirst({
        where: { userId: auth.ctx.payload.sub, courseId: event.courseId, role: "instructor" },
      });
      if (!instructorAccess) {
        return NextResponse.json({ error: "You can only delete events in courses you are assigned to" }, { status: 403 });
      }
    }
  }

  await db.event.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
