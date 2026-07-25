"use client";
import type { PortfolioData } from "@/components/examiner/teacher/types";

type Interaction = NonNullable<PortfolioData["interactions"]>[number];

export function computeMasteryFromInteractions(interactions: PortfolioData["interactions"]): {
  id: string; topic: string; pillar: string; masteryLevel: string;
  evidenceCount: number; lastAssessedWeek: number | null; trend: string;
}[] {
  const safeInteractions = interactions || [];
  const byTopic = safeInteractions.reduce<Record<string, Interaction[]>>((acc, i) => {
    if (!acc[i.topic]) acc[i.topic] = [];
    acc[i.topic].push(i);
    return acc;
  }, {});
  return Object.entries(byTopic).map(([topic, items]) => {
    const scores = items.map(i => i.correctness);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const masteryLevel = avg >= 90 ? "mastered" : avg >= 75 ? "proficient" : avg >= 50 ? "developing" : "not-started";
    const lastWeek = items.length > 0 ? Math.max(...items.map(i => i.week)) : null;
    return {
      id: topic,
      topic,
      pillar: items[0]?.pillar || "concept",
      masteryLevel,
      evidenceCount: items.length,
      lastAssessedWeek: lastWeek,
      trend: "stable",
    };
  });
}
