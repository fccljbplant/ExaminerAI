import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/stripe";
import { sendEnrollmentConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";

/** Shape shared by the invoice events we handle (B2B subscriptions). */
interface StripeInvoiceLike {
  id?: string;
  subscription?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string;
  period_start?: number | null;
  period_end?: number | null;
  metadata?: Record<string, string | null>;
  subscription_details?: { metadata?: Record<string, string | null> } | null;
}

/** Resolve { orgId, plan, seats } for a subscription invoice. The orgId
 *  rides in subscription metadata (checkout set subscription_data.metadata);
 *  when missing we fall back to the Subscription row by Stripe id. */
async function resolveOrgFromInvoice(invoice: StripeInvoiceLike): Promise<{
  orgId: string;
  plan: string;
  seats: number;
} | null> {
  const meta = invoice.subscription_details?.metadata ?? {};
  let orgId = meta.orgId ?? null;
  if (!orgId && invoice.subscription) {
    const sub = await db.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
      select: { orgId: true, plan: true, seats: true },
    });
    if (sub) return { orgId: sub.orgId, plan: meta.plan ?? sub.plan, seats: Number(meta.seats ?? sub.seats) };
    return null;
  }
  if (!orgId) return null;
  return { orgId, plan: meta.plan ?? "team", seats: Number(meta.seats ?? 5) };
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  const event = verifyWebhookSignature(payload, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id?: string;
      payment_intent?: string | null;
      amount_total?: number | null;
      metadata?: { courseId?: string; userId?: string; couponCode?: string };
    };
    const courseId = session.metadata?.courseId;
    const userId = session.metadata?.userId;

    if (courseId && userId) {
      try {
        // Check if already enrolled (idempotent)
        const existing = await db.courseEnrollment.findFirst({
          where: { userId, courseId, role: "student" },
        });
        if (!existing) {
          const course = await db.course.findUnique({
            where: { id: courseId },
            select: { name: true, price: true, currency: true, ownerUserId: true },
          });

          await db.courseEnrollment.create({
            data: { userId, courseId, role: "student" },
          });

          // Record payment — attributed to the course owner (creator
          // economy, 2026-08-17). Legacy courses without an owner keep
          // the course-level aggregates only.
          if (course && course.price > 0) {
            const amount = session.amount_total ? session.amount_total / 100 : course.price;
            const platformFee = Math.round(amount * 0.20 * 100) / 100;
            const instructorShare = Math.round(amount * 0.80 * 100) / 100;
            await db.payment.create({
              data: {
                userId,
                courseId,
                amount,
                currency: course.currency,
                platformFee,
                instructorShare,
                status: "completed",
                stripeSessionId: session.id ?? null,
                stripePaymentIntentId: session.payment_intent ?? null,
                instructorId: course.ownerUserId ?? null,
              },
            });
            await db.course.update({
              where: { id: courseId },
              data: { instructorEarnings: { increment: instructorShare }, platformFee: { increment: platformFee }, enrollmentCount: { increment: 1 } },
            });
            // Coupon usage accounting (best-effort — never blocks the webhook).
            const couponCode = session.metadata?.couponCode?.trim().toUpperCase();
            if (couponCode) {
              await db.coupon
                .update({ where: { code: couponCode }, data: { usedCount: { increment: 1 } } })
                .catch(() => {});
            }
          }

          // Send notification
          if (course) {
            void sendEnrollmentConfirmation(userId, course.name, courseId).catch((err) => { logger.warn("Operation failed", { err }); });
          }
        }
      } catch (e) {
        logger.error("[stripe webhook] Error processing payment", { error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // Refund handling (2026-08-17): reverse the payment + course aggregates.
  if (event.type === "charge.refunded") {
    const charge = event.data.object as { payment_intent?: string | null; refunded?: boolean };
    const intentId = charge.payment_intent;
    if (intentId) {
      try {
        const payment = await db.payment.findFirst({
          where: { stripePaymentIntentId: intentId, status: "completed" },
        });
        if (payment) {
          await db.payment.update({
            where: { id: payment.id },
            data: { status: "refunded", refundedAt: new Date() },
          });
          await db.course.update({
            where: { id: payment.courseId },
            data: {
              instructorEarnings: { decrement: payment.instructorShare },
              platformFee: { decrement: payment.platformFee },
            },
          });
        }
      } catch (e) {
        logger.error("[stripe webhook] Error processing refund", { error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // ── B2B seat subscriptions (2026-08-17) ──────────────────────────────
  // invoice.paid: activate/refresh Subscription + OrgInvoice and sync the
  // Organization's seats/status (trial → active). Idempotent upserts.

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const paid = event.type === "invoice.paid";
    const invoice = event.data.object as StripeInvoiceLike;
    try {
      const resolved = await resolveOrgFromInvoice(invoice);
      if (resolved) {
        const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : null;
        const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : null;

        await db.subscription.upsert({
          where: { orgId: resolved.orgId },
          update: {
            stripeSubscriptionId: invoice.subscription ?? undefined,
            plan: resolved.plan,
            seats: resolved.seats,
            status: paid ? "active" : "past_due",
            currentPeriodEnd: periodEnd ?? undefined,
          },
          create: {
            orgId: resolved.orgId,
            stripeSubscriptionId: invoice.subscription ?? null,
            plan: resolved.plan,
            seats: resolved.seats,
            status: paid ? "active" : "past_due",
            currentPeriodEnd: periodEnd,
          },
        });

        const invoiceData = {
          orgId: resolved.orgId,
          subscriptionId: invoice.subscription ?? null,
          amount: (paid ? invoice.amount_paid : invoice.amount_due) ?? 0,
          currency: invoice.currency ?? "usd",
          status: paid ? "paid" : "past_due",
          periodStart,
          periodEnd,
        };
        const existingInvoice = invoice.id
          ? await db.orgInvoice.findFirst({ where: { stripeInvoiceId: invoice.id } })
          : null;
        if (existingInvoice) {
          await db.orgInvoice.update({ where: { id: existingInvoice.id }, data: invoiceData });
        } else {
          await db.orgInvoice.create({
            data: { ...invoiceData, stripeInvoiceId: invoice.id ?? null },
          });
        }

        if (paid) {
          await db.organization.update({
            where: { id: resolved.orgId },
            data: { seats: resolved.seats, status: "active" },
          });
        }
      }
    } catch (e) {
      logger.error("[stripe webhook] Error processing subscription invoice", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as {
      id?: string;
      metadata?: Record<string, string | null>;
    };
    try {
      const meta = subscription.metadata ?? {};
      let orgId = meta.orgId ?? null;
      if (!orgId && subscription.id) {
        const existing = await db.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { orgId: true },
        });
        orgId = existing?.orgId ?? null;
      }
      if (orgId) {
        await db.subscription.update({
          where: { orgId },
          data: { status: "canceled" },
        });
      }
    } catch (e) {
      logger.error("[stripe webhook] Error processing subscription deletion", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ received: true });
}
