"use client";

// src/components/learn/TutorBadge.tsx — Floating avatar dock.
// Draggable, collapsible dock (full/mini/dot) that hosts the shared
// AvatarRig from modules/learn. The rig + `tutor` event bus live in
// @/modules/learn/components/avatar/avatar-rig — this file is only the
// docking behavior (position, drag, caption bubble, auto-shrink).

import React, { useEffect, useRef, useState } from "react";
import { AvatarRig, tutor } from "@/modules/learn/components/avatar/avatar-rig";

// Re-export so existing consumers keep working:
//   import { AvatarDock, tutor } from "@/components/learn/TutorBadge";
export { tutor };

// ── Hooks ──────────────────────────────────────────────────────────
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
 const busy = useUserBusy();
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
 const [caption, setCaption] = useState("");
 const [talking, setTalking] = useState(false);

 // Bus wiring — caption bubble + talking state (for auto-grow on speech).
 useEffect(() => {
  const unsubs: (() => void)[] = [];
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   setTalking(phase === "start");
  }));
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, []);

 // Auto-shrink when busy
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (talking) setMode(m => (m === "mini" ? "full" : m));
 }, [busy, talking]);

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
     <div className="tb-avatar-stage" style={{ width: px, height: px }}>
      <AvatarRig size={px} />
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
 .tb-avatar-stage{position:relative;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05);background:radial-gradient(circle at 50% 10%,#3b4a6b 0%,#22304d 55%,#16203a 100%);animation:tbIdle 4.2s ease-in-out infinite}
 @keyframes tbIdle{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(.2deg)}}
 .tb-shadow{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:60%;height:8px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;z-index:0}
 .tb-dot-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:pointer;touch-action:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
 .tb-dot-indicator{width:14px;height:14px;background:#00b894;border-radius:50%;box-shadow:0 0 15px rgba(0,184,148,0.3);animation:tbDotPulse 2.5s ease-in-out infinite}
 @keyframes tbDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
 .tb-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);z-index:10}
 .tb-dock[data-side="right"] .tb-cap{right:calc(100% + 10px)}
 .tb-dock[data-side="left"] .tb-cap{left:calc(100% + 10px)}
 body[data-focus] .tb-dock{opacity:.25}
 body[data-focus] .tb-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
