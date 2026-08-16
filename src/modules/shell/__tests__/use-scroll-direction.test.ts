import { describe, it, expect } from "vitest";
import {
  computeDirection,
  nextNavVisibility,
  HIDE_DOWN_PX,
  REVEAL_UP_PX,
} from "../use-scroll-direction";

describe("modules/shell — bottom-nav visibility logic", () => {
  it("computes scroll direction with hysteresis delta", () => {
    expect(computeDirection(100, 90)).toBe("up");
    expect(computeDirection(100, 110)).toBe("down");
    expect(computeDirection(100, 103)).toBeNull(); // within DELTA
    expect(computeDirection(50, 0)).toBe("top");
  });

  it("hides only after a real scroll-down from the reveal point", () => {
    // Below the threshold → stays visible.
    const stay = nextNavVisibility("visible", 100, 100 + HIDE_DOWN_PX - 1);
    expect(stay.next).toBe("visible");
    // Past the threshold → hides, anchor moves.
    const hide = nextNavVisibility("visible", 100, 100 + HIDE_DOWN_PX);
    expect(hide.next).toBe("hidden");
    expect(hide.anchor).toBe(100 + HIDE_DOWN_PX);
  });

  it("reveals on a small deliberate scroll-up (easier than hiding)", () => {
    expect(REVEAL_UP_PX).toBeLessThan(HIDE_DOWN_PX);
    const stay = nextNavVisibility("hidden", 300, 300 - REVEAL_UP_PX + 1);
    expect(stay.next).toBe("hidden");
    const show = nextNavVisibility("hidden", 300, 300 - REVEAL_UP_PX);
    expect(show.next).toBe("visible");
  });

  it("always reveals at the page top", () => {
    const show = nextNavVisibility("hidden", 200, 0);
    expect(show.next).toBe("visible");
    expect(show.anchor).toBe(0);
  });
});
