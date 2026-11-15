import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Touch-target standard (UI-STANDARDS §10, twelve rules rule 12):
 * interactive controls are at least 44 × 44 px (Tailwind h-11/min-h-11/
 * size-11). The floor is enforced at the PRIMITIVE level — the shared
 * ui/ components reach every one of their ~100+ call sites in one
 * place — plus the raw <button>/<input> controls in the scoped product
 * surfaces that bypass the primitives.
 *
 *
 * Known non-offenders (do not "fix" these):
 *   - inline text links (a/Link) — their target is the text line-box;
 *     the 44px floor applies to controls, not running text
 *   - <input type="range|checkbox|radio"> — browser-native controls
 *   - inputs inside a fixed-height wrapper (h-11 + items-center) —
 *     the wrapper sets the target; the input fills it
 *   - sr-only / visually-hidden controls
 */

const ROOT = resolve(__dirname, "../..");

/** ui primitives whose variant tables set the interactive floor. */
const PRIMITIVES: Record<string, { floor: string }> = {
  "modules/ui/button.tsx": { floor: "min-h-11" },
  "modules/ui/input.tsx": { floor: "min-h-11" },
  "modules/ui/select.tsx": { floor: "min-h-11" },
  "modules/ui/toggle.tsx": { floor: "min-h-11" },
};

/** No interactive variant may pin a height below the 44px floor. */
const SUB_44_HEIGHT = /(^|\s)(h|size|w)-[1-9](\s|$)|(^|\s)(h|size)-1[01](\s|$)/;

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

/** Interactive height/min-height/size classes at or above the 44px floor. */
const FLOOR_44 = /(^|\s)(min-h-1[12]|min-h-(1[3-9]|[2-9][0-9])|h-1[12]|h-(1[3-9]|[2-9][0-9])|size-1[12]|size-(1[3-9]|[2-9][0-9])|h-full|aspect-video|aspect-square)(\s|$)/;
const NATIVE_SIZED = /type="(range|checkbox|radio|file)"/;

function collectTsxFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) collectTsxFiles(full, out);
    else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

/** Extract every className-ish string literal on an opening element. */
function classStringsOf(node: ts.JsxOpeningLikeElement, src: string): string[] {
  const out: string[] = [];
  for (const attr of node.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== "className") continue;
    const init = attr.initializer;
    if (!init) continue;
    if (ts.isStringLiteral(init)) {
      out.push(init.text);
    } else if (ts.isJsxExpression(init) && init.expression) {
      // cn("…", cond ? "…" : "…", CONN) — collect nested string literals
      (function walk(n: ts.Node) {
        if (ts.isStringLiteral(n)) out.push(n.text);
        if (ts.isTemplateExpression(n)) out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
        ts.forEachChild(n, walk);
      })(init.expression);
    }
  }
  return out.join(" ").length ? [out.join(" ")] : [];
}

function rawControlsBelowFloor(): string[] {
  const offenders: string[] = [];
  for (const dir of SCOPED_DIRS) {
    for (const file of collectTsxFiles(join(ROOT, "src", dir))) {
      const src = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      (function walk(node: ts.Node) {
        if (ts.isJsxOpeningLikeElement(node)) {
          const tag = node.tagName.getText();
          if (tag === "button" || tag === "input") {
            const attrs = node.attributes.properties
              .filter((a): a is ts.JsxAttribute => ts.isJsxAttribute(a))
              .map((a) => a.name.getText() + "=" + (a.initializer?.getText() ?? ""))
              .join(" ");
            if (NATIVE_SIZED.test(attrs)) {
              // browser-native control sizes
            } else if (attrs.includes("sr-only")) {
              // visually hidden — no target
            } else if (/style=/.test(attrs) && /width|height/.test(attrs)) {
              // sized via inline style (e.g. the tutor FAB) — can't read
              // the runtime value statically; its size is pinned by test
            } else if (/aria-hidden=\{true\}|tabIndex=\{-1\}/.test(attrs)) {
              // hidden from interaction entirely (ghost FAB pattern)
            } else {
              const classes = classStringsOf(node, src);
              const joined = classes.join(" ");
              // Exempt wrapper-stretched inputs (flex-1 inside a fixed
              // height container), inline text buttons inside copy
              // (error Retry affordances), full-width row buttons and
              // bare text-only buttons whose box is their text line.
              const stretched = /flex-1|w-full/.test(joined);
              const inlineText = !/(inline-)?flex|grid/.test(joined) && /underline|text-(xs|sm|brand)/.test(joined);
              const textOnly = !/(inline-)?flex|grid|rounded-(md|lg|xl|full)|bg-|border/.test(joined) && !/p[xytblr]?-[0-9]/.test(joined);
              if (joined && !stretched && !inlineText && !textOnly && !FLOOR_44.test(` ${joined} `)) {
                const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
                offenders.push(`${file}:${line + 1} <${tag}>`);
              }
            }
          }
        }
        ts.forEachChild(node, walk);
      })(sf);
    }
  }
  return offenders;
}

describe("touch-target standard (UI-STANDARDS §10 — 44px floor)", () => {
  it("pins every ui primitive variant at ≥ 44px", () => {
    for (const [file, { floor }] of Object.entries(PRIMITIVES)) {
      const src = readFileSync(join(ROOT, "src", file), "utf8");
      expect(
        src.includes(floor),
        `${file} must keep a ${floor} floor on interactive variants`,
      ).toBe(true);
      // no variant line may pin an interactive height below the floor
      // (icon glyphs — className="size-4" on an SVG child — are exempt)
      const offenders = src
        .split("\n")
        .filter((l) => /"(min-h|h|size)-(7|8|9|10)"/.test(l))
        .filter((l) => !/(min-h|h|size)-1[12]|file:h-|size-4|size-5/.test(l))
        .map((l) => l.trim());
      expect(
        offenders,
        `${file}: heights below the 44px floor:\n${offenders.join("\n")}`,
      ).toEqual([]);
    }
  });

  it("raw <button>/<input> controls in scoped surfaces meet the 44px floor", () => {
    const offenders = rawControlsBelowFloor();
    expect(
      offenders,
      `controls below the 44px floor:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
