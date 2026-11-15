import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Accessible-names standard (keyboard/screen-reader pass, UI-STANDARDS
 * §0 rule 12 companion): an interactive control that renders no text —
 * an icon-only button or link — must carry an accessible name
 * (aria-label / aria-labelledby / title). Without one, a screen reader
 * announces just "button" and a keyboard/SR user cannot tell the
 * controls apart.
 *
 * Scope matches focus-visibility.test.ts (the twelve-rule surfaces).
 * Heuristic, conservatively tuned to avoid false positives:
 *   - named via aria-label / aria-labelledby / title  → OK
 *   - any literal text child (JSXText or string child) → OK
 *   - nested <span>/<p>/<div> with text               → OK
 *   - dynamic child expressions ({label})             → skipped
 *     (cannot prove icon-only at the source level)
 *   - sr-only text counts as a name via the text check
 */

const ROOT = resolve(__dirname, "../..");

const SCOPED_DIRS = [
  "app",
  "modules/learn",
  "components/learn",
  "modules/learner-portal",
  "modules/instructor-portal",
  "modules/org-portal",
  "modules/platform-portal",
  "modules/tutor",
  "modules/site",
];

const SEMANTIC_INTERACTIVE = new Set(["button", "a", "Link"]);
const NAMING_ATTRS = new Set(["aria-label", "aria-labelledby", "title"]);

function collectTsxFiles(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectTsxFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function hasAccessibleName(node: ts.JsxOpeningLikeElement): boolean {
  return node.attributes.properties.some(
    (a) => ts.isJsxAttribute(a) && NAMING_ATTRS.has(a.name.getText()),
  );
}

/** true = renders text, false = provably text-free, "unknown" = dynamic. */
function childrenRenderText(children: readonly ts.JsxChild[]): boolean | "unknown" {
  let sawUnknown = false;
  for (const c of children) {
    if (ts.isJsxText(c)) {
      if (c.getText().trim().length > 0) return true;
    } else if (ts.isJsxExpression(c)) {
      if (c.expression) {
        if (ts.isStringLiteral(c.expression) && c.expression.text.trim().length > 0) return true;
        sawUnknown = true;
      }
    } else if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) {
      const tag = ts.isJsxElement(c) ? c.openingElement.tagName.getText() : c.tagName.getText();
      if (tag === "span" || tag === "p" || tag === "div") {
        if (ts.isJsxElement(c)) {
          const inner = childrenRenderText(c.children);
          if (inner === true) return true;
          if (inner === "unknown") sawUnknown = true;
        }
      }
      // icon components / svg / kbd / nested buttons render no text
    } else {
      sawUnknown = true;
    }
  }
  return sawUnknown ? "unknown" : false;
}

function iconOnlyControlsWithoutName(): string[] {
  const offenders: string[] = [];
  for (const dir of SCOPED_DIRS) {
    for (const file of collectTsxFiles(join(ROOT, "src", dir))) {
      if (file.endsWith(".test.tsx")) continue;
      const src = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      (function walk(node: ts.Node) {
        // Paired elements carry their children; the opening tag carries
        // the attributes.
        if (ts.isJsxElement(node)) {
          const open = node.openingElement;
          const tag = open.tagName.getText();
          if (
            SEMANTIC_INTERACTIVE.has(tag) &&
            !hasAccessibleName(open) &&
            childrenRenderText(node.children) === false
          ) {
            const { line } = sf.getLineAndCharacterOfPosition(open.getStart());
            offenders.push(`${file.replace(ROOT + "/", "")}:${line + 1} <${tag}> icon-only without aria-label`);
          }
        }
        if (ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText();
          if (SEMANTIC_INTERACTIVE.has(tag) && !hasAccessibleName(node)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
            offenders.push(`${file.replace(ROOT + "/", "")}:${line + 1} <${tag} /> icon-only without aria-label`);
          }
        }
        ts.forEachChild(node, walk);
      })(sf);
    }
  }
  return offenders;
}

describe("accessible names standard (screen-reader pass)", () => {
  it("names every icon-only interactive control", () => {
    const offenders = iconOnlyControlsWithoutName();
    expect(
      offenders,
      `icon-only controls missing accessible names:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
