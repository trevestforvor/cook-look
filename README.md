# Chroma

A color-theory **design engine** with an Adobe Color–style editor. Chroma
generates, corrects, and alters accessible UI color palettes — text colors and
coherent light **and** dark mode pairs — entirely from color theory and
human-centered design principles.

> **This repository is Part 1 of 2.** It delivers a correct, fully-tested color
> engine and the editor UI. **Part 2** adds a provider-agnostic AI design agent
> that steers this same engine via its typed tool API. The engine API below is
> the stable contract Part 2 will consume.

## The defining principle

A **deterministic engine owns all color math and all final color values.** It is
pure, standalone, and has no network, LLM, or React dependency. Every color
decision the system makes flows through the engine. (In Part 2, the AI agent
reasons about design intent and calls engine functions as tools — it never emits
color values itself.)

## Architecture

A pnpm monorepo, strict TypeScript throughout (`strict: true`, no `any` in public
APIs):

| Package | Role |
| --- | --- |
| [`packages/engine`](packages/engine) | Pure, deterministic, fully unit-tested OKLCH color engine. The source of truth. |
| [`apps/web`](apps/web) | Next.js (App Router) + Tailwind editor: interactive color wheel, live palette, accessibility panel, preview, and token export. |

## Quick start

```bash
pnpm install
pnpm dev      # runs the editor at http://localhost:3000
pnpm test     # runs the engine test suite (102 tests)
pnpm typecheck
```

