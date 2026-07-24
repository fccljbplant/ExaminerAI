import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** GET /api/batches — list all batches with member counts.
 *  Available to teachers + admins. */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const batches = await db.batch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: "student" },
        select: { id: true, currentWeek: true },
      },
      course: { select: { id: true, name: true } },
    },
  });

  // Count students explicitly (the _count.users includes all roles)
  const enriched = batches.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
    courseId: c.courseId,
    courseName: c.course?.name || null,
    totalMembers: c._count.users,
    studentCount: c.users.length,
    avgWeek: c.users.length > 0
      ? Math.round(c.users.reduce((a, u) => a + u.currentWeek, 0) / c.users.length)
      : 0,
  }));

  return NextResponse.json({ batches: enriched });
}

/** POST /api/batches — create a new batch. Admin only. */
export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, startDate, endDate, courseId } = body as {
    name?: string; description?: string; startDate?: string; endDate?: string; courseId?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Batch name is required" }, { status: 400 });
  }

  // Check for duplicate name
  const existing = await db.batch.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "A batch with this name already exists" }, { status: 409 });
  }

  // M7-rel: race condition — two concurrent creates with the same name
  // both pass the check above. The unique constraint catches the second,
  // but without a try/catch it surfaces as a generic 500.
  try {
    const batch = await db.batch.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        courseId: courseId || null,
      },
    });

    return NextResponse.json({ batch });
  } catch (err: any) {
    // M7-rel: P2002 = unique constraint violation (race condition)
    if (err?.code === "P2002") {
      return NextResponse.json({ error: `A batch named "${name}" already exists` }, { status: 409 });
    }
    console.error("batch create failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}
