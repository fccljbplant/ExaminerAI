"use client";

/**
 * modules/tutor — VectorTutorRig (REDESIGN-P2 §1.5, W2)
 *
 * The new abstract, in-house vector tutor: 100% layered SVG, zero
 * raster, zero paid services. Same event→expression mapping idea as
 * the legacy rig, rebuilt on design tokens:
 *
 *   mood ring  → var(--tutor-ring)   (thinking: rotating dash)
 *   head       → var(--tutor-fab)
 *   face lines → var(--on-brand)
 *
 * States (the rig state machine's render side):
 *   idle      open eyes, soft smile, gentle bob
 *   listening raised brows, "o" mouth — actively receiving input
 *   thinking  eyes look up, flat mouth, ring spins
 *   speaking  open mouth animates, side arcs pulse
 *
 * All motion is wrapped in prefers-reduced-motion: no-preference.
 * The rig is decorative — state changes are announced through the
 * FloatingTutor's aria-live region instead (P6 §4).
 */

import { cn } from "@/lib/utils";
import type { TutorState } from "./tutor-store";

const MOTION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .vt-bob   { animation: vt-bob 3.2s ease-in-out infinite; }
  .vt-blink { animation: vt-blink 4.6s ease-in-out infinite; }
  .vt-talk  { animation: vt-talk 0.5s ease-in-out infinite; }
  .vt-spin  { animation: vt-spin 2.4s linear infinite; }
  .vt-wave  { animation: vt-wave 1.1s ease-in-out infinite; }
  .vt-dot   { animation: vt-dot 1.2s ease-in-out infinite; }
  .vt-dot:nth-child(2) { animation-delay: 0.15s; }
  .vt-dot:nth-child(3) { animation-delay: 0.3s; }
}
@keyframes vt-bob   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.2px); } }
@keyframes vt-blink { 0%,90%,100% { transform: scaleY(1); } 94% { transform: scaleY(0.12); } }
@keyframes vt-talk  { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
@keyframes vt-spin  { to { transform: rotate(360deg); } }
@keyframes vt-wave  { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; } }
@keyframes vt-dot   { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
.vt-bob, .vt-blink, .vt-talk, .vt-spin { transform-box: fill-box; transform-origin: center; }
`;

export interface VectorTutorRigProps {
  state: TutorState;
  /** Rendered square size in px (SVG scales). */
  size?: number;
  className?: string;
}

export function VectorTutorRig({ state, size = 40, className }: VectorTutorRigProps) {
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const listening = state === "listening";

  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <style>{MOTION_CSS}</style>
      <svg viewBox="0 0 64 64" width={size} height={size} role="img" focusable="false">
        {/* mood ring — spins while thinking */}
        <circle
          className={cn(thinking && "vt-spin")}
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="var(--tutor-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={thinking ? "14 8" : "none"}
          opacity={thinking ? 0.9 : 0.45}
        />

        <g className="vt-bob">
          {/* head */}
          <path
            d="M32 8c13.8 0 22 8.6 22 22.2 0 14-9.4 23.8-22 23.8S10 44.2 10 30.2C10 16.6 18.2 8 32 8Z"
            fill="var(--tutor-fab)"
          />

          {/* brows */}
          <g
            stroke="var(--on-brand)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            style={{
              transform: listening ? "translateY(-2px)" : undefined,
              transition: "transform 150ms ease",
            }}
          >
            <path d={thinking ? "M20 22.5 L28 20.5" : "M20 22 L28 22"} />
            <path d={thinking ? "M36 20.5 L44 22.5" : "M36 22 L44 22"} />
          </g>

          {/* eyes — look up while thinking, blink otherwise */}
          <g
            className="vt-blink"
            fill="var(--on-brand)"
            style={{
              transform: thinking ? "translateY(-1.8px)" : undefined,
              transition: "transform 200ms ease",
            }}
          >
            <circle cx="24.5" cy="29" r={listening ? 3.1 : 2.6} />
            <circle cx="39.5" cy="29" r={listening ? 3.1 : 2.6} />
          </g>

          {/* mouth — morphs per state */}
          {speaking ? (
            <ellipse
              className="vt-talk"
              cx="32"
              cy="42.5"
              rx="5"
              ry="4.5"
              fill="var(--on-brand)"
            />
          ) : listening ? (
            <circle cx="32" cy="42.5" r="3.2" fill="none" stroke="var(--on-brand)" strokeWidth="2.2" />
          ) : thinking ? (
            <path d="M28 43 L36 43" stroke="var(--on-brand)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          ) : (
            <path
              d="M25 41.5 Q32 46.5 39 41.5"
              stroke="var(--on-brand)"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>

        {/* speaking waves */}
        {speaking && (
          <g stroke="var(--tutor-ring)" strokeWidth="2" strokeLinecap="round" fill="none">
            <path className="vt-wave" d="M6.5 28 Q4.5 32 6.5 36" />
            <path className="vt-wave" d="M57.5 28 Q59.5 32 57.5 36" style={{ animationDelay: "0.2s" }} />
          </g>
        )}

        {/* thinking dots */}
        {thinking && (
          <g fill="var(--tutor-ring)">
            <circle className="vt-dot" cx="49" cy="12" r="1.8" />
            <circle className="vt-dot" cx="53.5" cy="16" r="1.8" />
            <circle className="vt-dot" cx="56.5" cy="21" r="1.8" />
          </g>
        )}
      </svg>
    </span>
  );
}
