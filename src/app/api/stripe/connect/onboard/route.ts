/**
 * POST /api/stripe/connect/onboard — Stripe Connect onboarding
 * (creator economy, 2026-08-17).
 *
 * Auth: required, instructor role only. Body: {}.
 *
 * Returns an account-link URL that walks the instructor through Stripe
 * Connect onboarding for payouts. The Connect account id is persisted on
 * User.stripeAccountId so destination charges + transfers can target it.
 * Calling again while already onboarded issues a fresh (refreshable)
 * account link — per Stripe, account links are single-use.
 *
 * Degrades to a clean 503 when STRIPE_SECRET_KEY is unset (stripe helper
 * returns null).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, ErrorCode } from "@/lib/api-response";
import { createConnectAccountLink } from "@/lib/stripe";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const PAYOUTS_URL = `${SITE_URL}/instructor/payouts`;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "instructor") {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }

  // Body is {} — swallow any unexpected payload so the route stays forgiving.
  await req.json().catch(() => ({}));

  try {
    const link = await createConnectAccountLink({
      userId: user.sub,
      email: user.email,
      refreshUrl: PAYOUTS_URL,
      returnUrl: PAYOUTS_URL,
    });
    if (!link) {
      return apiError(
        "Payments not configured. Please try again later.",
        ErrorCode.SERVICE_UNAVAILABLE,
        503,
      );
    }

    await db.user.update({
      where: { id: user.sub },
      data: { stripeAccountId: link.accountId },
    });

    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "connect_onboard_started",
      target: { type: "user", id: user.sub },
      metadata: { stripeAccountId: link.accountId },
      req,
    });

    return apiSuccess({ url: link.url });
  } catch (err) {
    logger.error("Failed to start Stripe Connect onboarding", {
      userId: user.sub,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Failed to start Stripe onboarding", "INTERNAL_ERROR", 500);
  }
}
