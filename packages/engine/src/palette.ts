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
import {
  clamp,
  maxChroma,
  normalizeHue,
  oklch,
  parseToOklch,
  resolveGamutClamped,
  resolveSwatch,
} from "./color.js";
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

/** Conventional OKLCH hues for semantic status roles (pre-harmonization). */
const SEMANTIC_HUES = { success: 150, warning: 70, danger: 27 } as const;

/**
 * Default cap (degrees) on how far semantic roles shift toward the brand's
 * temperature when the brand is fully warm or cool. 15° keeps red/amber/green
 * unmistakable while letting a warm brand pull them warmer (and cool cooler).
 */
export const DEFAULT_SEMANTIC_HARMONY = 15;

/**
 * Warm / cool poles on the OKLCH hue wheel (degrees). Warmth is modeled as a
 * cosine peaking at the warm pole, so orange/yellow read fully warm, blue fully
 * cool, and green/magenta temperature-neutral. Matches the warm/cool anchors
 * used by {@link AdjustIntent}.
 */
const WARM_ANCHOR = 60;
const COOL_ANCHOR = 240;

/**
 * Neutral tint: the neutral ramp carries the brand hue at a small chroma so
 * surfaces/backgrounds read warm or cool with the palette instead of dead gray.
 * Chroma scales with the brand's chroma, clamped to a perceptible-but-not-muddy
 * band. The light end is further limited by the gamut ceiling at each step.
 */
const NEUTRAL_TINT_FRACTION = 0.14;
const NEUTRAL_TINT_MIN = 0.006;
const NEUTRAL_TINT_MAX = 0.02;

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
 * OKLCH lightness targets for the neutral surface / text / outline system, per
 * mode, adapted from Material 3's neutral tonal roles (tone/100 ≈ OKLCH L).
 * Every role is a *distinct* value (no two collide). More-elevated surfaces step
 * *lighter* in both modes: in light mode toward the near-white background, and in
 * dark mode away from the dark background toward the foreground. Outlines and the
 * reduced-emphasis `foreground-secondary` take the neutral-*variant*
 * (higher-chroma) tint.
 */
const NEUTRAL_TONES = {
  background: { light: 0.985, dark: 0.2 },
  "background-elevated": { light: 0.968, dark: 0.235 },
  surface: { light: 0.955, dark: 0.27 },
  "surface-elevated": { light: 0.97, dark: 0.32 },
  "foreground-tertiary": { light: 0.5, dark: 0.7 },
  "foreground-secondary": { light: 0.42, dark: 0.82 },
  foreground: { light: 0.25, dark: 0.92 },
  outline: { light: 0.52, dark: 0.72 },
  "outline-variant": { light: 0.8, dark: 0.34 },
} as const satisfies Partial<Record<Role, Record<ThemeMode, number>>>;

/** Roles taking the higher-chroma neutral-variant tint (M3: outlines + on-surface-variant). */
const NEUTRAL_VARIANT_ROLES = new Set<string>([
  "outline",
  "outline-variant",
  "foreground-secondary",
]);

/** Neutral-variant chroma as a multiple of the neutral chroma (M3 ≈ 8 vs 6 HCT). */
const NEUTRAL_VARIANT_FACTOR = 1.6;

/** Container lightness (≈ M3 tone 90 light / 30 dark) and on-container target (≈ tone 40 / 92). */
const CONTAINER_TONE = { light: 0.9, dark: 0.32 } as const;
const ON_CONTAINER_TONE = { light: 0.28, dark: 0.92 } as const;
/** Cap container chroma so different-hue containers read as one even set (M3 leaves this uneven). */
const CONTAINER_CHROMA_CAP = { light: 0.05, dark: 0.085 } as const;

/**
 * Minimum APCA Lc for keeping the *cohesive* colored on-container tone (a deep
 * tinted family color) rather than falling back to a stark neutral near-black /
 * near-white. Set to the body bar (75): the on-container tone is dark enough to
 * clear it for most hues, so containers read as cohesive tinted blocks while
 * still passing body contrast; rare low-gamut hues fall back to the neutral end.
 */
