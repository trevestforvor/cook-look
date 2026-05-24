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
import { clamp, normalizeHue, parseToOklch } from "./color.js";
import { buildNeutralRamp, buildRamp } from "./ramps.js";
import { chromaticSeedHues, harmonyKind } from "./harmony.js";
import type {
  ContainerRole,
  GeneratePaletteOptions,
  Oklch,
  OnRole,
  Palette,
  PaletteSeeds,
  RampRole,
  RampStep,
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
  "primary-container",
  "secondary-container",
  "accent-container",
];

/** Brand families that carry a container pair. */
const CONTAINER_ROLES: readonly ContainerRole[] = [
  "primary",
  "secondary",
  "accent",
];

/**
 * Ramp steps used to derive the expanded role set, per mode. Values are chosen
 * by OKLCH *lightness target* (not by matching M3 tone numbers, whose scale runs
 * opposite to the ramp's step numbering). All on-/text pairings are validated by
 * the APCA auditor; these steps are the perceptual starting points.
 *
 * Container ≈ M3 tone 90 light / tone 30 dark; on-container ≈ tone 10 / tone 90.
 * Outline ≈ tone 50 light / 60 dark; outline-variant ≈ tone 80 / 30.
 */
const EXTENDED_STEPS = {
  // Container: a high-lightness step of the family ramp in light, low in dark.
  container: { light: 200, dark: 900 },
  // On-container: the contrasting end of the same family ramp.
  onContainer: { light: 950, dark: 200 },
  // Neutral surface stack.
  surfaceElevated: { light: 50, dark: 800 },
  backgroundElevated: { light: 100, dark: 900 },
  // Neutral outlines (decorative / non-text). Dark outline is lifted to step
  // 400 (lighter than tone 60's nominal step) so it clears the APCA non-text
  // bar (Lc>=45) against the dark background; at step 500/600 it falls short.
  outline: { light: 600, dark: 400 },
  outlineVariant: { light: 300, dark: 900 },
  // Reduced-emphasis foreground tiers (neutral ramp).
  foregroundSecondary: { light: 700, dark: 300 },
  foregroundTertiary: { light: 600, dark: 400 },
} as const satisfies Record<string, Record<ThemeMode, RampStep>>;

/** Pick the neutral-ramp end (near-white or near-black) with the most APCA contrast on `bg`. */
function pickOnColor(bg: Swatch, neutral: TonalRamp): Swatch {
  const light = neutral.steps[50];
  const dark = neutral.steps[950];
  return Math.abs(apcaLc(light, bg)) >= Math.abs(apcaLc(dark, bg))
    ? light
    : dark;
}

/**
 * Pick the on-container text color for a container swatch. Prefers the
 * contrasting end of the family's *own* ramp (the M3 tonal pairing keeps the
 * on-color in-family), but falls back to the neutral ramp's near-white/near-
 * black end if the family ramp can't clear APCA body contrast (e.g. a low-chroma
 * family whose dark/light ends are too close). The auditor reports the realized
 * contrast either way.
 */
