/**
 * modules/payments/lib/coupons.ts — coupon domain (2026-08-17)
 *
 * Pure validation + price math for coupon codes. DB access lives in the
 * route handlers; this module stays deterministic and unit-testable.
 */

export interface CouponLike {
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  courseId: string | null;
  orgId: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: Date | null;
}

export interface CouponValidation {
  ok: boolean;
  coupon?: CouponLike;
  error?: string;
}

/** Validate a coupon for a course purchase at a given moment. */
export function validateCoupon(
  coupon: CouponLike | null | undefined,
  courseId: string,
  now: Date = new Date(),
): CouponValidation {
  if (!coupon) return { ok: false, error: "Unknown coupon code" };
  if (!coupon.active) return { ok: false, error: "This coupon is no longer active" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: "This coupon has expired" };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "This coupon has reached its usage limit" };
  }
  if (coupon.courseId && coupon.courseId !== courseId) {
    return { ok: false, error: "This coupon doesn't apply to that course" };
  }
  return { ok: true, coupon };
}

/** Compute the discounted unit price (never below zero). */
export function applyCoupon(price: number, coupon: CouponLike): number {
  let discounted = price;
  if (coupon.percentOff) {
    discounted = price * (1 - coupon.percentOff / 100);
  } else if (coupon.amountOff) {
    discounted = price - coupon.amountOff;
  }
  return Math.max(0, Math.round(discounted * 100) / 100);
}
