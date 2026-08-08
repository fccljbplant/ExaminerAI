import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";

/**
 * GET /api/enrollments/batch?userIds=id1,id2,id3
 *
 * Batch fetch enrollments for multiple users in ONE request.
 * Replaces the N+1 pattern where the admin Users tab called
 * /api/enrollments?userId=X in a loop for every student (50 calls =
 * 50 DB connections = connection pool exhaustion = 500 errors).
 *
 * Admin-only. Returns a map: { [userId]: [{ courseId, courseName, role }] }
 *
 * Lightweight — only returns courseId/courseName/role (no progress/score
 * computation, which is what made the single-user endpoint slow).
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userIdsParam = req.nextUrl.searchParams.get("userIds") || "";
  const userIds = userIdsParam.split(",").map(s => s.trim()).filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({ map: {} });
  }
  if (userIds.length > 200) {
    return NextResponse.json({ error: "Too many userIds (max 200)" }, { status: 400 });
  }

  // ONE query for all users' enrollments — no N+1 loop.
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      role: true,
      courseId: true,
      course: { select: { name: true } },
    },
  });

  // Build the map.
  const map: Record<string, Array<{ courseId: string; courseName: string; role: string }>> = {};
  for (const e of enrollments) {
    if (!map[e.userId]) map[e.userId] = [];
    map[e.userId].push({
      courseId: e.courseId,
      courseName: e.course.name,
      role: e.role,
    });
  }

  return NextResponse.json({ map });
}
