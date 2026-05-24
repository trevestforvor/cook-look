/**
 * Color-theory harmonies, computed entirely in OKLCH hue space.
 *
 * A harmony is defined by a set of hue *offsets* from the base hue. The first
 * offset is always 0 (the base itself). These offsets are deterministic and
 * unit-tested by exact angle.
 */
import { normalizeHue } from "./color.js";
import type { HarmonyType, Oklch } from "./types.js";

/** Options that affect harmony hue placement. */
export interface HarmonyOptions {
  /** Analogous span in degrees on either side of the base (default 30). */
  analogousSpan?: number;
}

/**
 * Hue offsets (degrees from the base hue) that define a harmony. Index 0 is
 * always 0. Offsets are not yet normalized to [0,360) so the geometric intent
 * (e.g. ±150) stays readable; use {@link harmonyHues} for absolute hues.
 */
export function harmonyOffsets(
  harmony: HarmonyType,
  options: HarmonyOptions = {},
): number[] {
  const span = options.analogousSpan ?? 30;
  switch (harmony) {
    case "complementary":
      return [0, 180];
    case "split-complementary":
      // The complement (180) split by ±30 → 150 and 210.
      return [0, 150, 210];
    case "analogous":
      return [0, span, -span];
    case "monochromatic":
      return [0];
    case "triadic":
      return [0, 120, 240];
    case "tetradic":
      // Rectangular tetrad: two complementary pairs 60° apart.
      return [0, 60, 180, 240];
    case "square":
      return [0, 90, 180, 270];
    case "rectangular":
      // Alias-friendly rectangular tetrad with a wider 120° offset pair.
      return [0, 120, 180, 300];
  }
}

/** Absolute hue angles (normalized to [0,360)) for a harmony around `baseHue`. */
export function harmonyHues(
  baseHue: number,
  harmony: HarmonyType,
  options: HarmonyOptions = {},
): number[] {
  return harmonyOffsets(harmony, options).map((off) =>
    normalizeHue(baseHue + off),
  );
}

/**
 * Seed hues mapped to the three chromatic accent families (primary, secondary,
 * accent). Monochromatic reuses the base hue for all three; the palette builder
 * differentiates them via lightness/chroma instead.
 */
export function chromaticSeedHues(
  base: Oklch,
  harmony: HarmonyType,
  options: HarmonyOptions = {},
): { primary: number; secondary: number; accent: number } {
  const hues = harmonyHues(base.h, harmony, options);
  const primary = hues[0] ?? base.h;

  if (harmony === "monochromatic") {
    return { primary, secondary: primary, accent: primary };
  }
  if (hues.length >= 3) {
    return { primary, secondary: hues[1] ?? primary, accent: hues[2] ?? primary };
  }
  // Two-hue harmonies (complementary): accent is the complement, secondary is a
  // near-analogous neighbor of the primary for a usable third family.
  const accent = hues[1] ?? primary;
  return { primary, secondary: normalizeHue(primary + 30), accent };
}
