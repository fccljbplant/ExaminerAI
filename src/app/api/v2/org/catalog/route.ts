/**
 * GET/POST/DELETE /api/v2/org/catalog — the org's public storefront
 * catalog (OrgCourse rows, 2026-08-15).
 *
 * GET:    { linked, available } — linked courses (on the org's public
 *         page) and published courses that could be linked.
 * POST:   { courseId } links a published course (audited).
 * DELETE: ?courseId= unlinks (audited).
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) return apiError("Org access only", "FORBIDDEN", 403);
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const [linked, published] = await Promise.all([
    db.orgCourse.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        course: {
          select: {
            id: true,
            name: true,
            subtitle: true,
            thumbnailUrl: true,
            published: true,
          },
        },
      },
    }),
    db.course.findMany({
      where: { published: true, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subtitle: true },
    }),
  ]);

  const linkedIds = new Set(linked.map((l) => l.course.id));
  return apiSuccess({
    linked: linked.map((l) => l.course),
    available: published.filter((c) => !linkedIds.has(c.id)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) return apiError("Org access only", "FORBIDDEN", 403);
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }
  const demoBlock = await demoWriteBlock("updating the org catalog");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => ({}));
  const courseId = (body as { courseId?: string }).courseId;
  if (!courseId) return apiError("courseId is required", "VALIDATION_ERROR", 400);

  const course = await db.course.findFirst({
    where: { id: courseId, published: true, isActive: true },
    select: { id: true, name: true },
  });
  if (!course) return apiError("Course not found or not published", "NOT_FOUND", 404);

  const existing = await db.orgCourse.findUnique({
    where: { orgId_courseId: { orgId: ctx.orgId, courseId } },
  });
  if (existing) return apiError("Course is already in your catalog", "CONFLICT", 409);

  await db.orgCourse.create({ data: { orgId: ctx.orgId, courseId } });
  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "org_catalog_course_added",
    target: { type: "org", id: ctx.orgId },
    metadata: { courseId, courseName: course.name },
    req,
  }).catch(() => {});
  return apiSuccess({ linked: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) return apiError("Org access only", "FORBIDDEN", 403);
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }
  const demoBlock = await demoWriteBlock("updating the org catalog");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "VALIDATION_ERROR", 400);

  const link = await db.orgCourse.findUnique({
    where: { orgId_courseId: { orgId: ctx.orgId, courseId } },
  });
  if (!link) return apiError("Course is not in your catalog", "NOT_FOUND", 404);

  await db.orgCourse.delete({ where: { id: link.id } });
  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "org_catalog_course_removed",
    target: { type: "org", id: ctx.orgId },
    metadata: { courseId },
    req,
  }).catch(() => {});
  return apiSuccess({ linked: false });
}
