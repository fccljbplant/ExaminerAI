/**
 * GET/PUT /api/v2/platform/ai-budgets — per-org monthly AI token budgets
 *
 * GET: every org with its configured limit (Setting key
 *      `ai_budget_org:<orgId>`, absent = unlimited) and the current
 *      month's token usage (same calculation as
 *      ai-rate-limits.isOrgOverBudget).
 * PUT: { orgId, limit: number | null } — platform_admin only.
 *      null clears the budget (deletes the Setting row). Audited
 *      ("ai_budget_updated").
 */

import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { orgBudgetSettingKey, startOfUTCMonth } from "@/modules/assessment/lib/ai-rate-limits";

export const runtime = "nodejs";

const BUDGET_KEY_PREFIX = "ai_budget_org:";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized(), user: null };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403), user: null };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403), user: null };
  }
  return { denied: null, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.denied) return auth.denied;

  const orgs = await db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  if (orgs.length === 0) return apiSuccess({ budgets: [], monthStart: startOfUTCMonth() });

  const settings = await db.setting.findMany({
    where: { key: { startsWith: BUDGET_KEY_PREFIX } },
  });
  const limitByOrg = new Map<string, number>();
  for (const setting of settings) {
    const orgId = setting.key.slice(BUDGET_KEY_PREFIX.length);
    const parsed = parseInt(setting.value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) limitByOrg.set(orgId, parsed);
  }

  const usage = await db.aIUsageLog.groupBy({
    by: ["orgId"],
    where: {
      orgId: { in: orgs.map((o) => o.id) },
      createdAt: { gte: startOfUTCMonth() },
      success: true,
    },
    _sum: { totalTokens: true },
  });
  const usedByOrg = new Map<string, number>();
  for (const row of usage) {
    if (row.orgId) usedByOrg.set(row.orgId, row._sum.totalTokens ?? 0);
  }

  return apiSuccess({
    monthStart: startOfUTCMonth(),
    budgets: orgs.map((org) => ({
      orgId: org.id,
      name: org.name,
      limit: limitByOrg.get(org.id) ?? null,
      used: usedByOrg.get(org.id) ?? 0,
    })),
  });
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (auth.denied || !auth.user) return auth.denied;

  const body = (await req.json().catch(() => ({}))) as { orgId?: string; limit?: number | null };
  const orgId = (body.orgId ?? "").trim();
  if (!orgId) return apiError("orgId is required", "VALIDATION_ERROR", 400);
  if (body.limit === undefined) {
    return apiError("limit is required (a non-negative integer or null)", "VALIDATION_ERROR", 400);
  }
  if (body.limit !== null && (!Number.isInteger(body.limit) || body.limit < 0)) {
    return apiError("limit must be a non-negative integer or null", "VALIDATION_ERROR", 400);
  }

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return apiError("Organization not found", "NOT_FOUND", 404);

  const key = orgBudgetSettingKey(orgId);
  if (body.limit === null) {
    await db.setting.delete({ where: { key } }).catch(() => undefined);
  } else {
    await db.setting.upsert({
      where: { key },
      update: { value: String(body.limit) },
      create: { key, value: String(body.limit) },
    });
  }

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "ai_budget_updated",
    target: { type: "org", id: orgId },
    after: { limit: body.limit },
  });

  return apiSuccess({ orgId, limit: body.limit });
}
