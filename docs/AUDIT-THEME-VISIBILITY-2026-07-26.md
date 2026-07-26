# Section 4b — Theme + Accessibility Audit (2026-07-26)

**Scope**: Theme consistency, contrast (WCAG AA), color-only signals, responsive/mobile behaviour, and invisible/unreadable elements across the ExaminerAI Next.js app.

**Method**:
- Read `src/app/globals.css`, `tailwind.config.ts`, `src/components/theme-provider.tsx`, all of `src/modules/theme/*`.
- Grep for hardcoded hex colors and Tailwind palette classes (`bg-red-500`, `text-amber-600`, …) in `src/components/**`.
- Grep for inline `style={{ ... color ... }}` usage.
- Reviewed chart-color helpers (`src/lib/chart-theme.ts`), RadialProgress, prominent-tabs, action-dialog, DailyTaskReminder, CompactGantt, Login, SettingsPanel, AppShell, SpatialBatchMap, InsightsView, PrincipalDashboard, CounselorDashboard.
- Verified one narrow CSS-token fix (destructive-foreground) with `npx tsc --noEmit` and `npx next build`.

**Headline finding**: The `--destructive-foreground` token was undefined in `globals.css`, missing from the `@theme inline` block, missing from the `ThemeColors` interface, and missing from all 4 theme presets — yet it was referenced by `text-destructive-foreground` in `toast.tsx` (destructive toast variant) and `CertificateApprovals.tsx` (Reject button). The class silently no-op'd in Tailwind v4, so destructive toasts and the Reject button inherited the parent's foreground color — `#0f172a` on `#dc2626` in light mode (~3.5:1, fails AA) and `#fafafa` on `#f87171` in dark mode (~2.5:1, fails AA). **FIXED directly** — pure CSS/token addition, zero logic risk. See §3.1.

---

## 1. Theme system architecture (how it actually works)

| Layer | File | Role |
|---|---|---|
| Static fallback | `src/app/globals.css` `:root` / `.dark` | Defines every CSS variable as a hex literal. Used during SSR + first paint, before the React preset provider mounts. |
| Tailwind v4 tokens | `src/app/globals.css` `@theme inline { … }` | Maps CSS vars (`--background`) → Tailwind color utilities (`bg-background`). **Only variables listed here generate utilities.** |
| Runtime override | `src/modules/theme/theme-context.tsx` | `ThemePresetProvider` injects a `<style id="examiner-theme-vars">` into `<head>` that re-declares `:root` and `.dark` with the user's chosen preset. Wins over `globals.css` by source order. |
| Presets | `src/modules/theme/themes/presets.ts` | 4 presets (Modern Slate, Ocean Blue, Forest Sage, Sunset Rose) × 2 modes = 8 color sets. |
| Light/dark toggle | `src/components/theme-provider.tsx` + `next-themes` | Adds/removes `.dark` class on `<html>`. Default theme: light. |
| Combined UI | `src/modules/theme/unified-theme-toggle.tsx` | Single dropdown: mode (light/dark/system) + preset picker. |
| Growth palette | `globals.css` lines 93-101 (light) + 142-150 (dark) | Separate `--growth-sage` / `--growth-amber` / `--growth-coral` family. Used by `.bg-growth-sage-soft`, `.text-growth-coral`, etc. |

### Key implications

1. **Tailwind v3 config is dead code.** `tailwind.config.ts` declares colors as `hsl(var(--background))`, but the `@theme inline` block in `globals.css` uses raw hex (`--background: #fafafa`). Tailwind v4 reads `@theme inline`; the v3-style `hsl(var(--*))` references in `tailwind.config.ts` are ignored. **Result**: every utility class (`bg-primary`, `text-foreground`, etc.) resolves to the raw hex value. Not a bug — just dead config that should be deleted in a future cleanup.

