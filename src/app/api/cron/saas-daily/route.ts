/**
 * GET /api/cron/saas-daily — consolidated SaaS platform jobs.
 *
 * Vercel cron slots are limited, so the six SaaS jobs run sequentially
 * from ONE registered schedule (2026-08-17):
 *   - daily: compliance-expiry, trials-expiry, billing-dunning,
 *     ai-budget-alerts
 *   - monthly (1st): payouts-sweep
 *   - weekly (Sunday): audit-retention
 * Each job keeps its own individual route for manual triggering.
 */

import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { run as runComplianceExpiry } from "../compliance-expiry/route";
import { run as runTrialsExpiry } from "../trials-expiry/route";
import { run as runBillingDunning } from "../billing-dunning/route";
import { run as runAIBudgetAlerts } from "../ai-budget-alerts/route";
import { run as runPayoutsSweep } from "../payouts-sweep/route";
import { run as runAuditRetention } from "../audit-retention/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const isMonthly = now.getUTCDate() === 1;
  const isWeekly = now.getUTCDay() === 0; // Sunday

  const daily: [string, () => Promise<Response>][] = [
    ["compliance-expiry", runComplianceExpiry],
    ["trials-expiry", runTrialsExpiry],
    ["billing-dunning", runBillingDunning],
    ["ai-budget-alerts", runAIBudgetAlerts],
  ];
  if (isMonthly) daily.push(["payouts-sweep", runPayoutsSweep]);
  if (isWeekly) daily.push(["audit-retention", runAuditRetention]);

  const results: Record<string, unknown> = {};
  for (const [name, job] of daily) {
    try {
      const res = await job();
      results[name] = res.status === 200 ? await res.json() : { status: res.status };
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return Response.json({ ok: true, data: results });
}
