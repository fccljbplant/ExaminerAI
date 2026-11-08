/**
 * Instructor roster metrics — deterministic engagement calculations.
 *
 * Keep metric selection independent of database return order so dashboard
 * risk signals are reproducible and straightforward to test.
 */

export interface ScoredWeeklyTest {
  week: number;
  score: number | null;
}

export function getLatestScoredTest<T extends ScoredWeeklyTest>(
  tests: readonly T[],
): T | null {
  let latest: T | null = null;

  for (const test of tests) {
    if (test.score === null) continue;
    if (!latest || test.week > latest.week) latest = test;
  }

  return latest;
}

/** Use the aggregate count, never the capped dashboard preview length. */
export function getAtRiskKpiCount(atRisk: { count: number; items: readonly unknown[] }): number {
  return atRisk.count;
}
