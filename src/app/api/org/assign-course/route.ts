import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, normalizeRole, UserRole } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/org/assign-course — org course assignment (B2B ops).
 *
 * The learner and course must be linked to the same organization. Org
 * admins are restricted to organizations where they have an active admin
 * membership; platform admins may operate across organizations.
 */
export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPlatformAdmin = hasRole(payload.role, [UserRole.PLATFORM_ADMIN]);
  if (!isPlatformAdmin && !hasRole(payload.role, [UserRole.ORG_ADMIN])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { userId, courseId, expiresInDays, retakeAfterDays } = body as {
    userId?: string;
    courseId?: string;
    expiresInDays?: number;
    retakeAfterDays?: number;
  };
  if (typeof userId !== "string" || !userId.trim() || typeof courseId !== "string" || !courseId.trim()) {
    return NextResponse.json({ error: "userId and courseId required" }, { status: 400 });
  }

  if (expiresInDays !== undefined && (!Number.isFinite(expiresInDays) || expiresInDays <= 0)) {
    return NextResponse.json({ error: "expiresInDays must be a positive number" }, { status: 400 });
  }
  if (retakeAfterDays !== undefined && (!Number.isFinite(retakeAfterDays) || retakeAfterDays <= 0)) {
    return NextResponse.json({ error: "retakeAfterDays must be a positive number" }, { status: 400 });
  }

  const actorOrgIds = isPlatformAdmin
    ? null
    : (await db.orgMember.findMany({
        where: { userId: payload.sub, status: "active", role: "admin" },
        select: { orgId: true },
      })).map((membership) => membership.orgId);
  if (actorOrgIds && actorOrgIds.length === 0) {
    return NextResponse.json({ error: "No active organization-admin scope" }, { status: 403 });
  }

  const target = await db.user.findUnique({
    where: { id: userId.trim() },
    select: { id: true, role: true, status: true },
  });
  if (!target) return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  if (normalizeRole(target.role) !== UserRole.LEARNER || target.status !== "active") {
    return NextResponse.json({ error: "Only active learners can be assigned to courses" }, { status: 400 });
  }

  const course = await db.course.findFirst({
    where: { id: courseId.trim(), isActive: true },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Active course not found" }, { status: 404 });

  const courseLinks = await db.orgCourse.findMany({
    where: {
      courseId: course.id,
      ...(actorOrgIds ? { orgId: { in: actorOrgIds } } : {}),
    },
    select: { orgId: true },
  });
  const linkedOrgIds = courseLinks.map((link) => link.orgId);
  if (linkedOrgIds.length === 0) {
    return NextResponse.json({ error: "Course is not linked to an organization you can administer" }, { status: 403 });
  }

  const targetMembership = await db.orgMember.findFirst({
    where: { userId: target.id, orgId: { in: linkedOrgIds }, status: "active" },
    select: { orgId: true },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Learner is not an active member of the course's organization" }, { status: 403 });
  }

  const existing = await db.courseEnrollment.findFirst({
    where: { userId: target.id, courseId: course.id, role: "student" },
  });
  if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

  try {
    const enrollment = await db.courseEnrollment.create({
      data: {
        userId: target.id,
        courseId: course.id,
        role: "student",
        ...(expiresInDays !== undefined
          ? { expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) }
          : {}),
        ...(retakeAfterDays !== undefined ? { retakeAfterDays } : {}),
      },
    });
    await db.course.update({ where: { id: course.id }, data: { enrollmentCount: { increment: 1 } } });
    logger.info("Org course assigned", { userId: target.id, courseId: course.id, expiresInDays, retakeAfterDays });
    return NextResponse.json({ enrollment });
  } catch (err) {
    logger.error("Org course assignment failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to assign course" }, { status: 500 });
  }
}
