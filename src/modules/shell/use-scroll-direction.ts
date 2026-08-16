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
/** Downward scroll needed (from the reveal point) before hiding —
 *  deliberately generous so the nav only tucks on a real scroll-down. */
export const HIDE_DOWN_PX = 56;
/** Upward scroll needed (from the hide point) before revealing —
 *  small, so a light flick up brings it straight back. */
export const REVEAL_UP_PX = 24;
/** Distance from the page bottom that always reveals the nav. */
export const BOTTOM_REVEAL_PX = 96;

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

/**
 * Bottom-nav visibility with hysteresis — no blink on jitter — plus
 * hard guarantees that the nav NEVER goes missing when it is needed:
 *
 *   - any touch on the page reveals it (the user is interacting)
 *   - reaching the bottom of the page reveals it
 *   - back/forward (bfcache restores scroll WITHOUT a scroll event)
 *     reveals it via `pageshow`
 *   - focusing an input or a resize/orientation change reveals it
 *
 * Route changes are handled by the shell: it remounts the nav (keyed
 * by pathname) so every page starts with the nav visible.
 *
 * Hiding is a convenience (more reading room), never a trap.
 */
export function useNavVisibility(): NavVisibility {
  const [visibility, setVisibility] = useState<NavVisibility>("visible");
  const anchorRef = useRef(0);
  const visibilityRef = useRef<NavVisibility>("visible");

  useEffect(() => {
    let lastCall = 0;

    const show = () => {
      if (visibilityRef.current === "visible") {
        anchorRef.current = window.scrollY;
        return;
      }
      visibilityRef.current = "visible";
      anchorRef.current = window.scrollY;
      setVisibility("visible");
    };

    const onScroll = () => {
      const now = Date.now();
      if (now - lastCall < THROTTLE_MS) return;
      lastCall = now;

      const y = window.scrollY;
      // End of the page always reveals the nav.
      const doc = document.documentElement;
      if (y + window.innerHeight >= doc.scrollHeight - BOTTOM_REVEAL_PX) {
        show();
        return;
      }

      const { next, anchor } = nextNavVisibility(
        visibilityRef.current,
        anchorRef.current,
        y,
      );
      if (next !== visibilityRef.current) {
        visibilityRef.current = next;
        setVisibility(next);
      }
      anchorRef.current = anchor;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Back/forward (bfcache) restores scroll WITHOUT firing a scroll
    // event — without this the nav would stay hidden after Back.
    window.addEventListener("pageshow", show);
    // Any touch brings the nav back — the user is interacting.
    document.addEventListener("touchstart", show, { passive: true, capture: true });
    // Focusing an input (keyboard opens) reveals the nav.
    document.addEventListener("focusin", show);
    // Rotation / address-bar resize re-reveals instead of trapping.
    window.addEventListener("resize", show);
    window.addEventListener("orientationchange", show);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pageshow", show);
      document.removeEventListener("touchstart", show, { capture: true });
      document.removeEventListener("focusin", show);
      window.removeEventListener("resize", show);
      window.removeEventListener("orientationchange", show);
    };
  }, []);

  return visibility;
}
