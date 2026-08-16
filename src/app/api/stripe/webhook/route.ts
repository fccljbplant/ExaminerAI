import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/stripe";
import { sendEnrollmentConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";

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

  return NextResponse.json({ received: true });
}
