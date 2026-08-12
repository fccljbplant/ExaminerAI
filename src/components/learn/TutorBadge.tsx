"use client";

// src/components/learn/TutorBadge.tsx — Animate the vector SVG's own eyes + lips.
// The SVG has IDs on eye + mouth paths. We toggle their visibility/opacity
// to create blink, gaze, talk, smile — without any overlays.

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

// ── SVG element IDs for eyes + mouth ───────────────────────────────
const EYE_IDS = ["eyeL-iris", "eyeR-iris-1", "eyeR-iris-2", "eyeL-white", "eyeR-white-1", "eyeR-white-2", "eyeR-white-3"];
const MOUTH_IDS = ["mouth-upper", "mouth-line", "mouth-lower", "mouth-corner"];

// ── Helper: set opacity on SVG elements by ID ──────────────────────
function setOpacity(svg: SVGSVGElement | null, ids: string[], opacity: number) {
 if (!svg) return;
 ids.forEach(id => {
  const el = svg.querySelector(`#${id}`);
  if (el) el.setAttribute("opacity", String(opacity));
 });
}

function setTransform(svg: SVGSVGElement | null, id: string, transform: string) {
 if (!svg) return;
 const el = svg.querySelector(`#${id}`);
 if (el) el.setAttribute("transform", transform);
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
 const svgRef = useRef<SVGSVGElement>(null);
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
 const [caption, setCaption] = useState("");
 const talkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 // ── Blink: hide eye elements for 130ms ──
 const blink = useCallback(() => {
  const svg = svgRef.current;
  if (!svg) return;
  setOpacity(svg, EYE_IDS, 0);
  setTimeout(() => setOpacity(svg, EYE_IDS, 1), 130);
 }, []);

 // ── Talk: oscillate mouth element opacity ──
 const startTalk = useCallback(() => {
  const svg = svgRef.current;
  if (!svg) return;
  if (talkInterval.current) clearInterval(talkInterval.current);
  talkInterval.current = setInterval(() => {
   const t = performance.now();
   const open = 0.3 + 0.7 * Math.abs(Math.sin(t / 130) * 0.7 + Math.sin(t / 47) * 0.3);
   // Toggle mouth-line + mouth-corner visibility based on amplitude
   setOpacity(svg, ["mouth-line", "mouth-corner"], open > 0.5 ? 0 : 1);
   // Scale mouth-lower vertically to simulate opening
   const lowerEl = svg.querySelector("#mouth-lower");
   if (lowerEl) {
    const baseTransform = lowerEl.getAttribute("data-base-transform") || lowerEl.getAttribute("transform") || "";
    if (!lowerEl.getAttribute("data-base-transform")) {
     lowerEl.setAttribute("data-base-transform", baseTransform);
    }
    // Apply slight vertical scale
    const match = baseTransform.match(/translate\((\d+),(\d+)\)/);
    if (match) {
     const tx = parseInt(match[1]), ty = parseInt(match[2]);
     const scaleY = 0.8 + open * 0.6;
     lowerEl.setAttribute("transform", `translate(${tx},${ty}) scale(1,${scaleY})`);
    }
   }
  }, 90);
 }, []);

 const stopTalk = useCallback(() => {
  if (talkInterval.current) { clearInterval(talkInterval.current); talkInterval.current = null; }
  const svg = svgRef.current;
  if (!svg) return;
  setOpacity(svg, ["mouth-line", "mouth-corner"], 1);
  const lowerEl = svg?.querySelector("#mouth-lower");
  if (lowerEl) {
   const baseTransform = lowerEl.getAttribute("data-base-transform");
   if (baseTransform) lowerEl.setAttribute("transform", baseTransform);
  }
 }, []);

 // ── Gesture handler ──
 const applyGesture = useCallback((gesture: string) => {
  if (holdTimer.current) clearTimeout(holdTimer.current);
  stopTalk();
  const svg = svgRef.current;

  switch (gesture) {
   case "idle": case "focus":
    setOpacity(svg, EYE_IDS, 1);
    setOpacity(svg, MOUTH_IDS, 1);
    break;
   case "hello": case "bye":
    // Happy eyes — hide irises to make them look like ^^
    setOpacity(svg, ["eyeL-iris", "eyeR-iris-1", "eyeR-iris-2"], 0.3);
    setOpacity(svg, MOUTH_IDS, 1);
    holdTimer.current = setTimeout(() => { setOpacity(svg, EYE_IDS, 1); }, 2500);
    break;
   case "talk":
    startTalk();
    break;
   case "listen":
    setOpacity(svg, EYE_IDS, 1);
    setOpacity(svg, MOUTH_IDS, 1);
    break;
   case "think": case "confused":
    // Shift eye irises slightly (gaze)
    // For simplicity, just dim them slightly
    setOpacity(svg, ["eyeL-iris", "eyeR-iris-1", "eyeR-iris-2"], 0.7);
    holdTimer.current = setTimeout(() => setOpacity(svg, EYE_IDS, 1), 3000);
    break;
   case "idea": case "surprised":
    // Wide eyes — already fully visible, maybe pulse
    setOpacity(svg, EYE_IDS, 1);
    // O mouth — hide lip line, show only lower
    setOpacity(svg, ["mouth-line", "mouth-corner"], 0);
    holdTimer.current = setTimeout(() => { setOpacity(svg, MOUTH_IDS, 1); }, 2000);
    break;
   case "praise": case "celebrate": case "cheer": case "laugh": case "levelup": case "streak":
    // Happy eyes
    setOpacity(svg, ["eyeL-iris", "eyeR-iris-1", "eyeR-iris-2"], 0.3);
    holdTimer.current = setTimeout(() => setOpacity(svg, EYE_IDS, 1), 2500);
    break;
   case "comfort":
    setOpacity(svg, EYE_IDS, 1);
    setOpacity(svg, MOUTH_IDS, 1);
    break;
   case "oops":
    setOpacity(svg, ["mouth-line", "mouth-corner"], 0);
    holdTimer.current = setTimeout(() => setOpacity(svg, MOUTH_IDS, 1), 2000);
    break;
   case "wink":
    // Hide right eye only
    setOpacity(svg, ["eyeR-iris-1", "eyeR-iris-2", "eyeR-white-1", "eyeR-white-2", "eyeR-white-3"], 0);
    holdTimer.current = setTimeout(() => setOpacity(svg, EYE_IDS, 1), 2000);
    break;
   default:
    setOpacity(svg, EYE_IDS, 1);
    setOpacity(svg, MOUTH_IDS, 1);
  }
 }, [startTalk, stopTalk]);

 // ── Event bus wiring ──
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

 // ── Auto-shrink when busy ──
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
 }, [busy]);

 // ── Natural blink loop ──
 useEffect(() => {
  if (reduced) return;
  let blinkTimer: ReturnType<typeof setTimeout>;
  const loop = () => {
   blink();
   blinkTimer = setTimeout(loop, 2400 + Math.random() * 3200);
  };
  blinkTimer = setTimeout(loop, 800 + Math.random() * 2000);
  return () => clearTimeout(blinkTimer);
 }, [reduced, blink]);

 // ── Cleanup ──
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

 // Load SVG inline so we can query + animate its elements
 const [svgContent, setSvgContent] = useState<string>("");

 useEffect(() => {
  fetch("/assets/avatar/v1/vector-face.svg")
   .then(r => r.text())
   .then(setSvgContent)
   .catch(() => {});
 }, []);

 return (
  <div className="tb-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="tb-cap">{caption}</div>}
   {mode !== "dot" ? (
    <button className="tb-badge-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-badge" style={{ width: px, height: px }}>
      {svgContent ? (
       <div
        className="tb-svg-container"
        ref={(el) => {
         if (el) {
          const svg = el.querySelector("svg") as SVGSVGElement | null;
          if (svg) {
           svg.setAttribute("width", "100%");
           svg.setAttribute("height", "100%");
           svg.style.objectFit = "cover";
           svgRef.current = svg;
          }
         }
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
       />
      ) : (
       <div className="tb-loading">Loading...</div>
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

// ── CSS ────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("tb-css")) {
 const s = document.createElement("style"); s.id = "tb-css"; s.textContent = `
 .tb-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .tb-badge-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:grab;touch-action:none;position:relative;border-radius:12px;overflow:hidden}
 .tb-badge-btn:active{cursor:grabbing}
 .tb-badge{position:relative;border-radius:12px;overflow:hidden;will-change:transform;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.05)}
 .tb-svg-container{width:100%;height:100%}
 .tb-svg-container svg{width:100%;height:100%;display:block}
 .tb-loading{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:11px;color:#888}
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
