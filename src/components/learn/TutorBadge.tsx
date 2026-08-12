"use client";

// src/components/learn/TutorBadge.tsx — Vector face SVG + animated eye/lip overlays.
// Uses a pre-vectorized SVG portrait (158 paths, 149 colors) as the static base.
// Only the eyes and lips animate via SVG overlays positioned on top.

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Event bus ──────────────────────────────────────────────────────
type Handler = (p?: unknown) => void;
const handlers: Record<string, Set<Handler>> = {};

export const tutor = {
 on(ev: string, fn: Handler) { (handlers[ev] ??= new Set()).add(fn); return () => { handlers[ev]?.delete(fn); }; },
 emit(ev: string, p?: unknown) { handlers[ev]?.forEach(fn => fn(p)); },
 play(gesture: string) { this.emit("gesture", gesture); },
 caption(text: string) { this.emit("caption", text); },
 say(text: string, voice = true) {
  this.caption(text); this.emit("tts", "start");
  if (voice && typeof window !== "undefined" && "speechSynthesis" in window) {
   const u = new SpeechSynthesisUtterance(text);
   u.onend = () => this.emit("tts", "end"); u.onerror = () => this.emit("tts", "end");
   speechSynthesis.speak(u);
  } else setTimeout(() => this.emit("tts", "end"), Math.min(9000, text.length * 55));
 },
};

// ── Types ──────────────────────────────────────────────────────────
type EyeMode = "open" | "happy" | "wide" | "wink" | "blink";
type MouthMode = "idle" | "smile" | "talk" | "o" | "soft-smile";

// ── Eye + mouth positions (calibrated from the vector SVG transforms) ──
// The vector SVG is 635x360. Eyes are at translate(306,135) and translate(375,136).
// Mouth is at translate(320,197).
const EYE_L = { x: 306, y: 140, w: 30, h: 16 };
const EYE_R = { x: 375, y: 141, w: 30, h: 16 };
const MOUTH = { x: 320, y: 205, w: 50, h: 22 };
const SKIN = "#e8c098";
const SKIN_SHADOW = "#d4a877";

// ── Hooks ──────────────────────────────────────────────────────────
function useReducedMotion() {
 const [r, setR] = useState(false);
 useEffect(() => {
  const m = matchMedia("(prefers-reduced-motion: reduce)");
  setR(m.matches); const f = () => setR(m.matches);
  m.addEventListener("change", f); return () => m.removeEventListener("change", f);
 }, []);
 return r;
}

function useUserBusy() {
 const [busy, setBusy] = useState(false);
 useEffect(() => {
  let t: ReturnType<typeof setTimeout>;
  const on = () => { setBusy(true); clearTimeout(t); t = setTimeout(() => setBusy(false), 2500); };
  ["pointermove", "scroll", "keydown", "pointerdown"].forEach(e =>
   window.addEventListener(e, on, { passive: true }));
  return () => clearTimeout(t);
 }, []);
 return busy;
}

// ── VectorFace — loads the static SVG portrait ─────────────────────
function VectorFace() {
 return (
  <img
   src="/assets/avatar/v1/vector-face.svg"
   alt="AI tutor"
   className="tb-vector-face"
   draggable={false}
  />
 );
}

