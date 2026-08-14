"use client";
// src/components/shared/learner-badge-collection.tsx
// Shows all earned + available badges. Earned badges are full-color;
// unearned badges are grayed out with a lock icon.
//
// Mounted on the learner's Progress view.

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SkeletonPanel } from "@/modules/ui/states";
import { Lock } from "lucide-react";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "test" | "project" | "skill" | "course" | "streak";
  tier: "bronze" | "silver" | "gold" | "platinum";
  xpBonus?: number;
}

interface EarnedBadge {
  badgeId: string;
  awardedAt: string;
  badge: BadgeDef;
}

interface BadgeData {
  earned: EarnedBadge[];
  available: BadgeDef[];
  stats: {
    total: number;
    byTier: Record<string, number>;
    latest: EarnedBadge | null;
  };
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700/20 to-amber-600/10 border-amber-600/30",
  silver: "from-slate-400/20 to-slate-300/10 border-slate-400/30",
  gold: "from-amber-400/20 to-amber-300/10 border-amber-400/40",
  platinum: "from-violet-400/20 to-violet-300/10 border-violet-400/40",
};

const CATEGORY_LABELS: Record<string, string> = {
  test: "Tests",
  project: "Project",
  skill: "Skills",
  course: "Course",
  streak: "Streaks",
};

export function LearnerBadgeCollection() {
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BadgeData>("/api/learner/badges")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonPanel lines={1} className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonPanel key={i} lines={2} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const earnedIds = new Set(data.earned.map(b => b.badgeId));

  // Group available badges by category
  const byCategory: Record<string, BadgeDef[]> = {};
  for (const badge of data.available) {
    if (!byCategory[badge.category]) byCategory[badge.category] = [];
    byCategory[badge.category].push(badge);
  }

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            🏅 Badges
            <span className="text-sm font-normal text-muted-foreground">
              {data.stats.total} / {data.available.length} earned
            </span>
          </h3>
        </div>
        {/* Tier breakdown */}
        <div className="flex gap-2 text-xs">
          {["bronze", "silver", "gold", "platinum"].map((tier) => (
            <span key={tier} className="rounded-full border border-border px-2 py-0.5 capitalize">
              {tier}: {data.stats.byTier[tier] || 0}
            </span>
          ))}
        </div>
      </div>

      {/* Badge grid by category */}
      {Object.entries(byCategory).map(([category, badges]) => (
        <div key={category}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {CATEGORY_LABELS[category] || category}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {badges.map((badge) => {
              const earned = earnedIds.has(badge.id);
              const earnedBadge = data.earned.find(b => b.badgeId === badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "relative flex flex-col items-center rounded-xl border bg-gradient-to-br p-3 text-center transition",
                    TIER_COLORS[badge.tier] || "border-border",
                    earned ? "opacity-100" : "opacity-40 grayscale",
                  )}
                  title={earned ? `${badge.name} — ${badge.description}` : `Locked: ${badge.description}`}
                >
                  {/* Lock icon for unearned */}
                  {!earned && (
                    <div className="absolute top-1 right-1">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className={cn("text-3xl mb-1", !earned && "opacity-50")}>
                    {badge.icon}
                  </div>
                  <p className="text-[10px] font-semibold text-foreground leading-tight line-clamp-2">
                    {badge.name}
                  </p>
                  {earned && earnedBadge && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      {new Date(earnedBadge.awardedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
