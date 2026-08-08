import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";

/**
 * GET /api/admin/b2c-stats — B2C learner metrics for the admin B2C panel.
 *
 * Returns:
 *   - totalLearners (users with role=learner, NOT in any org)
 *   - activeToday (logged in within 24h)
 *   - completedCertificates count
 *   - avgScore across all weekly tests
 *   - recentLearners (last 10 signups)
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // B2C learners = role=learner AND not in any org (no OrgMember rows).
  // The User→OrgMember relation is named `organizationMembers` in the schema.
  const [totalLearners, activeToday, completedCertificates, avgScoreAgg, recentLearners] = await Promise.all([
    db.user.count({
      where: {
        role: "learner",
        organizationMembers: { none: {} },
      },
    }),
    db.user.count({
      where: {
        role: "learner",
        organizationMembers: { none: {} },
        lastLogin: { gte: twentyFourHoursAgo },
      },
    }),
    db.certificate.count({
      where: {
        user: {
          role: "learner",
          organizationMembers: { none: {} },
        },
      },
    }),
    db.weeklyTest.aggregate({
      where: {
        user: {
          role: "learner",
          organizationMembers: { none: {} },
        },
        status: "completed",
        score: { not: null },
      },
      _avg: { score: true },
    }),
    db.user.findMany({
      where: {
        role: "learner",
        organizationMembers: { none: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLogin: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const avgScore = avgScoreAgg._avg?.score != null ? Math.round(avgScoreAgg._avg.score) : null;

  return NextResponse.json({
    stats: {
      totalLearners,
      activeToday,
      enrolledInCourses: 0,
      completedCertificates,
      avgScore,
      completionRate: 0,
    },
    recentLearners: recentLearners.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      lastLogin: u.lastLogin?.toISOString() ?? null,
      _count: { enrollments: u._count.enrollments },
    })),
  });
}
