# Impeccable Design Research — Chroma Editor

> Sources: `~/.claude/skills/impeccable/SKILL.md`, `reference/color-and-contrast.md`, `reference/typography.md`, `reference/spatial-design.md`, `reference/motion-design.md`, `reference/interaction-design.md`, `reference/polish.md`, `reference/audit.md`, `reference/critique.md`, `reference/craft.md`, `reference/overdrive.md`, `reference/animate.md`, `reference/delight.md`

---

## 1. Core Philosophy & Methodology

Impeccable is a discipline for making interfaces that look like a human expert with taste made them — not an AI applying a template. Its defining method is **register identification before any design decision**: every surface is classified as either **brand** (design IS the product — marketing, landing, portfolio) or **product** (design SERVES the product — apps, tools, dashboards). This classification controls everything: motion vocabulary, typography density, delight placement, and color strategy.

**The Chroma editor is unambiguously product register.** It's a precision tool for color experts; every element should serve the workflow, not announce itself.

### The Register Distinction in Practice

| Dimension | Brand | Product (Chroma) |
|---|---|---|
| Motion | Orchestrated page sequences, staggered reveals | 150–250 ms state transitions only; no choreography |
| Delight | Distributed across surfaces | At specific moments — first export, fix applied, palette locked |
| Typography | Expressive, fluid display scales | Fixed rem scales; high information density |
| Color | Scene-setting identity | Surfaces at exact OKLCH lightness steps; tinted neutrals |

### How the Workflow Works

Impeccable is a **command sequence**, not a single pass. Each command loads a focused reference and applies a specific lens:

