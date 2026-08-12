"use client";

// src/components/learn/TutorBadge.tsx — Sprite-sheet rigged avatar.
// Cuts regions from a single sprite sheet PNG and layers them:
// face → mouth → beard → nose → eyes → brows → hair → gesture.
// Only eyes (blink) and mouth (lip-sync) animate. No sound waves.

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

// ── Crop regions (% of sheet) + rig positions (% of stage) ─────────
const SHEET_URL = "/assets/avatar/v1/avatar-sheet.png";

const DEFAULT_MAP: Record<string, {x:number;y:number;w:number;h:number}> = {
  faceBase: {x:2.2,y:52.3,w:16.6,h:12.6},
  hair:     {x:1.6,y:45.0,w:17.8,h:9.6},
  beard:    {x:3.0,y:63.3,w:15.2,h:9.2},
  nose:     {x:8.6,y:72.0,w:3.6,h:2.8},
  browsN:   {x:22.0,y:45.5,w:11.0,h:2.2},
  browsUp:  {x:22.0,y:48.9,w:11.0,h:2.2},
  browsSad: {x:34.0,y:55.8,w:11.0,h:2.2},
  eyesOpen: {x:22.0,y:53.2,w:11.0,h:2.8},
  eyesClosed:{x:34.0,y:53.4,w:11.0,h:2.0},
  eyesSide: {x:22.0,y:60.2,w:11.0,h:2.8},
  eyesWink: {x:22.0,y:63.6,w:11.0,h:2.8},
  eyesHappy:{x:34.0,y:60.4,w:11.0,h:2.2},
  m_closed: {x:47.4,y:45.6,w:5.6,h:1.8},
  m_smile:  {x:47.4,y:52.1,w:5.8,h:2.5},
  m_A:      {x:54.0,y:48.7,w:5.8,h:2.7},
  m_E:      {x:47.4,y:55.4,w:5.8,h:2.3},
  m_O:      {x:60.6,y:52.1,w:5.8,h:2.7},
  m_U:      {x:67.2,y:52.2,w:5.4,h:2.5},
  m_small:  {x:54.0,y:62.1,w:5.6,h:2.1},
  g_point:  {x:74.0,y:70.4,w:12.5,h:8.2},
  g_open:   {x:80.8,y:71.8,w:17.2,h:7.2},
  g_thumb:  {x:88.0,y:76.4,w:10.2,h:6.8},
  g_pen:    {x:74.0,y:82.8,w:12.5,h:7.4},
  g_thumb2: {x:86.4,y:82.4,w:12.2,h:8.2},
};

const DEFAULT_RIG: Record<string, {x:number;y:number;w:number}> = {
  face:    {x:14,y:6,w:72},
  mouth:   {x:37,y:52,w:26},
  beard:   {x:16,y:36,w:68},
  nose:    {x:44,y:44,w:13},
  eyes:    {x:26,y:33,w:48},
  brows:   {x:25,y:26,w:50},
  hair:    {x:12,y:0,w:76},
  gesture: {x:52,y:60,w:46},
};

// ── Moods ──────────────────────────────────────────────────────────
const MOODS: Record<string, {brows:string;eyes:string;mouth:string}> = {
  neutral:   {brows:"browsN",   eyes:"eyesOpen",   mouth:"m_closed"},
  smile:     {brows:"browsN",   eyes:"eyesOpen",   mouth:"m_smile"},
  happy:     {brows:"browsUp",  eyes:"eyesHappy",  mouth:"m_smile"},
  thinking:  {brows:"browsN",   eyes:"eyesSide",   mouth:"m_closed"},
  surprised: {brows:"browsUp",  eyes:"eyesOpen",   mouth:"m_O"},
  sad:       {brows:"browsSad", eyes:"eyesOpen",   mouth:"m_small"},
  wink:      {brows:"browsN",   eyes:"eyesWink",   mouth:"m_smile"},
};

const VISEMES = ["m_A","m_E","m_O","m_U","m_small","m_closed"];

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

// ── SpriteLayer — one cropped region from the sheet ────────────────
interface LayerData {
 key: string;
 srcKey: string;
 rig: {x:number;y:number;w:number};
 map: {x:number;y:number;w:number;h:number};
}

