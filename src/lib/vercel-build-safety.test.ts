import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const buildScript = readFileSync(join(process.cwd(), "scripts/vercel-build.sh"), "utf8");
const adminBootstrap = readFileSync(join(process.cwd(), "scripts/ensure-accounts.js"), "utf8");

describe("deployment build data-safety contract", () => {
  it("does not apply schema changes or run data seeders during Vercel builds", () => {
    expect(buildScript).not.toMatch(/prisma\s+db\s+push|prisma\s+migrate\s+deploy/i);
    expect(buildScript).not.toContain("ensure-accounts.js");
    expect(buildScript).not.toContain("seed-marketplace-prod.js");
    expect(buildScript).toContain("prisma generate");
    expect(buildScript).toContain("next build");
  });

  it("requires explicit bootstrap credentials and never resets existing accounts", () => {
    expect(adminBootstrap).toContain("ADMIN_BOOTSTRAP_EMAIL");
    expect(adminBootstrap).toContain("ADMIN_BOOTSTRAP_PASSWORD");
    expect(adminBootstrap).toMatch(/password\.length\s*<\s*16/);
    expect(adminBootstrap).not.toContain("admin123");
    expect(adminBootstrap).not.toMatch(/update\s*:\s*\{\s*passwordHash/);
    expect(adminBootstrap).toContain("db.user.findUnique");
    expect(adminBootstrap).toContain("db.user.create");
  });
});