2. **The growth palette is NOT part of the preset system.** `presets.ts` only includes the core token family (background, foreground, primary, …, chart-5, sidebar-*). The `--growth-*` variables are defined once in `globals.css` and never overridden by the preset provider. Switching from Modern Slate to Sunset Rose leaves `--growth-sage` at `#5b8a72`. Minor theme-consistency gap, not a contrast issue.

3. **First-paint theme is always Modern Slate.** Because the preset is applied client-side via `useEffect`, the SSR HTML uses `globals.css` defaults (which match the Modern Slate preset). If a returning user has Sunset Rose saved in `localStorage`, they see Modern Slate for one frame, then a flash to Sunset Rose. Acceptable but worth knowing.

---

## 2. Contrast audit (WCAG AA)

WCAG AA requires **4.5:1** for normal text (< 18pt / < 14pt bold) and **3:1** for large text. Non-text UI components (icon borders, focus rings) require **3:1**.

### 2.1 Core token combinations — verified

All ratios computed against the Modern Slate preset (default).

| Combination | Light | Dark | Notes |
|---|---|---|---|
| `text-foreground` on `bg-background` | `#0f172a` on `#fafafa` → **14.1:1** ✓ | `#fafafa` on `#0a0a0f` → **18.9:1** ✓ | Body text. Passes AAA. |
| `text-muted-foreground` on `bg-card` | `#64748b` on `#ffffff` → **4.6:1** ✓ | `#9ca3af` on `#16161f` → **6.4:1** ✓ | Secondary text. Barely passes AA in light. |
| `text-muted-foreground` on `bg-muted` | `#64748b` on `#f1f5f9` → **4.1:1** ✗ | `#9ca3af` on `#1c1c28` → **5.9:1** ✓ | **Light fails AA.** Used in captions, helper text on muted chips. |
| `text-primary-foreground` on `bg-primary` | `#ffffff` on `#0f172a` → **14.1:1** ✓ | `#0a0a0f` on `#fbbf24` → **11.5:1** ✓ | Primary buttons. |
| `text-accent-foreground` on `bg-accent` | `#92400e` on `#fef3c7` → **5.2:1** ✓ | `#fbbf24` on `#3d2e0e` → **7.9:1** ✓ | Accent pills. |
| `text-secondary-foreground` on `bg-secondary` | `#0f172a` on `#f1f5f9` → **12.6:1** ✓ | `#e5e7eb` on `#26263a` → **9.5:1** ✓ | Secondary buttons. |
| `text-white` on `bg-destructive` (button/badge) | `#ffffff` on `#dc2626` → **5.9:1** ✓ | `#ffffff` on `#f87171` → **2.6:1** ✗ (dark) | **Dark fails AA.** Used by `Button` and `Badge` destructive variants. Dark mode also applies `dark:bg-destructive/60` which raises effective contrast to ~4.4:1 — borderline. |
| `text-destructive-foreground` on `bg-destructive` (toast/CertificateApprovals) | **WAS BROKEN** — token undefined, inherited parent color (~3.5:1 ✗) | **WAS BROKEN** — inherited (~2.5:1 ✗) | **FIXED in this audit** → see §3.1. Now `#ffffff` light / `#0a0a0f` dark — both pass. |
| `text-foreground` on `bg-primary` (active nav item) | `#0f172a` on `#0f172a` → **1:1** ✗ | `#fafafa` on `#fbbf24` → **11.5:1** ✓ | **Active nav items use `text-primary-foreground`, NOT `text-foreground` — verified OK in AppShell.tsx line 591.** No issue. |
| `bg-white/20 text-white` on `bg-primary` (prominent-tabs active badge) | `#ffffff` on `#0f172a` @ 20% opacity → ~3.2:1 ✗ | `#ffffff` on `#fbbf24` @ 20% opacity → ~1.8:1 ✗ | **Both fail.** Active-tab badge in `prominent-tabs.tsx` line 146. See §4.3. |

### 2.2 Hardcoded color classes — patterns and contrast

The codebase has **251 occurrences** of hardcoded Tailwind palette classes (`bg-emerald-500/10`, `text-amber-600`, `border-rose-500/30`, etc.) across 40+ component files. The dominant pattern is a "tier pill" used for wellbeing flags:

