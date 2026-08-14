/**
 * scripts/validate-theme.ts — CLI gate (REDESIGN-P2 §2.4)
 *
 * Thin wrapper around src/modules/theme/lib/validate.ts so the same
 * assertions run here AND in vitest (`npm run theme:validate`).
 *
 *   bun run scripts/validate-theme.ts
 *
 * Exits non-zero on any violation.
 */

import { runThemeValidation } from "../src/modules/theme/lib/validate";

const result = runThemeValidation({ includeBuiltCss: true });

console.log(
  `validate-theme: ${result.checks} checks across 3 modes × ${result.brandsTested} brands`
);
if (result.failures.length) {
  console.error(`\nFAIL — ${result.failures.length} violation(s):`);
  for (const f of result.failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("PASS — all contrast pairs meet WCAG minimums, tokens complete.");
