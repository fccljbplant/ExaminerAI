/**
 * Tests for src/modules/shell/use-scroll-direction.ts (pure direction logic).
 *
 * The hook itself is a thin scroll-listener wrapper; all decision
 * behaviour lives in computeDirection so it is testable without a DOM.
 */

import { describe, it, expect } from "vitest";
import { computeDirection } from "./use-scroll-direction";

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
