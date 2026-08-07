import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://examiner-ai-tau.vercel.app";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { courseId } = body as { courseId?: string };
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, price: true, currency: true, published: true },
  });
  if (!course || !course.published) {
    return NextResponse.json({ error: "Course not available" }, { status: 404 });
  }
  if (course.price === 0) {
    return NextResponse.json({ error: "This course is free — no payment needed" }, { status: 400 });
  }

  const session = await createCheckoutSession({
    courseId: course.id,
    courseName: course.name,
    price: course.price,
    currency: course.currency,
    userId: user.id,
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
