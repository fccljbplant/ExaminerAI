import { describe, expect, it } from "vitest";
import { runThemeValidation } from "./validate";

/**
 * Theme CI gate as a test (REDESIGN-P2 §2.4) — runs via
 * `npm run theme:validate`. Mirrors scripts/validate-theme.ts.
 */
describe("theme validation gate", () => {
  it("every semantic token is defined in every mode", () => {
    const result = runThemeValidation();
    const completenessFailures = result.failures.filter((f) => f.startsWith("[completeness"));
    expect(completenessFailures).toEqual([]);
  });

  it("all static and brand-derived contrast pairs meet WCAG minimums", () => {
    const result = runThemeValidation();
    expect(result.failures).toEqual([]);
    expect(result.checks).toBeGreaterThan(500);
  });
});
