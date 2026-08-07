import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/** Lazy-init Stripe client. Returns null if STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeInstance = new Stripe(key, { apiVersion: "2024-06-20" as any });
  return stripeInstance;
}

/** Create a Stripe Checkout Session for a course purchase. */
export async function createCheckoutSession(params: {
  courseId: string;
  courseName: string;
  price: number;
  currency: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: params.currency.toLowerCase(),
        product_data: { name: params.courseName },
        unit_amount: Math.round(params.price * 100),
      },
      quantity: 1,
    }],
    metadata: { courseId: params.courseId, userId: params.userId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return { url: session.url!, sessionId: session.id };
}

/** Verify a Stripe webhook signature. */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return null;
  }
}
