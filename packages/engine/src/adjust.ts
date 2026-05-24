/**
 * Structured, perceptual color adjustment in OKLCH.
 *
 * Every axis is interpreted perceptually: lightness moves along OKLCH L,
 * saturation along OKLCH C, and temperature as a fractional rotation of hue
 * toward a warm (~60°) or cool (~250°) anchor along the shortest arc.
 */
import { normalizeHue, oklch, resolveSwatch } from "./color.js";
import type { AdjustIntent, AdjustResult, Oklch, Swatch } from "./types.js";

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
