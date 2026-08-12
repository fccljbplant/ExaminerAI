"use client";

// src/components/learn/TutorBadge.tsx — Code-drawn 2D avatar.
// The ENTIRE character is drawn in SVG code (no photo, no raster assets).
// Only the eyes and lips animate. Everything else is static.
//
// Inspired by the user's reference code: blink, gaze, talk (amplitude),
// smile, O mouth, happy eyes, wink. Natural idle blinks + micro gaze drift.
//
// The character: a professional man with beard, glasses, dark suit.

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Event bus (same API as before) ─────────────────────────────────
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

// ── Eye + mouth state types ────────────────────────────────────────
type EyeMode = "open" | "happy" | "wide" | "wink" | "blink";
type MouthMode = "idle" | "smile" | "talk" | "o" | "soft-smile";

// ── Config: positions of eyes + mouth (in viewBox coords 0-640 x 0-360) ──
const CFG = {
 eyeL: { x: 270, y: 135, w: 32, h: 16 },
 eyeR: { x: 370, y: 135, w: 32, h: 16 },
 mouth: { x: 320, y: 200, w: 50, h: 22 },
 skin: "#e8c098",
 skinShadow: "#d4a877",
 beard: "#2a2018",
 hair: "#1a1410",
};

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

// ── The code-drawn avatar SVG ──────────────────────────────────────
function AvatarSVG({
 eyeMode, mouthMode, mouthOpen, gaze, talking,
}: {
 eyeMode: EyeMode; mouthMode: MouthMode; mouthOpen: number; gaze: { x: number; y: number }; talking: boolean;
}) {
 const { eyeL, eyeR, mouth } = CFG;

 // Helper to render one eye
 const renderEye = (side: "L" | "R") => {
  const c = side === "L" ? eyeL : eyeR;
  const isWink = eyeMode === "wink" && side === "R";
  const isHappy = eyeMode === "happy" || (eyeMode === "wink" && side === "L");
  const isBlink = eyeMode === "blink";
  const isWide = eyeMode === "wide";

  // Happy arc (^^)
  if (isHappy) {
   return (
    <path
     d={`M ${c.x - c.w * 0.4} ${c.y + c.h * 0.15} Q ${c.x} ${c.y - c.h * 0.55} ${c.x + c.w * 0.4} ${c.y + c.h * 0.15}`}
     stroke="#17202f" strokeWidth="3.5" fill="none" strokeLinecap="round"
    />
   );
  }

  // Blink / wink (closed — skin patch)
  if (isBlink || isWink) {
   return (
    <rect
     x={c.x - c.w / 2} y={c.y - 1} width={c.w} height={2.5}
     rx={1.25} fill={CFG.skin}
    />
   );
  }

  // Open / wide
  const w = isWide ? c.w * 1.25 : c.w;
  const h = isWide ? c.h * 1.6 : c.h;
  return (
   <g>
    {/* Eye white */}
    <rect
     x={c.x - w * 0.4} y={c.y - h * 0.35} width={w * 0.8} height={h * 0.7}
     rx={5} fill="#fff" stroke="#17202f" strokeWidth="1.2"
    />
    {/* Pupil */}
    <circle
     cx={c.x + gaze.x} cy={c.y + gaze.y} r={h * 0.26} fill="#17202f"
    />
    {/* Glint */}
    <circle
     cx={c.x + gaze.x + 1.4} cy={c.y + gaze.y - 1.4} r={1.1} fill="#fff"
    />
   </g>
  );
 };

 // Mouth rendering
 const renderMouth = () => {
  const c = mouth;
  const lipColor = "#b07050";
  const lipStroke = "#8a4a30";
  const innerMouth = "#5a2010";

  // Talking — open mouth with amplitude
  if (talking) {
   const openH = Math.max(2, mouthOpen * c.h * 0.6);
   return (
    <g>
     {/* Upper lip */}
     <path d={`M ${c.x - c.w * 0.35} ${c.y - openH * 0.4} Q ${c.x} ${c.y - openH * 0.7} ${c.x + c.w * 0.35} ${c.y - openH * 0.4}`} stroke={lipStroke} strokeWidth="2.5" fill={lipColor} strokeLinecap="round" />
     {/* Inner mouth */}
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.25} ry={openH / 2} fill={innerMouth} />
     {/* Teeth (when mouth open enough) */}
     {mouthOpen > 0.5 && (
      <rect x={c.x - c.w * 0.18} y={c.y - openH * 0.35} width={c.w * 0.36} height={3} rx={1.5} fill="#f0f0f0" />
     )}
     {/* Lower lip */}
     <path d={`M ${c.x - c.w * 0.35} ${c.y + openH * 0.3} Q ${c.x} ${c.y + openH * 0.6} ${c.x + c.w * 0.35} ${c.y + openH * 0.3}`} stroke={lipStroke} strokeWidth="2.5" fill={lipColor} strokeLinecap="round" />
    </g>
   );
  }

  // O mouth
  if (mouthMode === "o") {
   return (
    <g>
     <ellipse cx={c.x} cy={c.y} rx={c.w * 0.2} ry={c.h * 0.35} fill={innerMouth} stroke={lipStroke} strokeWidth="2" />
    </g>
   );
  }

  // Smile
  if (mouthMode === "smile" || mouthMode === "soft-smile") {
   const curve = mouthMode === "smile" ? 8 : 4;
   return (
    <g>
     {/* Upper lip line */}
     <path d={`M ${c.x - c.w * 0.35} ${c.y - 1} Q ${c.x} ${c.y - 3} ${c.x + c.w * 0.35} ${c.y - 1}`} stroke={lipStroke} strokeWidth="2" fill="none" strokeLinecap="round" />
     {/* Lower lip (smile curve) */}
     <path d={`M ${c.x - c.w * 0.35} ${c.y - 1} Q ${c.x} ${c.y + curve} ${c.x + c.w * 0.35} ${c.y - 1}`} stroke={lipStroke} strokeWidth="2.5" fill={lipColor} strokeLinecap="round" />
    </g>
   );
  }

  // Idle — relaxed closed lips
  return (
   <g>
    {/* Upper lip */}
    <path d={`M ${c.x - c.w * 0.32} ${c.y - 1} Q ${c.x} ${c.y - 3} ${c.x + c.w * 0.32} ${c.y - 1}`} stroke={lipStroke} strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Lower lip */}
    <path d={`M ${c.x - c.w * 0.32} ${c.y - 1} Q ${c.x} ${c.y + 4} ${c.x + c.w * 0.32} ${c.y - 1}`} stroke={lipStroke} strokeWidth="2.5" fill={lipColor} strokeLinecap="round" />
   </g>
  );
 };

 return (
  <svg viewBox="0 0 640 360" className="tb-svg" preserveAspectRatio="xMidYMid meet">
   <defs>
    <linearGradient id="suitGrad" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor="#333" />
     <stop offset="100%" stopColor="#1a1a1a" />
    </linearGradient>
    <linearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor={CFG.skin} />
     <stop offset="100%" stopColor={CFG.skinShadow} />
    </linearGradient>
   </defs>

   {/* ── BACKGROUND ── */}
   <rect width="640" height="360" fill="#1a1a2e" />

   {/* ── SUIT SHOULDERS ── */}
   <path d="M 100 360 L 140 270 Q 200 240 260 235 L 380 235 Q 440 240 500 270 L 540 360 Z" fill="url(#suitGrad)" />
   {/* Suit lapels */}
   <path d="M 260 235 L 300 290 L 270 360 L 240 360 L 240 260 Z" fill="#222" />
   <path d="M 380 235 L 340 290 L 370 360 L 400 360 L 400 260 Z" fill="#222" />
   {/* White shirt */}
   <path d="M 300 290 L 320 320 L 340 290 L 335 235 L 305 235 Z" fill="#f5f5f5" />

   {/* ── NECK ── */}
   <path d="M 290 190 L 290 240 Q 290 250 320 252 Q 350 250 350 240 L 350 190 Z" fill={CFG.skinShadow} />
   {/* Neck shadow under chin */}
   <ellipse cx="320" cy="195" rx="30" ry="6" fill="#000" opacity="0.12" />

   {/* ── FACE — proper proportions: forehead 40%, midface 35%, jaw 25% ── */}
   {/* Face shape: wider at temples, narrower at jaw */}
   <path d="M 235 145 Q 235 80 290 65 Q 320 58 350 65 Q 405 80 405 145 Q 405 190 385 215 Q 360 235 320 238 Q 280 235 255 215 Q 235 190 235 145 Z" fill="url(#faceGrad)" />

   {/* ── HAIR — side-parted, textured top ── */}
   <path d="M 232 130 Q 225 70 285 55 Q 320 48 355 55 Q 415 70 408 130 Q 408 100 390 88 Q 370 78 345 82 Q 325 72 305 82 Q 280 78 260 88 Q 242 100 232 130 Z" fill={CFG.hair} />
   {/* Hair side fade */}
   <path d="M 232 130 Q 228 100 235 82 L 240 115 Z" fill="#0e0a06" />
   <path d="M 408 130 Q 412 100 405 82 L 400 115 Z" fill="#0e0a06" />

   {/* ── EARS ── */}
   <ellipse cx="236" cy="150" rx="7" ry="14" fill={CFG.skinShadow} />
   <ellipse cx="404" cy="150" rx="7" ry="14" fill={CFG.skinShadow} />

   {/* ── BEARD — jawline only, NOT covering the whole face ── */}
   <path d="M 255 165 Q 250 200 270 220 Q 290 232 320 234 Q 350 232 370 220 Q 390 200 385 165 Q 380 185 365 198 Q 345 212 320 214 Q 295 212 275 198 Q 260 185 255 165 Z" fill={CFG.beard} opacity="0.9" />
   {/* Mustache — thin, following lip line */}
   <path d="M 295 188 Q 310 184 320 186 Q 330 184 345 188 Q 338 192 320 191 Q 302 192 295 188 Z" fill={CFG.beard} />

   {/* ── EYEBROWS ── */}
   <path d="M 248 118 Q 265 112 285 118" stroke={CFG.hair} strokeWidth="4.5" fill="none" strokeLinecap="round" />
   <path d="M 355 118 Q 375 112 392 118" stroke={CFG.hair} strokeWidth="4.5" fill="none" strokeLinecap="round" />

   {/* ── GLASSES ── */}
   <rect x={eyeL.x - eyeL.w / 2 - 5} y={eyeL.y - eyeL.h - 3} width={eyeL.w + 10} height={eyeL.h * 2 + 6} rx="8" fill="none" stroke="#1a1a1a" strokeWidth="3" />
   <rect x={eyeR.x - eyeR.w / 2 - 5} y={eyeR.y - eyeR.h - 3} width={eyeR.w + 10} height={eyeR.h * 2 + 6} rx="8" fill="none" stroke="#1a1a1a" strokeWidth="3" />
   <line x1={eyeL.x + eyeL.w / 2 + 5} y1={eyeL.y} x2={eyeR.x - eyeR.w / 2 - 5} y2={eyeR.y} stroke="#1a1a1a" strokeWidth="3" />
   <line x1={eyeL.x - eyeL.w / 2 - 5} y1={eyeL.y} x2="234" y2={eyeL.y + 4} stroke="#1a1a1a" strokeWidth="3" />
   <line x1={eyeR.x + eyeR.w / 2 + 5} y1={eyeR.y} x2="406" y2={eyeR.y + 4} stroke="#1a1a1a" strokeWidth="3" />
   {/* Lens glare */}
   <path d={`M ${eyeL.x - eyeL.w / 2} ${eyeL.y - eyeL.h} L ${eyeL.x - eyeL.w / 4} ${eyeL.y - eyeL.h} L ${eyeL.x - eyeL.w / 6} ${eyeL.y - eyeL.h / 2} L ${eyeL.x - eyeL.w / 2} ${eyeL.y - eyeL.h / 2} Z`} fill="#fff" opacity="0.12" />
   <path d={`M ${eyeR.x - eyeR.w / 2} ${eyeR.y - eyeR.h} L ${eyeR.x - eyeR.w / 4} ${eyeR.y - eyeR.h} L ${eyeR.x - eyeR.w / 6} ${eyeR.y - eyeR.h / 2} L ${eyeR.x - eyeR.w / 2} ${eyeR.y - eyeR.h / 2} Z`} fill="#fff" opacity="0.12" />

   {/* ── NOSE — subtle shadow only ── */}
   <path d="M 316 148 Q 312 168 314 178 L 326 178 Q 328 168 324 148" fill="none" stroke={CFG.skinShadow} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
   <ellipse cx="314" cy="179" rx="2.5" ry="1.5" fill={CFG.skinShadow} opacity="0.4" />
   <ellipse cx="326" cy="179" rx="2.5" ry="1.5" fill={CFG.skinShadow} opacity="0.4" />

   {/* ── EYES (animated) ── */}
   <g>{renderEye("L")}</g>
   <g>{renderEye("R")}</g>

   {/* ── MOUTH (animated) ── */}
   <g>{renderMouth()}</g>
  </svg>
 );
}

