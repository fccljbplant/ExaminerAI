/**
 * Theme Module — Public API
 *
 * Import from here:
 *   import { ThemePresetProvider, useThemePreset, UnifiedThemeToggle } from "@/modules/theme";
 *   import { ThemeV2Provider, useThemeV2 } from "@/modules/theme"; // theme v2 (W0+)
 */

// Theme v2 (REDESIGN-P2 §2)
export { ThemeV2Provider, useThemeV2, THEME_V2_STORAGE } from "./theme-provider-v2";
export type { ThemeModeV2 } from "./theme-provider-v2";
export { deriveBrandPalette, paletteToCssVars, DEFAULT_BRAND_OKLCH } from "./lib/brand";
export type { BrandPalette, BrandPaletteMode } from "./lib/brand";
export { contrastRatio, hexToOklch, oklchToHex } from "./lib/color";
export { CONTRAST_MANIFEST } from "./lib/contrast-manifest";
export { captionsEnabled, useCaptionsStore, CAPTIONS_MODES } from "./lib/captions-store";
export type { CaptionsMode } from "./lib/captions-store";
