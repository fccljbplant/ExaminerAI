"use client";
// src/components/shared/celebration-overlay.tsx
// The full-screen celebration overlay that fires when a learner:
//   - Levels up (confetti + new level badge)
//   - Earns a badge (badge icon + name + description)
//   - Hits a milestone (XP milestone, streak milestone)
//
// Mount once at the app root (next to <CommandPalette />). It listens
// for `celebration` events dispatched from anywhere in the app:
//
//   window.dispatchEvent(new CustomEvent("traineesai:celebration", {
//     detail: { type: "level-up", level: 4, label: "Getting solid" }
//   }));
//   window.dispatchEvent(new CustomEvent("traineesai:celebration", {
//     detail: { type: "badge", badgeId: "perfect_daily", icon: "💯", name: "Perfect Day", description: "..." }
//   }));
//   window.dispatchEvent(new CustomEvent("traineesai:celebration", {
//     detail: { type: "xp", amount: 50, reason: "Weekly test passed" }
//   }));
//
// The overlay auto-dismisses after 4s. User can also click to dismiss.

import { useEffect, useState, useRef } from "react";

type CelebrationType = "level-up" | "badge" | "xp" | "milestone";

interface Celebration {
  id: string;
  type: CelebrationType;
  level?: number;
  label?: string;
  badgeId?: string;
  icon?: string;
  name?: string;
  description?: string;
  amount?: number;
  reason?: string;
}

interface Confetti {
  id: number;
  x: number; // percentage
  delay: number;
  duration: number;
  color: string;
  emoji?: string;
}

// W8: confetti reads the semantic chart/status tokens — mode-aware, no hex literals.
const CONFETTI_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];
const CONFETTI_EMOJIS = ["🎉", "✨", "⭐", "🚀", "💯", "🏆"];

export function CelebrationOverlay() {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Celebration;
      const id = `celebration-${idCounter.current++}`;
      setQueue(prev => [...prev, { ...detail, id }]);

      // Generate confetti for level-up + badge
      if (detail.type === "level-up" || detail.type === "badge") {
        const pieces: Confetti[] = Array.from({ length: 40 }).map((_, i) => ({
          id: idCounter.current++,
          x: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 2 + Math.random() * 2,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          emoji: Math.random() > 0.7 ? CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length] : undefined,
        }));
        setConfetti(pieces);
      }

      // Auto-dismiss after 4s
      setTimeout(() => {
        setQueue(prev => prev.filter(c => c.id !== id));
        if (detail.type === "level-up" || detail.type === "badge") {
          setTimeout(() => setConfetti([]), 500);
        }
      }, 4000);
    };

    window.addEventListener("traineesai:celebration", handler);
    return () => window.removeEventListener("traineesai:celebration", handler);
  }, []);

  const current = queue[0];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--p-z-toast)] pointer-events-none flex items-center justify-center"
      onClick={() => setQueue(prev => prev.slice(1))}
      role="alert"
      aria-live="assertive"
    >
      {/* Confetti layer */}
      {confetti.length > 0 && (
        <div className="absolute inset-0 overflow-hidden">
          {confetti.map(c => (
            <div
              key={c.id}
              className="absolute -top-10 text-2xl"
              style={{
                left: `${c.x}%`,
                animation: `confetti-fall ${c.duration}s ease-in ${c.delay}s forwards`,
                color: c.color,
              }}
            >
              {c.emoji || <span className="block h-2 w-3 rounded-sm" style={{ backgroundColor: c.color }} />}
            </div>
          ))}
        </div>
      )}

      {/* Backdrop */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" />

      {/* Card */}
      <div className="relative animate-celebration-pop pointer-events-auto">
        {current.type === "level-up" && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-brand bg-surface p-8 text-center shadow-2xl max-w-sm">
            <div className="text-6xl mb-3">🎉</div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Level Up!</p>
            <p className="mt-2 text-3xl font-extrabold text-fg">Level {current.level}</p>
            <p className="mt-1 text-lg font-semibold text-brand">{current.label}</p>
            <p className="mt-3 text-sm text-fg-muted">{current.description || "Keep going — you're on fire."}</p>
          </div>
        )}

        {current.type === "badge" && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-brand bg-surface p-8 text-center shadow-2xl max-w-sm">
            <div className="text-7xl mb-3 animate-bounce">{current.icon}</div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Badge Earned!</p>
            <p className="mt-2 text-2xl font-extrabold text-fg">{current.name}</p>
            <p className="mt-1 text-sm text-fg-muted">{current.description}</p>
          </div>
        )}

        {current.type === "xp" && (
          <div className="flex items-center gap-4 rounded-xl border border-brand bg-surface p-6 shadow-2xl">
            <div className="text-4xl">⚡</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">XP Earned</p>
              <p className="text-2xl font-extrabold text-fg">+{current.amount} XP</p>
              <p className="text-xs text-fg-muted">{current.reason}</p>
            </div>
          </div>
        )}

        {current.type === "milestone" && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-brand bg-surface p-8 text-center shadow-2xl max-w-sm">
            <div className="text-6xl mb-3">{current.icon || "🏆"}</div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Milestone!</p>
            <p className="mt-2 text-xl font-extrabold text-fg">{current.name}</p>
            <p className="mt-1 text-sm text-fg-muted">{current.description}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes celebration-pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-celebration-pop {
          animation: celebration-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </div>
  );
}
