"use client";
// src/hooks/use-celebration.ts
// Fires celebration events when the API returns XP/badge data.
// The CelebrationOverlay (mounted globally in layout.tsx) listens for
// these events and shows confetti + pop-in animations.

interface CelebrationData {
  xpAwarded: number;
  newTotal: number;
  level: number | null;
  levelLabel: string | null;
  badges: Array<{ id: string; name: string; icon: string; description: string }>;
}

/**
 * Fire celebration events from celebration data returned by API routes.
 * Call this from any component that receives a `celebration` field in
 * an API response (e.g., daily test completion, weekly test completion).
 *
 * Usage:
 *   const res = await api.post("/api/daily-test", { action: "finish" });
 *   if (res.celebration) fireCelebrations(res.celebration);
 */
export function fireCelebrations(data: CelebrationData): void {
  if (typeof window === "undefined") return;

  // Fire XP celebration first (if any XP was awarded)
  if (data.xpAwarded > 0) {
    window.dispatchEvent(new CustomEvent("traineesai:celebration", {
      detail: {
        type: "xp",
        amount: data.xpAwarded,
        reason: "Test completed",
      },
    }));
  }

  // Fire badge celebrations (each badge gets its own event, staggered)
  data.badges.forEach((badge, index) => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("traineesai:celebration", {
        detail: {
          type: "badge",
          badgeId: badge.id,
          icon: badge.icon,
          name: badge.name,
          description: badge.description,
        },
      }));
    }, 1500 * (index + 1)); // Stagger by 1.5s per badge
  });

  // Fire level-up celebration if level changed
  // (We don't have the previous level to compare, so we fire it only
  // if XP was awarded AND the level is >= 2 — the first level-up from
  // level 1 to 2 is the most impactful celebration)
  if (data.xpAwarded > 0 && data.level && data.level >= 2 && data.newTotal >= 100) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("traineesai:celebration", {
        detail: {
          type: "level-up",
          level: data.level,
          label: data.levelLabel,
          description: "You've reached a new level!",
        },
      }));
    }, 3000); // After XP + badge celebrations
  }
}
