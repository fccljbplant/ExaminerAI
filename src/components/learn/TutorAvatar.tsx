"use client";

// src/components/learn/TutorAvatar.tsx — Sprite player + lip-sync + event bus + floating dock.
// Procedural placeholder until real sprite strips exist (zero assets needed).

import React, { useEffect, useRef, useState } from "react";

type SheetKey =
 | "idle" | "talk" | "talkSoft" | "talkMid" | "talkWide" | "listen" | "think"
 | "point" | "explain" | "thumbsup" | "cheer" | "fistpump" | "comfort"
 | "wavehi" | "wavebye" | "write" | "question" | "jump";
type Gesture = Exclude<SheetKey, "talkSoft" | "talkMid" | "talkWide">;

const SHEETS: Record<SheetKey, { frames: number; fps: number; loop: boolean }> = {
 // Single-frame baked-3D sprites (pre-rendered Pixar-style character).
 // Each sprite is a 360x450 transparent WebP. The canvas player shows
 // the frame statically — real multi-frame animation strips can replace
 // these later without changing any code (just update frames count + SPRITES URL).
 idle: { frames: 1, fps: 8, loop: true }, listen: { frames: 1, fps: 8, loop: true },
 think: { frames: 1, fps: 10, loop: true }, explain: { frames: 1, fps: 12, loop: true },
 talk: { frames: 1, fps: 12, loop: true }, talkSoft: { frames: 1, fps: 10, loop: true },
 talkMid: { frames: 1, fps: 12, loop: true }, talkWide: { frames: 1, fps: 14, loop: true },
 wavehi: { frames: 1, fps: 12, loop: false }, wavebye: { frames: 1, fps: 10, loop: false },
 thumbsup: { frames: 1, fps: 12, loop: false }, cheer: { frames: 1, fps: 14, loop: false },
 fistpump: { frames: 1, fps: 12, loop: false }, comfort: { frames: 1, fps: 10, loop: false },
 point: { frames: 1, fps: 12, loop: false }, question: { frames: 1, fps: 12, loop: false },
 write: { frames: 1, fps: 12, loop: false }, jump: { frames: 1, fps: 14, loop: false },
};
const ONE_SHOT: Partial<Record<SheetKey, number>> = {};
(Object.keys(SHEETS) as SheetKey[]).forEach(k => {
 const s = SHEETS[k]; if (!s.loop) ONE_SHOT[k] = (s.frames / s.fps) * 1000 + 250;
});
// Baked-3D sprite strips (Pixar-style, transparent WebP, 360x450 per frame).
// Generated via scripts/avatar-assets/ — see manifest.json in /public/avatars/.
// Missing sheets (explain, listen, talk, fistpump, question, write, jump) fall
// back to the procedural placeholder canvas renderer.
const SPRITES: Partial<Record<SheetKey, string>> = {
 idle: "/avatars/idle.webp",
 talkSoft: "/avatars/talk-soft.webp",
 talkMid: "/avatars/talk-mid.webp",
 talkWide: "/avatars/talk-wide.webp",
 wavehi: "/avatars/wavehi.webp",
 point: "/avatars/point.webp",
 thumbsup: "/avatars/thumbsup.webp",
 think: "/avatars/think.webp",
 cheer: "/avatars/cheer.webp",
 comfort: "/avatars/comfort.webp",
 wavebye: "/avatars/wavebye.webp",
};

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

function useTutorState() {
 const [gesture, setGesture] = useState<Gesture>("idle");
 const [caption, setCaption] = useState("");
 useEffect(() => {
 let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
 const a = tutor.on("gesture", (g) => {
 const gesture = g as Gesture;
 setGesture(gesture); clearTimeout(t1);
 if (ONE_SHOT[gesture]) t1 = setTimeout(() => setGesture("idle"), ONE_SHOT[gesture]);
 });
 const b = tutor.on("tts", () => setGesture("talk"));
 const c = tutor.on("tts:end", () => setGesture("idle"));
 const d = tutor.on("caption", (text) => {
 const caption = text as string;
 setCaption(caption); clearTimeout(t2); t2 = setTimeout(() => setCaption(""), 6000);
 });
 return () => { a(); b(); c(); d(); };
 }, []);
 return { gesture, caption };
}

