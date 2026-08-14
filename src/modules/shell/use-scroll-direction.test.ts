/**
 * Tests for src/modules/shell/use-scroll-direction.ts (pure direction logic).
 *
 * The hook itself is a thin scroll-listener wrapper; all decision
 * behaviour lives in computeDirection so it is testable without a DOM.
 */

import { describe, it, expect } from "vitest";
import { computeDirection, nextNavVisibility } from "./use-scroll-direction";

describe("computeDirection", () => {
  it("returns top at the page top regardless of lastY", () => {
    expect(computeDirection(400, 0)).toBe("top");
    expect(computeDirection(10, -5)).toBe("top");
    expect(computeDirection(0, 0)).toBe("top");
  });

  it("returns down when scrolling down past the 8px delta", () => {
    expect(computeDirection(0, 179)).toBe("down");
    expect(computeDirection(100, 120)).toBe("down");
  });

  it("returns up when scrolling up past the 8px delta", () => {
    expect(computeDirection(179, 20)).toBe("up");
    expect(computeDirection(200, 180)).toBe("up");
  });

  it("treats arrival at the very top as top (nav shows), not up", () => {
    expect(computeDirection(179, 0)).toBe("top");
  });

  it("returns null for sub-delta jitter (no direction flip)", () => {
    expect(computeDirection(100, 104)).toBeNull();
    expect(computeDirection(100, 97)).toBeNull();
    expect(computeDirection(100, 100)).toBeNull();
  });
});

describe("nextNavVisibility (hysteresis — no blink)", () => {
  it("stays visible for small downward jitter below the hide threshold", () => {
    expect(nextNavVisibility("visible", 100, 118)).toEqual({ next: "visible", anchor: 100 });
  });

  it("hides only after scrolling down ≥ HIDE_DOWN_PX from the reveal point", () => {
    const r = nextNavVisibility("visible", 100, 126);
    expect(r).toEqual({ next: "hidden", anchor: 126 });
  });

  it("stays hidden for small upward jitter below the reveal threshold", () => {
    expect(nextNavVisibility("hidden", 300, 280)).toEqual({ next: "hidden", anchor: 300 });
  });

  it("reveals after scrolling up ≥ REVEAL_UP_PX from the hide point", () => {
    const r = nextNavVisibility("hidden", 300, 258);
    expect(r).toEqual({ next: "visible", anchor: 258 });
  });

  it("reveals at the page top from any state", () => {
    expect(nextNavVisibility("hidden", 500, 0)).toEqual({ next: "visible", anchor: 0 });
    expect(nextNavVisibility("visible", 200, -4)).toEqual({ next: "visible", anchor: 0 });
  });

  it("keeps the anchor when a state decision is rejected", () => {
    expect(nextNavVisibility("hidden", 300, 262).anchor).toBe(300);
    expect(nextNavVisibility("visible", 100, 120).anchor).toBe(100);
  });
});