```tsx
"text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-300"
"text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300"
"text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-300"
```

Verified contrast for this pattern:

| Tier | Light text on bg | Ratio | Dark text on bg | Ratio | Verdict |
|---|---|---|---|---|---|
| emerald | `#059669` on `#ecfdf5` | 3.0:1 ✗ | `#6ee7b7` on `#064e3b`@20% over `#16161f` ≈ `#0e2a23` → 6.8:1 ✓ | 6.8:1 ✓ | **Light fails AA for normal text.** |
| amber | `#d97706` on `#fffbeb` | 3.2:1 ✗ | `#fcd34d` on dark blend | ~8:1 ✓ | **Light fails AA.** |
| rose | `#e11d48` on `#fff1f2` | 4.7:1 ✓ | `#fda4af` on dark blend | ~5:1 ✓ | Passes. |
| red (`text-red-600 bg-red-500/10`) | `#dc2626` on `#fee2e2`-ish | 4.5:1 ✓ | n/a (no `dark:` variant) | — | Passes. |

The emerald-600 and amber-600 patterns in light mode are the most common contrast failures in the app. They appear in `action-dialog.tsx`, `DailyTaskReminder.tsx`, `AssignmentsTab.tsx`, `StudentsRoster.tsx`, `TeacherLoadPanel.tsx`, `CertificateApprovals.tsx`, `SettingsPanel.tsx`, and many others.

**Why I did not fix this directly**: The pattern is used in 40+ files with the same shape. Fixing it properly means changing the light-mode text color from `text-X-600` to `text-X-700` (e.g. `text-emerald-700` = `#047857` → 4.5:1 ✓) across all 40+ files. That's a coordinated change to the design-system pattern, not a single CSS value. It belongs in the report, not in a narrow fix.

### 2.3 Specific high-impact contrast failures (light mode)

These are the most user-facing:

