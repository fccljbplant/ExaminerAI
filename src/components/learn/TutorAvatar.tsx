"use client";

// src/components/learn/TutorAvatar.tsx — Baked-3D sprite avatar with smooth crossfade.
// Uses stacked <img> elements with CSS transitions (not canvas) for buttery-smooth
// gesture transitions. 3-state system: active → exiting → next active.
// Idle breathing + floating frame + professional macOS-style dock.

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Gesture types ──────────────────────────────────────────────────
type SheetKey =
  | "idle" | "talk" | "talkSoft" | "talkMid" | "talkWide" | "listen" | "think"
  | "point" | "explain" | "thumbsup" | "cheer" | "fistpump" | "comfort"
  | "wavehi" | "wavebye" | "write" | "question" | "jump";
type Gesture = Exclude<SheetKey, "talkSoft" | "talkMid" | "talkWide">;

// One-shot duration (ms) — how long a non-looping gesture plays before returning to idle.
const ONE_SHOT: Partial<Record<SheetKey, number>> = {
 wavehi: 2500, wavebye: 2500, thumbsup: 2000, cheer: 2500,
 fistpump: 2000, comfort: 2500, point: 2000, question: 2000,
 write: 2500, jump: 2000, explain: 3000,
};

// All 18 sprite URLs (transparent WebP, 360×450).
const SPRITES: Partial<Record<SheetKey, string>> = {
 idle: "/avatars/idle.webp", listen: "/avatars/listen.webp",
 think: "/avatars/think.webp", explain: "/avatars/explain.webp",
 talk: "/avatars/talk.webp", talkSoft: "/avatars/talk-soft.webp",
 talkMid: "/avatars/talk-mid.webp", talkWide: "/avatars/talk-wide.webp",
 wavehi: "/avatars/wavehi.webp", wavebye: "/avatars/wavebye.webp",
 thumbsup: "/avatars/thumbsup.webp", cheer: "/avatars/cheer.webp",
 fistpump: "/avatars/fistpump.webp", comfort: "/avatars/comfort.webp",
 point: "/avatars/point.webp", question: "/avatars/question.webp",
 write: "/avatars/write.webp", jump: "/avatars/jump.webp",
};

// ── Tiny event bus ─────────────────────────────────────────────────
type Handler = (p?: unknown) => void;
const handlers: Record<string, Set<Handler>> = {};
let boundAudio: HTMLAudioElement | null = null;
const connected = new WeakSet<HTMLMediaElement>();

export const tutor = {
 on(ev: string, fn: Handler) { (handlers[ev] ??= new Set()).add(fn); return () => { handlers[ev]?.delete(fn); }; },
 emit(ev: string, p?: unknown) { handlers[ev]?.forEach(fn => fn(p)); },
 play(g: Gesture) { this.emit("gesture", g); },
 caption(text: string) { this.emit("caption", text); },
 bindAudio(el: HTMLAudioElement) { boundAudio = el; },
 say(text: string, voice = true) {
  this.caption(text); this.emit("tts");
  if (voice && typeof window !== "undefined" && "speechSynthesis" in window) {
   const u = new SpeechSynthesisUtterance(text);
   u.onend = () => this.emit("tts:end"); u.onerror = () => this.emit("tts:end");
   speechSynthesis.speak(u);
  } else setTimeout(() => this.emit("tts:end"), Math.min(9000, text.length * 55));
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

// ── Tutor state — tracks current gesture + caption ─────────────────
function useTutorState() {
 const [gesture, setGesture] = useState<SheetKey>("idle");
 const [caption, setCaption] = useState("");
 useEffect(() => {
  let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
  const a = tutor.on("gesture", (g: unknown) => {
   const sheet = g as SheetKey;
   setGesture(sheet); clearTimeout(t1);
   if (ONE_SHOT[sheet]) t1 = setTimeout(() => setGesture("idle"), ONE_SHOT[sheet]);
  });
  const b = tutor.on("tts", () => setGesture("talk"));
  const c = tutor.on("tts:end", () => setGesture("idle"));
  const d = tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(t2); t2 = setTimeout(() => setCaption(""), 6000);
  });
  return () => { a(); b(); c(); d(); };
 }, []);
 return { gesture, caption };
}