function pickOnContainer(
  container: Swatch,
  family: TonalRamp,
  neutral: TonalRamp,
  preferStep: RampStep,
): Swatch {
  const inFamily = family.steps[preferStep];
  if (Math.abs(apcaLc(inFamily, container)) >= 75) return inFamily;
  // Best of the family's two ends, then the neutral ends — keep the strongest.
  const candidates: Swatch[] = [
    inFamily,
    family.steps[950],
    family.steps[50],
    neutral.steps[950],
    neutral.steps[50],
  ];
  return candidates.reduce((best, c) =>
    Math.abs(apcaLc(c, container)) > Math.abs(apcaLc(best, container)) ? c : best,
  );
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
    // A role may override its main step per mode (used by single-hue harmonies
    // like `shades` to render families as distinct values of one color).
    const step = seeds.mainSteps?.[role]?.[mode] ?? mainStep;
    roles[role] = ramps[role].steps[step];
  }
  roles.background = background;
  roles.surface = surface;
  roles.foreground = foreground;

  // Expanded role set (M3 + Apple HIG, adapted). All derived from existing ramp
  // steps; text pairings are validated by the APCA auditor downstream.
  for (const family of CONTAINER_ROLES) {
    roles[`${family}-container`] = ramps[family].steps[EXTENDED_STEPS.container[mode]];
  }
  roles["surface-elevated"] = neutral.steps[EXTENDED_STEPS.surfaceElevated[mode]];
  roles["background-elevated"] = neutral.steps[EXTENDED_STEPS.backgroundElevated[mode]];
  roles.outline = neutral.steps[EXTENDED_STEPS.outline[mode]];
  roles["outline-variant"] = neutral.steps[EXTENDED_STEPS.outlineVariant[mode]];
  roles["foreground-secondary"] =
    neutral.steps[EXTENDED_STEPS.foregroundSecondary[mode]];
  roles["foreground-tertiary"] =
    neutral.steps[EXTENDED_STEPS.foregroundTertiary[mode]];

  const on = {} as Record<OnRole, Swatch>;
  for (const role of ON_ROLES) {
    if (role.endsWith("-container")) {
      const family = role.slice(0, -"-container".length) as ContainerRole;
      on[role] = pickOnContainer(
        roles[role],
        ramps[family],
        neutral,
        EXTENDED_STEPS.onContainer[mode],
      );
    } else {
      on[role] = pickOnColor(roles[role], neutral);
    }
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
    customAngles: options.customAngles,
  });

  const pChroma = options.primaryChroma ?? Math.max(base.c, 0.13);
  const isMono = harmony === "monochromatic";
  // `shades` is single-hue like monochromatic, but holds chroma *constant*
  // across families so they read as the same color stepped in value ("adding
  // black"), rather than monochromatic's deliberate chroma fan-out. The tonal
  // ramp itself supplies the lightness/value variation per family.
  const isShades = harmony === "shades";

  const chroma: Record<RampRole, number> = {
    primary: clamp(pChroma, 0.04, 0.32),
    // Monochromatic differentiates families by chroma, not hue. Shades keeps
    // chroma flat (same color, different value); all others vary hue.
    secondary: clamp(pChroma * (isMono ? 0.5 : isShades ? 1 : 0.92), 0.02, 0.32),
    accent: clamp(pChroma * (isMono ? 0.8 : isShades ? 1 : 1), 0.04, 0.34),
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

  // Shades shares one hue+chroma across families, so distinguish them by
  // *value*: step secondary and accent toward darker ramp steps ("adding
  // black"). Primary keeps the mode default. In dark mode we keep the families
  // light (toward white) so they stay legible against the dark surface, still
  // descending in value relative to one another.
  const mainSteps = isShades
    ? ({
        secondary: { light: 700, dark: 300 } as Record<ThemeMode, RampStep>,
        accent: { light: 800, dark: 200 } as Record<ThemeMode, RampStep>,
      } satisfies Partial<Record<RampRole, Record<ThemeMode, RampStep>>>)
    : undefined;

  // Record the realized hue offsets (primary/secondary/accent relative to base)
  // so audit can verify against intent — especially for `custom` angles, which
  // are otherwise not recoverable from the palette. Single-hue harmonies have
  // no meaningful offsets, so leave them undefined.
  const harmonyOffsets =
    harmonyKind(harmony) === "single-hue"
      ? undefined
      : [seedHues.primary, seedHues.secondary, seedHues.accent].map((h) =>
          signedHueOffset(base.h, h),
        );

  return { harmony, base, hues, chroma, mainSteps, harmonyOffsets };
}

/**
 * Signed offset of `hue` relative to `baseHue`, in degrees, in the range
 * [−180, 180] with the antipode reported as +180 (not −180) for readability.
 */
function signedHueOffset(baseHue: number, hue: number): number {
  const off = normalizeHue(hue - baseHue + 180) - 180;
  // normalizeHue maps an exact 180° offset to −180; prefer +180.
  return off <= -180 ? 180 : off;
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
