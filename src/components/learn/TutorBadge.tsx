"use client";

// src/components/learn/TutorBadge.tsx — 4-layer avatar: face + face-turn + eyes + mouth.
// Uses pre-split PNGs from the asset sheet with transparent backgrounds.
// Only eyes (blink) and mouth (talk) animate. No sound waves.

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
 const [caption, setCaption] = useState("");
 const [stageClass, setStageClass] = useState<string>("idle");
 const [eyesVisible, setEyesVisible] = useState(true);
 const [mouthClass, setMouthClass] = useState("");
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const talkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

 const setStatus = useCallback((status: string) => {
  setStageClass(status);
  // Mouth animation class
  if (status === "speaking") setMouthClass("tb-mouth-talk");
  else setMouthClass("");
 }, []);

 const blink = useCallback(() => {
  setEyesVisible(false);
  setTimeout(() => setEyesVisible(true), 130);
 }, []);

 const applyGesture = useCallback((gesture: string) => {
  if (holdTimer.current) clearTimeout(holdTimer.current);
  switch (gesture) {
   case "idle": case "focus":
    setStatus("idle"); setEyesVisible(true); break;
   case "hello": case "bye":
    setStatus("speaking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 2500);
    break;
   case "talk":
    setStatus("speaking"); setEyesVisible(true); break;
   case "listen":
    setStatus("listening"); setEyesVisible(true); break;
   case "think": case "confused":
    setStatus("thinking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 3000);
    break;
   case "idea": case "surprised":
    setStatus("thinking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   case "praise": case "celebrate": case "cheer": case "laugh": case "levelup": case "streak":
    setStatus("speaking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 2500);
    break;
   case "comfort":
    setStatus("speaking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 3000);
    break;
   case "oops":
    setStatus("thinking"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   case "wink":
    setStatus("idle"); setEyesVisible(true);
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   default:
    setStatus("idle"); setEyesVisible(true);
  }
 }, [setStatus]);

 useEffect(() => {
  const unsubs: (() => void)[] = [];
  unsubs.push(tutor.on("gesture", (g: unknown) => applyGesture(g as string)));
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   if (phase === "start") setStatus("speaking");
   else if (phase === "end") setStatus("idle");
  }));
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, [applyGesture, setStatus]);

 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (stageClass === "speaking") setMode(m => (m === "mini" ? "full" : m));
 }, [busy, stageClass]);

 // Natural blink loop
 useEffect(() => {
  if (reduced) return;
  const loop = () => {
   blink();
   blinkTimer.current = setTimeout(loop, 2400 + Math.random() * 3200);
  };
  blinkTimer.current = setTimeout(loop, 800 + Math.random() * 2000);
  return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current); };
 }, [reduced, blink]);

 useEffect(() => {
  return () => {
   if (holdTimer.current) clearTimeout(holdTimer.current);
   if (blinkTimer.current) clearTimeout(blinkTimer.current);
   if (talkInterval.current) clearInterval(talkInterval.current);
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

 // Determine which face image to use (face vs face-turn for listening/thinking)
 const faceSrc = stageClass === "listening" || stageClass === "thinking"
  ? "/assets/avatar/v1/face-turn.png"
  : "/assets/avatar/v1/face.png";

 return (
  <div className="tb-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="tb-cap">{caption}</div>}
   {mode !== "dot" ? (
    <button className="tb-badge-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className={`tb-avatar-stage ${stageClass}`} style={{ width: px, height: px }}>
      {/* Layer 1: Face (base) — or face-turn for listening/thinking */}
      <img src={faceSrc} alt="AI tutor" className="tb-layer tb-face" draggable={false} />
      {/* Layer 2: Eyes/eyebrows overlay — toggles for blink */}
      <img
       src="/assets/avatar/v1/eyes.png"
       alt=""
       className={`tb-layer tb-eyes ${eyesVisible ? "" : "tb-eyes-hidden"}`}
       draggable={false}
       aria-hidden="true"
      />
      {/* Layer 3: Mouth/lips overlay — animates for talk */}
      <img
       src="/assets/avatar/v1/mouth.png"
       alt=""
       className={`tb-layer tb-mouth ${mouthClass}`}
       draggable={false}
       aria-hidden="true"
      />
      {/* Status indicator */}
      <div className="tb-avatar-status">
       <span className={`tb-status-dot ${stageClass}`} />
      </div>
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

 /* Avatar stage */
 .tb-avatar-stage{position:relative;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05);background:radial-gradient(circle at 50% 10%,#334155,#111827 70%)}

 /* All layers — stacked, same size */
 .tb-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;transition:opacity .1s ease}

 /* Face — idle breathing motion */
 .tb-face{animation:tbIdle 4.2s ease-in-out infinite;z-index:1}
 @keyframes tbIdle{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(.25deg)}}
 .tb-avatar-stage.listening .tb-face{animation:tbListening 1.1s ease-in-out infinite}
 .tb-avatar-stage.thinking .tb-face{animation:tbThinking 1.5s ease-in-out infinite}
 @keyframes tbListening{0%,100%{transform:translateX(0)}50%{transform:translateX(3px) rotate(.2deg)}}
 @keyframes tbThinking{0%,100%{transform:rotate(0)}50%{transform:rotate(.8deg) translateY(-2px)}}

 /* Eyes overlay — visible by default, hidden during blink */
 .tb-eyes{z-index:2;opacity:1}
 .tb-eyes-hidden{opacity:0}

 /* Mouth overlay — animates during talk */
 .tb-mouth{z-index:3;opacity:0;transform-origin:center bottom}
 .tb-mouth.tb-mouth-talk{opacity:1;animation:tbTalk .15s ease-in-out infinite alternate}
 @keyframes tbTalk{0%{transform:scaleY(.3) scaleX(.95)}33%{transform:scaleY(1.2) scaleX(1.05)}66%{transform:scaleY(.5) scaleX(.9)}100%{transform:scaleY(1.4) scaleX(1.1)}}

 /* Status indicator */
 .tb-avatar-status{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:rgba(15,23,42,.78);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);font-size:.65rem;box-shadow:0 4px 15px rgba(0,0,0,.2);z-index:10}
 .tb-status-dot{width:7px;height:7px;border-radius:50%;background:#22c55e}
 .tb-status-dot.listening{background:#38bdf8}
 .tb-status-dot.thinking{background:#f59e0b;animation:tbDotPulse 1s infinite}
 .tb-status-dot.speaking{background:#22c55e;animation:tbDotPulse 1s infinite}
 @keyframes tbDotPulse{50%{transform:scale(1.55)}}

 /* Shadow */
 .tb-shadow{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:60%;height:8px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;z-index:0}

 /* Dot mode */
 .tb-dot-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:pointer;touch-action:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
 .tb-dot-indicator{width:14px;height:14px;background:#00b894;border-radius:50%;box-shadow:0 0 15px rgba(0,184,148,0.3);animation:tbDotPulse2 2.5s ease-in-out infinite}
 @keyframes tbDotPulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}

 /* Caption */
 .tb-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);z-index:10}
 .tb-dock[data-side="right"] .tb-cap{right:calc(100% + 10px)}
 .tb-dock[data-side="left"] .tb-cap{left:calc(100% + 10px)}
 body[data-focus] .tb-dock{opacity:.25}
 body[data-focus] .tb-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
