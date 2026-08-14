"use client";

/**
 * modules/theme/lib/captions-store.ts — caption preference (mobile a11y pass)
 *
 * Persisted per-user caption preference feeding the classroom avatar
 * bubble and any future video-caption surface. Three states:
 *   auto (default) — captions are ON in Bed Mode, OFF otherwise
 *   on             — always show captions
 *   off            — never show captions
 *
 * Lives in the theme module because P6 §3 (Theme QA) asserts "Bed Mode:
 * captions default ON" — the auto state is the mode-coupled behavior.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CaptionsMode = "auto" | "on" | "off";

export const CAPTIONS_MODES: { mode: CaptionsMode; label: string; hint: string }[] = [
  { mode: "auto", label: "Auto", hint: "On in Bed Mode, off otherwise" },
  { mode: "on", label: "Always on", hint: "Show captions in every mode" },
  { mode: "off", label: "Off", hint: "Hide captions" },
];

interface CaptionsStore {
  captionsMode: CaptionsMode;
  setCaptionsMode: (mode: CaptionsMode) => void;
}

export const useCaptionsStore = create<CaptionsStore>()(
  persist(
    (set) => ({
      captionsMode: "auto",
      setCaptionsMode: (captionsMode) => set({ captionsMode }),
    }),
    { name: "tx-captions-mode" },
  ),
);

/** Effective switch — explicit preference wins; auto = bed-mode ON. */
export function captionsEnabled(captionsMode: CaptionsMode, themeMode: string): boolean {
  if (captionsMode === "on") return true;
  if (captionsMode === "off") return false;
  return themeMode === "bed";
}
