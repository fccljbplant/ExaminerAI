import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Focus-visibility standard (UI-STANDARDS §0, rule 12) enforced at the
 * source level: every interactive control in the product surfaces shows
 * a visible focus indicator for keyboard users. A border-color change
 * alone is not a focus ring, and `focus:outline-none` without a
 * replacement indicator is an invisible focus state.
 *
 * Scope: the surfaces governed by the twelve rules. `src/modules/ui`
 * (shared primitives on the legacy token system) and the legacy learn
 * system (`src/modules/learn`, `src/components/learn`) use their own
 * focus treatments and are excluded.
 */

const ROOT = resolve(__dirname, "../..");

const SCOPED_DIRS = [
  "app",
  "modules/learner-portal",
  "modules/instructor-portal",
  "modules/org-portal",
  "modules/platform-portal",
  "modules/tutor",
  "modules/site",
];

function collectTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectTsxFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function scopedFiles(): { file: string; lines: string[] }[] {
  return SCOPED_DIRS.flatMap((dir) =>
    collectTsxFiles(join(ROOT, "src", dir))
      .map((file) => ({ file, lines: readFileSync(file, "utf8").split("\n") })),
  );
}

/** Any visible focus treatment on the same line counts as an indicator. */
const VISIBLE_FOCUS = /focus-visible:outline|focus-visible:ring|focus:ring-2|focus:ring-inset/;

describe("focus visibility standard (UI-STANDARDS §0 rule 12)", () => {
  it("keeps the border-focus pattern paired with a visible keyboard ring", () => {
    const offenders = scopedFiles().flatMap(({ file, lines }) =>
      lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => line.includes("focus:border-brand focus:outline-none"))
        .filter(({ line }) => !line.includes("focus-visible:outline"))
        .map(({ i }) => `${file}:${i + 1}`),
    );

    expect(offenders, `focus:border-brand needs focus-visible:outline-2 rings:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("never leaves focus:outline-none without a visible replacement indicator", () => {
    const offenders = scopedFiles().flatMap(({ file, lines }) =>
      lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /\bfocus:outline-none\b/.test(line))
        .filter(({ line }) => !VISIBLE_FOCUS.test(line))
        .map(({ i }) => `${file}:${i + 1}`),
    );

    expect(offenders, `focus:outline-none needs a visible ring/outline on the same line:\n${offenders.join("\n")}`).toEqual([]);
  });
});
