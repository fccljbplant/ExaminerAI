/**
 * Theme Module — Public API
 *
 * Import from here:
 *   import { ThemePresetProvider, useThemePreset, UnifiedThemeToggle } from "@/modules/theme";
 */

export { ThemePresetProvider, useThemePreset } from "./theme-context";
export { UnifiedThemeToggle } from "./unified-theme-toggle";
export { THEME_PRESETS, DEFAULT_THEME_ID, getThemePreset } from "./themes/presets";
export type { ThemePreset, ThemeColors } from "./themes/presets";
