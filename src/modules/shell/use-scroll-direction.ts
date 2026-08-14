"use client";

import { useEffect, useRef, useState } from "react";

/**
 * modules/shell — useScrollDirection / useNavVisibility (mobile comfort)
 *
 * Tracks scroll direction + bottom-nav visibility with HYSTERESIS so
 * the nav never "blinks":
 *   - hides only after scrolling DOWN ≥ HIDE_DOWN_PX from the point
 *     where it last became visible (jitter-safe)
 *   - reveals only after scrolling UP ≥ REVEAL_UP_PX from the point
 *     where it hid, or on reaching the page top
 *
 * Time-throttled with Date.now() (NOT performance.now — some sandboxed
 * webviews zero the high-res timer; NOT requestAnimationFrame — it is
 * throttled in occluded frames). Scroll events themselves fire in
 * both environments.
 */

export type ScrollDirection = "top" | "up" | "down";
export type NavVisibility = "visible" | "hidden";

const DELTA = 8;
const THROTTLE_MS = 50;
/** Downward scroll needed (from the reveal point) before hiding. */
export const HIDE_DOWN_PX = 24;
/** Upward scroll needed (from the hide point) before revealing. */
export const REVEAL_UP_PX = 40;

/** Pure direction decision — unit-tested; the hooks are thin wrappers. */
export function computeDirection(lastY: number, y: number): ScrollDirection | null {
  if (y <= 0) return "top";
  if (y < lastY - DELTA) return "up";
  if (y > lastY + DELTA) return "down";
  return null;
}

/**
 * Pure hysteresis step. `anchor` is the scrollY where the current
 * visibility state was decided; returns the next state + anchor.
 */
export function nextNavVisibility(
  prev: NavVisibility,
  anchor: number,
  y: number,
): { next: NavVisibility; anchor: number } {
  if (y <= 0) return { next: "visible", anchor: 0 };
  if (prev === "visible") {
    if (y - anchor >= HIDE_DOWN_PX) return { next: "hidden", anchor: y };
    return { next: "visible", anchor };
  }
  if (anchor - y >= REVEAL_UP_PX) return { next: "visible", anchor: y };
  return { next: "hidden", anchor };
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

/** Bottom-nav visibility with hysteresis — no blink on jitter. */
export function useNavVisibility(): NavVisibility {
  const [visibility, setVisibility] = useState<NavVisibility>("visible");
  const anchorRef = useRef(0);
  const visibilityRef = useRef<NavVisibility>("visible");

  useEffect(() => {
    let lastCall = 0;

    const onScroll = () => {
      const now = Date.now();
      if (now - lastCall < THROTTLE_MS) return;
      lastCall = now;

      const { next, anchor } = nextNavVisibility(
        visibilityRef.current,
        anchorRef.current,
        window.scrollY,
      );
      if (next !== visibilityRef.current) {
        visibilityRef.current = next;
        setVisibility(next);
      }
      anchorRef.current = anchor;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visibility;
}
