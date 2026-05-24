---
name: chroma
description: Generate, audit, correct, and export accessible UI color palettes (OKLCH, APCA + WCAG, light/dark pairs) using the deterministic `chroma` CLI. Use whenever the task involves designing a color palette, theme, or design tokens; fixing contrast/accessibility of colors; or producing CSS variables / Tailwind color config.
---

# Chroma — color design via the `chroma` CLI

Chroma is a deterministic OKLCH color engine. **Do not invent hex values or
reason about color math yourself** — call the `chroma` CLI, which owns all color
math, and explain its results. You provide *intent* (a base hue/color, a
harmony, qualitative adjustments); the engine returns the colors.

## Setup (once)

The CLI is built from source in this repo:

```bash
pnpm install && pnpm build:cli      # produces packages/cli/dist/index.js
```

Invoke it as `node packages/cli/dist/index.js …` (or `pnpm exec chroma …` after
install). Run `node packages/cli/dist/index.js --help` to see the full command
tree; `--json` on any command gives machine-readable output, and palette
commands pipe together.

## Workflow (research-first)

1. **Investigate** the design context before generating: brand personality and
   any must-keep brand colors; audience; domain conventions (fintech leans
   trust-blue, wellness green, hospitality warm — starting points, not rules);
   emotional tone; cultural color associations; platform; competitive landscape.
   Ask focused questions when intent is ambiguous.
2. **Translate** findings into engine inputs — pick a base color/hue and a
   harmony, and state *why* (e.g. "analogous + muted blue ~255° for fintech
   trust"). To ground on an existing brand color, run `color analyze` first.
3. **Generate, audit, justify** — generate the palette, audit it, and explain
   the result in terms of the design context, not generic color theory.
4. **Correct/alter** to serve intent: `fix` for accessibility, `adjust` for
   warmer/cooler/lighter/more-saturated, `recolor` for a new hue/harmony.

## Commands

```bash
B="node packages/cli/dist/index.js"

# Generate a light+dark role palette (human-readable, with swatches)
$B palette generate --base '#3b82f6' --harmony triadic
#   harmonies: complementary | split-complementary | analogous | monochromatic
#              | triadic | tetradic | square | rectangular
#   --analogous-span <deg>   --chroma <0..0.37>   --json

# Pipe: generate machine-readable, then audit / fix / export
$B palette generate --base '#1f9d55' --harmony analogous --json | $B palette audit
$B palette generate --base '#1f9d55' --harmony analogous --json | $B palette fix

# Audit / fix accessibility (APCA primary, WCAG 2.2 secondary)
$B palette audit  --base '#3b82f6' --harmony triadic
$B palette fix    --base '#3b82f6' --harmony triadic --model apca --use body
$B palette fix    --base '#3b82f6' --harmony triadic --model wcag --use body --level AA

# Alter while preserving role structure
$B palette adjust  --base '#3b82f6' --harmony triadic --temperature warmer --amount 0.2
$B palette recolor --base '#3b82f6' --harmony complementary --harmony triadic

# Read a user-provided brand color into OKLCH parameters
$B color analyze 'rebeccapurple'

# Export design tokens
$B export --format css      --base '#3b82f6' --harmony triadic   # CSS custom properties (hex + oklch)
$B export --format tailwind --base '#3b82f6' --harmony triadic   # Tailwind theme config
$B export --format json     --base '#3b82f6' --harmony triadic   # JSON token tree
```

`palette audit/fix/recolor/adjust/name` and `export` take a palette from (in
order): stdin JSON → `--file <path>` → generating from `--base [--harmony]`.

## Accessibility targets

APCA is primary and directional: **Lc ≥ 75** body text, **≥ 60** large/secondary,
**≥ 45** non-text UI. WCAG 2.2 is secondary: **AA 4.5/3.0**, **AAA 7.0/4.5**. The
audit reports both for every pairing in light and dark mode; `fix` makes the
minimal OKLCH change and reports what moved and why.

## Principles (credited)

Reason about color in OKLCH (perceptual uniformity — Google Material/HCT); color
supports content and communicates state (Apple HIG); accessibility is a
first-class, continuously-checked constraint (WCAG/APCA); colors are reusable
roles/tokens (Figma/Adobe); every choice ties back to design intent (Adobe).
Premium/luxury usually means *lower* chroma and restrained lightness with
generous neutral surfaces — not more color.
