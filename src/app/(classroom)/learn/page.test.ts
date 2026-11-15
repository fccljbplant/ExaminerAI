import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * /learn hero — Continue Learning (rules 7 + 12).
 *
 * The hero used to promise two different actions ("Resume session" and
 * "View journey map") but both linked to the exact same course URL, and
 * its buttons were 36px targets. Pins: distinct destinations, the
 * journey link deep-links the classroom panel, and 44px controls.
 */

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const shell = readFileSync(
  new URL("../../../components/learn/LearnShell.tsx", import.meta.url),
  "utf8",
);

describe("/learn Continue Learning hero", () => {
  it("sends Resume and View journey map to genuinely different places", () => {
    const resume = page.match(/href=\{`\/learn\/\$\{lastCourse\.id\}`\}[^>]*>\s*\n\s*Resume session/);
    expect(resume).not.toBeNull();
    const journey = page.match(/href=\{`\/learn\/\$\{lastCourse\.id\}\?panel=journey`\}/);
    expect(journey).not.toBeNull();
  });

  it("deep-links the journey panel in the classroom shell", () => {
    expect(shell).toContain('new URLSearchParams(window.location.search).get("panel")');
    expect(shell).toContain('setActivePanel(panel)');
  });

  it("keeps every link control on the page a 44px target (rule 12)", () => {
    const links = page.match(/<Link[\s\S]{0,300}?className="[^"]*"/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(6);
    for (const link of links) {
      expect(link, link).toContain("min-h-11");
      expect(link, link).toContain("focus-visible:outline-2");
    }
  });
});
