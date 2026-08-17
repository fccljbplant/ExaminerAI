/**
 * GET/POST /api/v2/platform/announcements — platform-to-tenant broadcast
 * (2026-08-17). Platform admins post an announcement to an org; it fans
 * out as Notification rows to every active member and is stored as an
 * Announcement row for history.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError, apiNotFound } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const PostBody = z.object({
  orgId: z.string().min(1),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(1000),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const orgId = req.nextUrl.searchParams.get("orgId") ?? undefined;
  const announcements = await db.announcement.findMany({
    where: orgId ? { orgId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { org: { select: { name: true } } },
  });
  return apiSuccess({
    announcements: announcements.map((a) => ({
      id: a.id,
      orgName: a.org.name,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) {
    return apiError("orgId, title and body are required", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const org = await db.organization.findUnique({ where: { id: parsed.data.orgId }, select: { id: true } });
  if (!org) return apiNotFound("Organization not found");

  const members = await db.orgMember.findMany({
    where: { orgId: org.id, status: "active" },
    select: { userId: true },
  });

  const announcement = await db.announcement.create({
    data: {
      orgId: org.id,
      authorUserId: user.sub,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

  let notified = 0;
  for (const member of members) {
    try {
      await db.notification.create({
        data: {
          userId: member.userId,
          type: "announcement",
          title: parsed.data.title,
          body: parsed.data.body,
          link: "/org",
        },
      });
      notified++;
    } catch (err) {
      logger.warn("announcement fan-out failed", { orgId: org.id, err });
    }
  }

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "tenant_announcement",
    target: { type: "organization", id: org.id },
    after: { title: parsed.data.title, notified },
    metadata: { source: "platform_support" },
    req,
  }).catch(() => {});

  return apiSuccess({ announcement: { id: announcement.id }, notified }, 201);
}
