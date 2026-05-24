/**
 * Perceptual tonal ramps (50 … 950) generated in OKLCH.
 *
 * Lightness follows fixed perceptual targets (monotonically decreasing). Chroma
 * follows a bell-shaped envelope that peaks in the mid tones and tapers toward
 * the light and dark ends, where high-chroma colors fall out of gamut and read
 * as garish. Every step is gamut-mapped on resolution.
 */
import { maxChroma, oklch, resolveSwatch } from "./color.js";
import { RAMP_STEPS, type RampStep, type TonalRamp } from "./types.js";

/** Perceptual lightness target per ramp step (OKLCH L, 0…1). */
const LIGHTNESS_TARGETS: Record<RampStep, number> = {
  50: 0.985,
  100: 0.955,
  200: 0.9,
  300: 0.83,
  400: 0.74,
  500: 0.648,
  600: 0.563,
  700: 0.475,
  800: 0.387,
  900: 0.295,
  950: 0.213,
};

/**
 * Chroma envelope multiplier per step (0…1). Peaks around the 500–600 mid tones
 * and tapers toward both ends.
 */
const CHROMA_ENVELOPE: Record<RampStep, number> = {
  50: 0.18,
  100: 0.32,
  200: 0.55,
  300: 0.75,
  400: 0.9,
  500: 1.0,
  600: 0.98,
  700: 0.86,
  800: 0.72,
  900: 0.56,
  950: 0.42,
};

/** Lightness target for a given ramp step. */
export function rampLightness(step: RampStep): number {
  return LIGHTNESS_TARGETS[step];
}

/**
 * Largest chroma that stays inside the gamut after 4-decimal rounding. A small
 * margin below the true boundary keeps resolved swatches verifiably in-gamut.
 */
function gamutCeiling(l: number, hue: number): number {
  return Math.max(0, maxChroma(l, hue) - 0.0016);
}

/**
 * Build a perceptual tonal ramp for a hue family.
 *
 * @param hue   OKLCH hue angle in degrees.
 * @param chroma Intended peak chroma (clamped to the gamut at each step).
 */
export function buildRamp(hue: number, chroma: number): TonalRamp {
  const steps = {} as Record<RampStep, ReturnType<typeof resolveSwatch>>;
  for (const step of RAMP_STEPS) {
    const l = LIGHTNESS_TARGETS[step];
    const target = chroma * CHROMA_ENVELOPE[step];
    // Stay just inside the gamut boundary so the ramp keeps as much chroma as
    // each lightness can actually display.
    const ceiling = gamutCeiling(l, hue);
    const c = Math.min(target, ceiling);
    steps[step] = resolveSwatch(oklch(l, c, hue));
  }
  return { steps };
}

/** Build a near-neutral ramp (tinted toward `hue` by a small chroma). */
export function buildNeutralRamp(hue: number, chroma: number): TonalRamp {
  const steps = {} as Record<RampStep, ReturnType<typeof resolveSwatch>>;
  for (const step of RAMP_STEPS) {
    const l = LIGHTNESS_TARGETS[step];
    const ceiling = gamutCeiling(l, hue);
    const c = Math.min(chroma, ceiling);
    steps[step] = resolveSwatch(oklch(l, c, hue));
  }
  return { steps };
}
