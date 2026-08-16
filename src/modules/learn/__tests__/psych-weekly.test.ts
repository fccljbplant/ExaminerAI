import { describe, it, expect } from "vitest";
import { aggregateDayRows, calibrationLabel } from "../lib/psych-weekly";

describe("modules/learn — psych weekly (minimal day→week averages)", () => {
  it("labels calibration gaps with the old ±20 thresholds", () => {
    expect(calibrationLabel(25)).toBe("overconfident");
    expect(calibrationLabel(-25)).toBe("underconfident");
    expect(calibrationLabel(5)).toBe("well_calibrated");
    expect(calibrationLabel(-19)).toBe("well_calibrated");
    expect(calibrationLabel(null)).toBe("no_data");
  });

  it("rolls day rows into one weekly average per ISO week", () => {
    // Tue + Thu of the same week (Monday = 2026-08-02): confidence 4 and 2
    // → avg 3 → 60%; actuals 80 and 60 → avg 70% → gap −10 → coherence 90.
    const rows = [
      { date: "2026-08-03", confidence: 4, actual: 80 }, // Tue
      { date: "2026-08-05", confidence: 2, actual: 60 }, // Thu, same week
    ];
    const weeks = aggregateDayRows(rows);
    expect(weeks).toHaveLength(1);
    const w = weeks[0];
    expect(w.weekStart).toBe("2026-08-02");
    expect(w.confidencePct).toBe(60);
    expect(w.actualPct).toBe(70);
    expect(w.gap).toBe(-10);
    expect(w.coherence).toBe(90);
    expect(w.days).toBe(2);
  });

  it("buckets different weeks separately and sorts them", () => {
    const rows = [
      { date: "2026-08-11", confidence: 5, actual: 40 }, // Tue, week of Aug 10
      { date: "2026-08-03", confidence: 3, actual: 80 }, // Tue, week of Aug 2
    ];
    const weeks = aggregateDayRows(rows);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-08-02", "2026-08-09"]);
    expect(weeks[0].gap).toBe(-20); // 60 − 80
    expect(weeks[1].gap).toBe(60); // 100 − 40 → overconfident
    expect(weeks[1].coherence).toBe(40);
  });

  it("leaves gap/coherence null when a week has no actual scores", () => {
    const weeks = aggregateDayRows([{ date: "2026-08-03", confidence: 4, actual: null }]);
    expect(weeks[0].confidencePct).toBe(80);
    expect(weeks[0].actualPct).toBeNull();
    expect(weeks[0].gap).toBeNull();
    expect(weeks[0].coherence).toBeNull();
  });
});
