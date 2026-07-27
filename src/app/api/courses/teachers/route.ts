import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";

/** GET /api/courses/teachers — list all users with role=teacher.
 *
 *  Used by the Course Planner's teacher assignment dropdown.
 *  Returns: { teachers: [{ id, name, email }] }
 *
 *  Auth: staff only (course_coordinator, admin, principal, teacher).
 *  Teachers can see the list of fellow teachers (e.g. for collaboration).
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teachers = await db.user.findMany({
    where: {
      role: "teacher",
      blocked: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ teachers });
}