1. `teach` — establish PRODUCT.md and DESIGN.md context files
2. `document` — generate DESIGN.md from existing code if starting from an existing project
3. `critique` — UX heuristic scoring (finds what's wrong structurally)
4. `audit` — technical quality scan (a11y, responsive, anti-pattern detection)
5. `polish` — systematic final-quality pass (spacing, states, micro-interactions, copy)
6. `craft [feature]` — end-to-end feature build using the confirmed design system
7. `animate` — motion layer over existing UI
8. `overdrive` — one extraordinary moment per surface; raises the ceiling
9. `delight` — targeted celebration/feedback moments at workflow milestones

---

## 2. Key Anti-Patterns (AI Design Tells)

Impeccable maintains an explicit "AI slop test" — a two-altitude check: first-order is whether the palette reads as the category reflex ("OKLCH tool → purple neons on black"); second-order is whether the aesthetic family reads as the anti-reflex trap ("color tool that avoided neons → editorial gradient type on glassmorphism"). Both must fail to identify the design.

### Absolute Bans (cross-register, no exceptions)

- **Gradient text** — `background-clip: text` with gradient fill. The Chroma header already violates this (`bg-gradient-to-tr from-blue-500 via-fuchsia-500 to-amber-400` on the logo swatch — acceptable for a color swatch, not for logotype text).
- **Side-stripe borders** — `border-left`/`border-right` > 1px as decorative accent. Use background tints, full borders, or nothing.
- **Glassmorphism as default** — blur/frosted cards as the ambient UI style. Reserved for one purposeful moment if at all.
- **Hero-metric template** — big number, small label, gradient accent. The accessibility score callouts risk this.
- **Identical card grids** — same-size cards with icon + heading + body, repeated. The Panel component wrapping every section creates this right now.
- **Nested cards** — always wrong. Cards inside `rounded-2xl border bg-neutral-900` panels are nested.
- **Modal as first thought** — exhaust inline/progressive alternatives first.
- **Bounce/elastic easing** — tacky, dated.
- **Pure gray / pure black** — `#000` and `oklch(50% 0 0)` don't exist in nature; even chroma 0.005 reads more natural.
- **Generic fonts without intent** — `Inter` or `system-ui` without a deliberate role structure is fine, but needs a clear semantic token system, not raw Tailwind classes scattered throughout.

### Product-Register Specific Tells

- **Uppercase tracking-wide on all labels** — currently used on every section label (`text-xs font-semibold uppercase tracking-wide`). One level of hierarchy is fine; as the only hierarchy tool it becomes a template.
- **`accent-blue-500` on native `<input type="range">`** — unthemed browser chrome. Bespoke slider tracks are the premium baseline for a color tool.
- **No hover/focus/active states** — buttons in AccessibilityPanel have hover but no focus-visible ring; sliders have none.
- **`neutral-400` everywhere** — secondary text is uniformly `text-neutral-400` across all panels regardless of context. Color has no variation as an information signal.
- **Same `rounded-2xl border border-neutral-800 bg-neutral-900` Panel on every section** — the entire layout reads as identical card grid.

---

## 3. Concrete Application to the Chroma Editor

### 3.1 Dark UI Color System (Source: `color-and-contrast.md`)

**Current state:** Background is `#0b0d12` (pure dark, zero chroma). All surfaces use `neutral-800/900` (Tailwind gray — zero chroma). Borders are `neutral-800`. Accents are `blue-500` on sliders and action buttons — a reflexive category choice ("color tool → blue").

**Impeccable prescription:**

- **Tint all neutrals with the current base hue.** Surfaces should be `oklch(12% C H)`, `oklch(16% C H)`, `oklch(20% C H)` where `C` is ~0.005–0.012 and `H` is the current palette's base hue. This creates a "the UI breathes the color you're editing" effect that is deeply appropriate to this tool.
- **Build a 3-step surface scale:** `--surface-0` (body bg, ~11% L), `--surface-1` (panel bg, ~15% L), `--surface-2` (raised element, ~19% L). Borders are `--surface-3` (~22% L). Depth from lightness, not shadow.
- **Replace `blue-500` accent.** The accent for UI chrome should derive from the engine's current base color (OKLCH, pulled from Zustand store), desaturated to ~0.12 chroma and lightened to ~65% for use on dark surfaces. This means the editor chrome itself becomes a live preview of the palette — distinctive and deeply appropriate.
- **Text tiers:** `--text-primary` (oklch 94% 0.005 H), `--text-secondary` (oklch 65% 0.008 H), `--text-muted` (oklch 45% 0.004 H). Never pure white, never pure neutral-400.
- **Selection:** Current `#3b82f6` selection is static blue. Should derive from the current base hue.

### 3.2 Typography System (Source: `typography.md`)

**Current state:** `system-ui` stack — good. No semantic token system; raw Tailwind classes used inconsistently. `text-xs uppercase tracking-wide` used as the primary hierarchy signal everywhere. Monospace only in `font-family` extension, not applied systematically to numeric/code outputs.

**Impeccable prescription:**

- **Keep `system-ui`** — correct for a precision tool. Do not add a display typeface.
- **Define a semantic scale (fixed rem, not fluid):**
  - `--text-label`: 11px / 500 / 0.06em tracking (section headers, field labels)
  - `--text-body`: 13px / 400 / normal (table cells, descriptions)
  - `--text-body-strong`: 13px / 550 / normal (active values, names)
  - `--text-mono`: 12px monospace (hex values, OKLCH coordinates, APCA scores, export tokens)
  - `--text-heading`: 15px / 600 / -0.01em (panel titles)
  - `--text-display`: 22px / 700 / -0.02em (Chroma logotype only)
- **Retire the `uppercase tracking-wide` monoculture.** Use it only for `--text-label`. Panel titles (`h3`) should use `--text-heading` at normal case. The current uniform uppercase creates a sense that everything is equally important — no hierarchy.
- **Apply monospace systematically.** All hex values, OKLCH coordinates, contrast scores (APCA Lc, WCAG ratios), step numbers, and export token names should render in `font-mono`. This is a color science tool; numbers should look like numbers.
- **Reduce body text weight** — on dark backgrounds, regular weight reads heavier. Body text at 400 may benefit from a 350 variable-font setting where available; if not, remain at 400 but verify against the rendered contrast.

### 3.3 Spatial Design & Rhythm (Source: `spatial-design.md`)

**Current state:** `gap-5` (20px) between all panels. `gap-4` within panels. All padding is `p-4` or `p-5`. Uniform `gap-2` between grid items. 4-column and 5-column grids for swatches. Everything the same spatial temperature.

**Impeccable prescription:**

- **Use 4pt base:** 4, 8, 12, 16, 24, 32, 48px.
- **Vary spacing for rhythm.** The current layout reads as monotony because every gap is 20px. Prescribe:
  - Between major layout columns: `gap-6` (24px)
  - Between panels in a column: `gap-4` (16px)
  - Within a panel, label → content: `gap-2` (8px)
  - Between section groups within a panel: `gap-6` (24px) to create breathing room
  - Between swatch cells: `gap-1.5` (6px) — tighter than current `gap-2`
- **Break the identical Panel pattern.** The ColorWheel + Controls panel and the PaletteGrid panel should have different spatial signatures. The wheel panel should feel more contained/focused; the palette panel should breathe wider.
- **Swatch sizing:** Current palette grid uses auto sizing. Prescribe `h-10` (40px) for role swatches, `h-8` (32px) for ramp steps — enough touch target, clear enough to read the tonal scale.
- **Vertical rhythm anchor:** Body text at 13px / line-height 1.5 = 19.5px. Round to 20px as the vertical rhythm unit. Section padding should be multiples of 20px (20, 40, 60px).

### 3.4 ColorWheel — Premium Feel (Source: `motion-design.md`, `interaction-design.md`, `overdrive.md`)

**Current state:** Canvas renders correctly. Harmony markers are SVG circles with inline style `background` + `border-2 border-white`. No hover state, no active/drag state differentiation, no ring on the dragging marker. The container div has `touch-none select-none rounded-full` but nothing visual signals the drag interaction.

**Impeccable prescription:**

- **Marker hierarchy.** The base marker (primary hue) should be visually distinct: larger (18px vs 14px for harmonics), white ring + 1px dark inner gap (the "double ring" gives it visual lift without glow). Secondary harmony markers: 14px, 60% opacity ring, no inner gap.
- **Drag active state.** On `pointerdown`, the active marker should: scale up (1.15×), increase ring brightness, cast a soft box-shadow matching the marker's own color (`box-shadow: 0 0 0 4px oklch(50% 0.15 H / 0.3)`). Animate with `--ease-out-expo` at 100ms. On `pointerup`, snap back at 150ms.
- **Wheel border.** The canvas `rounded-full` container currently has no border. Add a 1px border at `oklch(22% 0.008 H)` — the surface scale tinted border. On hover, shift to `oklch(28% 0.012 H)`. This grounds the wheel in the tinted surface system.
- **The overdrive moment for the wheel:** On palette commit (pointer up → `setBase` fires), pulse a faint halo ring outward from the wheel edge — a `scale(1) → scale(1.04) → scale(1)` on a pseudo-element ring, at 300ms `--ease-out-quint`, opacity 0.4 → 0. This is the one extraordinary moment on this surface — every new committed color confirms with a physical "lock" feel. Respect `prefers-reduced-motion`.

### 3.5 Controls Panel (Source: `interaction-design.md`, `polish.md`)

**Current state:** Raw `<input type="range">` with `accent-blue-500`. No custom track, no thumb styling beyond browser defaults. Field labels use `text-xs font-medium uppercase tracking-wide text-neutral-400`. Hex input is unstyled `<input type="text">`. The harmony `<select>` is browser-default.

**Impeccable prescription:**

- **Custom slider component.** Replace `<input type="range">` with a bespoke slider: a div track at 4px height, `rounded-full`, background using a CSS gradient that represents the actual value range (for chroma: a gradient from oklch(65% 0 H) to oklch(65% MAX_C H) using the current hue — live and beautiful). Thumb: 16px circle, white fill, 1px border at `oklch(30% 0.01 H)`, shadow `0 1px 3px black/40`. Hover: thumb scale 1.1. Active/drag: thumb scale 1.2, track brightens. All at 120ms `--ease-out-expo`.
- **Hex input.** Should render in `font-mono`. Border should be `oklch(22% 0.008 H)`. On focus: border shifts to the current accent color, subtle glow `box-shadow: 0 0 0 2px [accent]/30`. Error state (invalid hex): border `oklch(55% 0.2 25)` (red-range), no shake.
- **Harmony select.** Replace `<select>` with a custom pill-based selector or a minimal styled dropdown. The current browser `<select>` breaks the dark theme on most platforms.
- **Field labels.** Retire uppercase from the value-showing labels (`Chroma (OKLCH C) — 0.150`). The value itself should be monospace at `--text-mono` in `--text-primary`. The label word "Chroma" stays at `--text-label` uppercase. Structure: label on line 1, current value on line 1 right-aligned (not in the label string).

### 3.6 PaletteGrid (Source: `color-and-contrast.md`, `spatial-design.md`, `interaction-design.md`)

**Current state:** Role swatches in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2`. Each swatch is a div with inline `background`/`color` style, renders role name and hex value. Ramp steps in `grid-cols-11` (RAMP_STEPS). Color names shown in a `text-xs text-neutral-500` span. Copy button on hover per swatch. Section labels use the universal `text-xs font-semibold uppercase` treatment.

**Impeccable prescription:**

- **Swatch proportions.** Role swatches: `h-16` (64px), full width of the grid cell. This gives enough surface to read the color; current `h-12` is marginal. Ramp steps: `h-10` (40px), narrower cells are fine for the tonal scale.
- **Swatch content hierarchy.** Inside each role swatch: role name at `--text-label` (10px, uppercase, 500 weight), hex value at `--text-mono` (11px) below it. Both in the engine-supplied on-color. Currently both render at `text-xs` with no weight differentiation.
- **Hover state.** On hover: the swatch border shifts from transparent to a 1px outline of its own foreground color at 40% opacity (rings itself). The hex shifts to full opacity. A copy icon appears at top-right, 16px. No scale — scale on color swatches introduces visual noise in a grid where precise comparison matters.
- **Ramp step interaction.** On hover over a ramp step: show a tooltip with the OKLCH values (`L: 0.65, C: 0.14, H: 220`). This is the color science payload users need. Currently nothing.
- **Section separation.** The "Roles" and "Ramps" sections currently flow together with only a 24px gap. Introduce a 1px separator line at `--surface-3` between them, plus a 32px vertical gap. The sections have different spatial characters and should feel like distinct zones.
- **Mode indicator.** The `mode` (light/dark) is shown elsewhere. The palette grid should have a faint tinted background shift when in dark mode vs light mode — not a full invert, just `--surface-1` vs `--surface-0` for the grid container, so the palette reads in context.

### 3.7 AccessibilityPanel (Source: `color-and-contrast.md`, `typography.md`, `interaction-design.md`)

**Current state:** Table with `border-t border-neutral-800` rows. APCA score in `font-mono text-green-400` or `text-amber-400`. WCAG ratio in `font-mono text-neutral-300`. Badge component (`✓`/`✗`). "Fix → APCA 75" and "Fix → WCAG AA" as `bg-blue-600` / `border-neutral-700` buttons. Two-status summary at top.

**Impeccable prescription:**

- **Table density.** Current `py-1.5 px-2` row padding is acceptable but the table reads as generic. Prescribe: `py-2 px-3` with a `48px` minimum row height. The color swatch pairs (the `Swatches` component) should be `20px × 14px` (wider, landscape) not `16px × 16px` square — more legible as a pair.
- **Score column.** APCA Lc score should be the dominant column: `--text-body-strong` weight (550), the green/amber color treatment stays but use OKLCH versions: pass = `oklch(72% 0.18 145)`, fail = `oklch(72% 0.17 55)`. Not Tailwind `green-400`/`amber-400` which are sRGB approximations — ironic in an OKLCH tool.
- **Pass/fail badges.** Replace `✓`/`✗` text with 8px filled circles: green for pass, amber for fail, `oklch`-specified. No emoji, no icon font — just a CSS circle. Cleaner at this scale.
- **Fix buttons.** Retire the static `bg-blue-600` on the primary fix button. It should use `--accent` (the derived base-hue accent). Give it a 120ms background transition. The secondary "Fix → WCAG AA" button should be an outlined variant at `border-[--accent/40]` not `border-neutral-700`.
- **"Last fix applied" feedback.** When `lastFix` is set (a fix was just applied), show a one-time subtle confirmation: the panel header border briefly animates from `--surface-3` to `oklch(72% 0.18 145)` and back at 600ms. This is the delight moment for the accessibility workflow — first time a fix lands, it confirms.
- **Empty state.** If all pairs pass, replace the table with a centered checkmark + "All pairs meet APCA 75 body threshold" in `--text-secondary`. Currently the table renders regardless.

### 3.8 PreviewPanel (Source: `interaction-design.md`, `spatial-design.md`)

**Current state:** A `rounded-xl border border-neutral-800 p-5` div that renders a hardcoded mock UI (heading, paragraph, buttons, badge, alert, input, card) using the live CSS custom properties. The mock is static — no hover states, no interactivity. The container blends into the editor's own dark surface.

**Impeccable prescription:**

- **Container distinction.** The preview panel should be visually isolated from the editor chrome — it is showing a *different* UI context. Apply a `ring-1 ring-[--surface-3]` instead of a border, and add a top label bar (`Preview — light / dark` with the ModeToggle inline) that sits outside the preview's own color system (editor chrome coloring, not preview coloring).
- **Add hover states to the preview buttons.** The preview's button should actually respond to hover — `background-color` transition using the `--primary` variable. This lets users test hover contrast live, which is a meaningful feature for a color tool.
- **Realistic content scale.** The `max-w-md` mock is good. Ensure the font sizes inside the preview are `16px` base (not 13px like the editor UI) — it's simulating a real app, not the editor shell.
- **The card inside the preview.** The preview renders a card inside the main preview container — this is nested cards (absolute ban if both have the same visual weight). Differentiate: the outer preview container is just the bg-color demo surface; the inner card is `--surface-1` with a `1px border at --border`. The distinction must be legible, not decorative.

---

## 4. Recommended Impeccable Command Sequence

Run in this order for the Chroma editor redesign:

### Phase 1: Establish Context
```
/impeccable teach
```
Create `PRODUCT.md` (product register, OKLCH color tool, precision audience) and `DESIGN.md` (current tokens, component inventory). This gives all subsequent commands a shared contract.

```
/impeccable document
```
Generate DESIGN.md from the existing codebase — extracts current token patterns, component list, spacing values, so the polish phase has a baseline.

### Phase 2: Evaluate
```
/impeccable critique apps/web
```
Heuristic UX review: information architecture, interaction model, hierarchy. Will surface the Panel monoculture, the `uppercase tracking-wide` overuse, and the missing interactive states.

```
/impeccable audit apps/web
```
Technical quality scan: a11y (focus rings, color contrast of editor chrome itself), responsive behavior, anti-pattern detection (gradient swatch in the header, native sliders, browser select).

### Phase 3: Build the Design System
```
/impeccable extract apps/web
```
Pull the current ad-hoc Tailwind classes into a token system: `--surface-0` through `--surface-3`, `--text-label` through `--text-display`, `--ease-out-expo`, `--ease-out-quart`. This is prerequisite to `polish` being coherent.

### Phase 4: Systematic Refinement
```
/impeccable polish apps/web
```
Work through the Polish checklist: spacing alignment, typography refinement, color/contrast, interaction states, micro-interactions, copy. This is the longest phase. Sub-tasks per component in the order: globals.css → Controls → PaletteGrid → AccessibilityPanel → ColorWheel → PreviewPanel → page.tsx layout.

```
/impeccable animate apps/web
```
After all states are designed, add the motion layer: slider thumb transitions, swatch hover reveals, table row entrances (stagger at 30ms/row, cap at 10 rows), fix-button confirmation animation.

### Phase 5: Ceiling Raisers
```
/impeccable overdrive ColorWheel
```
The wheel is the one surface where extraordinary is earned — the palette-commit halo pulse. Scoped tightly to this component.

```
/impeccable delight apps/web
```
Map the two delight moments: (1) first export — a brief token-list "unroll" animation when the export panel opens for the first time; (2) accessibility fix applied — the panel header confirmation pulse.

### Phase 6: Harden
```
/impeccable harden apps/web
```
Edge cases, empty states (all pairs pass → checkmark, no palette yet), keyboard navigation (focus order through ColorWheel → Controls → PaletteGrid → AccessibilityPanel), `prefers-reduced-motion` guards on every animation.

---

## 5. What to Avoid That This Editor Risks

| Risk | Current Signal | Impeccable Correction |
|---|---|---|
| Category-reflex palette | `blue-500` accent on a color tool | Derive accent from live base hue |
| Monoculture panels | Every section wrapped in identical `rounded-2xl border-neutral-800 bg-neutral-900` | Break with varied surface levels and spatial signatures |
| UPPERCASE as only hierarchy tool | Every label is `text-xs uppercase tracking-wide` | Introduce weight, size, and color as independent hierarchy axes |
| Native browser chrome in a premium tool | `<input type="range" className="accent-blue-500">`, `<select>` | Custom slider, custom dropdown |
| No interactive states beyond hover | Buttons have hover, sliders have nothing | Full 8-state matrix per component |
| Pure neutral surfaces | `#0b0d12`, `neutral-800/900` zero chroma | Tinted neutrals at 0.005–0.012 chroma, hue-tracking |
| Numbers not in mono | Hex, OKLCH values, scores in `text-xs text-neutral-300` | `font-mono` for all numeric/code content |
| Nested cards | PreviewPanel card inside Panel wrapper | Differentiate surface levels; preview is its own frame |
