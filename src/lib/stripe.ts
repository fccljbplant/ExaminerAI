import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/** Lazy-init Stripe client. Returns null if STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeInstance = new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  return stripeInstance;
}

/** Create a Stripe Checkout Session for a course purchase.
 *  Creator economy (2026-08-17): when the course owner has completed
 *  Stripe Connect onboarding, the charge becomes a DESTINATION charge
 *  (transfer_data) so the owner's 80% share goes straight to them.
 *  `unitAmountOverride` carries a coupon-discounted price. */
export async function createCheckoutSession(params: {
  courseId: string;
  courseName: string;
  price: number;
  currency: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  unitAmountOverride?: number;
  transferDestination?: string | null;
  couponCode?: string | null;
}): Promise<{ url: string; sessionId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: params.currency.toLowerCase(),
        product_data: { name: params.courseName },
        unit_amount: Math.round((params.unitAmountOverride ?? params.price) * 100),
      },
      quantity: 1,
    }],
    metadata: {
      courseId: params.courseId,
      userId: params.userId,
      couponCode: params.couponCode ?? "",
    },
    ...(params.transferDestination
      ? {
          payment_intent_data: {
            transfer_data: { destination: params.transferDestination },
          },
        }
      : {}),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return { url: session.url!, sessionId: session.id };
}

/** Create a Stripe Connect onboarding account link for a creator. */
export async function createConnectAccountLink(params: {
  userId: string;
  email: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ url: string; accountId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const account = await stripe.accounts.create({
    type: "express",
    email: params.email,
    metadata: { userId: params.userId },
  });
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
  return { url: link.url, accountId: account.id };
}

/** Pay out a creator's available balance via a Connect transfer. */
export async function createPayoutTransfer(params: {
  stripeAccountId: string;
  amountUsd: number;
  description: string;
}): Promise<{ transferId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const transfer = await stripe.transfers.create({
    amount: Math.round(params.amountUsd * 100),
    currency: "usd",
    destination: params.stripeAccountId,
    description: params.description,
  });
  return { transferId: transfer.id };
}

/** Refund a payment intent (full refund) — platform refund flow. */
export async function refundPaymentIntent(paymentIntentId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    return true;
  } catch {
    return false;
  }
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
