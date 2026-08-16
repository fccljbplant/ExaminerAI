// src/modules/learn/lib/psych-weekly.ts — weekly coherence + Dunning-Kruger.
/**
 * Minimal-math psychology signals for the instructor profile:
 *
 *   day:    average self-rated confidence (DailyLog 1-5, ×20 → %) and
 *           average actual score (that day's LearnDailyTest scores).
 *   week:   average of the day values, bucketed by calendar week.
 *   gap:    confidence% − actual%  (positive = overconfident — the
 *           Dunning-Kruger signal; negative = underconfident).
 *   coherence: 100 − |gap|, clamped 0-100 (how well self-assessment
 *           matches reality).
 *
 * No AI, no heavy pipelines — just daily averages rolled into weekly
 * averages, exactly like the pre-strip calibration math (gap thresholds
 * ±20 kept from the old CalibrationScatterCard).
 */

import { db } from "@/lib/db";

export interface DayPsychRow {
  date: string; // yyyy-mm-dd
  confidence: number | null; // 1-5
  actual: number | null; // 0-100
}

export interface WeeklyPsychPoint {
  weekStart: string; // Monday of the week, yyyy-mm-dd
  weekLabel: string; // e.g. "Aug 4"
  confidencePct: number | null;
  actualPct: number | null;
  gap: number | null;
  coherence: number | null;
  days: number;
}

export type Calibration = "overconfident" | "underconfident" | "well_calibrated" | "no_data";

export interface PsychWeeklySummary {
  weeks: WeeklyPsychPoint[];
  latest: WeeklyPsychPoint | null;
  avgCoherence: number | null;
  calibration: Calibration;
}

/** Pure: label a calibration gap (thresholds from the old
 *  CalibrationScatterCard — ±20). */
export function calibrationLabel(gap: number | null): Calibration {
  if (gap === null) return "no_data";
  if (gap > 20) return "overconfident";
  if (gap < -20) return "underconfident";
  return "well_calibrated";
}

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pure: roll day rows into weekly averages (day → week, nothing more). */
export function aggregateDayRows(rows: DayPsychRow[]): WeeklyPsychPoint[] {
  const buckets = new Map<string, { confSum: number; confN: number; actSum: number; actN: number; days: number }>();
  for (const r of rows) {
    const monday = mondayOf(new Date(r.date + "T00:00:00"));
    const key = monday.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { confSum: 0, confN: 0, actSum: 0, actN: 0, days: 0 };
    b.days += 1;
    if (r.confidence !== null) {
      b.confSum += r.confidence;
      b.confN += 1;
    }
    if (r.actual !== null) {
      b.actSum += r.actual;
      b.actN += 1;
    }
    buckets.set(key, b);
  }
  const points: WeeklyPsychPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, b]) => {
      const confidencePct = b.confN > 0 ? round1((b.confSum / b.confN) * 20) : null;
      const actualPct = b.actN > 0 ? round1(b.actSum / b.actN) : null;
      const gap = confidencePct !== null && actualPct !== null ? round1(confidencePct - actualPct) : null;
      const coherence = gap !== null ? Math.max(0, Math.min(100, round1(100 - Math.abs(gap)))) : null;
      const d = new Date(weekStart + "T00:00:00");
      return {
        weekStart,
        weekLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        confidencePct,
        actualPct,
        gap,
        coherence,
        days: b.days,
      };
    });
  return points;
}

/** Load day rows (DailyLog confidence + LearnDailyTest scores) for one
 *  learner + course and roll them into weekly averages. */
export async function computePsychWeekly(
  userId: string,
  courseId: string,
  weeksBack = 12,
): Promise<PsychWeeklySummary> {
  const since = new Date();
  since.setDate(since.getDate() - weeksBack * 7);

  const [logs, tests] = await Promise.all([
    db.dailyLog.findMany({
      where: { userId, courseId, date: { gte: since } },
      select: { date: true, confidence: true },
    }),
    db.learnDailyTest.findMany({
      where: { userId, courseId, date: { gte: since }, status: "completed" },
      select: { date: true, score: true },
    }),
  ]);

  // Day rows: one per date, actual = average of that day's test scores.
  const byDate = new Map<string, DayPsychRow>();
  for (const l of logs) {
    if (l.confidence === null) continue;
    const key = l.date.toISOString().slice(0, 10);
    const row = byDate.get(key) ?? { date: key, confidence: null, actual: null };
    row.confidence = l.confidence;
    byDate.set(key, row);
  }
  for (const t of tests) {
    if (t.score === null) continue;
    const key = t.date.toISOString().slice(0, 10);
    const row = byDate.get(key) ?? { date: key, confidence: null, actual: null };
    row.actual = row.actual === null ? t.score : Math.round(((row.actual + t.score) / 2) * 10) / 10;
    byDate.set(key, row);
  }

  const weeks = aggregateDayRows([...byDate.values()]);
  const withGap = weeks.filter((w) => w.gap !== null);
  const avgCoherence = withGap.length
    ? Math.round(withGap.reduce((s, w) => s + (w.coherence ?? 0), 0) / withGap.length)
    : null;
  const latest = withGap.length ? withGap[withGap.length - 1] : weeks.length ? weeks[weeks.length - 1] : null;

  return {
    weeks,
    latest,
    avgCoherence,
    calibration: calibrationLabel(latest?.gap ?? null),
  };
}
