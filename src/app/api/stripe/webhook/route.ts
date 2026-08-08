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
    const session = event.data.object as any;
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
            select: { name: true, price: true, currency: true },
          });

          await db.courseEnrollment.create({
            data: { userId, courseId, role: "student" },
          });

          // Record payment
          if (course && course.price > 0) {
            const platformFee = Math.round(course.price * 0.20 * 100) / 100;
            const instructorShare = Math.round(course.price * 0.80 * 100) / 100;
            await db.payment.create({
              data: { userId, courseId, amount: course.price, currency: course.currency, platformFee, instructorShare, status: "completed" },
            });
            await db.course.update({
              where: { id: courseId },
              data: { instructorEarnings: { increment: instructorShare }, platformFee: { increment: platformFee }, enrollmentCount: { increment: 1 } },
            });
          }

          // Send notification
          if (course) {
            void sendEnrollmentConfirmation(userId, course.name, courseId).catch((err) => { logger.warn("Operation failed", { err }); });
          }
        }
      } catch (e) {
        console.error("[stripe webhook] Error processing payment:", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
