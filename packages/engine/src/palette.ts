/**
 * Role-based palette construction — the "system of design".
 *
 * A palette is built from deterministic {@link PaletteSeeds} (hues + intended
 * chroma per family). Light and dark modes are derived from the *same* seeds by
 * a mode-aware {@link buildTheme}, so the pair is coherent rather than a naive
 * inversion: dark mode selects lighter ramp steps (whose chroma the ramp
 * envelope already reduces at high lightness) and lifts surface above
 * background in steps.
 */
import { apcaLc } from "./accessibility.js";
import { clamp, parseToOklch } from "./color.js";
import { buildNeutralRamp, buildRamp } from "./ramps.js";
import { chromaticSeedHues } from "./harmony.js";
import type {
  GeneratePaletteOptions,
  Oklch,
  OnRole,
  Palette,
  PaletteSeeds,
  RampRole,
  Role,
  Swatch,
  ThemeMode,
  ThemePalette,
  TonalRamp,
} from "./types.js";

/** Conventional OKLCH hues for semantic status roles. */
const SEMANTIC_HUES = { success: 150, warning: 70, danger: 27 } as const;

/** The ramp step used as a role's "main" swatch, per mode. */
const MAIN_STEP = { light: 500, dark: 400 } as const;

const RAMP_ROLES: readonly RampRole[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
];

const ON_ROLES: readonly OnRole[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "success",
  "warning",
  "danger",
];

/** Pick the neutral-ramp end (near-white or near-black) with the most APCA contrast on `bg`. */
function pickOnColor(bg: Swatch, neutral: TonalRamp): Swatch {
  const light = neutral.steps[50];
  const dark = neutral.steps[950];
  return Math.abs(apcaLc(light, bg)) >= Math.abs(apcaLc(dark, bg))
    ? light
    : dark;
}

/**
 * Build one mode (light or dark) of a palette from seeds. Deterministic.
 */
export function buildTheme(seeds: PaletteSeeds, mode: ThemeMode): ThemePalette {
  const mainStep = MAIN_STEP[mode];

  const ramps = {} as Record<RampRole, TonalRamp>;
  for (const role of RAMP_ROLES) {
    ramps[role] =
      role === "neutral"
        ? buildNeutralRamp(seeds.hues.neutral, seeds.chroma.neutral)
        : buildRamp(seeds.hues[role], seeds.chroma[role]);
  }

  const neutral = ramps.neutral;

  // Background / surface / foreground selected from the neutral ramp per mode.
  const background =
    mode === "light" ? neutral.steps[50] : neutral.steps[950];
  const surface = mode === "light" ? neutral.steps[100] : neutral.steps[900];
  const foreground =
    mode === "light" ? neutral.steps[900] : neutral.steps[100];

  const roles = {} as Record<Role, Swatch>;
  for (const role of RAMP_ROLES) {
    roles[role] = ramps[role].steps[mainStep];
  }
  roles.background = background;
  roles.surface = surface;
  roles.foreground = foreground;

  const on = {} as Record<OnRole, Swatch>;
  for (const role of ON_ROLES) {
    on[role] = pickOnColor(roles[role], neutral);
  }

  return { mode, roles, on, ramps };
}

/** Build seeds from a base color + harmony. */
export function buildSeeds(
  base: Oklch,
  harmony: Palette["harmony"],
  options: GeneratePaletteOptions = {},
): PaletteSeeds {
  const seedHues = chromaticSeedHues(base, harmony, {
    analogousSpan: options.analogousSpan,
  });

  const pChroma = options.primaryChroma ?? Math.max(base.c, 0.13);
  const isMono = harmony === "monochromatic";

  const chroma: Record<RampRole, number> = {
    primary: clamp(pChroma, 0.04, 0.32),
    // Monochromatic differentiates families by chroma, not hue.
    secondary: clamp(pChroma * (isMono ? 0.5 : 0.92), 0.02, 0.32),
    accent: clamp(pChroma * (isMono ? 0.8 : 1), 0.04, 0.34),
    neutral: options.neutralChroma ?? Math.min(0.012, pChroma * 0.06),
    success: 0.15,
    warning: 0.15,
    danger: 0.16,
  };

  const hues: Record<RampRole, number> = {
    primary: seedHues.primary,
    secondary: seedHues.secondary,
    accent: seedHues.accent,
    neutral: seedHues.primary,
    success: SEMANTIC_HUES.success,
    warning: SEMANTIC_HUES.warning,
    danger: SEMANTIC_HUES.danger,
  };

  return { harmony, base, hues, chroma };
}

/**
 * Generate a complete role-based palette (light + dark) from a base color and
 * harmony. The base color may be an {@link Oklch} object or any CSS color
 * string (parsed to OKLCH).
 *
 * @throws if a `baseColor` string cannot be parsed.
 */
export function generatePalette(input: {
  baseColor: Oklch | string;
  harmony: Palette["harmony"];
  options?: GeneratePaletteOptions;
}): Palette {
  const { baseColor, harmony, options = {} } = input;
  const base =
    typeof baseColor === "string" ? parseToOklch(baseColor) : baseColor;
  if (!base) {
    throw new Error(`generatePalette: could not parse baseColor "${baseColor}"`);
  }

  const seeds = buildSeeds(base, harmony, options);
  return {
    harmony,
    baseColor: base,
    seeds,
    light: buildTheme(seeds, "light"),
    dark: buildTheme(seeds, "dark"),
  };
}