const ON_CONTAINER_MIN_LC = 75;

/** Resolve a gamut-clamped swatch at a target OKLCH lightness + hue, capped to `chroma`. */
function neutralSwatchAt(l: number, chroma: number, hue: number): Swatch {
  const c = Math.min(chroma, Math.max(0, maxChroma(l, hue) - 0.0016));
  return resolveSwatch(oklch(l, c, hue));
}

/** Pick the neutral-ramp end (near-white or near-black) with the most APCA contrast on `bg`. */
function pickOnColor(bg: Swatch, neutral: TonalRamp): Swatch {
  const light = neutral.steps[50];
  const dark = neutral.steps[950];
  return Math.abs(apcaLc(light, bg)) >= Math.abs(apcaLc(dark, bg))
    ? light
    : dark;
}

/**
 * On-container text color, adapted from Material 3 (on-container ≈ tone 30 light
 * / 90 dark — a saturated family color, not near-black, so containers read as
 * cohesive tinted blocks). Resolves the family hue at the on-container tone; if
 * that can't clear APCA body contrast, falls back to the strongest of the
 * neutral near-white / near-black ends. The auditor reports realized contrast.
 */
function pickOnContainer(
  container: Swatch,
  familyHue: number,
  familyChroma: number,
  neutral: TonalRamp,
  onTone: number,
): Swatch {
  const inFamily = neutralSwatchAt(onTone, familyChroma, familyHue);
  if (Math.abs(apcaLc(inFamily, container)) >= ON_CONTAINER_MIN_LC) return inFamily;
  const candidates: Swatch[] = [inFamily, neutral.steps[950], neutral.steps[50]];
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
  const nHue = seeds.hues.neutral;
  const nChroma = seeds.chroma.neutral;
  const nvChroma = nChroma * NEUTRAL_VARIANT_FACTOR;

  // Brand families honor the picked base color: in light mode the PRIMARY is the
  // exact base color the user chose (only gamut-mapped for sRGB display, never
  // normalized), and secondary/accent sit at the same lightness on their harmony
  // hues. Dark mode lifts above the base for a coherent pair. Neutrals and the
  // conventional semantic roles keep their fixed ramp steps.
  const brandDarkL = clamp(seeds.base.l + 0.17, 0.66, 0.88);
  const brandMainL = mode === "light" ? seeds.base.l : brandDarkL;

  const roles = {} as Record<Role, Swatch>;
  for (const role of RAMP_ROLES) {
    const stepOverride = seeds.mainSteps?.[role]?.[mode];
    if (role === "primary") {
      // The user's color, as-is (light); a coherent lighter sibling in dark.
      roles[role] =
        mode === "light"
          ? resolveSwatch(seeds.base)
          : resolveGamutClamped(brandDarkL, seeds.chroma.primary, seeds.hues.primary);
    } else if (stepOverride !== undefined) {
      // `shades` distinguishes families by value — keep its ramp-step stepping.
      roles[role] = ramps[role].steps[stepOverride];
    } else if ((CONTAINER_ROLES as readonly string[]).includes(role)) {
      // secondary/accent: the harmony hue at the brand lightness.
      roles[role] = resolveGamutClamped(brandMainL, seeds.chroma[role], seeds.hues[role]);
    } else {
      // neutral + semantic roles keep their fixed main ramp step.
      roles[role] = ramps[role].steps[mainStep];
    }
  }

  // Neutral surface / text / outline system: each role resolved at a dedicated,
  // distinct lightness target (Material-3 neutral roles), so no two collide.
  // Outlines + foreground-secondary use the higher-chroma neutral-variant tint.
  for (const role of Object.keys(NEUTRAL_TONES) as (keyof typeof NEUTRAL_TONES)[]) {
    const c = NEUTRAL_VARIANT_ROLES.has(role) ? nvChroma : nChroma;
    roles[role] = neutralSwatchAt(NEUTRAL_TONES[role][mode], c, nHue);
  }

  // Brand containers: a pale (light) / deep (dark) tint of the family at a fixed
  // tone, with chroma capped so different-hue containers read as one even set.
  for (const family of CONTAINER_ROLES) {
    roles[`${family}-container`] = neutralSwatchAt(
      CONTAINER_TONE[mode],
      Math.min(seeds.chroma[family], CONTAINER_CHROMA_CAP[mode]),
      seeds.hues[family],
    );
  }

  const on = {} as Record<OnRole, Swatch>;
  for (const role of ON_ROLES) {
    if (role.endsWith("-container")) {
      const family = role.slice(0, -"-container".length) as ContainerRole;
      on[role] = pickOnContainer(
        roles[role],
        seeds.hues[family],
        seeds.chroma[family],
        neutral,
        ON_CONTAINER_TONE[mode],
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

  const cMax = options.unrestrictedChroma ? 0.5 : 0.32;
  const cMaxAccent = options.unrestrictedChroma ? 0.5 : 0.34;

  const chroma: Record<RampRole, number> = {
    primary: clamp(pChroma, 0.04, cMax),
    // Monochromatic differentiates families by chroma, not hue. Shades keeps
    // chroma flat (same color, different value); all others vary hue.
    secondary: clamp(pChroma * (isMono ? 0.5 : isShades ? 1 : 0.92), 0.02, cMax),
    accent: clamp(pChroma * (isMono ? 0.8 : isShades ? 1 : 1), 0.04, cMaxAccent),
    neutral:
      options.neutralChroma ??
      clamp(pChroma * NEUTRAL_TINT_FRACTION, NEUTRAL_TINT_MIN, NEUTRAL_TINT_MAX),
    success: 0.15,
    warning: 0.15,
    danger: 0.16,
  };

  // Shift semantic hues toward the brand's temperature: a warm brand pulls
  // success/warning/danger warmer, a cool brand cooler, scaled by how warm or
  // cool the brand actually is. Magnitude is capped so they stay recognizable.
  const maxSemanticRotation = options.semanticHarmony ?? DEFAULT_SEMANTIC_HARMONY;
  const temperature = brandTemperature(seedHues.primary);
  const harmonize = (hue: number) =>
    temperatureShift(hue, temperature, maxSemanticRotation);

  const hues: Record<RampRole, number> = {
    primary: seedHues.primary,
    secondary: seedHues.secondary,
    accent: seedHues.accent,
    neutral: seedHues.primary,
    success: harmonize(SEMANTIC_HUES.success),
    warning: harmonize(SEMANTIC_HUES.warning),
    danger: harmonize(SEMANTIC_HUES.danger),
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
 * Brand temperature in [−1, 1]: +1 when the hue sits on the warm pole
 * ({@link WARM_ANCHOR}), −1 on the cool pole, 0 at the neutral green/magenta
 * axis. A smooth cosine so brands between poles get a proportional pull.
 */
function brandTemperature(hue: number): number {
  return Math.cos(((hue - WARM_ANCHOR) * Math.PI) / 180);
}

/**
 * Shift `hue` toward the warm or cool pole per the brand `temperature`, by up
 * to `maxRotation` degrees at full warmth/coolness (scaled by |temperature|).
 * Never overshoots the pole, so the hue moves warmer/cooler but stays itself.
 */
function temperatureShift(hue: number, temperature: number, maxRotation: number): number {
  if (maxRotation <= 0 || temperature === 0) return normalizeHue(hue);
  const anchor = temperature > 0 ? WARM_ANCHOR : COOL_ANCHOR;
  const toAnchor = signedHueOffset(hue, anchor); // shortest signed arc to pole
  const magnitude = Math.min(Math.abs(temperature) * maxRotation, Math.abs(toAnchor));
  return normalizeHue(hue + Math.sign(toAnchor) * magnitude);
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