// ── Eye overlay (animated) ─────────────────────────────────────────
function EyeOverlay({ eyeMode, gaze }: { eyeMode: EyeMode; gaze: { x: number; y: number } }) {
 const renderEye = (side: "L" | "R") => {
  const c = side === "L" ? EYE_L : EYE_R;
  const isWink = eyeMode === "wink" && side === "R";
  const isHappy = eyeMode === "happy" || (eyeMode === "wink" && side === "L");
  const isBlink = eyeMode === "blink";
  const isWide = eyeMode === "wide";

  // Happy arc (^^)
  if (isHappy) {
   return (
    <polyline
     points={`${c.x - c.w * 0.45},${c.y + 2} ${c.x},${c.y - c.h * 0.6} ${c.x + c.w * 0.45},${c.y + 2}`}
     stroke="#1a1010" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
    />
   );
  }

  // Blink / wink (closed — skin-colored line over the eye)
  if (isBlink || isWink) {
   return (
    <g>
     <rect x={c.x - c.w * 0.5} y={c.y - 3} width={c.w} height={6} rx={2} fill={SKIN} />
     <line x1={c.x - c.w * 0.45} y1={c.y} x2={c.x + c.w * 0.45} y2={c.y} stroke="#3a2010" strokeWidth="2" strokeLinecap="round" />
    </g>
   );
  }

  // Open / wide
  const w = isWide ? c.w * 1.15 : c.w;
  const h = isWide ? c.h * 1.4 : c.h;
  return (
   <g>
    {/* Eye white — almond shape */}
    <ellipse cx={c.x} cy={c.y} rx={w * 0.42} ry={h * 0.4} fill="#fff" stroke="#2a1010" strokeWidth="1" />
    {/* Iris */}
    <circle cx={c.x + gaze.x} cy={c.y + gaze.y} r={h * 0.28} fill="#3a2010" />
    {/* Pupil */}
    <circle cx={c.x + gaze.x} cy={c.y + gaze.y} r={h * 0.14} fill="#0a0500" />
    {/* Glint */}
    <circle cx={c.x + gaze.x + 2} cy={c.y + gaze.y - 2} r={1.5} fill="#fff" />
   </g>
  );
 };

 return (
  <g>
   {renderEye("L")}
   {renderEye("R")}
  </g>
 );
}

// ── Mouth overlay (animated) ───────────────────────────────────────
function MouthOverlay({ mouthMode, mouthOpen, talking }: { mouthMode: MouthMode; mouthOpen: number; talking: boolean }) {
  const c = MOUTH;
  const lipColor = "#c08070";
  const lipStroke = "#8a4a30";
  const innerMouth = "#5a2010";
  const teethColor = "#f0ece0";

  // Talking — open mouth with amplitude
  if (talking) {
   const openH = Math.max(2, mouthOpen * c.h * 0.7);
   const topY = c.y - openH * 0.35;
   const botY = c.y + openH * 0.45;
   return (
    <g>
     {/* Skin patch to cover the static mouth in the SVG */}
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.55} ry={c.h * 0.6} fill={SKIN} />
     {/* Upper lip */}
     <path d={`M ${c.x - c.w * 0.35} ${topY} Q ${c.x - c.w * 0.15} ${topY - 3} ${c.x} ${topY - 1} Q ${c.x + c.w * 0.15} ${topY - 3} ${c.x + c.w * 0.35} ${topY} Q ${c.x + c.w * 0.2} ${topY + 2} ${c.x} ${topY + 3} Q ${c.x - c.w * 0.2} ${topY + 2} ${c.x - c.w * 0.35} ${topY} Z`} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
     {/* Inner mouth */}
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.25} ry={openH / 2} fill={innerMouth} />
     {/* Teeth */}
     {mouthOpen > 0.5 && (
      <rect x={c.x - c.w * 0.16} y={topY + 3} width={c.w * 0.32} height={4} rx={2} fill={teethColor} />
     )}
     {/* Lower lip */}
     <path d={`M ${c.x - c.w * 0.3} ${botY - 2} Q ${c.x} ${botY} ${c.x + c.w * 0.3} ${botY - 2} Q ${c.x + c.w * 0.2} ${botY + 4} ${c.x} ${botY + 6} Q ${c.x - c.w * 0.2} ${botY + 4} ${c.x - c.w * 0.3} ${botY - 2} Z`} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
    </g>
   );
  }

  // O mouth
  if (mouthMode === "o") {
   return (
    <g>
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.55} ry={c.h * 0.6} fill={SKIN} />
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.2} ry={c.h * 0.35} fill={innerMouth} stroke={lipStroke} strokeWidth="2" />
    </g>
   );
  }

  // Smile
  if (mouthMode === "smile" || mouthMode === "soft-smile") {
   const curve = mouthMode === "smile" ? 8 : 4;
   return (
    <g>
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.5} ry={c.h * 0.5} fill={SKIN} />
     <path d={`M ${c.x - c.w * 0.35} ${c.y - 1} Q ${c.x - c.w * 0.15} ${c.y - 3} ${c.x} ${c.y - 2} Q ${c.x + c.w * 0.15} ${c.y - 3} ${c.x + c.w * 0.35} ${c.y - 1} Q ${c.x + c.w * 0.2} ${c.y} ${c.x} ${c.y + 1} Q ${c.x - c.w * 0.2} ${c.y} ${c.x - c.w * 0.35} ${c.y - 1} Z`} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
     <path d={`M ${c.x - c.w * 0.35} ${c.y - 1} Q ${c.x} ${c.y + curve} ${c.x + c.w * 0.35} ${c.y - 1} Q ${c.x + c.w * 0.25} ${c.y + curve + 3} ${c.x} ${c.y + curve + 5} Q ${c.x - c.w * 0.25} ${c.y + curve + 3} ${c.x - c.w * 0.35} ${c.y - 1} Z`} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
    </g>
   );
  }

  // Idle — no overlay (show the real mouth from the SVG)
  return null;
}

