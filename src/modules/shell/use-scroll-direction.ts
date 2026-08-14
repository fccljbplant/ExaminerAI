"use client";

import { useEffect, useState } from "react";

/**
 * modules/shell — useScrollDirection (mobile comfort)
 *
 * Tracks whether the user is scrolling up, down, or sitting at the
 * top of the page. Powers the BottomNav hide-on-scroll behaviour:
 * scrolling down tucks the nav away for reading space, scrolling up
 * (or resting near the top) brings it back.
 *
 * SSR-safe: first paint reports "top" so the nav is visible until the
 * page hydrates. A small 8px delta + rAF throttling keeps direction
 * changes jitter-free on touch scroll.
 */

export type ScrollDirection = "top" | "up" | "down";

const DELTA = 8;
/** ~20fps throttle. Uses Date.now() — NOT performance.now() (some
 *  sandboxed webviews zero the high-res timer, which would make the
 *  throttle gate fire every scroll) and NOT requestAnimationFrame
 *  (throttled in occluded frames). Scroll events themselves still
 *  fire in both environments. */
const THROTTLE_MS = 50;

/** Pure direction decision — unit-tested; the hook is a thin wrapper. */
export function computeDirection(lastY: number, y: number): ScrollDirection | null {
  if (y <= 0) return "top";
  if (y < lastY - DELTA) return "up";
  if (y > lastY + DELTA) return "down";
  return null;
}

export function useScrollDirection(): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("top");

  useEffect(() => {
    let lastY = window.scrollY;
    let lastCall = 0;

    const update = () => {
      const next = computeDirection(lastY, window.scrollY);
      if (next) setDirection(next);
      lastY = window.scrollY;
    };

    const onScroll = () => {
      const now = Date.now();
      if (now - lastCall < THROTTLE_MS) return;
      lastCall = now;
      update();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return direction;
}
