/**
 * modules/tutor — dock math tests (REDESIGN-P5 W2 exit criteria)
 *
 * Exit criteria under test:
 *  1. "dock persists across reloads" — normalize/denormalize round-trip
 *     keeps the FAB on the same spot (then re-clamps for safety).
 *  2. "never overlaps BottomNav (snapshot test)" — across the P6 device
 *     matrix, no drag target or restored dock ever intersects the
 *     BottomNav or ActionBar rects.
 */

import { describe, expect, it } from "vitest";
import {
  CLEARANCE,
  EDGE_MARGIN,
  FAB_SIZE,
  clampDock,
  defaultDock,
  denormalizeDock,
  fabRect,
  normalizeDock,
  rectsIntersect,
  snapToEdge,
  type Rect,
  type Viewport,
} from "./dock";

/** P6 §1 device matrix. */
const VIEWPORTS: Viewport[] = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 600 },
  { width: 1366, height: 768 },
];

/** BottomNav (xs, 56px + 20px safe area) and ActionBar (~64px sticky). */
function chromeObstacles(vp: Viewport): { bottomNav: Rect; actionBar: Rect } {
  return {
    bottomNav: { x: 0, y: vp.height - 76, width: vp.width, height: 76 },
    actionBar: { x: 0, y: vp.height - 64, width: vp.width, height: 64 },
  };
}

/** Drag targets incl. the adversarial ones: dead-centre of each bar. */
function dragTargets(vp: Viewport) {
  const { bottomNav, actionBar } = chromeObstacles(vp);
  return [
    { x: -200, y: -200 }, // outside top-left
    { x: vp.width + 90, y: vp.height + 90 }, // outside bottom-right
    { x: vp.width / 2, y: bottomNav.y + 10 }, // dropped ON the BottomNav
    { x: 8, y: actionBar.y + 4 }, // dropped ON the ActionBar
    { x: vp.width / 2, y: vp.height / 2 }, // centre
    { x: 4, y: 4 }, // top-left corner
  ];
}

describe("clampDock — never overlaps BottomNav/ActionBar", () => {
  const results: Record<string, unknown> = {};

  for (const vp of VIEWPORTS) {
    const { bottomNav, actionBar } = chromeObstacles(vp);
    const obstacles = [bottomNav, actionBar];

    it(`clears chrome on ${vp.width}x${vp.height}`, () => {
      const cases = dragTargets(vp).map((target) => {
        const clamped = clampDock(target, vp, obstacles);
        const rect = fabRect(clamped);
        expect(rectsIntersect(rect, bottomNav)).toBe(false);
        expect(rectsIntersect(rect, actionBar)).toBe(false);
        // stays inside the viewport (margin respected)
        expect(clamped.x).toBeGreaterThanOrEqual(EDGE_MARGIN);
        expect(clamped.y).toBeGreaterThanOrEqual(EDGE_MARGIN);
        expect(clamped.x + FAB_SIZE).toBeLessThanOrEqual(vp.width - EDGE_MARGIN);
        return { target, clamped };
      });
      results[`${vp.width}x${vp.height}`] = cases;
    });
  }

  it("snapToEdge lands flush on an edge, still clear of chrome", () => {
    for (const vp of VIEWPORTS) {
      const { bottomNav } = chromeObstacles(vp);
      for (const third of [0.2, 0.5, 0.8]) {
        const raw = snapToEdge(
          { x: vp.width * third, y: vp.height - 40 },
          vp
        );
        const safe = clampDock(raw, vp, [bottomNav]);
        expect([EDGE_MARGIN, vp.width - FAB_SIZE - EDGE_MARGIN]).toContain(safe.x);
        expect(rectsIntersect(fabRect(safe), bottomNav)).toBe(false);
      }
    }
  });

  it("default dock rests above the BottomNav on every device", () => {
    for (const vp of VIEWPORTS) {
      const { bottomNav } = chromeObstacles(vp);
      const pos = defaultDock(vp, 76);
      const clamped = clampDock(pos, vp, [bottomNav]);
      expect(rectsIntersect(fabRect(clamped), bottomNav)).toBe(false);
      expect(clamped.y + FAB_SIZE + CLEARANCE).toBeLessThanOrEqual(bottomNav.y);
    }
  });

  it("drag-target matrix matches the archived snapshot", () => {
    expect(results).toMatchSnapshot();
  });
});

describe("dock persistence — survives reloads", () => {
  it("normalize → denormalize round-trips within rounding", () => {
    const vp: Viewport = { width: 390, height: 844 };
    const { bottomNav } = chromeObstacles(vp);
    const original = clampDock({ x: 40, y: 300 }, vp, [bottomNav]);

    const restored = clampDock(denormalizeDock(normalizeDock(original, vp), vp), vp, [bottomNav]);
    expect(Math.abs(restored.x - original.x)).toBeLessThan(1);
    expect(Math.abs(restored.y - original.y)).toBeLessThan(1);
  });

  it("corrupt or out-of-range stored values re-clamp safely", () => {
    const vp: Viewport = { width: 360, height: 640 };
    const obstacles = Object.values(chromeObstacles(vp));
    const junk = [
      { xPct: NaN, yPct: Infinity },
      { xPct: 3, yPct: -2 },
      { xPct: 1, yPct: 1 }, // bottom-right corner — inside the nav zone
    ];
    for (const n of junk) {
      const pos = clampDock(denormalizeDock(n, vp), vp, obstacles);
      for (const obs of obstacles) {
        expect(rectsIntersect(fabRect(pos), obs)).toBe(false);
      }
    }
  });
});
