import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";
import { validateCoupon, applyCoupon } from "@/modules/payments/lib/coupons";
import { logger } from "@/lib/logger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://examiner-ai-tau.vercel.app";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Demo accounts must never create real Stripe payment sessions —
  // their courses live in the local demo db only.
  if (user.email?.toLowerCase().endsWith("@demo.ai")) {
    return NextResponse.json(
      { error: "Demo accounts can't purchase courses. Create a real account to enroll." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { courseId, couponCode } = body as { courseId?: string; couponCode?: string };
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      price: true,
      currency: true,
      published: true,
      ownerUserId: true,
      owner: { select: { stripeAccountId: true } },
    },
  });
  if (!course || !course.published) {
    return NextResponse.json({ error: "Course not available" }, { status: 404 });
  }
  if (course.price === 0) {
    return NextResponse.json({ error: "This course is free — no payment needed" }, { status: 400 });
  }

  // Coupon (2026-08-17): validate + discount before the Stripe session.
  let unitAmount = course.price;
  if (couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    const validation = validateCoupon(coupon, course.id);
    if (!validation.ok || !validation.coupon) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    unitAmount = applyCoupon(course.price, validation.coupon);
  }

  const session = await createCheckoutSession({
    courseId: course.id,
    courseName: course.name,
    price: course.price,
    currency: course.currency,
    userId: user.id,
    unitAmountOverride: unitAmount,
    // Destination charge when the creator has onboarded with Connect —
    // their 80% share goes straight to their connected account.
    transferDestination: course.owner?.stripeAccountId ?? null,
    couponCode: couponCode ?? null,
    successUrl: `${SITE_URL}/courses/${course.id}?paid=1`,
    cancelUrl: `${SITE_URL}/courses/${course.id}?paid=0`,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Payments not configured. Please try again later or contact support." },
      { status: 503 }
    );
  }

  return NextResponse.json({ url: session.url, sessionId: session.sessionId });
}
