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

 // Helper to render one eye — using polygons like tracing a sketch
 const renderEye = (side: "L" | "R") => {
  const c = side === "L" ? eyeL : eyeR;
  const isWink = eyeMode === "wink" && side === "R";
  const isHappy = eyeMode === "happy" || (eyeMode === "wink" && side === "L");
  const isBlink = eyeMode === "blink";
  const isWide = eyeMode === "wide";

  // Happy arc (^^) — polyline
  if (isHappy) {
   return (
    <polyline
     points={`${c.x - c.w * 0.4},${c.y + c.h * 0.15} ${c.x},${c.y - c.h * 0.55} ${c.x + c.w * 0.4},${c.y + c.h * 0.15}`}
     stroke="#17202f" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
    />
   );
  }

  // Blink / wink (closed — skin-colored line)
  if (isBlink || isWink) {
   return (
    <line
     x1={c.x - c.w / 2} y1={c.y} x2={c.x + c.w / 2} y2={c.y}
     stroke={CFG.skinShadow} strokeWidth="3" strokeLinecap="round"
    />
   );
  }

  // Open / wide — eye white as polygon, pupil as polygon
  const w = isWide ? c.w * 1.2 : c.w;
  const h = isWide ? c.h * 1.5 : c.h;
  const x1 = c.x - w * 0.4, y1 = c.y - h * 0.35;
  const x2 = c.x + w * 0.4, y2 = c.y + h * 0.35;
  // Eye shape: almond/oval using points
  const eyePoints = `${x1},${c.y} ${c.x - w * 0.2},${y1} ${c.x + w * 0.2},${y1} ${x2},${c.y} ${c.x + w * 0.2},${y2} ${c.x - w * 0.2},${y2}`;
  return (
   <g>
    {/* Eye white — almond shape polygon */}
    <polygon points={eyePoints} fill="#fff" stroke="#17202f" strokeWidth="1.2" />
    {/* Iris + pupil — small polygon circle */}
    <polygon
     points={`
      ${c.x + gaze.x},${c.y + gaze.y - h * 0.26}
      ${c.x + gaze.x + h * 0.22},${c.y + gaze.y - h * 0.1}
      ${c.x + gaze.x + h * 0.22},${c.y + gaze.y + h * 0.1}
      ${c.x + gaze.x},${c.y + gaze.y + h * 0.26}
      ${c.x + gaze.x - h * 0.22},${c.y + gaze.y + h * 0.1}
      ${c.x + gaze.x - h * 0.22},${c.y + gaze.y - h * 0.1}
     `}
     fill="#2a1a0e"
    />
    {/* Glint — tiny white polygon */}
    <polygon
     points={`
      ${c.x + gaze.x + 1},${c.y + gaze.y - 2}
      ${c.x + gaze.x + 3},${c.y + gaze.y - 1}
      ${c.x + gaze.x + 2},${c.y + gaze.y + 1}
      ${c.x + gaze.x},${c.y + gaze.y}
     `}
     fill="#fff"
    />
   </g>
  );
 };

 // Mouth rendering — using polygons
 const renderMouth = () => {
  const c = mouth;
  const lipColor = "#c08070";
  const lipStroke = "#8a4a30";
  const innerMouth = "#5a2010";
  const teethColor = "#f0ece0";

  // Talking — open mouth with amplitude
  if (talking) {
   const openH = Math.max(2, mouthOpen * c.h * 0.6);
   const topY = c.y - openH * 0.4;
   const botY = c.y + openH * 0.5;
   return (
    <g>
     {/* Upper lip — polygon */}
     <polygon points={`
      ${c.x - c.w * 0.35},${topY}
      ${c.x - c.w * 0.15},${topY - 2}
      ${c.x},${topY - 1}
      ${c.x + c.w * 0.15},${topY - 2}
      ${c.x + c.w * 0.35},${topY}
      ${c.x + c.w * 0.2},${topY + 2}
      ${c.x},${topY + 3}
      ${c.x - c.w * 0.2},${topY + 2}
     `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
     {/* Inner mouth — polygon */}
     <polygon points={`
      ${c.x - c.w * 0.22},${topY + 2}
      ${c.x},${topY + 3}
      ${c.x + c.w * 0.22},${topY + 2}
      ${c.x + c.w * 0.18},${botY - 2}
      ${c.x},${botY}
      ${c.x - c.w * 0.18},${botY - 2}
     `} fill={innerMouth} />
     {/* Teeth — polygon (when open enough) */}
     {mouthOpen > 0.5 && (
      <polygon points={`
       ${c.x - c.w * 0.16},${topY + 3}
       ${c.x + c.w * 0.16},${topY + 3}
       ${c.x + c.w * 0.14},${topY + 7}
       ${c.x - c.w * 0.14},${topY + 7}
      `} fill={teethColor} />
     )}
     {/* Lower lip — polygon */}
     <polygon points={`
      ${c.x - c.w * 0.3},${botY - 2}
      ${c.x},${botY}
      ${c.x + c.w * 0.3},${botY - 2}
      ${c.x + c.w * 0.2},${botY + 4}
      ${c.x},${botY + 6}
      ${c.x - c.w * 0.2},${botY + 4}
     `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
    </g>
   );
  }

  // O mouth — polygon oval
  if (mouthMode === "o") {
   return (
    <polygon points={`
     ${c.x},${c.y - c.h * 0.35}
     ${c.x + c.w * 0.18},${c.y - c.h * 0.2}
     ${c.x + c.w * 0.18},${c.y + c.h * 0.2}
     ${c.x},${c.y + c.h * 0.35}
     ${c.x - c.w * 0.18},${c.y + c.h * 0.2}
     ${c.x - c.w * 0.18},${c.y - c.h * 0.2}
    `} fill={innerMouth} stroke={lipStroke} strokeWidth="2" />
   );
  }

  // Smile — upper + lower lip polygons
  if (mouthMode === "smile" || mouthMode === "soft-smile") {
   const curve = mouthMode === "smile" ? 8 : 4;
   return (
    <g>
     {/* Upper lip */}
     <polygon points={`
      ${c.x - c.w * 0.35},${c.y - 1}
      ${c.x - c.w * 0.15},${c.y - 3}
      ${c.x},${c.y - 2}
      ${c.x + c.w * 0.15},${c.y - 3}
      ${c.x + c.w * 0.35},${c.y - 1}
      ${c.x + c.w * 0.2},${c.y}
      ${c.x},${c.y + 1}
      ${c.x - c.w * 0.2},${c.y}
     `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
     {/* Lower lip (smile curve) */}
     <polygon points={`
      ${c.x - c.w * 0.35},${c.y - 1}
      ${c.x},${c.y + curve}
      ${c.x + c.w * 0.35},${c.y - 1}
      ${c.x + c.w * 0.25},${c.y + curve + 3}
      ${c.x},${c.y + curve + 5}
      ${c.x - c.w * 0.25},${c.y + curve + 3}
     `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
    </g>
   );
  }

  // Idle — relaxed closed lips (upper + lower lip polygons)
  return (
   <g>
    {/* Upper lip */}
    <polygon points={`
     ${c.x - c.w * 0.32},${c.y - 1}
     ${c.x - c.w * 0.14},${c.y - 3}
     ${c.x},${c.y - 2}
     ${c.x + c.w * 0.14},${c.y - 3}
     ${c.x + c.w * 0.32},${c.y - 1}
     ${c.x + c.w * 0.18},${c.y}
     ${c.x},${c.y + 1}
     ${c.x - c.w * 0.18},${c.y}
    `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
    {/* Lower lip */}
    <polygon points={`
     ${c.x - c.w * 0.32},${c.y - 1}
     ${c.x},${c.y + 4}
     ${c.x + c.w * 0.32},${c.y - 1}
     ${c.x + c.w * 0.22},${c.y + 6}
     ${c.x},${c.y + 8}
     ${c.x - c.w * 0.22},${c.y + 6}
    `} fill={lipColor} stroke={lipStroke} strokeWidth="1.5" />
   </g>
  );
 };

 return (
  <svg viewBox="0 0 640 400" className="tb-svg" preserveAspectRatio="xMidYMid meet">
   {/* Transparent background — no rect */}

   {/* ── SUIT — polygon points tracing shoulders + jacket ── */}
   <polygon points="80,400 120,300 170,265 220,250 250,245 250,230 270,225 320,225 370,225 390,230 390,245 420,250 470,265 520,300 560,400" fill="#2a2a2a" />
   {/* Left lapel */}
   <polygon points="250,245 270,225 295,225 300,270 275,310 255,400 235,400 235,275" fill="#1a1a1a" />
   {/* Right lapel */}
   <polygon points="390,245 370,225 345,225 340,270 365,310 385,400 405,400 405,275" fill="#1a1a1a" />
   {/* White shirt V */}
   <polygon points="295,225 345,225 340,270 320,300 300,270" fill="#f0f0f0" />

   {/* ── NECK — polygon tracing neck shape ── */}
   <polygon points="290,190 290,235 300,245 320,248 340,245 350,235 350,190" fill={CFG.skinShadow} />
   {/* Neck shadow polygon */}
   <polygon points="290,190 350,190 345,200 335,205 320,207 305,205 295,200" fill="#000" opacity="0.15" />

   {/* ── HAIR — polygon tracing hairline + sides ── */}
   <polygon points="228,120 225,90 235,68 260,55 290,50 320,48 350,50 380,55 405,68 415,90 412,120 408,105 395,92 375,85 355,88 340,80 325,85 310,80 295,88 275,85 255,92 240,105 232,120" fill={CFG.hair} />

   {/* ── FACE — polygon tracing face outline (forehead → temples → cheeks → jaw → chin) ── */}
   <polygon points="235,120 238,95 250,75 275,62 320,58 365,62 390,75 402,95 405,120 402,150 395,175 380,195 360,210 340,218 320,220 300,218 280,210 260,195 245,175 238,150" fill={CFG.skin} />

   {/* ── EARS — polygon tracing ear shapes ── */}
   <polygon points="238,135 230,140 228,155 232,170 240,168 238,155" fill={CFG.skinShadow} />
   <polygon points="402,135 410,140 412,155 408,170 400,168 402,155" fill={CFG.skinShadow} />

   {/* ── BEARD — polygon tracing jawline beard (NOT covering face) ── */}
   <polygon points="255,165 250,180 252,195 260,208 275,218 295,224 320,226 345,224 365,218 380,208 388,195 390,180 385,165 380,175 370,185 355,195 340,200 320,202 300,200 285,195 270,185 260,175" fill={CFG.beard} opacity="0.85" />
   {/* Mustache — polygon tracing upper lip hair */}
   <polygon points="292,190 305,186 320,188 335,186 348,190 340,194 320,193 300,194" fill={CFG.beard} />

   {/* ── EYEBROWS — polygon tracing brow shapes ── */}
   <polygon points="248,116 258,112 270,112 282,115 285,119 275,118 262,118 252,120" fill={CFG.hair} />
   <polygon points="355,116 365,112 378,112 390,115 392,119 382,118 370,118 358,120" fill={CFG.hair} />

   {/* ── GLASSES — polygon tracing frame outlines ── */}
   {/* Left lens rim */}
   <polygon points={`
    ${eyeL.x - eyeL.w / 2 - 5},${eyeL.y - eyeL.h - 3}
    ${eyeL.x + eyeL.w / 2 + 5},${eyeL.y - eyeL.h - 3}
    ${eyeL.x + eyeL.w / 2 + 5},${eyeL.y + eyeL.h + 3}
    ${eyeL.x - eyeL.w / 2 - 5},${eyeL.y + eyeL.h + 3}
   `} fill="none" stroke="#1a1a1a" strokeWidth="3" rx="6" />
   {/* Right lens rim */}
   <polygon points={`
    ${eyeR.x - eyeR.w / 2 - 5},${eyeR.y - eyeR.h - 3}
    ${eyeR.x + eyeR.w / 2 + 5},${eyeR.y - eyeR.h - 3}
    ${eyeR.x + eyeR.w / 2 + 5},${eyeR.y + eyeR.h + 3}
    ${eyeR.x - eyeR.w / 2 - 5},${eyeR.y + eyeR.h + 3}
   `} fill="none" stroke="#1a1a1a" strokeWidth="3" rx="6" />
   {/* Bridge */}
   <line x1={eyeL.x + eyeL.w / 2 + 5} y1={eyeL.y} x2={eyeR.x - eyeR.w / 2 - 5} y2={eyeR.y} stroke="#1a1a1a" strokeWidth="3" />
   {/* Temple arms */}
   <line x1={eyeL.x - eyeL.w / 2 - 5} y1={eyeL.y} x2="235" y2={eyeL.y + 4} stroke="#1a1a1a" strokeWidth="3" />
   <line x1={eyeR.x + eyeR.w / 2 + 5} y1={eyeR.y} x2="405" y2={eyeR.y + 4} stroke="#1a1a1a" strokeWidth="3" />

   {/* ── NOSE — polygon tracing nose bridge + tip + nostrils ── */}
   <polygon points="315,145 312,160 310,172 314,180 320,182 326,180 330,172 328,160 325,145 322,143 318,143" fill="none" stroke={CFG.skinShadow} strokeWidth="1.5" opacity="0.5" />
   {/* Left nostril */}
   <polygon points="314,179 316,182 318,180 316,177" fill={CFG.skinShadow} opacity="0.4" />
   {/* Right nostril */}
   <polygon points="322,180 324,182 326,179 324,177" fill={CFG.skinShadow} opacity="0.4" />

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