// ── Preload all sprites on module load ─────────────────────────────
const imgCache: Record<string, HTMLImageElement> = {};
const getImg = (url: string) => (imgCache[url] ??= (() => { const i = new Image(); i.src = url; return i; })());
if (typeof window !== "undefined") {
 Object.values(SPRITES).forEach((url) => { if (url) getImg(url); });
}

// ── SpriteAvatar — IMG-based crossfade (not canvas) ────────────────
// Stacked <img> elements with CSS transitions for buttery-smooth gesture changes.
// 3-state system: active (entrance from scale 0.96) → exiting (scale 1.02 + blur)
// → next active (entrance from scale 0.96).
function SpriteAvatar({ gesture, reduced }: { gesture: SheetKey; reduced: boolean }) {
 const [activeGesture, setActiveGesture] = useState<SheetKey>(gesture);
 const [exitingGesture, setExitingGesture] = useState<SheetKey | null>(null);
 const [isEntering, setIsEntering] = useState(false);

 // When gesture changes, trigger the 3-state crossfade.
 useEffect(() => {
  if (gesture === activeGesture) return;
  setExitingGesture(activeGesture);
  setActiveGesture(gesture);
  setIsEntering(true);
  // Remove entering class after the entrance animation completes.
  const enterTimer = setTimeout(() => setIsEntering(false), 450);
  // Clean up exiting after the transition completes.
  const exitTimer = setTimeout(() => setExitingGesture(null), 450);
  return () => { clearTimeout(enterTimer); clearTimeout(exitTimer); };
 }, [gesture, activeGesture]);

 const activeUrl = SPRITES[activeGesture];
 const exitingUrl = exitingGesture ? SPRITES[exitingGesture] : null;

 // Active image classes: ta-active (base) + ta-entering (entrance anim) + ta-breathe (idle only, after entrance)
 const activeClasses = ["ta-sprite", "ta-active"];
 if (isEntering && !reduced) activeClasses.push("ta-entering");
 if (activeGesture === "idle" && !isEntering && !reduced) activeClasses.push("ta-breathe");

 return (
  <div className="ta-sprite-wrap">
   {/* Exiting image — fades out + scales up slightly + blur */}
   {exitingUrl && (
    <img
     src={exitingUrl}
     alt=""
     className={`ta-sprite ta-exiting ${reduced ? "" : "ta-animate"}`}
     aria-hidden="true"
    />
   )}
   {/* Active image — entrance from scale 0.96, then breathing if idle */}
   {activeUrl && (
    <img
     src={activeUrl}
     alt="AI tutor"
     className={activeClasses.join(" ")}
    />
   )}
  </div>
 );
}

// ── Dock sizes + position ──────────────────────────────────────────
const SIZES = { full: 140, mini: 84, dot: 44 } as const;
type Mode = keyof typeof SIZES;
type Pos = { side: "left" | "right"; bottom: number };
const LS_KEY = "tutorDockPos";
const loadPos = (): Pos => {
 try { const p = JSON.parse(localStorage.getItem(LS_KEY) || ""); if (p?.side) return p; } catch {
  // Corrupted localStorage entry — fall through to default position.
 }
 return { side: "right", bottom: 20 };
};