function SpriteLayer({ data, sheetW, sheetH, stageW, stageH, visible }: {
 data: LayerData; sheetW: number; sheetH: number; stageW: number; stageH: number; visible: boolean;
}) {
 if (!visible) return null;
 const src = data.map;
 const dst = data.rig;
 const srcW = src.w / 100 * sheetW;
 const srcH = src.h / 100 * sheetH;
 const scale = (dst.w / 100 * stageW) / srcW;
 const elW = dst.w / 100 * stageW;
 const elH = srcH * scale;
 const imgW = sheetW * scale;
 const imgH = sheetH * scale;
 const left = -src.x / 100 * sheetW * scale;
 const top = -src.y / 100 * sheetH * scale;

 return (
  <div
   className="tb-layer"
   style={{
    left: `${dst.x / 100 * stageW}px`,
    top: `${dst.y / 100 * stageH}px`,
    width: `${elW}px`,
    height: `${elH}px`,
   }}
  >
   <img
    src={SHEET_URL}
    alt=""
    draggable={false}
    style={{
     position: "absolute",
     width: `${imgW}px`,
     height: `${imgH}px`,
     left: `${left}px`,
     top: `${top}px`,
     maxWidth: "none",
     userSelect: "none",
    }}
   />
  </div>
 );
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
 const stageRef = useRef<HTMLDivElement>(null);
 const [sheetLoaded, setSheetLoaded] = useState(false);
 const [sheetW, setSheetW] = useState(0);
 const [sheetH, setSheetH] = useState(0);
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
 const [caption, setCaption] = useState("");

 // Avatar state
 const [mood, setMood] = useState("smile");
 const [gesture, setGestureState] = useState<string | null>(null);
 const [talking, setTalking] = useState(false);
 const [srcMap, setSrcMap] = useState<Record<string,string>>({
  face: "faceBase", mouth: "m_smile", beard: "beard", nose: "nose",
  eyes: "eyesOpen", brows: "browsN", hair: "hair",
 });
 const talkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Load sprite sheet
 useEffect(() => {
  const img = new Image();
  img.src = SHEET_URL;
  img.onload = () => {
   setSheetW(img.naturalWidth);
   setSheetH(img.naturalHeight);
   setSheetLoaded(true);
  };
 }, []);

 // Apply mood
 const applyMood = useCallback((m: string) => {
  const mo = MOODS[m] || MOODS.neutral;
  setMood(m);
  setSrcMap(prev => ({ ...prev, brows: mo.brows, eyes: mo.eyes, mouth: mo.mouth }));
 }, []);

 // Start/stop talking (lip-sync)
 const startTalking = useCallback(() => {
  setTalking(true);
  let i = 0;
  talkTimer.current = setInterval(() => {
   setSrcMap(prev => ({
    ...prev,
    mouth: VISEMES[(Math.random() * VISEMES.length) | 0],
   }));
   i++;
   if (i % 4 === 3) setSrcMap(prev => ({ ...prev, mouth: "m_closed" }));
  }, 95);
 }, []);

 const stopTalking = useCallback(() => {
  setTalking(false);
  if (talkTimer.current) { clearInterval(talkTimer.current); talkTimer.current = null; }
  const mo = MOODS[mood] || MOODS.neutral;
  setSrcMap(prev => ({ ...prev, mouth: mo.mouth }));
 }, [mood]);

 // Gesture
 const setGesture = useCallback((g: string | null) => {
  setGestureState(g);
  if (g) {
   holdTimer.current = setTimeout(() => {
    setGestureState(prev => prev === g ? null : prev);
   }, 2500);
  }
 }, []);

 // Apply gesture from event bus
 const applyGesture = useCallback((gesture: string) => {
  if (holdTimer.current) clearTimeout(holdTimer.current);
  stopTalking();

  const gestureMap: Record<string, {mood?:string;gesture?:string;talk?:boolean}> = {
   idle: {mood:"neutral"}, focus: {mood:"neutral"},
   hello: {mood:"happy",gesture:"g_open"}, bye: {mood:"smile",gesture:"g_open"},
   talk: {talk:true}, listen: {mood:"neutral"},
   think: {mood:"thinking",gesture:"g_point"}, confused: {mood:"thinking"},
   idea: {mood:"surprised",gesture:"g_point"}, surprised: {mood:"surprised"},
   praise: {mood:"happy",gesture:"g_thumb"}, celebrate: {mood:"happy",gesture:"g_thumb"},
   cheer: {mood:"happy",gesture:"g_thumb"}, laugh: {mood:"happy"},
   levelup: {mood:"happy",gesture:"g_thumb"}, streak: {mood:"happy"},
   comfort: {mood:"sad"}, oops: {mood:"sad"}, wink: {mood:"wink"},
   determined: {mood:"surprised",gesture:"g_point"}, proud: {mood:"happy",gesture:"g_thumb"},
  };

  const action = gestureMap[gesture] || {};
  if (action.mood) applyMood(action.mood);
  if (action.gesture) setGesture(action.gesture);
  else setGesture(null);
  if (action.talk) startTalking();
 }, [applyMood, setGesture, startTalking, stopTalking]);

 // Event bus wiring
 useEffect(() => {
  const unsubs: (() => void)[] = [];
  unsubs.push(tutor.on("gesture", (g: unknown) => applyGesture(g as string)));
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   if (phase === "start") { applyMood("smile"); startTalking(); }
   else if (phase === "end") stopTalking();
  }));
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, [applyGesture, applyMood, startTalking, stopTalking]);

 // Auto-shrink when busy
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (talking) setMode(m => (m === "mini" ? "full" : m));
 }, [busy, talking]);

 // Natural blink
 useEffect(() => {
  if (reduced || !sheetLoaded) return;
  const loop = () => {
   if (!talking && (mood === "neutral" || mood === "smile")) {
    setSrcMap(prev => ({ ...prev, eyes: "eyesClosed" }));
    setTimeout(() => {
     setSrcMap(prev => ({ ...prev, eyes: MOODS[mood]?.eyes || "eyesOpen" }));
    }, 140);
   }
   blinkTimer.current = setTimeout(loop, 2400 + Math.random() * 3200);
  };
  blinkTimer.current = setTimeout(loop, 800 + Math.random() * 2000);
  return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current); };
 }, [reduced, sheetLoaded, talking, mood]);

 // Cleanup
 useEffect(() => {
  return () => {
   if (talkTimer.current) clearInterval(talkTimer.current);
   if (holdTimer.current) clearTimeout(holdTimer.current);
   if (blinkTimer.current) clearTimeout(blinkTimer.current);
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

 // Build layer data
 const layers: LayerData[] = [
  { key: "face", srcKey: srcMap.face, rig: DEFAULT_RIG.face, map: DEFAULT_MAP[srcMap.face] },
  { key: "mouth", srcKey: srcMap.mouth, rig: DEFAULT_RIG.mouth, map: DEFAULT_MAP[srcMap.mouth] },
  { key: "beard", srcKey: srcMap.beard, rig: DEFAULT_RIG.beard, map: DEFAULT_MAP[srcMap.beard] },
  { key: "nose", srcKey: srcMap.nose, rig: DEFAULT_RIG.nose, map: DEFAULT_MAP[srcMap.nose] },
  { key: "eyes", srcKey: srcMap.eyes, rig: DEFAULT_RIG.eyes, map: DEFAULT_MAP[srcMap.eyes] },
  { key: "brows", srcKey: srcMap.brows, rig: DEFAULT_RIG.brows, map: DEFAULT_MAP[srcMap.brows] },
  { key: "hair", srcKey: srcMap.hair, rig: DEFAULT_RIG.hair, map: DEFAULT_MAP[srcMap.hair] },
 ];
 if (gesture) {
  layers.push({ key: "gesture", srcKey: gesture, rig: DEFAULT_RIG.gesture, map: DEFAULT_MAP[gesture] });
 }

 return (
  <div className="tb-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="tb-cap">{caption}</div>}
   {mode !== "dot" ? (
    <button className="tb-badge-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-avatar-stage" ref={stageRef} style={{ width: px, height: px }}>
      {sheetLoaded && stageRef.current && (() => {
       const sw = stageRef.current.clientWidth;
       const sh = stageRef.current.clientHeight;
       return <>
        {layers.map(L => (
         <SpriteLayer
          key={L.key}
          data={L}
          sheetW={sheetW}
          sheetH={sheetH}
          stageW={sw}
          stageH={sh}
          visible={true}
         />
        ))}
       </>
      })()}
      {!sheetLoaded && <div className="tb-loading">Loading…</div>}
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
 .tb-layer{position:absolute;overflow:hidden;pointer-events:none}
 .tb-layer img{position:absolute;max-width:none;user-select:none;-webkit-user-drag:none}
 .tb-loading{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:11px;color:#888}
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
