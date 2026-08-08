import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";

/**
 * GET /api/admin/orgs — list ALL organizations (platform admin only).
 *
 * Returns org list with member counts + seat utilization.
 * Used by the admin B2B panel.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await db.organization.findMany({
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    orgs: orgs.map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      seats: o.seats,
      createdAt: o.createdAt.toISOString(),
      _count: { members: o._count.members },
    })),
  });
}
