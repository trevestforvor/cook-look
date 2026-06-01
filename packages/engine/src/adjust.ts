/**
 * Structured, perceptual color adjustment in OKLCH.
 *
 * Every axis is interpreted perceptually: lightness moves along OKLCH L,
 * saturation along OKLCH C, and temperature as a fractional rotation of hue
 * toward a warm (~60°) or cool (~250°) anchor along the shortest arc.
 */
import { clamp, maxChroma, normalizeHue, oklch, resolveSwatch } from "./color.js";
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
 * Saturation/temperature deltas land far weaker than lightness at the same
 * `amount` (a 0.2 chroma multiplier is a subtle nudge; a 0.2 lightness shift is
 * dramatic). Scale them up so a single click reads as a real, deliberate step.
 */
const SATURATION_GAIN = 1.5;

/** Families that follow the shared brand lightness (so vibrant can cusp-shift them). */
const BRAND_CONTAINER_FAMILIES: readonly RampRole[] = ["secondary", "accent"];

/**
 * Lightness (0…1) that maximizes the sRGB-reachable chroma for a hue (the OKLCH
 * "cusp"). Coarse scan then refine — cheap and deterministic. A gamut-capped
 * family can only become MORE saturated by moving its lightness toward this.
 */
function cuspLightness(hue: number): number {
  let bestL = 0.6;
  let bestC = -1;
  for (let l = 0.2; l <= 0.92; l += 0.02) {
    const c = maxChroma(l, hue);
    if (c > bestC) {
      bestC = c;
      bestL = l;
    }
  }
  // Refine around the coarse winner.
  for (let l = bestL - 0.02; l <= bestL + 0.02; l += 0.005) {
    const c = maxChroma(l, hue);
    if (c > bestC) {
      bestC = c;
      bestL = l;
    }
  }
  return bestL;
}

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

  // Base lightness drives the brand families' main-swatch lightness. Clamp to a
  // USABLE band, not [0,1]: primary IS the base color, so letting it reach pure
  // white/black would strand it there (white can't get lighter) and collapse the
  // brand families to #ffffff/#000000. Keeping it in [0.2, 0.92] means lightness
  // adjustments always stay reversible and never produce a dead all-white set.
  let baseL = seeds.base.l;
  if (intent.lightness === "lighter") baseL += amount;
  else if (intent.lightness === "darker") baseL -= amount;
  baseL = clamp(baseL, 0.2, 0.92);

  // Saturation scales each family's intended chroma multiplicatively (gained up
  // so a click is a clear step), preserving the relative chroma relationships.
  const satFactor =
    intent.saturation === "more"
      ? 1 + amount * SATURATION_GAIN
      : intent.saturation === "less"
        ? Math.max(0, 1 - amount * SATURATION_GAIN)
        : 1;
  const moreSaturated = intent.saturation === "more";

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

  // Vibrant on an already-vivid palette: secondary/accent render their main
  // swatch at the shared brand lightness, where they may already be at the sRGB
  // gamut ceiling — so raising their chroma ceiling does nothing visible. The
  // only way to look MORE saturated there is to move that family's lightness
  // toward its own hue's chroma cusp (which differs per hue). We store this as a
  // per-family OFFSET from the (new) base lightness, so it COMPOSES with the
  // lightness axis — the lightness slider still moves secondary/accent. Only
  // applied when the family is actually capped at its current effective L, and
  // proportional to intensity.
  const nextOffset: Partial<Record<RampRole, number>> = { ...seeds.mainLOffset };
  if (moreSaturated) {
    for (const family of BRAND_CONTAINER_FAMILIES) {
      const hue = nextHues[family];
      const startOffset = seeds.mainLOffset?.[family] ?? 0;
      const effectiveL = clamp(baseL + startOffset, 0.05, 0.95);
      const capped = nextChroma[family] >= maxChroma(effectiveL, hue) - 0.003;
      if (capped) {
        const cusp = cuspLightness(hue);
        // Move the EFFECTIVE lightness a fraction toward the cusp; keep it as an
        // offset relative to base so later lightness moves still apply.
        const targetL = effectiveL + (cusp - effectiveL) * amount;
        nextOffset[family] = clamp(targetL, 0.05, 0.95) - baseL;
      }
    }
  } else if (intent.saturation === "less") {
    // Muting no longer needs the cusp shift — drop any prior offset so the
    // family rejoins the cohesive shared lightness.
    for (const family of BRAND_CONTAINER_FAMILIES) delete nextOffset[family];
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
    mainLOffset: Object.keys(nextOffset).length > 0 ? nextOffset : undefined,
  };

  return {
    harmony: palette.harmony,
    baseColor: nextBase,
    seeds: nextSeeds,
    light: buildTheme(nextSeeds, "light"),
    dark: buildTheme(nextSeeds, "dark"),
  };
}
