/**
 * Structured, perceptual color adjustment in OKLCH.
 *
 * Every axis is interpreted perceptually: lightness moves along OKLCH L,
 * saturation along OKLCH C, and temperature as a fractional rotation of hue
 * toward a warm (~60°) or cool (~250°) anchor along the shortest arc.
 */
import { clamp, normalizeHue, oklch, resolveSwatch } from "./color.js";
import { buildTheme } from "./palette.js";
import type {
  AdjustIntent,
  AdjustResult,
  Oklch,
  Palette,
  PaletteSeeds,
  RampRole,
  Swatch,
} from "./types.js";

const WARM_ANCHOR = 60;
const COOL_ANCHOR = 250;

/** Shortest signed angular distance from `from` to `to`, in degrees (−180…180]. */
function shortestArc(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function inputToOklch(color: Oklch | Swatch): Oklch {
  return "oklch" in color ? color.oklch : color;
}

/**
 * Apply a structured {@link AdjustIntent} to a color and return the new swatch
 * plus the per-axis delta. Pure and deterministic.
 */
export function adjustColor(input: {
  color: Oklch | Swatch;
  intent: AdjustIntent;
}): AdjustResult {
  const { color, intent } = input;
  const start = inputToOklch(color);
  const amount = intent.amount ?? 0.1;

  let { l, c, h } = start;

  if (intent.lightness === "lighter") l += amount;
  else if (intent.lightness === "darker") l -= amount;

  if (intent.saturation === "more") c += amount * 0.2;
  else if (intent.saturation === "less") c -= amount * 0.2;

  if (intent.temperature) {
    const anchor = intent.temperature === "warmer" ? WARM_ANCHOR : COOL_ANCHOR;
    h = normalizeHue(h + shortestArc(h, anchor) * amount);
  }

  const after = oklch(l, Math.max(0, c), h);
  const before = resolveSwatch(start);
  const afterSwatch = resolveSwatch(after);

  return {
    before,
    after: afterSwatch,
    delta: {
      l: afterSwatch.oklch.l - before.oklch.l,
      c: afterSwatch.oklch.c - before.oklch.c,
      h: shortestArc(before.oklch.h, afterSwatch.oklch.h),
    },
    intent,
  };
}

/** All chromatic/family ramp roles whose seeds an adjustment should move. */
const ADJUSTABLE_FAMILIES: readonly RampRole[] = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "neutral",
];

/**
 * Apply an {@link AdjustIntent} to a WHOLE palette by transforming its seeds and
 * rebuilding both modes — so every brand, semantic, and neutral family moves
 * together (and ramps, on-colors, and containers stay coherent), not just the
 * base color.
 *
 * This is what "adjust the whole palette" must mean: a per-color
 * {@link adjustColor} on the base alone barely moves the result, because most
 * roles derive their chroma/lightness independently of the base. Here we instead
 * nudge the shared seed parameters:
 *   - lightness → shifts the base lightness (drives every brand family's main
 *     swatch lightness)
 *   - saturation → scales every family's intended chroma
 *   - temperature → rotates every family hue toward the warm/cool anchor
 *
 * Pure + deterministic. Locked-role preservation is the caller's concern (the
 * editor re-freezes locked roles on top of the result), so this function moves
 * everything; callers restore the colors the user pinned.
 */
export function adjustPalette(input: {
  palette: Palette;
  intent: AdjustIntent;
}): Palette {
  const { palette, intent } = input;
  const amount = intent.amount ?? 0.1;
  const seeds = palette.seeds;

  // Base lightness drives the brand families' main-swatch lightness.
  let baseL = seeds.base.l;
  if (intent.lightness === "lighter") baseL += amount;
  else if (intent.lightness === "darker") baseL -= amount;
  baseL = clamp(baseL, 0, 1);

  // Saturation scales each family's intended chroma multiplicatively, so the
  // relative chroma relationships between families are preserved.
  const satFactor =
    intent.saturation === "more"
      ? 1 + amount
      : intent.saturation === "less"
        ? Math.max(0, 1 - amount)
        : 1;

  // Temperature rotates every hue a fraction of the way to the warm/cool anchor.
  const rotate = (h: number): number => {
    if (!intent.temperature) return h;
    const anchor = intent.temperature === "warmer" ? WARM_ANCHOR : COOL_ANCHOR;
    return normalizeHue(h + shortestArc(h, anchor) * amount);
  };

  const nextChroma = { ...seeds.chroma } as Record<RampRole, number>;
  const nextHues = { ...seeds.hues } as Record<RampRole, number>;
  for (const family of ADJUSTABLE_FAMILIES) {
    if (seeds.chroma[family] !== undefined) {
      nextChroma[family] = Math.max(0, seeds.chroma[family] * satFactor);
    }
    if (seeds.hues[family] !== undefined) {
      nextHues[family] = rotate(seeds.hues[family]);
    }
  }

  const nextBase: Oklch = {
    l: baseL,
    c: Math.max(0, seeds.base.c * satFactor),
    h: rotate(seeds.base.h),
  };

  const nextSeeds: PaletteSeeds = {
    ...seeds,
    base: nextBase,
    hues: nextHues,
    chroma: nextChroma,
  };

  return {
    harmony: palette.harmony,
    baseColor: nextBase,
    seeds: nextSeeds,
    light: buildTheme(nextSeeds, "light"),
    dark: buildTheme(nextSeeds, "dark"),
  };
}
