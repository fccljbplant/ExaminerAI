"use client";

// src/modules/learn/components/avatar/avatar-rig.tsx — Shared avatar rig + event bus.
// The sprite-sheet rig (face → mouth → beard → nose → eyes → brows → hair →
// gesture) and the `tutor` event bus, extracted from TutorBadge so both the
// floating dock and the classroom AvatarStage animate the same character.
// Only eyes (blink) and mouth (lip-sync visemes) animate. CLIENT-ONLY.

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

const DEFAULT_MAP: Record<string, { x: number; y: number; w: number; h: number }> = {
  faceBase: { x: 2.2, y: 52.3, w: 16.6, h: 12.6 },
  hair:     { x: 1.6, y: 45.0, w: 17.8, h: 9.6 },
  beard:    { x: 3.0, y: 63.3, w: 15.2, h: 9.2 },
  nose:     { x: 8.6, y: 72.0, w: 3.6, h: 2.8 },
  browsN:   { x: 22.0, y: 45.5, w: 11.0, h: 2.2 },
  browsUp:  { x: 22.0, y: 48.9, w: 11.0, h: 2.2 },
  browsSad: { x: 34.0, y: 55.8, w: 11.0, h: 2.2 },
  eyesOpen: { x: 22.0, y: 53.2, w: 11.0, h: 2.8 },
  eyesClosed: { x: 34.0, y: 53.4, w: 11.0, h: 2.0 },
  eyesSide: { x: 22.0, y: 60.2, w: 11.0, h: 2.8 },
  eyesWink: { x: 22.0, y: 63.6, w: 11.0, h: 2.8 },
  eyesHappy: { x: 34.0, y: 60.4, w: 11.0, h: 2.2 },
  m_closed: { x: 47.4, y: 45.6, w: 5.6, h: 1.8 },
  m_smile:  { x: 47.4, y: 52.1, w: 5.8, h: 2.5 },
  m_A:      { x: 54.0, y: 48.7, w: 5.8, h: 2.7 },
  m_E:      { x: 47.4, y: 55.4, w: 5.8, h: 2.3 },
  m_O:      { x: 60.6, y: 52.1, w: 5.8, h: 2.7 },
  m_U:      { x: 67.2, y: 52.2, w: 5.4, h: 2.5 },
  m_small:  { x: 54.0, y: 62.1, w: 5.6, h: 2.1 },
  g_point:  { x: 74.0, y: 70.4, w: 12.5, h: 8.2 },
  g_open:   { x: 80.8, y: 71.8, w: 17.2, h: 7.2 },
  g_thumb:  { x: 88.0, y: 76.4, w: 10.2, h: 6.8 },
  g_pen:    { x: 74.0, y: 82.8, w: 12.5, h: 7.4 },
  g_thumb2: { x: 86.4, y: 82.4, w: 12.2, h: 8.2 },
};

const DEFAULT_RIG: Record<string, { x: number; y: number; w: number }> = {
  face:    { x: 14, y: 6, w: 72 },
  mouth:   { x: 37, y: 52, w: 26 },
  beard:   { x: 16, y: 36, w: 68 },
  nose:    { x: 44, y: 44, w: 13 },
  eyes:    { x: 26, y: 33, w: 48 },
  brows:   { x: 25, y: 26, w: 50 },
  hair:    { x: 12, y: 0, w: 76 },
  gesture: { x: 52, y: 60, w: 46 },
};

// ── Moods ──────────────────────────────────────────────────────────
const MOODS: Record<string, { brows: string; eyes: string; mouth: string }> = {
  neutral:   { brows: "browsN", eyes: "eyesOpen", mouth: "m_closed" },
  smile:     { brows: "browsN", eyes: "eyesOpen", mouth: "m_smile" },
  happy:     { brows: "browsUp", eyes: "eyesHappy", mouth: "m_smile" },
  thinking:  { brows: "browsN", eyes: "eyesSide", mouth: "m_closed" },
  surprised: { brows: "browsUp", eyes: "eyesOpen", mouth: "m_O" },
  sad:       { brows: "browsSad", eyes: "eyesOpen", mouth: "m_small" },
  wink:      { brows: "browsN", eyes: "eyesWink", mouth: "m_smile" },
};

const VISEMES = ["m_A", "m_E", "m_O", "m_U", "m_small", "m_closed"];

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

// ── SpriteLayer — one cropped region from the sheet ────────────────
interface LayerData {
  key: string;
  srcKey: string;
  rig: { x: number; y: number; w: number };
  map: { x: number; y: number; w: number; h: number };
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
      style={{
        position: "absolute", overflow: "hidden", pointerEvents: "none",
        left: `${dst.x / 100 * stageW}px`,
        top: `${dst.y / 100 * stageH}px`,
        width: `${elW}px`,
        height: `${elH}px`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- sprite sheet crop requires raw img transforms */}
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

// ── AvatarRig ──────────────────────────────────────────────────────
interface AvatarRigProps {
  /** Square stage size in px. */
  size: number;
  /** Optional extra className on the stage wrapper. */
  className?: string;
}

/**
 * The rigged avatar character. Subscribes to the `tutor` event bus for
 * gestures and TTS lip-sync; renders the layered sprite at `size`.
 * Background-agnostic — callers provide the backdrop (dock, podium).
 */
export function AvatarRig({ size, className }: AvatarRigProps) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [sheetLoaded, setSheetLoaded] = useState(false);
  const [sheetW, setSheetW] = useState(0);
  const [sheetH, setSheetH] = useState(0);

  // Avatar state
  const [mood, setMood] = useState("smile");
  const [gesture, setGestureState] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({
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
  const applyGesture = useCallback((gestureName: string) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    stopTalking();

    const gestureMap: Record<string, { mood?: string; gesture?: string; talk?: boolean }> = {
      idle: { mood: "neutral" }, focus: { mood: "neutral" },
      hello: { mood: "happy", gesture: "g_open" }, bye: { mood: "smile", gesture: "g_open" },
      talk: { talk: true }, listen: { mood: "neutral" },
      think: { mood: "thinking", gesture: "g_point" }, confused: { mood: "thinking" },
      idea: { mood: "surprised", gesture: "g_point" }, surprised: { mood: "surprised" },
      praise: { mood: "happy", gesture: "g_thumb" }, celebrate: { mood: "happy", gesture: "g_thumb" },
      cheer: { mood: "happy", gesture: "g_thumb" }, laugh: { mood: "happy" },
      levelup: { mood: "happy", gesture: "g_thumb" }, streak: { mood: "happy" },
      comfort: { mood: "sad" }, oops: { mood: "sad" }, wink: { mood: "wink" },
      determined: { mood: "surprised", gesture: "g_point" }, proud: { mood: "happy", gesture: "g_thumb" },
    };

    const action = gestureMap[gestureName] || {};
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
    return () => { unsubs.forEach(u => u()); };
  }, [applyGesture, applyMood, startTalking, stopTalking]);

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
    <div
      ref={stageRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", width: size, height: size }}
      aria-hidden="true"
    >
      {sheetLoaded && stageRef.current && (() => {
        const sw = stageRef.current.clientWidth;
        const sh = stageRef.current.clientHeight;
        return (
          <>
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
        );
      })()}
    </div>
  );
}
