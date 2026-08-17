/**
 * GET /api/v2/org/compliance — assignment expiry matrix (B2B ops, 2026-08-17)
 *
 * For every student enrollment of the org's members (joined with course
 * names): expiresAt + retakeAfterDays + a computed status — "compliant"
 * (no expiry or >14 days out), "due_soon" (within 14 days) or "expired"
 * (past due). Grouped by course with per-status counts + member lists.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

type ComplianceStatus = "compliant" | "due_soon" | "expired";

const DUE_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function complianceStatus(expiresAt: Date | null, now: Date): ComplianceStatus {
  if (!expiresAt) return "compliant";
  if (expiresAt.getTime() < now.getTime()) return "expired";
  if (expiresAt.getTime() - now.getTime() <= DUE_SOON_WINDOW_MS) return "due_soon";
  return "compliant";
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  try {
    const members = await db.orgMember.findMany({
      where: { orgId: ctx.orgId, status: { not: "removed" } },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);

    const enrollments =
      userIds.length === 0
        ? []
        : await db.courseEnrollment.findMany({
            where: { userId: { in: userIds }, role: "student" },
            orderBy: [{ courseId: "asc" }, { expiresAt: "asc" }],
            select: {
              userId: true,
              courseId: true,
              expiresAt: true,
              retakeAfterDays: true,
              user: { select: { name: true, email: true } },
              course: { select: { name: true } },
            },
          });

    const now = new Date();
    const byCourse = new Map<
      string,
      {
        courseId: string;
        courseName: string;
        counts: { compliant: number; dueSoon: number; expired: number };
        members: Array<{
          userId: string;
          name: string;
          email: string;
          expiresAt: string | null;
          retakeAfterDays: number | null;
          status: ComplianceStatus;
        }>;
      }
    >();

    for (const e of enrollments) {
      const status = complianceStatus(e.expiresAt, now);
      let group = byCourse.get(e.courseId);
      if (!group) {
        group = {
          courseId: e.courseId,
          courseName: e.course.name,
          counts: { compliant: 0, dueSoon: 0, expired: 0 },
          members: [],
        };
        byCourse.set(e.courseId, group);
      }
      group.counts[status === "due_soon" ? "dueSoon" : status]++;
      group.members.push({
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
        retakeAfterDays: e.retakeAfterDays,
        status,
      });
    }

    const courses = [...byCourse.values()].map((g) => ({
      ...g,
      members: [...g.members].sort((a, b) => {
        const rank = { expired: 0, due_soon: 1, compliant: 2 } as const;
        return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
      }),
    }));

    const totals = courses.reduce(
      (acc, c) => {
        acc.compliant += c.counts.compliant;
        acc.dueSoon += c.counts.dueSoon;
        acc.expired += c.counts.expired;
        return acc;
      },
      { compliant: 0, dueSoon: 0, expired: 0 },
    );

    return apiSuccess({ courses, totals });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