// ── Dock ───────────────────────────────────────────────────────────
const SIZES = { full: 140, mini: 84, dot: 44 } as const;
type Mode = keyof typeof SIZES;
type Pos = { side: "left" | "right"; bottom: number };
const LS_KEY = "tutorDockPos";
const loadPos = (): Pos => {
 try { const p = JSON.parse(localStorage.getItem(LS_KEY) || ""); if (p?.side) return p; } catch { /* corrupted */ }
 return { side: "right", bottom: 20 };
};

// ── AvatarDock ─────────────────────────────────────────────────────
export function AvatarDock() {
 const reduced = useReducedMotion();
 const busy = useUserBusy();
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);

 const [eyeMode, setEyeMode] = useState<EyeMode>("open");
 const [mouthMode, setMouthMode] = useState<MouthMode>("idle");
 const [mouthOpen, setMouthOpen] = useState(0);
 const [gaze, setGaze] = useState({ x: 0, y: 0 });
 const [talking, setTalking] = useState(false);
 const [caption, setCaption] = useState("");
 const talkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 const applyGesture = useCallback((gesture: string) => {
  if (holdTimer.current) clearTimeout(holdTimer.current);
  if (talkInterval.current) { clearInterval(talkInterval.current); talkInterval.current = null; }
  setTalking(false);

  switch (gesture) {
   case "idle": case "focus":
    setEyeMode("open"); setMouthMode("idle"); break;
   case "hello": case "bye":
    setEyeMode("happy"); setMouthMode("smile");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 2500);
    break;
   case "talk":
    setEyeMode("open"); setMouthMode("talk"); setTalking(true);
    talkInterval.current = setInterval(() => {
     const t = performance.now();
     setMouthOpen(0.3 + 0.7 * Math.abs(Math.sin(t / 130) * 0.7 + Math.sin(t / 47) * 0.3));
    }, 90);
    break;
   case "listen":
    setEyeMode("open"); setMouthMode("idle"); break;
   case "think": case "confused":
    setEyeMode("open"); setMouthMode("idle");
    setGaze({ x: -2, y: -2 });
    holdTimer.current = setTimeout(() => setGaze({ x: 0, y: 0 }), 3000);
    break;
   case "idea": case "surprised":
    setEyeMode("wide"); setMouthMode("o");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 2000);
    break;
   case "praise": case "celebrate": case "cheer": case "laugh": case "levelup": case "streak":
    setEyeMode("happy"); setMouthMode("smile");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 2500);
    break;
   case "comfort":
    setEyeMode("open"); setMouthMode("soft-smile");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 3000);
    break;
   case "oops":
    setEyeMode("open"); setMouthMode("o");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 2000);
    break;
   case "wink":
    setEyeMode("wink"); setMouthMode("smile");
    holdTimer.current = setTimeout(() => { setEyeMode("open"); setMouthMode("idle"); }, 2000);
    break;
   default:
    setEyeMode("open"); setMouthMode("idle");
  }
 }, []);

 useEffect(() => {
  const unsubs: (() => void)[] = [];
  unsubs.push(tutor.on("gesture", (g: unknown) => applyGesture(g as string)));
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   if (phase === "start") applyGesture("talk");
   else if (phase === "end") applyGesture("idle");
  }));
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, [applyGesture]);

 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (talking) setMode(m => (m === "mini" ? "full" : m));
 }, [busy, talking]);

 // Natural blink
 useEffect(() => {
  if (reduced) return;
  let blinkTimer: ReturnType<typeof setTimeout>;
  const blink = () => {
   setEyeMode(prev => {
    if (prev === "blink" || prev === "wink" || prev === "happy") return prev;
    return "blink";
   });
   setTimeout(() => setEyeMode(prev => prev === "blink" ? "open" : prev), 130);
   blinkTimer = setTimeout(blink, 2400 + Math.random() * 3200);
  };
  blinkTimer = setTimeout(blink, 800 + Math.random() * 2000);
  return () => clearTimeout(blinkTimer);
 }, [reduced]);

 // Micro gaze drift
 useEffect(() => {
  if (reduced) return;
  const id = setInterval(() => {
   setEyeMode(prev => {
    if (prev === "open") setGaze({ x: Math.sin(Date.now() / 2600) * 2.5, y: 0 });
    return prev;
   });
  }, 400);
  return () => clearInterval(id);
 }, [reduced]);

 useEffect(() => {
  return () => {
   if (talkInterval.current) clearInterval(talkInterval.current);
   if (holdTimer.current) clearTimeout(holdTimer.current);
  };
 }, []);

 const px = SIZES[mode]; const h = px * 1.25;

 const onDown = (e: React.PointerEvent) => {
  (e.target as Element).setPointerCapture(e.pointerId);
  dragInfo.current = { sx: e.clientX, sy: e.clientY, moved: false };
 };
 const onMove = (e: React.PointerEvent) => {
  const d = dragInfo.current; if (!d) return;
  if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 8) d.moved = true;
  if (d.moved) setDrag({ x: e.clientX - px / 2, y: e.clientY - h / 2 });
 };
 const onUp = (e: React.PointerEvent) => {
  const d = dragInfo.current; dragInfo.current = null; setDrag(null);
  if (d?.moved) {
   const side: Pos["side"] = e.clientX < innerWidth / 2 ? "left" : "right";
   const bottom = Math.max(8, Math.min(innerHeight - h - 8, innerHeight - e.clientY - h / 2));
   const p = { side, bottom }; setPos(p); localStorage.setItem(LS_KEY, JSON.stringify(p));
  } else setMode(m => (m === "full" ? "mini" : m === "mini" ? "dot" : "full"));
 };

 const style: React.CSSProperties = drag
  ? { left: drag.x, top: drag.y, width: px, height: h }
  : { [pos.side]: 16, bottom: pos.bottom, width: px, height: h } as React.CSSProperties;

 return (
  <div className="tb-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="tb-cap">{caption}</div>}
   {mode !== "dot" ? (
    <button className="tb-badge-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-badge" style={{ width: px, height: px }}>
      {/* Static vector face */}
      <VectorFace />
      {/* Animated eye + mouth overlays */}
      <svg viewBox="0 0 635 360" className="tb-overlay-svg" preserveAspectRatio="xMidYMid slice">
       <EyeOverlay eyeMode={eyeMode} gaze={gaze} />
       <MouthOverlay mouthMode={mouthMode} mouthOpen={mouthOpen} talking={talking} />
      </svg>
      <div className="tb-shadow" aria-hidden="true" />
     </div>
    </button>
   ) : (
    <button className="tb-dot-btn" aria-label="AI tutor (click to expand)" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-dot-indicator" />
    </button>
   )}
  </div>
 );
}

// ── CSS ────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("tb-css")) {
 const s = document.createElement("style"); s.id = "tb-css"; s.textContent = `
 .tb-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .tb-badge-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:grab;touch-action:none;position:relative;border-radius:12px;overflow:hidden}
 .tb-badge-btn:active{cursor:grabbing}
 .tb-badge{position:relative;border-radius:12px;overflow:hidden;will-change:transform;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05)}
 .tb-vector-face{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
 .tb-overlay-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
 .tb-dot-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:pointer;touch-action:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
 .tb-dot-indicator{width:14px;height:14px;background:#00b894;border-radius:50%;box-shadow:0 0 15px rgba(0,184,148,0.3);animation:tbPulse 2.5s ease-in-out infinite}
 @keyframes tbPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
 .tb-shadow{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:60%;height:10px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;z-index:0}
 .tb-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);z-index:10}
 .tb-dock[data-side="right"] .tb-cap{right:calc(100% + 10px)}
 .tb-dock[data-side="left"] .tb-cap{left:calc(100% + 10px)}
 body[data-focus] .tb-dock{opacity:.25}
 body[data-focus] .tb-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
