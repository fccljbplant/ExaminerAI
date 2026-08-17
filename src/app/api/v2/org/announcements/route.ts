/**
 * GET/POST /api/v2/org/announcements — org announcements (B2B ops, 2026-08-17)
 *
 * GET:  the 20 most recent announcements (author names joined).
 * POST: { title, body } — org_admin only. Creates the Announcement row,
 *       fans a notification out to every active member (type
 *       "announcement") and is audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/email";
import { getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const AnnounceBody = z.object({
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(2000),
});

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
    const announcements = await db.announcement.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Announcement has no User relation — join author names in one batch.
    const authorIds = [...new Set(announcements.map((a) => a.authorUserId))];
    const authors = await db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true },
    });
    const nameByAuthor = new Map(authors.map((u) => [u.id, u.name]));

    return apiSuccess({
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        authorName: nameByAuthor.get(a.authorUserId) ?? "Unknown",
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("posting an announcement");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = AnnounceBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid announcement body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const announcement = await db.announcement.create({
      data: {
        orgId: ctx.orgId,
        authorUserId: user.sub,
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
      },
    });

    // Fan out to every active member (best-effort — sendNotification
    // never throws).
    const members = await db.orgMember.findMany({
      where: { orgId: ctx.orgId, status: "active" },
      select: { userId: true },
    });
    for (const member of members) {
      await sendNotification({
        userId: member.userId,
        type: "announcement",
        title: announcement.title,
        body: announcement.body,
        link: "/org",
      });
    }

    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "org_announcement_created",
      target: { type: "org", id: ctx.orgId },
      after: { title: announcement.title },
      metadata: { notified: members.length },
      req,
    }).catch(() => {});

    return apiSuccess(
      {
        announcement: {
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          authorName: user.name,
          createdAt: announcement.createdAt.toISOString(),
        },
        notified: members.length,
      },
      201,
    );
  } catch (err) {
    return orgErrorResponse(err);
  }
}
