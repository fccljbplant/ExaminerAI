# REDESIGN P6 — QA Pass (executable gates per workstream)

> Phase 6 (2026-08-14). Runs per workstream before its flag goes default-on; full matrix re-runs at W5 and W10. **Any violation blocks merge — no waivers.**

## 1. Device matrix (automated, Playwright)

Viewports: **360×640 · 390×844 · 768×1024 · 1024×600 · 1366×768 · 1440×900**. Per screen route:
- `scrollWidth <= clientWidth` on document + every panel (no horizontal page overflow).
- Above-the-fold: `[data-primary-action]` and first KPI row fully inside first viewport at 360×640 and 1024×600.
- No clipped controls: `getBoundingClientRect` intersection for all `[data-primary-action]`, BottomNav items, ActionBar buttons.
- Single scroll axis: assert exactly one visible `overflow-y:auto` ancestor chain per view (no double scrollbars).
- Tap targets: every `button, a, [role=tab], input[type=checkbox]` ≥44×44 css px on touch viewports (hit-area padding allowed); gap ≥8 between adjacent targets.
- Shell collisions: FloatingTutor FAB rect ∩ BottomNav/ActionBar rect = ∅ in all dock positions.

## 2. Interaction & inclusivity audits

- Hover-only: CSS scan — every `:hover` rule must have a `:focus-visible`/always-visible equivalent or a sibling button; manual pass per portal.
- Gesture parity: e2e asserts each swipe/drag handler has a visible button performing the same action (slide arrows, swipe-action rows, tutor dock).
- Keyboard-only journeys (tab order e2e): login → home → session → submission flow → exam runner → review detail.
- Screen-reader smoke (manual script, NVDA + VoiceOver): dialog (modal/sheet), tabs, combobox (search), table (sticky col), toast/UNDO announcements, tutor state changes (`aria-live`).
- 200% text zoom: re-run §1 assertions with root font-size ×2; zero overflow/clipping.
- Reduced motion: `prefers-reduced-motion` emulation → animations ≤ opacity fades (snapshot).

## 3. Theme QA

- CI: `scripts/validate-theme.ts` (P2 §2.4) — all modes × default + 12 brand hues + edge hues; manifest pairs ≥4.5:1 / ≥3:1; token completeness.
- Runtime switch e2e: toggle light→dark→bed→org-brand; assert **no navigation event** and computed vars swap; charts re-color (canvas pixel sample).
- Bed Mode: captions default ON assertion; Media Session API metadata present; audio continues with screen locked (real-device check); warm-dim snapshot diff vs dark.
- Sunlight check: light-mode contrast +15% ambient simulation in validator (margin ≥0.5 above AA).

## 4. Accessibility gate

- axe-core in e2e per screen: **0 critical/serious**; ARIA pattern checks for dialog/tabs/combobox/table.
- Focus rings visible in every mode (screenshot diff on focused primary button).
- Dynamic type: L13 settings scale applies app-wide (assert computed sizes).

## 5. Performance gate

- Lighthouse CI (mobile emulation): ≥90 performance/accessibility/best-practices on each portal root + session page.
- 3G (slow-3g CDP throttle): learner home TTI < 5s; session start < 4s; skeleton visible < 300ms.
- Bundle budgets (build assert): initial JS ≤200KB gz; per-portal chunk ≤350KB gz (route-level splitting verified by `next build` trace).
- Audio-only mode: avatar assets not requested when enabled (network assertion); graceful 3G = no layout shift (CLS < 0.1).
- No full-page reloads: SPA nav assertion across portals (navigation listener).

## 6. Token / component / density audits

- `eslint` hex-ban + `scripts/audit-tokens.sh`: zero literal colors, inline color styles, or off-scale spacing/radius in `modules/**` components.
- Duplicate-primitive scan: per workstream, list components by role; two implementations of one role = consolidate before merge.
- States harness: each data component rendered in empty/loading/error/denied at xs + xl (route-level mock flags) — screenshots archived.
- Density review (human, per workstream): body 14–16px; KPI value ≤30px on xs; padding/radius from tokens; whitespace separates not swells; fold screenshots at 1024×600 reviewed against P3 §5.

## 7. Sign-off sheet (per workstream)

| Gate | Tool | Pass criteria |
|---|---|---|
| Device matrix | Playwright §1 | all green, 6 viewports |
| Interaction/a11y | §2 + axe §4 | 0 violations |
| Theme | §3 | validator green + switch e2e |
| Perf | §5 | budgets + Lighthouse |
| Tokens/density | §6 | 0 findings |
| States | §6 harness | 4 states × 2 sizes archived |
| DoD docs | P2 §1.6 | README/JSDoc updated |

Owner signs; violations get fix tickets in the same workstream (never deferred).