function useMouthLevel(active: boolean, reduced: boolean) {
 const [level, setLevel] = useState(0);
 useEffect(() => {
 if (!active || reduced) { setLevel(0); return; }
 const el = boundAudio;
 if (el && !connected.has(el)) {
 try {
 const ctx = new AudioContext();
 const src = ctx.createMediaElementSource(el);
 const an = ctx.createAnalyser(); src.connect(an); an.connect(ctx.destination);
 connected.add(el);
 const buf = new Uint8Array(an.fftSize);
 const id = setInterval(() => {
 an.getByteTimeDomainData(buf);
 const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length) / 128;
 setLevel(rms < 0.04 ? 0 : Math.min(3, 1 + Math.floor(rms * 5)));
 }, 80);
 return () => clearInterval(id);
 } catch {
 // AudioContext may fail if the element is cross-origin or already
 // connected — fall through to the simulated fallback below.
 }
 }
 const id = setInterval(() =>
 setLevel(Math.random() < 0.18 ? 0 : 1 + Math.floor(Math.random() * 3)), 130);
 return () => clearInterval(id);
 }, [active, reduced]);
 return level;
}

const W = 360, H = 450;
const imgCache: Record<string, HTMLImageElement> = {};
const getImg = (url: string) => (imgCache[url] ??= (() => { const i = new Image(); i.src = url; return i; })());

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
 ctx.beginPath();
 ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
 ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, g: string, mouth: number, t: number) {
 ctx.clearRect(0, 0, W, H);
 const cx = 180, bob = Math.sin(t / 500) * 4, wig = Math.sin(t / 170) * 12;
 ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.ellipse(cx, 432, 92, 13, 0, 0, 7); ctx.fill();
 ctx.strokeStyle = "#7d9484"; ctx.lineWidth = 26; ctx.lineCap = "round";
 const arm = (a: number, b: number, c: number, d: number) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
 if (g === "cheer" || g === "jump") { arm(140, 300, 92, 185 + wig); arm(220, 300, 268, 185 - wig); }
 else if (g === "wavehi" || g === "wavebye") { arm(220, 300, 272, 205 + wig); arm(140, 300, 120, 368); }
 else if (g === "point") { arm(220, 300, 322, 268); arm(140, 300, 120, 368); }
 else if (g === "thumbsup" || g === "fistpump") { arm(220, 300, 258, 225 + wig / 2); arm(140, 300, 120, 368); }
 else if (g === "think") { arm(220, 300, 198, 222); arm(140, 300, 120, 368); }
 else if (g === "comfort" || g === "question") { arm(140, 300, 100, 262 - wig / 2); arm(220, 300, 260, 262 + wig / 2); }
 else if (g === "explain") { arm(140, 300, 96, 266 + wig / 2); arm(220, 300, 264, 266 - wig / 2); }
 else { arm(140, 300, 120, 372); arm(220, 300, 240, 372); }
 ctx.fillStyle = "#8fa590"; rr(ctx, 110, 252 + bob, 140, 160, 46); ctx.fill();
 ctx.fillStyle = "#fff"; rr(ctx, 150, 262 + bob, 60, 140, 26); ctx.fill();
 ctx.fillStyle = "#f7dcc0"; ctx.beginPath(); ctx.arc(cx, 160 + bob, 78, 0, 7); ctx.fill();
 ctx.fillStyle = "#6b4a35"; ctx.beginPath(); ctx.arc(cx, 132 + bob, 78, Math.PI, 0); ctx.fill();
 ctx.beginPath(); ctx.arc(254, 168 + bob, 22, 0, 7); ctx.fill();
 ctx.strokeStyle = "#4a4a4a"; ctx.lineWidth = 4;
 ctx.beginPath(); ctx.arc(150, 166 + bob, 24, 0, 7); ctx.stroke();
 ctx.beginPath(); ctx.arc(212, 166 + bob, 24, 0, 7); ctx.stroke();
 ctx.beginPath(); ctx.moveTo(174, 166 + bob); ctx.lineTo(188, 166 + bob); ctx.stroke();
 ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(150, 166 + bob, 6, 0, 7); ctx.fill();
 ctx.beginPath(); ctx.arc(212, 166 + bob, 6, 0, 7); ctx.fill();
 if (mouth <= 0) { ctx.strokeStyle = "#8c5b46"; ctx.lineWidth = 5;
 ctx.beginPath(); ctx.arc(cx, 198 + bob, 16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
 else { ctx.fillStyle = "#7c4a3a";
 ctx.beginPath(); ctx.ellipse(cx, 206 + bob, 14, 4 + mouth * 6, 0, 0, 7); ctx.fill(); }
}

function SpriteAvatar({ sheet, mouth, reduced }: { sheet: SheetKey; mouth: number; reduced: boolean }) {
 const ref = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
 const canvas = ref.current!; const ctx = canvas.getContext("2d")!;
 const url = SPRITES[sheet]; const img = url ? getImg(url) : null;
 const cfg = SHEETS[sheet];
 let frame = 0, last = 0, raf = 0;
 const draw = (t: number) => {
 // Use the sprite image if it has loaded and is at least W pixels wide.
 // Single-frame sprites are exactly W (360) wide; multi-frame strips are
 // W * frames wide. Both cases are handled by the drawImage source-crop.
 if (img && img.complete && img.naturalWidth >= W && img.naturalHeight >= H) {
 ctx.clearRect(0, 0, W, H); ctx.drawImage(img, frame * W, 0, W, H, 0, 0, W, H);
 } else drawPlaceholder(ctx, sheet, sheet.startsWith("talk") ? mouth : 0, t);
 };
 const step = (t: number) => {
 if (reduced) { draw(t); return; }
 raf = requestAnimationFrame(step);
 if (t - last < 1000 / cfg.fps) return;
 last = t; draw(t);
 if (frame >= cfg.frames - 1) frame = cfg.loop ? 0 : frame; else frame++;
 };
 raf = requestAnimationFrame(step);
 return () => cancelAnimationFrame(raf);
 }, [sheet, mouth, reduced]);
 return <canvas ref={ref} width={W} height={H} />;
}

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

