"use client";

/**
 * modules/tutor — tutor-store (REDESIGN-P2 §1.4, W2)
 *
 * Per-feature zustand store for the FloatingTutor:
 *  - `dock`    normalized FAB position, persisted (localStorage,
 *              versioned) so the dock survives reloads — W2 exit
 *              criterion.
 *  - `open`    panel visibility (FAB ↔ panel/full-screen).
 *  - `state`   rig state machine: idle / listening / thinking / speaking.
 *  - `badge`   unread-offer count shown on the FAB (fed by the
 *              study-flow engine in W3; mechanism shipped here).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NormalizedDock } from "./lib/dock";

export type TutorState = "idle" | "listening" | "thinking" | "speaking";

interface TutorStore {
  /** Persisted, viewport-independent FAB position. Null = default dock. */
  dock: NormalizedDock | null;
  open: boolean;
  state: TutorState;
  badge: number;
  setDock: (dock: NormalizedDock | null) => void;
  setOpen: (open: boolean) => void;
  setState: (state: TutorState) => void;
  setBadge: (badge: number) => void;
}

export const useTutorStore = create<TutorStore>()(
  persist(
    (set) => ({
      dock: null,
      open: false,
      state: "idle",
      badge: 0,
      setDock: (dock) => set({ dock }),
      setOpen: (open) => set({ open }),
      setState: (state) => set({ state }),
      setBadge: (badge) => set({ badge: Math.max(0, Math.floor(badge)) }),
    }),
    {
      name: "tutor-v1",
      version: 1,
      // Only the dock position is durable — panel visibility and rig
      // state reset on every page load by design.
      partialize: (s) => ({ dock: s.dock }),
    }
  )
);
