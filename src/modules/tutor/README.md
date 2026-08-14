# modules/tutor — Floating AI Tutor (REDESIGN-P5 W2)

The draggable, dockable AI tutor present on every portal screen. Ships
inside the `portal_learner_v2` flag via the learner `PortalShell`.

## Public API

| Export | Purpose |
|---|---|
| `FloatingTutor` | Mount once per portal shell — FAB + chat panel + live region. |
| `VectorTutorRig` | Abstract in-house vector avatar (layered SVG, tokens only). |
| `useTutorStore` | Zustand store: `dock` (persisted), `open`, `state`, `badge`. |
| `TutorState` | Rig state machine: `idle \| listening \| thinking \| speaking`. |
| `ChatMessage` | Chat transcript row type. |

## Architecture

- `lib/dock.ts` — DOM-free dock math (clamp/snap/normalize). Unit +
  snapshot tested (`dock.test.ts`): the FAB rect never intersects the
  BottomNav/ActionBar rects across the P6 device matrix, and the
  normalized dock round-trips across reloads.
- `floating-tutor.tsx` — pointer-drag with edge snap; measures chrome
  obstacles via `data-slot="bottom-nav" / "action-bar"`; persists the
  dock via `zustand/persist` (`tutor-v1` key, dock-only partialize).
- `tutor-panel.tsx` — full-screen dialog on xs, docked card on md+;
  stays mounted while closed so transcripts survive open/close.
- `use-tutor-chat.ts` — streams `POST /api/v2/tutor/ask` (SSE) and
  drives the rig state machine.
- `vector-rig.tsx` — event→expression mapping on `--tutor-ring` /
  `--tutor-fab` / `--on-brand` tokens; motion honours reduced-motion.

## Constraints honoured

- **Text-only AI** (P2 §1.5): composer accepts text; the system prompt
  forbids the model from claiming it can see files/media.
- **Gesture parity** (P6 §3): the panel's edge-flip button is the
  visible equivalent of dragging the FAB to the other side.
- **A11y** (P6 §4): rig is `aria-hidden`; state changes announced via
  an `aria-live` region; Esc closes; composer auto-focuses.

## Data owners

No tables of its own. Reads `LearnProfile`/course context via
`/api/v2/tutor/ask`; `badge` is fed by the W3 study-flow engine.
