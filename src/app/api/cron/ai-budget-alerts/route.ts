/**
 * GET /api/cron/ai-budget-alerts — per-org AI budget alerts (daily).
 *
 * For every org with an `ai_budget_org:<orgId>` Setting at >= 80% of
 * this month's token usage, notifies each OrgMember with role "admin"
 * (Notification type "message_received", link /org/billing). Deduped:
 * an admin only gets a new alert when the last notification with the
 * SAME title is more than 6 days old.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isOrgOverBudget } from "@/modules/assessment/lib/ai-rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDGET_KEY_PREFIX = "ai_budget_org:";
const ALERT_THRESHOLD = 0.8;
const DEDUPE_DAYS = 6;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.setting.findMany({
    where: { key: { startsWith: BUDGET_KEY_PREFIX } },
  });

  const dedupeSince = new Date(Date.now() - DEDUPE_DAYS * 86_400_000);
  let notified = 0;
  let skipped = 0;

  for (const setting of settings) {
    const orgId = setting.key.slice(BUDGET_KEY_PREFIX.length);
    if (!orgId) continue;

    const budget = await isOrgOverBudget(orgId);
    if (budget.limit === null || budget.limit <= 0) continue;
    const percent = budget.used / budget.limit;
    if (percent < ALERT_THRESHOLD) continue;

    const admins = await db.orgMember.findMany({
      where: { orgId, role: "admin", status: { not: "removed" } },
      select: { userId: true },
    });

    const title = `AI budget at ${Math.round(percent * 100)}%`;
    const body = `${budget.used.toLocaleString()} of ${budget.limit.toLocaleString()} tokens used this month.`;

    for (const admin of admins) {
      const lastNotice = await db.notification.findFirst({
        where: { userId: admin.userId, title, createdAt: { gte: dedupeSince } },
        select: { id: true },
      });
      if (lastNotice) {
        skipped++;
        continue;
      }
      await db.notification.create({
        data: {
          userId: admin.userId,
          type: "message_received",
          title,
          body,
          link: "/org/billing",
        },
      });
      notified++;
    }
  }

  logger.info("ai-budget-alerts complete", { notified, skipped, orgs: settings.length });
  return Response.json({ ok: true, notified, skipped, orgs: settings.length });
}
