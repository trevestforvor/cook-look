/**
 * Color-theory harmonies, computed entirely in OKLCH hue space.
 *
 * Most harmonies are defined by a set of hue *offsets* from the base hue (index
 * 0 is always 0, the base itself); these are deterministic and unit-tested by
 * exact angle. Two harmonies are special:
 * - `shades` is **single-hue**: families share the base hue and differentiate
 *   by lightness/value, not by hue rotation. {@link harmonyKind} reports it as
 *   "single-hue" so audit verification can skip offset checks gracefully.
 * - `custom` takes arbitrary user-supplied offsets via
 *   {@link HarmonyOptions.customAngles}.
 */
import { normalizeHue } from "./color.js";
import type { HarmonyType, Oklch } from "./types.js";

/**
 * How a harmony places its families. `hue-offsets` harmonies rotate hue around
 * the base; `single-hue` harmonies (e.g. `shades`) keep one hue and vary
 * lightness/chroma instead, so hue-offset checks are not applicable.
 */
export type HarmonyKind = "hue-offsets" | "single-hue";

/** Default offsets for the `compound` harmony (analogous + complementary). */
export const COMPOUND_OFFSETS = [0, 30, 180, 210] as const;

/** Options that affect harmony hue placement. */
export interface HarmonyOptions {
  /** Analogous span in degrees on either side of the base (default 30). */
  analogousSpan?: number;
  /**
   * Hue offsets (degrees from base) for the `custom` harmony. The first three
   * map to primary/secondary/accent. Ignored for non-custom harmonies.
   */
  customAngles?: number[];
}

/** Classify a harmony by how it places families. */
export function harmonyKind(harmony: HarmonyType): HarmonyKind {
  return harmony === "shades" ? "single-hue" : "hue-offsets";
}

/**
 * Hue offsets (degrees from the base hue) that define a harmony. Index 0 is
 * always 0. Offsets are not yet normalized to [0,360) so the geometric intent
 * (e.g. ±150) stays readable; use {@link harmonyHues} for absolute hues.
 *
 * `monochromatic` and `shades` are single-hue and return `[0]` (their families
 * are differentiated by chroma/lightness in the palette builder, not by hue).
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
    case "double-split-complementary":
      // The base split by ±30 (analogous neighbors) plus the complement split
      // by ±30. The geometric set is {0, +30, -30, +150, +210}; we order the
      // chromatic triple first so primary/secondary/accent map to 0 / +30 / +150
      // (mirroring how `compound` maps its three chromatic roles), with -30 and
      // +210 trailing as the remaining harmony members.
      return [0, 30, 150, -30, 210];
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
    case "compound":
      // Adobe-style compound: a near-analogous neighbor (+30) plus a
      // split-complementary pair near the complement (180, 210).
      return [...COMPOUND_OFFSETS];
    case "shades":
      // Single-hue: families share the base hue; lightness/value carries the
      // variation. Offsets are degenerate by design.
      return [0];
    case "custom":
      return normalizeCustomAngles(options.customAngles);
  }
}

/**
 * Validate and normalize user-supplied custom angles. Ensures the list is
 * finite numbers and starts at 0 (the base). Throws on invalid input so the
 * CLI surfaces an actionable error rather than producing a silent off palette.
 */
export function normalizeCustomAngles(angles: number[] | undefined): number[] {
  if (!angles || angles.length === 0) {
    throw new Error(
      "custom harmony requires at least one angle (e.g. customAngles: [0, 40, 180, 210]).",
    );
  }
  if (angles.length > 12) {
    throw new Error(
      `custom harmony accepts at most 12 angles, got ${angles.length}.`,
    );
  }
  for (const a of angles) {
    if (!Number.isFinite(a)) {
      throw new Error(`custom harmony angles must be finite numbers, got "${a}".`);
    }
  }
  // Anchor the base at 0: prepend it if the caller didn't.
  return angles[0] === 0 ? [...angles] : [0, ...angles];
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

  // Single-hue harmonies reuse the base hue for all three families; the palette
  // builder differentiates them via lightness/chroma rather than hue.
  if (harmony === "monochromatic" || harmonyKind(harmony) === "single-hue") {
    return { primary, secondary: primary, accent: primary };
  }
  if (hues.length >= 3) {
    return { primary, secondary: hues[1] ?? primary, accent: hues[2] ?? primary };
  }
  // Custom harmonies must supply all three chromatic angles explicitly; falling
  // into the two-hue fallback would silently mismap secondary/accent.
  if (harmony === "custom") {
    throw new Error(
      "custom harmony requires at least 3 hue angles (primary, secondary, accent).",
    );
  }
  // Two-hue harmonies (complementary): accent is the complement, secondary is a
  // near-analogous neighbor of the primary for a usable third family.
  const accent = hues[1] ?? primary;
  return { primary, secondary: normalizeHue(primary + 30), accent };
}
