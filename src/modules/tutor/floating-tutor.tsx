"use client";

/**
 * modules/tutor — FloatingTutor (REDESIGN-P2 §1.5, P3 §1, W2)
 *
 * The draggable, dockable tutor FAB present on every portal screen:
 *
 *  - position persisted as normalized coords (zustand persist) — the
 *    dock survives reloads (W2 exit criterion);
 *  - drag with pointer capture, edge-snap on release, click vs drag
 *    disambiguated by a 6px threshold;
 *  - obstacle measurement (BottomNav / ActionBar via data-slot) feeds
 *    clampDock, so the FAB never covers bottom chrome (P6 §2);
 *  - badge dot for pending tutor offers (fed by W3 study-flow);
 *  - aria-live announcements for open/close + rig state (P6 §4);
 *  - every drag has a button equivalent: the panel's edge-flip moves
 *    the dock left/right (P6 §3 gesture parity).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { TutorPanel } from "./tutor-panel";
import { useTutorStore, type TutorState } from "./tutor-store";
import {
  FAB_SIZE,
  clampDock,
  defaultDock,
  denormalizeDock,
  normalizeDock,
  snapToEdge,
  type Point,
  type Rect,
  type Viewport,
} from "./lib/dock";

/** Pointer must move more than this before a tap becomes a drag. */
const DRAG_THRESHOLD = 6;
/** Default BottomNav allowance until it measures (xs 56px row). */
const DEFAULT_NAV_HEIGHT = 56;

const LIVE_TEXT: Record<TutorState, string> = {
  idle: "Tutor ready",
  listening: "Tutor is listening",
  thinking: "Tutor is thinking",
  speaking: "Tutor is replying",
};

interface Frame {
  viewport: Viewport;
  obstacles: Rect[];
  /** Height of the tallest bottom-anchored chrome bar (0 at md+). */
  chromeHeight: number;
}

function measureFrame(): Frame {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const obstacles: Rect[] = [];
  let chromeHeight = 0;

  for (const slot of ["bottom-nav", "action-bar"] as const) {
    const el = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    // Only chrome that actually sits at the viewport bottom blocks us.
    // Tolerance is generous: embedded browser panels can leave a gap of
    // ~10px between the fixed nav and the viewport edge.
    if (rect.height > 0 && rect.bottom >= viewport.height - 24) {
      obstacles.push({ x: 0, y: rect.top, width: viewport.width, height: rect.height });
      chromeHeight = Math.max(chromeHeight, rect.height);
    }
  }
  return { viewport, obstacles, chromeHeight };
}

export function FloatingTutor() {
  const pathname = usePathname();
  const dock = useTutorStore((s) => s.dock);
  const open = useTutorStore((s) => s.open);
  const badge = useTutorStore((s) => s.badge);
  const state = useTutorStore((s) => s.state);
  const { setDock, setOpen, setBadge } = useTutorStore();

  const [frame, setFrame] = useState<Frame | null>(null);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const dragRef = useRef<{ start: Point; grab: Point; moved: boolean } | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  // Re-measure on mount, resize, and route change (ActionBar comes
  // and goes per page). Measurement itself happens in event
  // callbacks; the effect only subscribes.
  useLayoutEffect(() => {
    const measure = () => setFrame(measureFrame());
    measure(); // mount (first paint uses the null-frame fallback)
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  // Announce open/close + rig state to screen readers.
  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = open ? `Tutor opened. ${LIVE_TEXT[state]}` : LIVE_TEXT[state];
    }
  }, [open, state]);

  // Reset any previously persisted dock so the FAB always starts at
  // the default position: bottom-right, above the bottom nav.
  // useLayoutEffect avoids a flash of the stale position.
  useLayoutEffect(() => {
    setDock(null);
  }, [setDock]);

  // Close the panel when the user navigates to a different route.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      if (open) setOpen(false);
    }
  }, [pathname, open, setOpen]);

  const resolvePos = useCallback((): Point => {
    if (!frame) return { x: -9999, y: -9999 };
    const base = dock
      ? denormalizeDock(dock, frame.viewport)
      : defaultDock(frame.viewport, frame.chromeHeight || DEFAULT_NAV_HEIGHT);
    return clampDock(base, frame.viewport, frame.obstacles);
  }, [frame, dock]);

  const pos = dragPos ?? resolvePos();
  const edge: "left" | "right" = pos.x + FAB_SIZE / 2 < (frame?.viewport.width ?? 360) / 2 ? "left" : "right";

  /* ---- drag handlers ------------------------------------------- */

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      start: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - pos.x, y: e.clientY - pos.y },
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || !frame) return;
    const dx = e.clientX - drag.start.x;
    const dy = e.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setDragPos({ x: e.clientX - drag.grab.x, y: e.clientY - drag.grab.y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !frame) return;

    if (!drag.moved) {
      // Plain tap → open the panel (and consume the unread badge).
      setOpen(true);
      if (badge > 0) setBadge(0);
      setDragPos(null);
      return;
    }

    const raw = { x: e.clientX - drag.grab.x, y: e.clientY - drag.grab.y };
    const settled = clampDock(snapToEdge(raw, frame.viewport), frame.viewport, frame.obstacles);
    setDock(normalizeDock(settled, frame.viewport));
    setDragPos(null);
  };

  /** Button equivalent of dragging to the opposite edge (P6 §3). */
  const flipEdge = () => {
    if (!frame) return;
    const current = resolvePos();
    const mirrored = {
      x: frame.viewport.width - FAB_SIZE - current.x,
      y: current.y,
    };
    const settled = clampDock(snapToEdge(mirrored, frame.viewport), frame.viewport, frame.obstacles);
    setDock(normalizeDock(settled, frame.viewport));
  };

  if (!frame) return null;

  return (
    <>
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      <button
        type="button"
        aria-label={badge > 0 ? `Open AI tutor (${badge} new)` : "Open AI tutor"}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragPos(null);
        }}
        className={`fixed z-tutor flex items-center justify-center rounded-full border-2 border-[var(--tutor-ring)] bg-[var(--tutor-fab)] shadow-elev-2 transition-shadow hover:shadow-elev-3 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        } ${dragPos ? "cursor-grabbing" : "cursor-grab touch-none"}`}
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          left: 0,
          top: 0,
        }}
      >
        <Sparkles className="h-6 w-6 text-[var(--on-brand)]" aria-hidden />
        {badge > 0 && !open && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-on ring-2 ring-bg"
            aria-hidden
          >
            {Math.min(badge, 9)}
          </span>
        )}
      </button>

      <TutorPanel
        open={open}
        onClose={() => setOpen(false)}
        edge={edge}
        onFlipEdge={flipEdge}
        bottomOffset={frame.chromeHeight + 12}
        surface={pathname}
      />
    </>
  );
}
