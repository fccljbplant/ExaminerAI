import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as ts from "typescript";
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

const SEMANTIC_INTERACTIVE = new Set(["button", "a", "Link"]);

/**
 * Semantic interactive elements (button/a/Link) must carry a visible
 * keyboard ring in their own className. Component wrappers (Button,
 * DropdownMenuItem, chips…) are excluded: their focus lives in the
 * component definition. A className that is a bare identifier (shared
 * class constant) is skipped — a known limitation; the constants in use
 * were verified to contain the ring.
 */
function interactiveElementsWithoutRing(): string[] {
  const offenders: string[] = [];
  for (const dir of SCOPED_DIRS) {
    for (const file of collectTsxFiles(join(ROOT, "src", dir))) {
      if (file.endsWith(".test.tsx")) continue;
      const src = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      (function walk(node: ts.Node) {
        if (ts.isJsxOpeningLikeElement(node)) {
          const tag = node.tagName.getText();
          if (SEMANTIC_INTERACTIVE.has(tag)) {
            const cls = node.attributes.properties.find(
              (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "className",
            );
            if (!cls) {
              offenders.push(`${file}:<${tag}> no className`);
            } else if (
              cls.initializer &&
              ts.isJsxExpression(cls.initializer) &&
              cls.initializer.expression &&
              ts.isIdentifier(cls.initializer.expression)
            ) {
              // shared class constant — skipped (see docblock)
            } else if (!cls.getText().includes("focus-visible:")) {
              const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
              offenders.push(`${file}:${line + 1} <${tag}>`);
            }
          }
        }
        ts.forEachChild(node, walk);
      })(sf);
    }
  }
  return offenders;
}

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

  it("gives every semantic interactive element (button/a/Link) a visible keyboard ring", () => {
    const offenders = interactiveElementsWithoutRing();
    expect(offenders, `interactive elements missing focus rings:\n${offenders.join("\n")}`).toEqual([]);
  });
});