// ── AvatarDock — the floating interactive avatar ───────────────────
export function AvatarDock() {
 const { gesture, caption } = useTutorState();
 const reduced = useReducedMotion();
 const busy = useUserBusy();
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);

 // Shrink while learner busy, grow when tutor speaks.
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (gesture !== "idle") setMode(m => (m === "mini" ? "full" : m));
 }, [busy, gesture]);

 // Celebrations briefly pop to full.
 useEffect(() => {
  if (["cheer", "jump", "thumbsup"].includes(gesture)) {
   setMode(m => (m === "dot" ? m : "full"));
   const t = setTimeout(() => setMode(m => (m === "full" ? "mini" : m)), 2200);
   return () => clearTimeout(t);
  }
 }, [gesture]);

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
  <div className="ta-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="ta-cap">{caption}</div>}
   <button className="ta-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
    <SpriteAvatar gesture={gesture} reduced={reduced} />
   </button>
   {/* CSS sphere shadow under the avatar */}
   {mode !== "dot" && <div className="ta-shadow" aria-hidden="true" />}
  </div>
 );
}

// ── CSS — injected once ────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("ta-css")) {
 const s = document.createElement("style"); s.id = "ta-css"; s.textContent = `
 .ta-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .ta-btn{pointer-events:auto;border:0;background:transparent;padding:0;width:100%;height:100%;cursor:grab;touch-action:none;position:relative;border-radius:12px}
 .ta-btn:active{cursor:grabbing}

 /* ── Sprite crossfade system ── */
 .ta-sprite-wrap{position:relative;width:100%;height:100%;overflow:hidden;border-radius:12px}
 .ta-sprite{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;will-change:opacity,transform,filter}

 /* Active image — visible, normal scale. Entrance animation runs once on mount. */
 .ta-sprite.ta-active{opacity:1;transform:scale(1) translateY(0);filter:brightness(1) blur(0);z-index:2;
   transition:opacity .45s cubic-bezier(0.4,0,0.2,1),transform .45s cubic-bezier(0.4,0,0.2,1),filter .45s cubic-bezier(0.4,0,0.2,1)}
 /* Entrance: new active image fades in from scale 0.96 + slight Y offset */
 .ta-sprite.ta-active.ta-entering{animation:taEnter .45s cubic-bezier(0.4,0,0.2,1)}
 @keyframes taEnter{from{opacity:0;transform:scale(0.96) translateY(6px);filter:brightness(0.95)}to{opacity:1;transform:scale(1) translateY(0);filter:brightness(1)}}

 /* Exiting image — fades out, scales up slightly, subtle blur */
 .ta-sprite.ta-exiting{opacity:0;transform:scale(1.02) translateY(-4px);filter:brightness(1.05) blur(1px);z-index:1;
   transition:opacity .35s cubic-bezier(0.4,0,0.2,1),transform .35s cubic-bezier(0.4,0,0.2,1),filter .35s cubic-bezier(0.4,0,0.2,1)}

 /* Exiting image with animation class — plays the exit keyframes */
 .ta-sprite.ta-exiting.ta-animate{animation:taExit .35s cubic-bezier(0.4,0,0.2,1) forwards}
 @keyframes taExit{from{opacity:1;transform:scale(1) translateY(0);filter:brightness(1) blur(0)}to{opacity:0;transform:scale(1.02) translateY(-4px);filter:brightness(1.05) blur(1px)}}

 /* Idle breathing — subtle scale + translateY infinite loop.
    Only applies when NOT entering (entrance animation completes first, then breathing takes over). */
 .ta-sprite.ta-breathe{animation:taBreathe 4s ease-in-out infinite .5s}
 @keyframes taBreathe{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.008) translateY(-3px)}}

 /* ── Caption bubble ── */
 .ta-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);z-index:10}
 .ta-dock[data-side="right"] .ta-cap{right:calc(100% + 10px)}
 .ta-dock[data-side="left"] .ta-cap{left:calc(100% + 10px)}

 /* ── CSS sphere shadow ── */
 .ta-shadow{position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:55%;height:12px;
   background:radial-gradient(ellipse at center,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.14) 40%,transparent 75%);
   border-radius:50%;pointer-events:none;filter:blur(2px);z-index:0}

 /* ── Focus mode dimming ── */
 body[data-focus] .ta-dock{opacity:.25}
 body[data-focus] .ta-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