// ── Dock sizes + position ──────────────────────────────────────────
const SIZES = { full: 140, mini: 84, dot: 44 } as const;
type Mode = keyof typeof SIZES;
type Pos = { side: "left" | "right"; bottom: number };
const LS_KEY = "tutorDockPos";
const loadPos = (): Pos => {
 try { const p = JSON.parse(localStorage.getItem(LS_KEY) || ""); if (p?.side) return p; } catch { /* corrupted */ }
 return { side: "right", bottom: 20 };
};

// ── AvatarDock — the floating badge ────────────────────────────────
export function AvatarDock() {
 const reduced = useReducedMotion();
 const busy = useUserBusy();
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);

 // Eye + mouth state
 const [eyeMode, setEyeMode] = useState<EyeMode>("open");
 const [mouthMode, setMouthMode] = useState<MouthMode>("idle");
 const [mouthOpen, setMouthOpen] = useState(0);
 const [gaze, setGaze] = useState({ x: 0, y: 0 });
 const [talking, setTalking] = useState(false);
 const [caption, setCaption] = useState("");
 const talkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Apply a gesture
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
   case "determined": case "proud":
    setEyeMode("open"); setMouthMode("idle");
    holdTimer.current = setTimeout(() => setEyeMode("open"), 2500);
    break;
   default:
    setEyeMode("open"); setMouthMode("idle");
  }
 }, []);

 // Event bus wiring
 useEffect(() => {
  const unsubs: (() => void)[] = [];
  unsubs.push(tutor.on("gesture", (g: unknown) => applyGesture(g as string)));
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   if (phase === "start") applyGesture("talk");
   else if (phase === "end") { applyGesture("idle"); }
  }));
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, [applyGesture]);

 // Auto-shrink while learner busy
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (talking) setMode(m => (m === "mini" ? "full" : m));
 }, [busy, talking]);

 // Natural blink (every 2.4-5.6 seconds)
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

 // Micro gaze drift (when eyes are open)
 useEffect(() => {
  if (reduced) return;
  const id = setInterval(() => {
   setEyeMode(prev => {
    if (prev === "open") {
     setGaze({ x: Math.sin(Date.now() / 2600) * 2.1, y: 0 });
    }
    return prev;
   });
  }, 400);
  return () => clearInterval(id);
 }, [reduced]);

 // Cleanup on unmount
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
      <AvatarSVG eyeMode={eyeMode} mouthMode={mouthMode} mouthOpen={mouthOpen} gaze={gaze} talking={talking} />
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

// ── CSS — injected once ────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("tb-css")) {
 const s = document.createElement("style"); s.id = "tb-css"; s.textContent = `
 .tb-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .tb-badge-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:grab;touch-action:none;position:relative;border-radius:12px;overflow:hidden}
 .tb-badge-btn:active{cursor:grabbing}
 .tb-badge{position:relative;border-radius:12px;overflow:hidden;will-change:transform;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05)}
 .tb-svg{width:100%;height:100%;display:block}
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
