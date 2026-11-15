import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Token-purity standard (UI-STANDARDS §12 — one token system):
 * the shared primitives in src/modules/ui must use only v2 token
 * classes. The legacy shadcn token layer (bg-primary, text-muted-
 * foreground, bg-accent, border-input, focus:ring-2…) is kept in
 * globals.css purely for strangulation and is deleted at cutover
 * (REDESIGN-P5); every primitive that still references it would
 * break at that deletion.
 *
 * Scope: src/modules/ui — every .tsx file, source-level scan. The
 * variant-prefixed forms (hover:, dark:, data-[state=open]:,
 * [a&]:, selection:, file:, aria-selected:, group-hover:,
 * navigation-menu:) count: the class is the same legacy token.
 *
 * Allowed look-alikes that are NOT legacy tokens: *-sidebar-* (the
 * sidebar keeps its own token family), --tw variable references,
 * class names in comments.
 */

const ROOT = resolve(__dirname, "../..");

/** legacy token classes, longest-first where one contains another. */
const LEGACY_TOKEN = /\b(?:[a-z-]+:)*(?:text|bg|border|ring|outline)-(?:primary-foreground|primary|muted-foreground|muted|background|foreground|card-foreground|card|popover-foreground|popover|accent-foreground|accent|destructive-foreground|destructive|secondary-foreground|secondary|input|border)(?:\/[\w.]+)?\b/g;

function collectTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) collectTsx(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Lines with legacy token classes; comment lines excluded. */
function legacyLines(): string[] {
  const offenders: string[] = [];
  for (const file of collectTsx(join(ROOT, "src/modules/ui"))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      const m = code.match(LEGACY_TOKEN);
      if (m) offenders.push(`${file}:${i + 1} ${m.join(" ")}`);
    });
  }
  return offenders;
}

describe("token-purity standard (UI-STANDARDS §12 — v2 tokens only in shared primitives)", () => {
  it("src/modules/ui contains zero legacy shadcn token classes", () => {
    const offenders = legacyLines();
    expect(
      offenders,
      `legacy token classes in shared primitives (break at the P5 cutover deletion):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
