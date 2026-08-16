import { describe, it, expect } from "vitest";
import { validateCoupon, applyCoupon, type CouponLike } from "../coupons";

function coupon(overrides: Partial<CouponLike> = {}): CouponLike {
  return {
    code: "SAVE10",
    percentOff: 10,
    amountOff: null,
    courseId: null,
    orgId: null,
    maxUses: null,
    usedCount: 0,
    active: true,
    expiresAt: null,
    ...overrides,
  };
}

describe("coupons", () => {
  it("accepts an active, unexpired coupon", () => {
    const r = validateCoupon(coupon(), "c1");
    expect(r.ok).toBe(true);
  });

  it("rejects an inactive coupon", () => {
    expect(validateCoupon(coupon({ active: false }), "c1").ok).toBe(false);
  });

  it("rejects an expired coupon", () => {
    const r = validateCoupon(coupon({ expiresAt: new Date("2020-01-01") }), "c1");
    expect(r.ok).toBe(false);
  });

  it("rejects when maxUses is exhausted", () => {
    const r = validateCoupon(coupon({ maxUses: 5, usedCount: 5 }), "c1");
    expect(r.ok).toBe(false);
  });

  it("rejects a course-scoped coupon on another course", () => {
    const r = validateCoupon(coupon({ courseId: "c2" }), "c1");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/doesn't apply/);
  });

  it("computes percent and amount discounts, never negative", () => {
    expect(applyCoupon(100, coupon({ percentOff: 20 }))).toBe(80);
    expect(applyCoupon(100, coupon({ percentOff: null, amountOff: 30 }))).toBe(70);
    expect(applyCoupon(10, coupon({ percentOff: null, amountOff: 30 }))).toBe(0);
  });
});
