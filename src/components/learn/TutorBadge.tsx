"use client";

// src/components/learn/TutorBadge.tsx — Living Portrait Tutor Badge.
//
// ONE locked face photo + 100% code-driven animation. The face never changes;
// the code does the acting via SVG overlays, FX particles, mood rings, and props.
//
// Layers (back → front):
//   0. Circle frame + mood ring (emotion color)
//   1. Inner backdrop (soft radial)
//   2. Face photo (circular crop, micro-translate for gaze, breathing scale)
//   3. Brows overlay (SVG: neutral/raised/furrowed/one-up/empathetic)
//   4. Eyes overlay (SVG: open/blink/happy-arc/wide/wink/closed-arc)
//   5. Mouth overlay (SVG: hidden/closed/smile/mid/wide/laugh/o)
//   6. FX layer (emoji + CSS particles: sparkles, confetti, hearts, etc.)
//   7. Props layer (emoji hands/objects sliding from circle edge)
//   8. Shine layer (glasses glint sweep on "idea" moments)
//   9. Outside circle (caption bubble + XP chip)

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────
interface FaceConfig {
 faceImage: string;
 crop: { cx: number; cy: number; r: number };
 eyeL: { x: number; y: number };
 eyeR: { x: number; y: number };
 mouth: { x: number; y: number; w: number };
 brows: { leftX: number; leftY: number; rightX: number; rightY: number };
 mode: "real" | "collage";
}

interface Recipe {
 brows: string;
 eyes: string;
 mouth: string;
 fx: string[];
 props: string[];
 ring: string;
 motion: string;
 holdMs: number;
}

// ── Default face config (matches face-config.json) ─────────────────
const DEFAULT_CONFIG: FaceConfig = {
 faceImage: "/assets/avatar/v1/face.png",
 crop: { cx: 50, cy: 38, r: 42 },
 eyeL: { x: 38, y: 35 },
 eyeR: { x: 62, y: 35 },
 mouth: { x: 50, y: 55, w: 16 },
 brows: { leftX: 38, leftY: 27, rightX: 62, rightY: 27 },
 mode: "real",
};

