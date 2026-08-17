/**
 * GET/POST /api/v2/org/billing — O6 Billing & seats (REDESIGN-P4 §2 O6, W7)
 *
 * GET:  plan card data + seat usage + recent member payments.
 * POST: { plan, seats } starts a Stripe subscription checkout — one
 *       monthly line item priced at seats × $29, floor of the plan's
 *       minimum seats. Returns { url } (503 when Stripe isn't configured).
 *       Audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { getStripe } from "@/lib/stripe";
import { getOrgBilling, getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const SEAT_PRICE_USD = 29;
const PLAN_MIN_SEATS = {
  starter: 5,
  team: 50,
  business: 200,
  enterprise: 500,
} as const;
type PlanKey = keyof typeof PLAN_MIN_SEATS;

const CheckoutBody = z.object({
  plan: z.enum(["starter", "team", "business", "enterprise"]),
  seats: z.number().int().positive().max(100_000).optional(),
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
    const data = await getOrgBilling(ctx.orgId);
    return apiSuccess(data);
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

  const demoBlock = await demoWriteBlock("starting a checkout");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = CheckoutBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid checkout body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const stripe = getStripe();
  if (!stripe) {
    return apiError("Stripe is not configured on this server", "DEGRADED", 503);
  }

  const plan = parsed.data.plan as PlanKey;
  const seats = Math.max(parsed.data.seats ?? PLAN_MIN_SEATS[plan], PLAN_MIN_SEATS[plan]);
  const origin = new URL(req.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: seats * SEAT_PRICE_USD * 100,
            product_data: { name: `${plan} plan — ${seats} seats` },
          },
        },
      ],
      metadata: { orgId: ctx.orgId, plan, seats: String(seats) },
      subscription_data: { metadata: { orgId: ctx.orgId, plan, seats: String(seats) } },
      success_url: `${origin}/org/billing?checkout=success`,
      cancel_url: `${origin}/org/billing?checkout=canceled`,
    });

    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "org_billing_checkout_started",
      target: { type: "org", id: ctx.orgId },
      metadata: { plan, seats, sessionId: session.id },
      req,
    }).catch(() => {});

    return apiSuccess({ url: session.url });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Could not start checkout",
      "INTERNAL_ERROR",
      500,
    );
  }
}
