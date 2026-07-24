import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/password-reset-requests
 *
 * List password reset requests. Admins see all, teachers see for their students.
 * Query: ?status=pending|approved|resolved|rejected
 */
export async function GET(req: Request) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  // M2-security: teachers/TAs only see reset requests for their batch.
  // Admins see all requests.
  let batchFilter: Record<string, unknown> = {};
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    const teacher = await db.user.findUnique({
      where: { id: payload.sub },
      select: { batchId: true },
    });
    const teacherBatchIds = await getTeacherBatchIds(payload.sub, payload.role);
    if (teacherBatchIds !== null && teacherBatchIds.length > 0) {
      batchFilter = { user: { batchId: { in: teacherBatchIds } } };
    } else if (teacherBatchIds !== null) {
      batchFilter = { user: { batchId: null } }; // no batches = sees nothing
    }
  }

  const requests = await db.passwordResetRequest.findMany({
    where: { ...(status === "all" ? {} : { status }), ...batchFilter },
    take: 100,
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