// ── Expression recipes (inline copy of expressions.json) ───────────
const RECIPES: Record<string, Recipe> = {
 idle: { brows: "neutral", eyes: "open", mouth: "hidden", fx: [], props: [], ring: "transparent", motion: "breathe", holdMs: 0 },
 hello: { brows: "raised", eyes: "happy", mouth: "smile", fx: [], props: ["wave"], ring: "#22c55e", motion: "pop-in", holdMs: 2500 },
 talk: { brows: "neutral", eyes: "open", mouth: "amplitude", fx: [], props: [], ring: "#3b82f6", motion: "micro-nod", holdMs: 0 },
 listen: { brows: "neutral", eyes: "open", mouth: "hidden", fx: [], props: [], ring: "#14b8a6", motion: "tilt-3", holdMs: 0 },
 think: { brows: "one-up", eyes: "gaze-up-left", mouth: "hidden", fx: ["question"], props: [], ring: "#f59e0b", motion: "still", holdMs: 0 },
 idea: { brows: "raised", eyes: "wide", mouth: "smile", fx: ["exclaim"], props: [], ring: "#eab308", motion: "scale-pop", holdMs: 2000 },
 praise: { brows: "raised", eyes: "happy-arc", mouth: "smile", fx: ["sparkle"], props: [], ring: "#22c55e", motion: "gentle-bounce", holdMs: 2500 },
 celebrate: { brows: "raised", eyes: "happy", mouth: "laugh", fx: ["confetti", "party"], props: [], ring: "#fbbf24", motion: "bounce", holdMs: 3000 },
 comfort: { brows: "empathetic", eyes: "open", mouth: "soft-smile", fx: ["heart"], props: [], ring: "#3b82f6", motion: "gentle-tilt", holdMs: 3000 },
 oops: { brows: "furrow-soft", eyes: "open", mouth: "o", fx: ["sweat"], props: [], ring: "#f59e0b", motion: "shake", holdMs: 2000 },
 surprised: { brows: "raised", eyes: "wide", mouth: "o", fx: [], props: [], ring: "#ffffff", motion: "scale-105", holdMs: 1500 },
 wink: { brows: "raised", eyes: "wink", mouth: "smile", fx: ["sparkle-small"], props: [], ring: "#22c55e", motion: "still", holdMs: 2000 },
 determined: { brows: "in-down", eyes: "open", mouth: "closed-firm", fx: [], props: ["fist"], ring: "#ef4444", motion: "still", holdMs: 2500 },
 laugh: { brows: "raised", eyes: "closed-arc", mouth: "laugh", fx: ["star"], props: [], ring: "#fbbf24", motion: "bounce", holdMs: 2500 },
 focus: { brows: "neutral", eyes: "open", mouth: "hidden", fx: [], props: [], ring: "#10b981", motion: "breathe", holdMs: 0 },
 streak: { brows: "raised", eyes: "happy", mouth: "smile", fx: ["fire-orbit"], props: [], ring: "#f97316", motion: "still", holdMs: 2500 },
 levelup: { brows: "raised", eyes: "happy", mouth: "laugh", fx: ["star", "confetti"], props: [], ring: "#fbbf24", motion: "jump", holdMs: 3000 },
 confused: { brows: "one-up", eyes: "gaze-side", mouth: "hidden", fx: ["question"], props: [], ring: "#8b5cf6", motion: "tilt-3", holdMs: 0 },
 proud: { brows: "neutral", eyes: "gaze-chin-up", mouth: "smile", fx: ["star-glow"], props: [], ring: "#fbbf24", motion: "still", holdMs: 2500 },
 shy: { brows: "neutral", eyes: "gaze-away", mouth: "small-smile", fx: ["blush"], props: [], ring: "#f472b6", motion: "tilt-3", holdMs: 2000 },
 bye: { brows: "raised", eyes: "happy", mouth: "smile", fx: [], props: ["wave-slow"], ring: "#22c55e", motion: "fade-tilt", holdMs: 3000 },
};

// ── Event bus (same API as old tutor object) ───────────────────────
type Handler = (p?: unknown) => void;
const handlers: Record<string, Set<Handler>> = {};
let boundAudio: HTMLAudioElement | null = null;
const connected = new WeakSet<HTMLMediaElement>();

export const tutor = {
 on(ev: string, fn: Handler) { (handlers[ev] ??= new Set()).add(fn); return () => { handlers[ev]?.delete(fn); }; },
 emit(ev: string, p?: unknown) { handlers[ev]?.forEach(fn => fn(p)); },
 play(gesture: string) { this.emit("gesture", gesture); },
 caption(text: string) { this.emit("caption", text); },
 bindAudio(el: HTMLAudioElement) { boundAudio = el; },
 say(text: string, voice = true) {
  this.caption(text); this.emit("tts", "start");
  if (voice && typeof window !== "undefined" && "speechSynthesis" in window) {
   const u = new SpeechSynthesisUtterance(text);
   u.onend = () => this.emit("tts", "end"); u.onerror = () => this.emit("tts", "end");
   speechSynthesis.speak(u);
  } else setTimeout(() => this.emit("tts", "end"), Math.min(9000, text.length * 55));
 },
};