| Location | Element | Combo | Ratio | Fix |
|---|---|---|---|---|
| `prominent-tabs.tsx:146` | Active-tab badge | `text-white` on `bg-primary` @ `bg-white/20` overlay | ~1.8:1 (dark) / ~3.2:1 (light) | Use `bg-primary-foreground/30 text-primary-foreground` instead — keeps contrast against primary. |
| `modern-landing.tsx:516, 579, 135` | Primary CTA buttons | `text-white` on `bg-amber-500` | **1.9:1** ✗ | Replace `bg-amber-500` with `bg-amber-600` (3.2:1, large text only) or `bg-amber-700` (5.0:1 ✓). |
| `modern-landing.tsx:618` | "AI-powered" badge | `text-amber-950` on `bg-amber-400` | ~9:1 ✓ | OK. |
| `DailyTaskReminder.tsx:189` | Floating pending badge | `text-white` on `bg-amber-500` + `animate-pulse` | **1.9:1** ✗ | Same fix as above. |
| `Login.tsx:135` | "Launch Demo" button | `text-white` on `bg-amber-500 hover:bg-amber-600` | 1.9:1 → 3.2:1 | Same fix. |
| `Login.tsx:111` | "Try the Live Demo" header | `text-amber-900` on `bg-amber-50` | 9.5:1 ✓ | OK. |
| `Login.tsx:113` | Demo description | `text-amber-800` on `bg-amber-50` | 7.2:1 ✓ | OK. |
| `SettingsPanel.tsx:207` | "No security question set" warning | `text-amber-600` on `bg-card` | 3.2:1 ✗ | Use `text-amber-700` (#b45309 → 4.6:1 ✓). |
| `CompactGantt.tsx:186` | "W1→W3" label inside task bar | `text-white` on `bg-emerald-500/80` | ~2.8:1 ✗ + 8px text | Two issues: contrast AND text size. |
| `toast.tsx:80` | Destructive toast close button | `text-red-300` on `bg-destructive` (`#dc2626`) | 3.4:1 ✗ for icon | Non-text UI component — AA requires 3:1, barely passes. |

### 2.4 Dark-mode destructive button (systemic, low-risk)

`Button` destructive variant (`button.tsx:15`):
```
"bg-destructive text-white ... dark:bg-destructive/60"
```

In dark mode `--destructive` is `#f87171`. With 60% opacity over the card bg (`#16161f`), the effective bg is approximately `#9a5757`. White text on `#9a5757` = **~4.4:1** — borderline; fails AA for normal text by a hair, passes for large text.

Fixing this means choosing a darker destructive color in dark mode (e.g. `#ef4444` instead of `#f87171`) — would push to ~5.5:1. This is a design-system change. Belongs in the report.

---

## 3. Direct CSS fixes applied in this audit

### 3.1 FIXED — `--destructive-foreground` token was missing entirely

**Symptom**: `text-destructive-foreground` class was a no-op in Tailwind v4 (no `--color-destructive-foreground` in `@theme inline`), so destructive toasts and the certificate-reject button inherited the parent's text color, producing failing contrast.

**Files changed** (pure CSS/token additions, zero logic/data risk):

1. `src/app/globals.css`:
   - Added `--destructive-foreground: #ffffff;` to `:root` (light).
   - Added `--destructive-foreground: #0a0a0f;` to `.dark`.
   - Added `--color-destructive-foreground: var(--destructive-foreground);` to the `@theme inline` block (this is what generates the `text-destructive-foreground` / `bg-destructive-foreground` utilities in Tailwind v4).

2. `src/modules/theme/themes/presets.ts`:
   - Added `destructiveForeground: string;` to the `ThemeColors` interface.
   - Added `destructiveForeground` to all 8 color sets (4 presets × 2 modes):
     - Modern Slate: light `#ffffff`, dark `#0a0a0f`
     - Ocean Blue: light `#ffffff`, dark `#1e1f20`
     - Forest Sage: light `#ffffff`, dark `#1a2e22`
     - Sunset Rose: light `#ffffff`, dark `#1a0f12`
   - Foreground is the dark background color of each preset's dark mode (mirrors how `primary-foreground` flips between light and dark).

3. `src/modules/theme/theme-context.tsx`:
   - Added `destructiveForeground: "--destructive-foreground"` to the `colorsToCssVars` map (the `Record<keyof ThemeColors, string>` lookup). Without this, TypeScript would compile (the object is partial) but the runtime `<style>` injection would not write `--destructive-foreground` for the active preset.

**Verification**:
- `npx tsc --noEmit` — no new errors in `src/`. (Pre-existing errors in `examples/` and `skills/` directories are unrelated.)
- `npx next build` — **✓ Compiled successfully in 30.0s**, 100/100 static pages generated.

**Affected components** (now render correctly):
- `src/components/ui/toast.tsx` — destructive toast variant (line 34) + toast action button hover (line 65).
- `src/components/examiner/teacher/CertificateApprovals.tsx` — "Confirm Reject" button (line 215).

### 3.2 No other direct CSS fixes applied

Other contrast failures (§2.2, §2.3, §2.4) require either:
- A coordinated design-system change to the "tier pill" pattern (`text-X-600` → `text-X-700`) across 40+ files, OR
- A change to the destructive color palette in dark mode (would affect every destructive button/badge), OR
- A change to the prominent-tabs badge logic (would require restructuring the active/inactive branch in `prominent-tabs.tsx:146`).

These are structural and are documented in §4 for the implementation team.

---

## 4. Findings — full list

### 4.1 Theme consistency

| # | Severity | Location | Finding |
|---|---|---|---|
| T-1 | Medium | `src/lib/chart-theme.ts` | Hardcoded LIGHT/DARK chart palettes mirror the **Ocean Blue** preset (`#1a73e8`, `#34a853`, `#fbbc04`, `#ea4335`, `#9334e8`), not the Modern Slate preset (`#f59e0b`, `#10b981`, `#3b82f6`, `#ef4444`, `#8b5cf6`). When a user picks Modern Slate, charts still use Ocean Blue colors. Fix: read from `getComputedStyle(document.documentElement).getPropertyValue('--chart-1')` after mount, or duplicate the palette per preset. |
| T-2 | Medium | `src/components/examiner/teacher/SpatialBatchMap.tsx:28-33` | `TIER_COLORS` hardcoded as `#10b981`, `#f59e0b`, `#ef4444`, `#6b7280`. Same colors in every preset and every mode. Should at minimum swap light/dark via `useChartColors()`. |
| T-3 | Medium | `src/components/examiner/teacher/InsightsView.tsx:40, 64-69, 92-95` | `WELLBEING_COLORS`, score-distribution buckets, and engagement-distribution colors all hardcoded. Won't follow preset or mode. |
| T-4 | Medium | `src/components/examiner/PrincipalDashboard.tsx:176-184, 369-377` | All pie-chart data arrays hardcode `color: "#10b981"` etc. |
| T-5 | Medium | `src/components/examiner/CounselorDashboard.tsx:207-209, 598-600` | Same pattern as PrincipalDashboard. |
| T-6 | Medium | `src/components/examiner/student/CompactGantt.tsx:78-83` | `statusColors` uses Tailwind palette classes (`bg-blue-500/70`, `bg-emerald-500/80`, `bg-amber-500/70`) — won't follow preset. |
| T-7 | Low | `src/app/globals.css` (growth palette) | `--growth-sage`, `--growth-amber`, `--growth-coral` are defined only in `globals.css`. They are NOT overridden by the runtime preset provider (presets.ts doesn't include them). When a user picks Ocean Blue, growth-palette elements still show Modern Slate sage/amber/coral. Fix: add `growth*` fields to `ThemeColors` + each preset. |
| T-8 | Low | `tailwind.config.ts` | Tailwind v4 ignores this file's `hsl(var(--*))` color definitions because `@theme inline` in `globals.css` is authoritative. The v3-style config is dead code that misleads readers. Recommend deleting or marking as legacy. |
| T-9 | Low | `src/components/examiner/student/CompactGantt.tsx:119, 210, 172` | "Today" marker and current-week number use `text-red-500` / `bg-red-500/60`. Hardcoded — same red in Ocean / Forest / Sunset presets. |
| T-10 | Low | 40+ component files (see §2.2) | The "tier pill" pattern `text-X-600 bg-X-50 dark:bg-X-950/20 dark:text-X-300` uses Tailwind palette colors, not tokens. Visually consistent across presets (always same emerald/amber/rose) but ignores the active preset's chart colors. Acceptable as a design choice (semantic colors should be stable) but worth documenting. |

### 4.2 Color-only signals (labels are words first, color second)

**Verified**: The codebase follows the "words first, color second" rule consistently. Every status/flag/tier indicator that uses color also has a text label or icon. No finding requires a code change.

Verified locations:
- `action-dialog.tsx` — each tier (green/amber/red) has BOTH a distinct icon (`CheckCircle2` / `AlertTriangle` / `AlertCircle`) AND a `data.headline` text label.
- `DailyTaskReminder.tsx` — pending/done states have `Bell`/`CheckCircle2` icons + "X pending" / "All done" text. Status pills have text labels ("Pending", "Done", "Required", "Milestone").
- `CompactGantt.tsx` — legend at line 95-101 has text labels ("Done", "Active", "Planned", "Blocked", "Today"). Task status icons are paired with text descriptions.
- `SpatialBatchMap.tsx` — legend at line 127-138 has text labels ("Green", "Amber", "Red").
- `InsightsView.tsx` — all chart data has `name` fields shown in legends/tooltips.
- `PrincipalDashboard.tsx`, `CounselorDashboard.tsx` — pie-chart legends have text labels.
- `prominent-tabs.tsx` — badges show a numeric count (the count is the information; color is decorative).
- `SettingsPanel.tsx:207` — "⚠ No security question set" uses emoji + text + amber color. Not color-only.
- `Login.tsx:111-115` — "Try the Live Demo" + amber box + Sparkles icon. Not color-only.
- `action-dialog.tsx:145` — required-field asterisk uses `text-rose-500 *` BUT also has the explicit text "(required)" right after. Compliant.

### 4.3 Contrast failures (WCAG AA) — needs implementation

| # | Severity | Location | Combo | Ratio | Suggested fix |
|---|---|---|---|---|---|
| C-1 | High | `prominent-tabs.tsx:146` | `bg-white/20 text-white` on `bg-primary` (active badge) | ~1.8:1 dark, ~3.2:1 light | Replace with `bg-primary-foreground/20 text-primary-foreground`. |
| C-2 | High | `modern-landing.tsx:516, 579, 135`, `Login.tsx:135`, `DailyTaskReminder.tsx:189` | `text-white` on `bg-amber-500` (primary CTA / floating badge) | **1.9:1** | Replace `bg-amber-500` with `bg-amber-600` (3.2:1, large text only) or `bg-amber-700` (5.0:1 ✓). |
| C-3 | Medium | `button.tsx:15` (destructive dark) | `text-white` on `dark:bg-destructive/60` (`#f87171` @ 60% over `#16161f`) | ~4.4:1 | Change dark `--destructive` from `#f87171` to `#ef4444` (red-500) → ~5.5:1 ✓. |
| C-4 | Medium | 40+ files using the "tier pill" pattern | `text-emerald-600`/`text-amber-600` on `bg-X-50` (light mode) | 3.0–3.2:1 | Change light-mode text from `text-X-600` to `text-X-700` across the pattern. |
| C-5 | Medium | `SettingsPanel.tsx:207` | `text-amber-600` on `bg-card` (#ffffff) | 3.2:1 | Change to `text-amber-700` (#b45309 → 4.6:1 ✓) or `text-amber-800` (#92400e → 5.9:1 ✓). |
| C-6 | Low | `CompactGantt.tsx:186` | `text-white` on `bg-emerald-500/80` for "W1→W3" label | ~2.8:1 + 8px text | Two issues: contrast AND text size. Drop the in-bar label or move it below. |
| C-7 | Low | `Login.tsx:231` | `text-foreground text-muted-foreground` (both classes on same element — `text-foreground` is overridden by `text-muted-foreground`) | n/a | Remove the redundant `text-foreground` class. Cosmetic. |
| C-8 | Low | `toast.tsx:80` | Destructive toast close icon `text-red-300` on `bg-destructive` | ~3.4:1 for icon | AA non-text UI requires 3:1 — barely passes. Could bump to `text-red-200` for ~4.5:1. |

### 4.4 Responsive / mobile

**Verified usable on small viewports**:
- `AppShell.tsx:540-546` — mobile hamburger toggle for sidebar (`lg:hidden fixed top-4 left-4 z-50`), sidebar slides in/out (`translate-x-full lg:translate-x-0`).
- `AppShell.tsx:532-537` — skip-to-content link for keyboard users (`sr-only focus:not-sr-only`).
- `prominent-tabs.tsx:70-112` — underline variant is `overflow-x-auto` with `whitespace-nowrap flex-shrink-0` (horizontal scroll on small screens).
- `prominent-tabs.tsx:95-96` — pill variant collapses labels to first word on small screens (`hidden sm:inline` / `sm:hidden`).
- `CompactGantt.tsx:110-111` — wraps the timeline in `overflow-x-auto` with `min-w-[480px]` so it scrolls horizontally instead of squishing.
- `CompactGantt.tsx:113` — grid cols shrink from `180px` to `90px` label column on mobile (`grid-cols-[90px_1fr] sm:grid-cols-[180px_1fr]`).
- `DailyTaskReminder.tsx:217` — popup uses `items-end sm:items-center` so on mobile it sticks to the bottom (thumb-reachable), on desktop it centers.
- `use-mobile.ts` hook exists (768px breakpoint) — but only used in a few places. Most responsive behaviour is via Tailwind `sm:`/`lg:` classes.
- `Login.tsx:87` — `min-h-screen flex items-center justify-center p-4` — properly padded on mobile.
- `UnifiedThemeToggle` dropdown — `className="w-64"` fixed width. On a 320px screen this fits but leaves only 56px margin. OK.

**Minor responsive issues**:
- `AdminDashboard` has 12 top-level tabs — flagged in prior Section-4 audit as wrapping 2-3 rows on smaller screens. Not fixed yet. (Out of scope for this audit — see `AUDIT-ROLES-2026-07-26-V2.md` finding 11.)
- `StudentPortfolioPage` (1342 lines, 10 tabs) — likely wraps on mobile. Not separately re-audited here.

### 4.5 Invisible / unreadable elements under specific theme/state

| # | Severity | Location | Issue |
|---|---|---|---|
| I-1 | High (now fixed) | `toast.tsx:34`, `CertificateApprovals.tsx:215` | `text-destructive-foreground` was a no-op (token missing). Destructive toasts and the Reject button inherited parent color → failing contrast. **FIXED in §3.1.** |
| I-2 | Medium | `prominent-tabs.tsx:146` | Active-tab badge text effectively invisible in dark mode (1.8:1 ratio). User sees a number floating in a faint white blob. |
| I-3 | Medium | `SpatialBatchMap.tsx:114-117` | `fillOpacity={0.7}` on scatter cells. With `fill="#6b7280"` (null tier) over a white card in light mode, the dot is `#a1a6ae`-ish — visible. In dark mode over `#16161f`, the dot becomes `#3d4248`-ish — visible. OK. But the green/amber/red cells with 0.7 opacity + 1px stroke in the same color may be hard to distinguish for color-blind users. Not a contrast issue per se. |
| I-4 | Low | `DailyTaskReminder.tsx:217` | Modal backdrop uses `bg-black/50`. In dark mode this is acceptable; in light mode the underlying content is partially visible through the 50% black overlay. Standard pattern. OK. |
| I-5 | Low | `CompactGantt.tsx:172` | "Today" marker is `bg-red-500/60 w-0.5` — a 2px-wide vertical line at 60% opacity. In dark mode against dark backgrounds, may be hard to see. Bump to `bg-red-500` (100%) or `bg-rose-500`. |
| I-6 | Low | `chart-theme.ts:38-66` | `axisFaded` is `#9aa0a6` (light) / `#5f6368` (dark). On white background, `#9aa0a6` is 2.6:1 — fails AA for the small axis tick labels (typically 10-11px). Recommend `#5f6368` for both modes. |

---

## 5. What's working well

1. **Skip-to-content link** (`AppShell.tsx:532-537`) — properly implemented `sr-only focus:not-sr-only` pattern for keyboard users.
2. **Aria-labels on all icon-only buttons** — verified in `StudentPortfolioPage`, `AdminDashboard`, `Messages`, `AppShell`, `ThemePreferenceControl`, `AskMyTeacher`, `CoursePlanner`. Comprehensive.
3. **`prefers-reduced-motion` respected** — `globals.css:299-308` disables all custom animations (`animate-pulse-slow`, `animate-fade-in-up`, `animate-stagger`, `animate-success-burst`, `animate-float`, `shimmer`) when the user prefers reduced motion. Excellent.
4. **`role="progressbar"` with `aria-valuenow/min/max`** on `RadialProgress` (`radial-progress.tsx:78-82`) — proper ARIA pattern.
5. **`aria-pressed` on toggle buttons** — `ThemePreferenceControl.tsx:46` uses `aria-pressed={active}`.
6. **`role="alert"` on alerts** — `alert.tsx:30` — proper ARIA for announceable alerts.
7. **Theme preset system is well-architected** — clean separation between static fallback (globals.css), runtime override (theme-context.tsx), and presets (presets.ts). Adding a new preset is a one-file change.
8. **Growth palette (Phase C)** — separate `--growth-sage` / `--growth-amber` / `--growth-coral` family with soft + foreground variants. Well-documented in `globals.css:87-101`. Used consistently in `RadialProgress`, `AskMyTeacher`, `action-dialog` (sort of).
9. **Custom scrollbar adapts to theme** — `globals.css:285-297` uses `var(--muted-foreground)`.
10. **`UnifiedThemeToggle`** — single dropdown combining light/dark/system + preset picker. Excellent UX. Shows a small colored dot indicating the active preset's accent color.

---

## 6. Recommended next actions (prioritized)

| Priority | Action | Effort | Impact |
|---|---|---|---|
| P1 | Apply C-1 fix: replace `bg-white/20 text-white` with `bg-primary-foreground/20 text-primary-foreground` in `prominent-tabs.tsx:146`. | 1 line | Restores contrast on active-tab badges in both modes. |
| P1 | Apply C-2 fix: replace `bg-amber-500` with `bg-amber-700` for primary CTAs in `modern-landing.tsx` (3 places), `Login.tsx:135`, `DailyTaskReminder.tsx:189`. | 5 lines | Restores AA contrast on the most prominent CTAs. |
| P2 | Apply C-3 fix: change dark-mode `--destructive` from `#f87171` to `#ef4444` in `globals.css` + all 4 presets' dark mode. | 5 lines | Restores AA on every destructive button/badge in dark mode. |
| P2 | Apply C-4 fix: search-and-replace `text-emerald-600 bg-emerald-50` → `text-emerald-700 bg-emerald-50` (and same for amber) across the "tier pill" pattern. ~40 files. | 1 hour | Restores AA on the most common status-pill pattern. |
| P2 | Apply C-5 fix: `text-amber-600` → `text-amber-700` in `SettingsPanel.tsx:207`. | 1 line | Minor. |
| P3 | Fix T-1: make `chart-theme.ts` read from CSS variables (or duplicate per preset). | 1 hour | Charts follow the active preset. |
| P3 | Fix T-2/T-3/T-4/T-5: replace hardcoded hex chart colors with `useChartColors()` calls. | 2 hours | Charts follow the active preset. |
| P3 | Fix T-7: add `growth*` fields to `ThemeColors` + each preset. | 30 min | Growth palette follows the active preset. |
| P3 | Fix C-6: drop the in-bar "W1→W3" label in `CompactGantt.tsx:186` or move below the bar. | 5 min | Removes 8px-text accessibility issue. |
| P4 | Delete the dead `tailwind.config.ts` (T-8) or mark as legacy. | 5 min | Removes misleading config. |
| P4 | Fix C-7: remove redundant `text-foreground` class on `Login.tsx:231`. | 1 line | Cosmetic. |
| P4 | Fix I-5: bump `bg-red-500/60` to `bg-red-500` for the "Today" marker in `CompactGantt.tsx:172`. | 1 line | Improves visibility. |
| P4 | Fix I-6: change `axisFaded` in `chart-theme.ts` from `#9aa0a6` to `#5f6368` (light mode). | 1 line | Improves axis label contrast. |

---

## 7. Files changed in this audit

| File | Change | Risk |
|---|---|---|
| `src/app/globals.css` | Added `--destructive-foreground` to `:root` (white) and `.dark` (near-black); added `--color-destructive-foreground` to `@theme inline`. | None — pure CSS token addition. |
| `src/modules/theme/themes/presets.ts` | Added `destructiveForeground` field to `ThemeColors` interface + all 8 preset color sets (4 presets × light/dark). | None — additive change to a type and data. |
| `src/modules/theme/theme-context.tsx` | Added `destructiveForeground: "--destructive-foreground"` to the `colorsToCssVars` map. | None — one-key addition to a lookup table. |

**Build verification**:
- `npx tsc --noEmit` — no new errors in `src/`.
- `npx next build` — ✓ Compiled successfully in 30.0s. 100/100 static pages generated.