export function AvatarDock() {
 const { gesture, caption } = useTutorState();
 const reduced = useReducedMotion();
 const busy = useUserBusy();
 const mouth = useMouthLevel(gesture === "talk", reduced);
 const [mode, setMode] = useState<Mode>(() =>
 typeof window !== "undefined" && window.innerWidth < 640 ? "mini" : "full");
 const [pos, setPos] = useState<Pos>(loadPos);
 const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
 const dragInfo = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
 const sheet: SheetKey = gesture === "talk" ? (mouth <= 1 ? "talkSoft" : mouth === 2 ? "talkMid" : "talkWide") : gesture;

 useEffect(() => {
 if (busy) setMode(m => (m === "full" ? "mini" : m));
 else if (gesture !== "idle") setMode(m => (m === "mini" ? "full" : m));
 }, [busy, gesture]);

 useEffect(() => {
 if (["cheer", "jump", "thumbsup"].includes(gesture)) {
 setMode(m => (m === "dot" ? m : "full"));
 const t = setTimeout(() => setMode(m => (m === "full" ? "mini" : m)), 2200);
 return () => clearTimeout(t);
 }
 }, [gesture]);

 const px = SIZES[mode]; const h = px * 1.25;
 const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); dragInfo.current = { sx: e.clientX, sy: e.clientY, moved: false }; };
 const onMove = (e: React.PointerEvent) => { const d = dragInfo.current; if (!d) return; if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 8) d.moved = true; if (d.moved) setDrag({ x: e.clientX - px / 2, y: e.clientY - h / 2 }); };
 const onUp = (e: React.PointerEvent) => { const d = dragInfo.current; dragInfo.current = null; setDrag(null); if (d?.moved) { const side: Pos["side"] = e.clientX < innerWidth / 2 ? "left" : "right"; const bottom = Math.max(8, Math.min(innerHeight - h - 8, innerHeight - e.clientY - h / 2)); const p = { side, bottom }; setPos(p); localStorage.setItem(LS_KEY, JSON.stringify(p)); } else setMode(m => (m === "full" ? "mini" : m === "mini" ? "dot" : "full")); };
 const style: React.CSSProperties = drag ? { left: drag.x, top: drag.y, width: px, height: h } : { [pos.side]: 16, bottom: pos.bottom, width: px, height: h } as React.CSSProperties;

 return (
 <div className="ta-dock" data-side={pos.side} style={style}>
 {caption && mode !== "dot" && <div className="ta-cap">{caption}</div>}
 <button className="ta-btn" aria-label="AI tutor" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
 <SpriteAvatar sheet={sheet} mouth={mouth} reduced={reduced} />
 </button>
 </div>
 );
}

if (typeof document !== "undefined" && !document.getElementById("ta-css")) {
 const s = document.createElement("style"); s.id = "ta-css"; s.textContent = `
 .ta-dock{position:fixed;z-index:40;pointer-events:none;transition:width .25s,height .25s,opacity .3s}
 .ta-btn{pointer-events:auto;border:0;background:transparent;padding:0;width:100%;height:100%;cursor:grab;touch-action:none;filter:drop-shadow(0 8px 20px rgba(0,0,0,.18))}
 .ta-btn:active{cursor:grabbing}
 .ta-btn canvas{width:100%;height:100%;display:block}
 .ta-cap{position:absolute;bottom:14px;max-width:280px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#222;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)}
 .ta-dock[data-side="right"] .ta-cap{right:calc(100% + 10px)}
 .ta-dock[data-side="left"] .ta-cap{left:calc(100% + 10px)}
 body[data-focus] .ta-dock{opacity:.25}
 body[data-focus] .ta-dock:hover{opacity:1}`;
 document.head.appendChild(s);
}