// Event → recipe mapping
const EVENT_MAP: Record<string, string> = {
 "session:start": "hello",
 "tts:start": "talk",
 "tts:end": "idle",
 "student:input": "listen",
 "tutor:thinking": "think",
 "slide:highlight": "idea",
 "answer:correct": "praise",
 "answer:wrong": "comfort",
 "badge": "celebrate",
 "xp": "celebrate",
 "motivate": "determined",
 "level:up": "levelup",
 "streak:day": "streak",
 "session:end": "bye",
 "emphasize": "idea",
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

// ── Amplitude hook (simulated, ~9 Hz mouth loop) ───────────────────
function useMouthAmplitude(active: boolean): number {
 const [level, setLevel] = useState(0);
 useEffect(() => {
  if (!active) { setLevel(0); return; }
  // Simulated amplitude — cycles 0-3 at ~9 Hz
  const id = setInterval(() => {
   setLevel(() => {
    const r = Math.random();
    if (r < 0.15) return 0;
    if (r < 0.5) return 1;
    if (r < 0.8) return 2;
    return 3;
   });
  }, 110);
  return () => clearInterval(id);
 }, [active]);
 return level;
}

// ── SVG Overlay: Brows ─────────────────────────────────────────────
function BrowsOverlay({ type, config, viewBox }: { type: string; config: FaceConfig; viewBox: string }) {
 const lx = config.brows.leftX, ly = config.brows.leftY;
 const rx = config.brows.rightX, ry = config.brows.rightY;
 const stroke = "#3a2a1a", sw = 2.2;

 const paths: Record<string, React.ReactNode> = {
  neutral: (<>
   <path d={`M ${lx - 5} ${ly} Q ${lx} ${ly - 1.5} ${lx + 5} ${ly}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry} Q ${rx} ${ry - 1.5} ${rx + 5} ${ry}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
  raised: (<>
   <path d={`M ${lx - 5} ${ly - 2} Q ${lx} ${ly - 4} ${lx + 5} ${ly - 2}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry - 2} Q ${rx} ${ry - 4} ${rx + 5} ${ry - 2}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
  "furrow-soft": (<>
   <path d={`M ${lx - 5} ${ly + 1} Q ${lx} ${ly - 0.5} ${lx + 5} ${ly - 1}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry - 1} Q ${rx} ${ry - 0.5} ${rx + 5} ${ry + 1}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
  "one-up": (<>
   <path d={`M ${lx - 5} ${ly - 3} Q ${lx} ${ly - 5} ${lx + 5} ${ly - 3}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry} Q ${rx} ${ry - 1.5} ${rx + 5} ${ry}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
  empathetic: (<>
   <path d={`M ${lx - 5} ${ly + 1} Q ${lx} ${ly - 1} ${lx + 5} ${ly - 0.5}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry - 0.5} Q ${rx} ${ry - 1} ${rx + 5} ${ry + 1}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
  "in-down": (<>
   <path d={`M ${lx - 5} ${ly - 1} L ${lx + 5} ${ly + 2}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
   <path d={`M ${rx - 5} ${ry + 2} L ${rx + 5} ${ry - 1}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
  </>),
 };

 return <svg viewBox={viewBox} className="tb-overlay" aria-hidden="true">{paths[type] ?? paths.neutral}</svg>;
}

// ── SVG Overlay: Eyes ──────────────────────────────────────────────
function EyesOverlay({ type, config, viewBox }: { type: string; config: FaceConfig; viewBox: string }) {
 const lx = config.eyeL.x, ly = config.eyeL.y;
 const rx = config.eyeR.x, ry = config.eyeR.y;
 const ew = 4, eh = 2.5;
 const skin = "#d4a574";

 // In "real" mode, eyes overlay only draws eyelid patches for blinks.
 // In "collage" mode, it draws cartoon eyes on top of the photo.
 if (config.mode === "real" && type !== "blink" && type !== "closed-arc" && type !== "wink") {
  // No overlay — real eyes show through
  if (type === "happy-arc") {
   return <svg viewBox={viewBox} className="tb-overlay" aria-hidden="true">
    {/* Happy arc — subtle dark arc over real eyes */}
    <path d={`M ${lx - ew} ${ly + 0.5} Q ${lx} ${ly - eh} ${lx + ew} ${ly + 0.5}`} stroke="#3a2a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />
    <path d={`M ${rx - ew} ${ry + 0.5} Q ${rx} ${ry - eh} ${rx + ew} ${ry + 0.5}`} stroke="#3a2a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />
   </svg>;
  }
  return null;
 }

 const eyes: Record<string, React.ReactNode> = {
  open: config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx} cy={ly} r="1.5" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx} cy={ry} r="1.5" fill="#3a2a1a" />
  </>) : null,
  blink: (<>
   <rect x={lx - ew} y={ly - 0.5} width={ew * 2} height="1.5" rx="0.75" fill={skin} />
   <rect x={rx - ew} y={ry - 0.5} width={ew * 2} height="1.5" rx="0.75" fill={skin} />
  </>),
  "happy-arc": (<>
   <path d={`M ${lx - ew} ${ly + 0.5} Q ${lx} ${ly - eh} ${lx + ew} ${ly + 0.5}`} stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
   <path d={`M ${rx - ew} ${ry + 0.5} Q ${rx} ${ry - eh} ${rx + ew} ${ry + 0.5}`} stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </>),
  wide: config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly} rx={ew + 1} ry={eh + 1.5} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx} cy={ly} r="1.8" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry} rx={ew + 1} ry={eh + 1.5} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx} cy={ry} r="1.8" fill="#3a2a1a" />
  </>) : null,
  wink: (<>
   <path d={`M ${lx - ew} ${ly + 0.5} Q ${lx} ${ly - eh} ${lx + ew} ${ly + 0.5}`} stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
   {config.mode === "collage" ? (<>
    <ellipse cx={rx} cy={ry} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
    <circle cx={rx} cy={ry} r="1.5" fill="#3a2a1a" />
   </>) : null}
  </>),
  "closed-arc": (<>
   <path d={`M ${lx - ew} ${ly - 0.5} Q ${lx} ${ly + eh} ${lx + ew} ${ly - 0.5}`} stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
   <path d={`M ${rx - ew} ${ry - 0.5} Q ${rx} ${ry + eh} ${rx + ew} ${ry - 0.5}`} stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </>),
  "gaze-up-left": config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx - 1} cy={ly - 1} r="1.5" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx - 1} cy={ry - 1} r="1.5" fill="#3a2a1a" />
  </>) : null,
  "gaze-side": config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx + 1.5} cy={ly} r="1.5" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx + 1.5} cy={ry} r="1.5" fill="#3a2a1a" />
  </>) : null,
  "gaze-chin-up": config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly + 0.5} rx={ew} ry={eh - 0.5} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx} cy={ly + 0.5} r="1.2" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry + 0.5} rx={ew} ry={eh - 0.5} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx} cy={ry + 0.5} r="1.2" fill="#3a2a1a" />
  </>) : null,
  "gaze-away": config.mode === "collage" ? (<>
   <ellipse cx={lx} cy={ly} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={lx - 2} cy={ly} r="1.5" fill="#3a2a1a" />
   <ellipse cx={rx} cy={ry} rx={ew} ry={eh} fill="#fff" stroke="#3a2a1a" strokeWidth="1" />
   <circle cx={rx - 2} cy={ry} r="1.5" fill="#3a2a1a" />
  </>) : null,
 };

 return <svg viewBox={viewBox} className="tb-overlay" aria-hidden="true">{eyes[type] ?? eyes.open}</svg>;
}

// ── SVG Overlay: Mouth ─────────────────────────────────────────────
function MouthOverlay({ type, level, config, viewBox }: { type: string; level: number; config: FaceConfig; viewBox: string }) {
 if (type === "hidden") return null;
 const mx = config.mouth.x, my = config.mouth.y, mw = config.mouth.w;
 const stroke = "#5a3a2a", sw = 2;

 // Amplitude-driven talk mouth
 if (type === "amplitude") {
  if (level === 0) return null; // Real mouth shows when silent
  const h = 1 + level * 1.5;
  return <svg viewBox={viewBox} className="tb-overlay" aria-hidden="true">
   <ellipse cx={mx} cy={my} rx={mw / 2.5} ry={h} fill="#7a3a2a" stroke={stroke} strokeWidth={sw} />;
  </svg>;
 }

 const mouths: Record<string, React.ReactNode> = {
  closed: <path d={`M ${mx - mw / 2} ${my} L ${mx + mw / 2} ${my}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />,
  smile: <path d={`M ${mx - mw / 2} ${my - 0.5} Q ${mx} ${my + 3} ${mx + mw / 2} ${my - 0.5}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />,
  mid: <ellipse cx={mx} cy={my} rx={mw / 2.5} ry="1.5" fill="#7a3a2a" stroke={stroke} strokeWidth={sw} />,
  wide: <ellipse cx={mx} cy={my} rx={mw / 2} ry="2.5" fill="#7a3a2a" stroke={stroke} strokeWidth={sw} />,
  laugh: <path d={`M ${mx - mw / 2} ${my - 1} Q ${mx} ${my + 4} ${mx + mw / 2} ${my - 1} Z`} fill="#7a3a2a" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />,
  o: <ellipse cx={mx} cy={my} rx={mw / 3.5} ry="3" fill="#7a3a2a" stroke={stroke} strokeWidth={sw} />,
  "soft-smile": <path d={`M ${mx - mw / 2.5} ${my} Q ${mx} ${my + 2} ${mx + mw / 2.5} ${my}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />,
  "closed-firm": <path d={`M ${mx - mw / 2} ${my} L ${mx + mw / 2} ${my}`} stroke={stroke} strokeWidth={sw + 0.5} fill="none" strokeLinecap="round" />,
  "small-smile": <path d={`M ${mx - mw / 3} ${my} Q ${mx} ${my + 1.5} ${mx + mw / 3} ${my}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />,
 };

 return <svg viewBox={viewBox} className="tb-overlay" aria-hidden="true">{mouths[type] ?? mouths.closed}</svg>;
}

// ── FX layer (emoji + CSS particles) ───────────────────────────────
function FXLayer({ fx, size }: { fx: string[]; size: number }) {
 const fxConfig: Record<string, { emoji: string; className: string; style?: React.CSSProperties }> = {
  sparkle: { emoji: "✨", className: "tb-fx-sparkle" },
  "sparkle-small": { emoji: "✨", className: "tb-fx-sparkle", style: { fontSize: size * 0.18 } },
  exclaim: { emoji: "❗", className: "tb-fx-pop" },
  question: { emoji: "❓", className: "tb-fx-float" },
  confetti: { emoji: "🎉", className: "tb-fx-confetti" },
  party: { emoji: "🎊", className: "tb-fx-pop" },
  heart: { emoji: "💙", className: "tb-fx-float" },
  sweat: { emoji: "💦", className: "tb-fx-fall" },
  star: { emoji: "⭐", className: "tb-fx-sparkle" },
  "star-glow": { emoji: "🌟", className: "tb-fx-sparkle" },
  "fire-orbit": { emoji: "🔥", className: "tb-fx-orbit" },
  blush: { emoji: "😊", className: "tb-fx-blush" },
 };

 return (
  <div className="tb-fx-layer" aria-hidden="true">
   {fx.map((f, i) => {
    const c = fxConfig[f];
    if (!c) return null;
    return <span key={i} className={`tb-fx ${c.className}`} style={{ fontSize: size * 0.2, ...c.style }}>{c.emoji}</span>;
   })}
  </div>
 );
}

// ── Props layer (emoji hands/objects sliding from circle edge) ─────
function PropsLayer({ props, size }: { props: string[]; size: number }) {
 const propConfig: Record<string, { emoji: string; className: string }> = {
  wave: { emoji: "👋", className: "tb-prop-wave" },
  "wave-slow": { emoji: "👋", className: "tb-prop-wave-slow" },
  fist: { emoji: "✊", className: "tb-prop-fist" },
 };

 return (
  <div className="tb-props-layer" aria-hidden="true">
   {props.map((p, i) => {
    const c = propConfig[p];
    if (!c) return null;
    return <span key={i} className={`tb-prop ${c.className}`} style={{ fontSize: size * 0.3 }}>{c.emoji}</span>;
   })}
  </div>
 );
}

// ── Dock sizes + position ──────────────────────────────────────────
const SIZES = { full: 140, mini: 84, dot: 44 } as const;
type Mode = keyof typeof SIZES;
type Pos = { side: "left" | "right"; bottom: number };
const LS_KEY = "tutorDockPos";
const loadPos = (): Pos => {
 try { const p = JSON.parse(localStorage.getItem(LS_KEY) || ""); if (p?.side) return p; } catch { /* corrupted — default */ }
 return { side: "right", bottom: 20 };
};

// ── TutorBadge — the main component ────────────────────────────────
export function AvatarDock({ config = DEFAULT_CONFIG }: { config?: FaceConfig }) {
 const [recipe, setRecipe] = useState<Recipe>(RECIPES.idle);
 const [caption, setCaption] = useState("");
 const reduced = useReducedMotion();
 const busy = useUserBusy();
 const [mode, setMode] = useState<Mode>(() =>
  typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
 const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isTalking = recipe.motion === "micro-nod";
 const mouthLevel = useMouthAmplitude(isTalking && !reduced);

 // Apply recipe from gesture/event
 const applyRecipe = useCallback((name: string) => {
  const r = RECIPES[name] ?? RECIPES.idle;
  setRecipe(r);
  if (holdTimer.current) clearTimeout(holdTimer.current);
  if (r.holdMs > 0) {
   holdTimer.current = setTimeout(() => setRecipe(RECIPES.idle), r.holdMs);
  }
 }, []);

 // Event bus wiring
 useEffect(() => {
  const unsubs: (() => void)[] = [];
  // Gesture events (direct recipe name)
  unsubs.push(tutor.on("gesture", (g: unknown) => applyRecipe(g as string)));
  // TTS events
  unsubs.push(tutor.on("tts", (phase: unknown) => {
   if (phase === "start") applyRecipe("talk");
   else if (phase === "end") applyRecipe("idle");
  }));
  // Caption
  let capTimer: ReturnType<typeof setTimeout>;
  unsubs.push(tutor.on("caption", (text: unknown) => {
   setCaption(text as string); clearTimeout(capTimer);
   capTimer = setTimeout(() => setCaption(""), 6000);
  }));
  // Tutor engine events (mapped via EVENT_MAP)
  Object.keys(EVENT_MAP).forEach(ev => {
   unsubs.push(tutor.on(ev, () => applyRecipe(EVENT_MAP[ev])));
  });
  return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
 }, [applyRecipe]);

 // Auto-shrink while learner busy, grow when tutor speaks
 useEffect(() => {
  if (busy) setMode(m => (m === "full" ? "mini" : m));
  else if (recipe.motion !== "breathe" && recipe.motion !== "still") setMode(m => (m === "mini" ? "full" : m));
 }, [busy, recipe]);

 // Celebrations pop to full
 useEffect(() => {
  if (["bounce", "jump", "scale-pop"].includes(recipe.motion)) {
   setMode(m => (m === "dot" ? m : "full"));
   const t = setTimeout(() => setMode(m => (m === "full" ? "mini" : m)), recipe.holdMs || 2500);
   return () => clearTimeout(t);
  }
 }, [recipe]);

 // Natural blink (every 3-6 seconds when idle/listening)
 const [blinking, setBlinking] = useState(false);
 useEffect(() => {
  if (reduced) return;
  const blink = () => {
   setBlinking(true);
   setTimeout(() => setBlinking(false), 150);
  };
  const interval = setInterval(() => {
   if (Math.random() < 0.4) blink();
  }, 3000);
  return () => clearInterval(interval);
 }, [reduced]);

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

 // Determine effective eye type (blink overrides)
 const effectiveEyes = blinking ? "blink" : recipe.eyes;
 const viewBox = `0 0 100 100`;
 const motionClass = reduced ? "" : `tb-motion-${recipe.motion}`;

 return (
  <div className="tb-dock" data-side={pos.side} style={style}>
   {caption && mode !== "dot" && <div className="tb-cap">{caption}</div>}

   {mode !== "dot" && (
    <button className={`tb-badge-btn ${motionClass}`} aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-badge" style={{ width: px, height: px }}>
      {/* Layer 0: Mood ring */}
      {recipe.ring !== "transparent" && <div className="tb-ring" style={{ borderColor: recipe.ring }} />}

      {/* Layer 1: Inner backdrop */}
      <div className="tb-backdrop" />

      {/* Layer 2: Face photo (circular crop, breathing) */}
      <div className="tb-face-wrap">
       <img src={config.faceImage} alt="AI tutor" className="tb-face" />
      </div>

      {/* Layer 3: Brows */}
      <BrowsOverlay type={recipe.brows} config={config} viewBox={viewBox} />

      {/* Layer 4: Eyes */}
      <EyesOverlay type={effectiveEyes} config={config} viewBox={viewBox} />

      {/* Layer 5: Mouth */}
      <MouthOverlay type={recipe.mouth} level={mouthLevel} config={config} viewBox={viewBox} />

      {/* Layer 6: FX */}
      <FXLayer fx={recipe.fx} size={px} />

      {/* Layer 7: Props */}
      <PropsLayer props={recipe.props} size={px} />

      {/* Layer 8: Shine (glasses glint on idea) */}
      {recipe.motion === "scale-pop" && <div className="tb-shine" />}

      {/* CSS sphere shadow */}
      <div className="tb-shadow" aria-hidden="true" />
     </div>
    </button>
   )}

   {mode === "dot" && (
    <button className="tb-dot-btn" aria-label="AI tutor (click to expand)" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
     <div className="tb-dot-indicator" style={{ borderColor: recipe.ring !== "transparent" ? recipe.ring : "#00b894" }} />
    </button>
   )}
  </div>
 );
}

// ── CSS — injected once ────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("tb-css")) {
 const s = document.createElement("style"); s.id = "tb-css"; s.textContent = `
 .tb-dock{position:fixed;z-index:40;pointer-events:none;transition:width .35s cubic-bezier(0.4,0,0.2,1),height .35s cubic-bezier(0.4,0,0.2,1),opacity .3s}
 .tb-badge-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:grab;touch-action:none;position:relative;border-radius:50%}
 .tb-badge-btn:active{cursor:grabbing}
 .tb-dot-btn{pointer-events:auto;border:0;background:transparent;padding:0;cursor:pointer;touch-action:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
 .tb-dot-indicator{width:14px;height:14px;background:#00b894;border-radius:50%;border:2px solid #00b894;box-shadow:0 0 15px rgba(0,184,148,0.3);animation:tbPulse 2.5s ease-in-out infinite}
 @keyframes tbPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}

 /* ── Badge (circle frame) ── */
 .tb-badge{position:relative;border-radius:50%;overflow:hidden;will-change:transform}
 .tb-ring{position:absolute;inset:-3px;border-radius:50%;border:3px solid transparent;transition:border-color .4s ease;z-index:0;box-shadow:0 0 12px currentColor}
 .tb-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,0.08) 0%,transparent 70%);z-index:1}

 /* ── Face photo ── */
 .tb-face-wrap{position:absolute;inset:0;border-radius:50%;overflow:hidden;z-index:2}
 .tb-face{width:100%;height:100%;object-fit:cover;object-position:50% 38%;will-change:transform}

 /* ── SVG overlays ── */
 .tb-overlay{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}

 /* ── FX layer ── */
 .tb-fx-layer{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:visible}
 .tb-fx{position:absolute;will-change:transform,opacity}
 .tb-fx-sparkle{top:-10%;right:-5%;animation:tbSparkle 1.5s ease-in-out infinite}
 .tb-fx-pop{top:-15%;left:50%;transform:translateX(-50%);animation:tbPop .6s ease-out}
 .tb-fx-float{top:-20%;right:0;animation:tbFloat 2s ease-in-out infinite}
 .tb-fx-confetti{top:-20%;left:50%;transform:translateX(-50%);animation:tbPop .5s ease-out}
 .tb-fx-fall{top:10%;right:5%;animation:tbFall 1.5s ease-in}
 .tb-fx-orbit{top:50%;left:50%;animation:tbOrbit 2s linear infinite}
 .tb-fx-blush{top:60%;left:50%;transform:translateX(-50%);opacity:0.4;font-size:60%!important}
 @keyframes tbSparkle{0%,100%{opacity:0;transform:scale(0.5) rotate(0)}50%{opacity:1;transform:scale(1) rotate(180deg)}}
 @keyframes tbPop{0%{opacity:0;transform:translateX(-50%) scale(0)}60%{opacity:1;transform:translateX(-50%) scale(1.2)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
 @keyframes tbFloat{0%,100%{opacity:0.5;transform:translateY(0)}50%{opacity:1;transform:translateY(-8px)}}
 @keyframes tbFall{0%{opacity:0;transform:translateY(-10px)}30%{opacity:1}100%{opacity:0;transform:translateY(20px)}}
 @keyframes tbOrbit{0%{transform:translate(-50%,-50%) rotate(0) translateX(60%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(360deg) translateX(60%) rotate(-360deg)}}

 /* ── Props layer ── */
 .tb-props-layer{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:visible}
 .tb-prop{position:absolute;will-change:transform}
 .tb-prop-wave{top:10%;right:-15%;animation:tbWave 0.8s ease-in-out infinite alternate}
 .tb-prop-wave-slow{top:10%;right:-15%;animation:tbWave 1.5s ease-in-out infinite alternate}
 .tb-prop-fist{bottom:5%;right:-10%;animation:tbPop .5s ease-out}
 @keyframes tbWave{0%{transform:rotate(-10deg)}100%{transform:rotate(20deg)}}

 /* ── Shine (glasses glint) ── */
 .tb-shine{position:absolute;top:20%;left:30%;width:40%;height:8%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent);transform:translateX(-100%);animation:tbShine 0.8s ease-out;z-index:8;pointer-events:none}
 @keyframes tbShine{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}

 /* ── Shadow ── */
 .tb-shadow{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:60%;height:10px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;z-index:0}

 /* ── Caption bubble ── */
 .tb-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);z-index:10}
 .tb-dock[data-side="right"] .tb-cap{right:calc(100% + 10px)}
 .tb-dock[data-side="left"] .tb-cap{left:calc(100% + 10px)}

 /* ── Motion classes ── */
 .tb-motion-breathe .tb-face{animation:tbBreathe 4s ease-in-out infinite}
 .tb-motion-pop-in{animation:tbPopIn .4s cubic-bezier(0.34,1.56,0.64,1)}
 .tb-motion-micro-nod .tb-face{animation:tbMicroNod 0.8s ease-in-out infinite}
 .tb-motion-tilt-3{animation:tbTilt3 0.5s ease-out forwards}
 .tb-motion-still{animation:none}
 .tb-motion-scale-pop{animation:tbScalePop .3s ease-out}
 .tb-motion-gentle-bounce{animation:tbGentleBounce 0.6s ease-in-out}
 .tb-motion-bounce{animation:tbBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)}
 .tb-motion-shake{animation:tbShake 0.4s ease-in-out}
 .tb-motion-scale-105{animation:tbScale105 0.2s ease-out}
 .tb-motion-jump{animation:tbJump 0.6s cubic-bezier(0.34,1.56,0.64,1)}
 .tb-motion-gentle-tilt{animation:tbGentleTilt 0.8s ease-in-out}
 .tb-motion-fade-tilt{animation:tbFadeTilt 1s ease-in-out forwards}

 @keyframes tbBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.01)}}
 @keyframes tbPopIn{0%{transform:scale(0.7);opacity:0}100%{transform:scale(1);opacity:1}}
 @keyframes tbMicroNod{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
 @keyframes tbTilt3{0%{transform:rotate(0)}100%{transform:rotate(-3deg)}}
 @keyframes tbScalePop{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
 @keyframes tbGentleBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
 @keyframes tbBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}60%{transform:translateY(-4px)}}
 @keyframes tbShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
 @keyframes tbScale105{0%{transform:scale(1)}100%{transform:scale(1.05)}}
 @keyframes tbJump{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
 @keyframes tbGentleTilt{0%,100%{transform:rotate(0)}50%{transform:rotate(2deg)}}
 @keyframes tbFadeTilt{0%{transform:rotate(0);opacity:1}100%{transform:rotate(-5deg);opacity:0.7}}

 /* ── Focus mode ── */
 body[data-focus] .tb-dock{opacity:.25}
 body[data-focus] .tb-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
