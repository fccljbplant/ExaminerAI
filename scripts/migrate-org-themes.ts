/**
 * scripts/migrate-org-themes.ts — one-time org theme migration
 * (REDESIGN-P2 §2.5)
 *
 * Moves legacy org theme settings (old THEME_PRESETS ids saved in the
 * Setting key/value store) into the v2 format:
 *
 *   key   = "org-theme:<orgId>"
 *   value = JSON { orgId, mode, brandHex, derivedAt }
 *
 * Mapping: preset id → preset accentColor becomes the single brand hex
 * (deriveBrandPalette regenerates everything else at runtime). Legacy
 * keys are left in place as an audit trail; the client-side preset key
 * is migrated + deleted by ThemeV2Provider on next load.
 *
 * Idempotent: existing org-theme:* keys are never overwritten.
 *
 * Usage:
 *   node scripts/migrate-org-themes.ts            # apply
 *   node scripts/migrate-org-themes.ts --dry-run  # report only
 */

import { PrismaClient } from "@prisma/client";

// Preset id → accentColor, mirrored from src/modules/theme/themes/presets.ts
// (kept inline so this script runs standalone under node's type stripping).
const PRESET_ACCENTS: Record<string, string> = {
  modern: "#f59e0b",
  ocean: "#1a73e8",
  forest: "#5b8a72",
  sunset: "#e11d48",
};
const DEFAULT_ACCENT = PRESET_ACCENTS.modern;

// Settings keys written by the legacy org theming surface.
const LEGACY_KEY_RE = /^(?:org[-_]?)?theme[-_]?preset(?::(.+))?$/i;
const targetKey = (orgId: string) => `org-theme:${orgId}`;

function resolveBrandHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { presetId?: string; accentColor?: string };
    if (parsed.accentColor) return parsed.accentColor;
    if (parsed.presetId) return PRESET_ACCENTS[parsed.presetId] ?? DEFAULT_ACCENT;
  } catch {
    /* not JSON — treat as bare preset id below */
  }
  return PRESET_ACCENTS[trimmed] ?? DEFAULT_ACCENT;
}

async function main() {
  try {
    process.loadEnvFile(); // .env, if present (Prisma needs DATABASE_URL)
  } catch {
    /* no .env — assume env is provided another way */
  }

  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  try {
    const settings = await prisma.setting.findMany();
    const legacy = settings.filter((s) => LEGACY_KEY_RE.test(s.key));
    const existingTargets = new Set(
      settings.filter((s) => s.key.startsWith("org-theme:")).map((s) => s.key)
    );

    let migrated = 0;
    let skipped = 0;

    for (const row of legacy) {
      const orgId = LEGACY_KEY_RE.exec(row.key)?.[1] ?? "platform";
      const target = targetKey(orgId);
      const brandHex = resolveBrandHex(row.value);

      if (!brandHex) {
        console.warn(`skip ${row.key}: unrecognised value ${JSON.stringify(row.value)}`);
        skipped++;
        continue;
      }
      if (existingTargets.has(target)) {
        console.log(`skip ${row.key}: ${target} already migrated`);
        skipped++;
        continue;
      }

      const payload = {
        orgId,
        mode: "light",
        brandHex,
        derivedAt: new Date().toISOString(),
      };
      if (dryRun) {
        console.log(`dry-run: ${row.key} → ${target} = ${JSON.stringify(payload)}`);
      } else {
        await prisma.setting.upsert({
          where: { key: target },
          create: { key: target, value: JSON.stringify(payload) },
          update: {}, // idempotent — never overwrite an existing config
        });
        console.log(`migrated: ${row.key} → ${target} (brand ${brandHex})`);
      }
      existingTargets.add(target);
      migrated++;
    }

    console.log(
      `migrate-org-themes: ${dryRun ? "would migrate" : "migrated"} ${migrated}, skipped ${skipped} (of ${legacy.length} legacy row(s)).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("migrate-org-themes failed:", err);
  process.exit(1);
});
