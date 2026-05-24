/**
 * Coherent light↔dark derivation.
 *
 * Rather than inverting a theme, we recover its perceptual seeds (hue + intended
 * chroma per family) and rebuild the opposite mode with {@link buildTheme}. This
 * guarantees the dark and light variants share hue families and chroma intent
 * while lightness placement, surface stepping, and on-colors are recomputed for
 * the target mode.
 */
import { buildTheme } from "./palette.js";
import {
  type PaletteSeeds,
  type RampRole,
  type ThemePalette,
  type TonalRamp,
} from "./types.js";

const RAMP_ROLES: readonly RampRole[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
];

/** Peak chroma across a ramp — used as the family's intended chroma. */
function peakChroma(ramp: TonalRamp): number {
  let peak = 0;
  for (const step of Object.values(ramp.steps)) {
    if (step.oklch.c > peak) peak = step.oklch.c;
  }
  return peak;
}

/** Recover deterministic seeds from a rendered theme. */
export function extractSeeds(theme: ThemePalette): PaletteSeeds {
  const hues = {} as Record<RampRole, number>;
  const chroma = {} as Record<RampRole, number>;
  for (const role of RAMP_ROLES) {
    hues[role] = theme.roles[role].oklch.h;
    chroma[role] = peakChroma(theme.ramps[role]);
  }
  return {
    // Harmony is not needed to rebuild a mode; preserve hues/chroma fidelity.
    harmony: "analogous",
    base: theme.roles.primary.oklch,
    hues,
    chroma,
  };
}

/** Derive a coherent dark theme from a light theme. */
export function deriveDarkMode(input: { lightPalette: ThemePalette }): ThemePalette {
  return buildTheme(extractSeeds(input.lightPalette), "dark");
}

/** Derive a coherent light theme from a dark theme. */
export function deriveLightMode(input: { darkPalette: ThemePalette }): ThemePalette {
  return buildTheme(extractSeeds(input.darkPalette), "light");
}
