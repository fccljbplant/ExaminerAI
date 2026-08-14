/**
 * modules/tutor — dock layout math (REDESIGN-P5 W2, P6 §2)
 *
 * Pure functions that decide where the FloatingTutor FAB may sit.
 * Guarantees (exit criteria): the FAB rect never intersects the
 * BottomNav or ActionBar rects, and the docked position survives
 * reloads via normalized (percentage) coordinates.
 *
 * Everything here is DOM-free so it can be unit-tested and reused
 * by the drag handler, the resize handler and the persistence layer.
 */

/** FAB edge length — matches the ≥44px tap-target mandate. */
export const FAB_SIZE = 56;
/** Gap kept between the FAB and viewport edges / obstacles. */
export const EDGE_MARGIN = 12;
/** Extra breathing room above an obstacle before the FAB rests. */
export const CLEARANCE = 8;

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Dock position persisted to localStorage (viewport-independent). */
export interface NormalizedDock {
  xPct: number;
  yPct: number;
}

/** The FAB rect for a given top-left position. */
export function fabRect(pos: Point, size: number = FAB_SIZE): Rect {
  return { x: pos.x, y: pos.y, width: size, height: size };
}

/** True when two rects overlap (strictly — touching edges is fine). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Clamp a FAB position into the viewport and lift it above any
 * obstacle (BottomNav / ActionBar) it would overlap. Obstacles are
 * bottom-anchored chrome bars, so the only escape direction is up.
 */
export function clampDock(
  pos: Point,
  viewport: Viewport,
  obstacles: Rect[],
  size: number = FAB_SIZE
): Point {
  let x = Math.min(Math.max(pos.x, EDGE_MARGIN), viewport.width - size - EDGE_MARGIN);
  let y = Math.min(Math.max(pos.y, EDGE_MARGIN), viewport.height - size - EDGE_MARGIN);

  for (const obs of obstacles) {
    const candidate = fabRect({ x, y }, size);
    const padded: Rect = {
      x: obs.x,
      y: obs.y - CLEARANCE,
      width: obs.width,
      height: obs.height + CLEARANCE,
    };
    if (rectsIntersect(candidate, padded)) {
      y = Math.min(y, obs.y - size - CLEARANCE);
    }
  }

  // Lifting may push above the viewport on absurdly small screens —
  // the viewport margin wins last (a FAB half-hidden beats an overlap).
  y = Math.max(y, EDGE_MARGIN);
  return { x, y };
}

/** Snap a released FAB to the nearest horizontal edge. */
export function snapToEdge(pos: Point, viewport: Viewport, size: number = FAB_SIZE): Point {
  const center = pos.x + size / 2;
  return center < viewport.width / 2
    ? { x: EDGE_MARGIN, y: pos.y }
    : { x: viewport.width - size - EDGE_MARGIN, y: pos.y };
}

/** Resting position before the user ever drags: above the nav, right. */
export function defaultDock(viewport: Viewport, bottomNavHeight: number): Point {
  return {
    x: viewport.width - FAB_SIZE - EDGE_MARGIN,
    y: Math.max(EDGE_MARGIN, viewport.height - bottomNavHeight - CLEARANCE - FAB_SIZE),
  };
}

/** Convert an absolute dock point into viewport-independent storage. */
export function normalizeDock(pos: Point, viewport: Viewport): NormalizedDock {
  return {
    xPct: clamp01(pos.x / viewport.width),
    yPct: clamp01(pos.y / viewport.height),
  };
}

/** Reverse of normalizeDock — re-clamped by the caller via clampDock. */
export function denormalizeDock(n: NormalizedDock, viewport: Viewport): Point {
  return {
    x: clamp01(n.xPct) * viewport.width,
    y: clamp01(n.yPct) * viewport.height,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
