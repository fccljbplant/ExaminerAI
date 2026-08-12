"use client";

// src/components/learn/TutorBadge.tsx — Static avatar PNG + CSS blink/mouth overlays.
// Uses the audited business-ai-avatar approach: one PNG + CSS-positioned
// eyelid + mouth divs that animate via CSS keyframes.
//
// The avatar.png is 590×650 RGBA. Eye + mouth positions are calibrated
// percentages from the audited CSS.

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
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 const setStatus = useCallback((status: string) => {
  setStageClass(status);
 }, []);

 const applyGesture = useCallback((gesture: string) => {
  if (holdTimer.current) clearTimeout(holdTimer.current);

  switch (gesture) {
   case "idle": case "focus":
    setStatus("idle"); break;
   case "hello": case "bye":
    setStatus("speaking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 2500);
    break;
   case "talk":
    setStatus("speaking"); break;
   case "listen":
    setStatus("listening"); break;
   case "think": case "confused":
    setStatus("thinking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 3000);
    break;
   case "idea": case "surprised":
    setStatus("thinking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   case "praise": case "celebrate": case "cheer": case "laugh": case "levelup": case "streak":
    setStatus("speaking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 2500);
    break;
   case "comfort":
    setStatus("speaking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 3000);
    break;
   case "oops":
    setStatus("thinking");
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   case "wink":
    setStatus("idle");
    holdTimer.current = setTimeout(() => setStatus("idle"), 2000);
    break;
   default:
    setStatus("idle");
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

 useEffect(() => {
  return () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
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
     <div className={`tb-avatar-stage ${stageClass}`} style={{ width: px, height: px }}>
      <img src="/assets/avatar/v1/avatar.png" alt="AI tutor" className="tb-avatar-image" draggable={false} />
      <div className="tb-blink tb-left-eye" aria-hidden="true" />
      <div className="tb-blink tb-right-eye" aria-hidden="true" />
      <div className="tb-mouth" aria-hidden="true" />
      <div className="tb-avatar-status">
       <span className={`tb-status-dot ${stageClass}`} />
      </div>
      {stageClass === "speaking" && !reduced && (
       <div className="tb-sound-waves" aria-hidden="true"><i /><i /><i /></div>
      )}
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

// ── CSS — calibrated positions from the audited business-ai-avatar ─
if (typeof document !== "undefined" && !document.getElementById("tb-css")) {
 const s = document.createElement("style"); s.id = "tb-css"; s.textContent = `
 .tb-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .tb-badge-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:grab;touch-action:none;position:relative;border-radius:12px;overflow:hidden}
 .tb-badge-btn:active{cursor:grabbing}

 /* Avatar stage */
 .tb-avatar-stage{position:relative;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05);background:radial-gradient(circle at 50% 10%,#334155,#111827 70%)}

 /* Avatar image — idle breathing */
 .tb-avatar-image{display:block;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none;animation:tbIdle 4.2s ease-in-out infinite}
 @keyframes tbIdle{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(.25deg)}}
 .tb-avatar-stage.listening .tb-avatar-image{animation:tbListening 1.1s ease-in-out infinite}
 .tb-avatar-stage.thinking .tb-avatar-image{animation:tbThinking 1.5s ease-in-out infinite}
 @keyframes tbListening{0%,100%{transform:translateX(0)}50%{transform:translateX(5px) rotate(.3deg)}}
 @keyframes tbThinking{0%,100%{transform:rotate(0)}50%{transform:rotate(1.1deg) translateY(-3px)}}

 /* Blink overlays — calibrated for 590x650 avatar.png */
 .tb-blink{position:absolute;top:25.5%;width:11.2%;height:2.2%;background:#e7a37b;border-radius:50%;transform:scaleY(0);transform-origin:center;pointer-events:none;opacity:.96}
 .tb-left-eye{left:30.1%}
 .tb-right-eye{left:59.2%}
 .tb-avatar-stage.idle .tb-blink,
 .tb-avatar-stage.listening .tb-blink,
 .tb-avatar-stage.thinking .tb-blink,
 .tb-avatar-stage.speaking .tb-blink{animation:tbBlink 4.7s infinite}
 @keyframes tbBlink{0%,92%,100%{transform:scaleY(0)}94%,96%{transform:scaleY(1)}}

 /* Mouth overlay — talk animation */
 .tb-mouth{position:absolute;left:50.2%;top:38.1%;width:13.6%;height:2.2%;transform:translateX(-50%) scaleY(0);transform-origin:center;opacity:0;background:#541f1d;border-radius:45% 45% 52% 52%;pointer-events:none;box-shadow:inset 0 2px 0 rgba(255,255,255,.1)}
 .tb-avatar-stage.speaking .tb-mouth{opacity:1;animation:tbTalk .15s ease-in-out infinite alternate}
 @keyframes tbTalk{0%{width:12%;height:1.3%;transform:translateX(-50%) scaleY(.8)}33%{width:14.5%;height:4.2%;border-radius:48%}66%{width:10%;height:5.5%;border-radius:45%}100%{width:15.5%;height:2.7%;border-radius:52%}}

 /* Status indicator */
 .tb-avatar-status{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(15,23,42,.78);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);font-size:.7rem;box-shadow:0 4px 15px rgba(0,0,0,.2)}
 .tb-status-dot{width:8px;height:8px;border-radius:50%;background:#22c55e}
 .tb-status-dot.listening{background:#38bdf8}
 .tb-status-dot.thinking{background:#f59e0b;animation:tbDotPulse 1s infinite}
 .tb-status-dot.speaking{background:#22c55e;animation:tbDotPulse 1s infinite}
 @keyframes tbDotPulse{50%{transform:scale(1.55)}}

 /* Sound waves */
 .tb-sound-waves{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);display:flex;align-items:center;gap:4px}
 .tb-sound-waves i{width:3px;height:10px;border-radius:999px;background:#7dd3fc;animation:tbWave .45s ease-in-out infinite alternate}
 .tb-sound-waves i:nth-child(2){animation-delay:.12s}
 .tb-sound-waves i:nth-child(3){animation-delay:.24s}
 @keyframes tbWave{to{height:28px}}

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