No environment variables are required for Part 1. `.env.example` documents the
`LLM_PROVIDER` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` variables reserved for
Part 2's agent.

## Color-science choices

### Why OKLCH is the working space

All harmony generation, tonal ramps, and perceptual adjustments happen in
**OKLCH** (the cylindrical form of OKLab), not HSL. OKLCH is *perceptually
uniform*: equal numeric steps in lightness or hue look like equal visual steps,
hue stays stable as you change lightness, and a single lightness axis (`L`) maps
to how light a color actually appears. HSL fails all three — its "lightness" is
not perceptual and its hues drift, which is why HSL-based palettes look uneven.
Chroma converts to sRGB/hex **only at the display boundary**.

### Why gamut mapping (and why we expose it)

Many OKLCH coordinates are more colorful than sRGB can show. Rather than letting
the browser clip channels (which shifts hue and lightness), Chroma **gamut-maps**
out-of-range colors by reducing chroma while preserving hue and lightness, using
`culori`'s `clampChroma`. Every resolved color records whether it was `clamped`,
so the UI can surface the gamut boundary (the dimmed region of the color wheel)
and the audit can report it.

> **No hand-rolled color math.** Every OKLCH↔sRGB conversion and all gamut
> mapping is delegated to [`culori`](https://culorijs.org). The engine only owns
> the *design* logic on top.

### Why APCA is primary (and WCAG secondary)

Accessibility is first-class, with **both** models computed for every palette in
both modes:

- **APCA (Lc contrast)** is the primary model. It models real perceptual
  readability far better than the legacy ratio, and it is **directional** — dark
  text on a light background is not the same as the reverse. Chroma uses the
  standard guidance thresholds: **Lc ≥ 75** for body text, **≥ 60** for
  large/secondary text, **≥ 45** for non-text UI. The implementation is verified
  against the canonical reference pairs (black-on-white ≈ `106.0`,
  white-on-black ≈ `-107.9`).
- **WCAG 2.2 contrast ratios** (AA/AAA at 4.5 / 3.0 / 7.0) are reported alongside
  for real-world compliance.

### Coherent light/dark pairs (derived, not inverted)

Light and dark modes are generated from the **same perceptual seeds**, not by
inverting one into the other. Dark mode selects lighter ramp steps for chromatic
roles (the ramp's chroma envelope already reduces chroma at high lightness),
lifts surface above background in steps, and recomputes on-colors to keep APCA
targets. `deriveDarkMode` / `deriveLightMode` recover a theme's seeds and rebuild
the opposite mode, so the relationship is always principled.

## The engine API (Part 2's tools)

Every function is pure, precisely typed, and JSDoc'd. These are exactly the tools
the Part 2 agent will call.

| Function | Purpose |
| --- | --- |
| `generatePalette({ baseColor, harmony, options })` | Build a complete role-based light+dark palette. `baseColor` accepts an OKLCH object or any CSS color string. |
| `adjustColor({ color, intent })` | Perceptual adjustment with a structured intent (lighten/darken, warmer/cooler, more/less saturated, by amount). |
| `fixContrast({ palette, target })` | Minimally nudge OKLCH lightness to meet an APCA/WCAG target; returns what changed and why. |
| `deriveDarkMode({ lightPalette })` / `deriveLightMode({ darkPalette })` | Coherently derive the opposite mode. |
| `auditPalette({ palette })` | Full contrast (APCA + WCAG) + harmony + gamut report for both modes. |
| `recolor({ palette, newBase?, newHarmony? })` | Re-derive a palette while preserving role structure and chroma intent. |
| `nameColors({ palette })` | Deterministic descriptive names per role. |
| `toCssVariables` / `toTailwindConfig` / `toJSON` | Export design tokens (CSS custom properties with hex fallbacks + OKLCH, a Tailwind theme, or JSON). |

### Harmonies

All computed in OKLCH hue space and unit-tested by exact angle:
**complementary** (180°), **split-complementary** (±150°), **analogous**
(configurable span), **monochromatic** (perceptual L/C ramp), **triadic** (120°),
**tetradic**, **square** (90°), and **rectangular**.

### Output contract — a system of design

`generatePalette` returns a semantic, role-mapped palette (not a flat swatch
list): `primary`, `secondary`, `accent`, `neutral`, `background`, `surface`,
`foreground`, plus `success` / `warning` / `danger`, with matching **on-colors**
and full **50–950 tonal ramps** generated by perceptual lightness. Each color is
a `Swatch` carrying its canonical OKLCH, a gamut-mapped `hex`, a CSS `oklch()`
string, and a `clamped` flag.

## The editor (`apps/web`)

- **Interactive OKLCH color wheel** — a canvas disk rendered at the current
  lightness (with the reachable sRGB gamut visible), draggable to set hue +
  chroma, with harmony handles. Pick a base, choose a harmony, and the
  role-based palette updates live.
- **Live light/dark toggle** and a **side-by-side UI preview** (buttons, cards,
  inputs, status chips, links) rendered from engine output.
- **Accessibility panel** — APCA Lc and WCAG AA/AAA per pairing with pass/fail,
  plus one-click **Fix → APCA 75** / **Fix → WCAG AA** wired to the engine.
- **Export** — copy or download tokens as CSS variables, Tailwind config, or
  JSON.

The palette lives in a single store (`apps/web/src/lib/store.ts`) that is the
**single source of truth** — the wheel and every panel read from it, and Part
2's agent will drive the same state through the same engine actions.

## Testing

The engine is tested hard (`pnpm test`, 102 tests): exact harmony hue angles,
gamut mapping + clamp flags, APCA values against known reference pairs, WCAG
ratios, ramp monotonicity and in-gamut guarantees, light/dark coherence,
contrast repair, and token export. The engine is trustworthy with no AI
involved.

## Project layout

```
chroma/
├── packages/engine/        # the deterministic color engine (+ tests)
│   └── src/
│       ├── color.ts         # OKLCH↔sRGB + gamut mapping (culori boundary)
│       ├── accessibility.ts # APCA + WCAG 2.2
│       ├── harmony.ts        # named harmonies
│       ├── ramps.ts          # perceptual tonal ramps
│       ├── palette.ts        # role mapping + light/dark pair
│       ├── darkmode.ts       # coherent derivation
│       ├── adjust.ts · contrast-fix.ts · audit.ts · recolor.ts · naming.ts
│       └── tokens.ts         # CSS / Tailwind / JSON exporters
└── apps/web/               # Next.js editor
```
