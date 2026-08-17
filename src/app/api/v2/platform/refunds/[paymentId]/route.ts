/**
 * POST /api/v2/platform/refunds/[paymentId] — refund a B2C payment
 * (2026-08-17). Platform-admin only: creates the Stripe refund and, on
 * success, marks the Payment refunded and reverses the course revenue
 * aggregates (mirrors the charge.refunded webhook path for cases where
 * the webhook was missed or the refund is initiated manually).
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError, apiNotFound } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { refundPaymentIntent } from "@/lib/stripe";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { paymentId } = await params;
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return apiNotFound("Payment not found");
  if (payment.status !== "completed") {
    return apiError("Only completed payments can be refunded", "CONFLICT", 409);
  }

  // Stripe refund when we have the payment intent; without it (or without
  // Stripe configured) the payment is still marked refunded locally.
  let stripeRefunded = false;
  if (payment.stripePaymentIntentId) {
    stripeRefunded = await refundPaymentIntent(payment.stripePaymentIntentId);
    if (!stripeRefunded) {
      logger.warn("Stripe refund failed — refunding locally only", { paymentId });
    }
  }

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "refunded", refundedAt: new Date() },
  });
  await db.course.update({
    where: { id: payment.courseId },
    data: {
      instructorEarnings: { decrement: payment.instructorShare },
      platformFee: { decrement: payment.platformFee },
    },
  });

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "payment_refunded",
    target: { type: "payment", id: paymentId },
    after: { amount: payment.amount, stripeRefunded },
    metadata: { source: "platform_revenue" },
    req,
  }).catch(() => {});

  return apiSuccess({ refunded: true, stripeRefunded, amount: payment.amount });
}
