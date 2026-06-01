/**
 * Palette auditing: contrast (APCA + WCAG), harmony verification, and gamut.
 *
 * The audit enumerates the foreground/background pairings a real UI relies on,
 * in both light and dark mode, and reports APCA Lc + WCAG ratio with pass/fail
 * per use-case. It also checks that the realized hues match the intended
 * harmony and lists any swatch that required gamut mapping.
 */
import { apcaLc, apcaPasses, wcagPasses, wcagRatio } from "./accessibility.js";
import { normalizeHue, oklch, resolveSwatch } from "./color.js";
import {
  chromaticSeedHues,
  harmonyKind,
  type HarmonyOptions,
} from "./harmony.js";
import type {
  HarmonyAudit,
  HarmonyOutlier,
  HarmonyType,
  ModeAudit,
  Palette,
  PairContrast,
  PaletteAudit,
  PaletteWarning,
  Role,
  Swatch,
  ThemePalette,
} from "./types.js";

/** Build a full {@link PairContrast} for a directional foreground/background pair. */
export function evaluatePair(
  label: string,
  foreground: Swatch,
  background: Swatch,
): PairContrast {
  const lc = apcaLc(foreground, background);
  const ratio = wcagRatio(foreground, background);
  return {
    label,
    foreground,
    background,
    apcaLc: Math.round(lc * 10) / 10,
    wcagRatio: Math.round(ratio * 100) / 100,
    apca: apcaPasses(lc),
    wcag: wcagPasses(ratio),
  };
}

/** The set of pairings a UI design system cares about, for one theme. */
function themePairs(theme: ThemePalette): PairContrast[] {
  const { roles, on } = theme;
  return [
    evaluatePair("foreground on background", roles.foreground, roles.background),
    evaluatePair("foreground on surface", roles.foreground, roles.surface),
    evaluatePair("on-primary on primary", on.primary, roles.primary),
    evaluatePair("on-secondary on secondary", on.secondary, roles.secondary),
    evaluatePair("on-accent on accent", on.accent, roles.accent),
    evaluatePair("on-success on success", on.success, roles.success),
    evaluatePair("on-warning on warning", on.warning, roles.warning),
    evaluatePair("on-danger on danger", on.danger, roles.danger),
    evaluatePair("primary on background", roles.primary, roles.background),
    evaluatePair("primary on surface", roles.primary, roles.surface),
    evaluatePair("accent on background", roles.accent, roles.background),
    // Expanded role set (M3 + Apple HIG): container text, elevated surfaces,
    // and reduced-emphasis foreground tiers.
    evaluatePair(
      "on-primary-container on primary-container",
      on["primary-container"],
      roles["primary-container"],
    ),
    evaluatePair(
      "on-secondary-container on secondary-container",
      on["secondary-container"],
      roles["secondary-container"],
    ),
    evaluatePair(
      "on-accent-container on accent-container",
      on["accent-container"],
      roles["accent-container"],
    ),
    evaluatePair(
      "foreground on surface-elevated",
      roles.foreground,
      roles["surface-elevated"],
    ),
    evaluatePair(
      "foreground-secondary on background",
      roles["foreground-secondary"],
      roles.background,
    ),
    evaluatePair(
      "foreground-secondary on surface",
      roles["foreground-secondary"],
      roles.surface,
    ),
    evaluatePair(
      "foreground-tertiary on background",
      roles["foreground-tertiary"],
      roles.background,
    ),
    evaluatePair("outline on background", roles.outline, roles.background),
  ];
}

function clampedSwatches(theme: ThemePalette): string[] {
  const out: string[] = [];
  for (const [role, swatch] of Object.entries(theme.roles)) {
    if (swatch.clamped) out.push(`${role} (${swatch.hex})`);
  }
  for (const [role, ramp] of Object.entries(theme.ramps)) {
    for (const [step, swatch] of Object.entries(ramp.steps)) {
      if (swatch.clamped) out.push(`${role}-${step} (${swatch.hex})`);
    }
  }
  return out;
}

function auditMode(theme: ThemePalette): ModeAudit {
  return {
    mode: theme.mode,
    pairs: themePairs(theme),
    clamped: clampedSwatches(theme),
  };
}

/**
 * Expected primary/secondary/accent hue offsets from base, per harmony.
 *
 * For `custom`, the offsets are user-supplied and must be passed via
 * `options.customAngles`. For single-hue harmonies (`shades`) the families
 * share the base hue, so all expected offsets are 0.
 */
export function expectedChromaticOffsets(
  harmony: HarmonyType,
  options: HarmonyOptions = {},
): number[] {
  const hues = chromaticSeedHues({ l: 0.6, c: 0.15, h: 0 }, harmony, options);
  return [hues.primary, hues.secondary, hues.accent];
}

function auditHarmony(palette: Palette): HarmonyAudit {
  const baseHue = palette.baseColor.h;
  const measured = (["primary", "secondary", "accent"] as const).map((role) =>
    normalizeHue(palette.light.roles[role].oklch.h - baseHue),
  );

  // Single-hue harmonies (e.g. `shades`) intentionally share the base hue and
  // differentiate by value, so a hue-offset check does not apply. Report it as
  // N/A (singleHue) and trivially satisfied rather than falsely failing.
  if (harmonyKind(palette.harmony) === "single-hue") {
    return {
      harmony: palette.harmony,
      expectedOffsets: [],
      measuredOffsets: measured,
      ok: true,
      singleHue: true,
    };
  }

  // For `custom`, the angles aren't re-derivable from the harmony name, so use
  // the offsets recorded on the seeds. For built-in harmonies, re-derive from
  // the harmony definition (independent of the realized palette).
  const expected =
    palette.harmony === "custom"
      ? (palette.seeds.harmonyOffsets ?? []).slice(0, 3).map((o) => normalizeHue(o))
      : expectedChromaticOffsets(palette.harmony, { analogousSpan: undefined });

  const tol = 1.0;
  const ok = expected.every((exp, i) => {
    const got = measured[i] ?? Number.NaN;
    const diff = Math.abs(normalizeHue(got - exp + 180) - 180);
    return diff <= tol;
  });
  return {
    harmony: palette.harmony,
    expectedOffsets: expected,
    measuredOffsets: measured,
    ok,
    singleHue: false,
  };
}

/** OKLCH chroma thresholds for the balance check. */
const VIVID_CHROMA = 0.15;
const NEUTRAL_CHROMA = 0.05;
/**
 * Mean brand chroma above which a palette reads as over-saturated. The engine's
 * default primary chroma (~0.13–0.18 after gamut mapping) sits below this; a
 * palette pushed past it via `--chroma` lacks a calm chromatic anchor.
 */
const VIVID_BRAND_MEAN = 0.19;

/** The chromatic brand families whose realized hue offsets a harmony defines. */
const CHROMATIC_ROLES = ["primary", "secondary", "accent"] as const;

/**
 * Composition warnings (non-fatal, taste/quality not accessibility):
 *  - balance: the 60-30-10 heuristic — a palette dominated by vivid roles with
 *    too few neutrals reads as garish.
 *  - harmony-outlier: for fixed-offset harmonies, any chromatic role whose
 *    realized hue offset drifts beyond ±20° of its expected offset. Skipped
 *    gracefully for single-hue (`shades`) and `custom` harmonies.
 */
function compositionWarnings(palette: Palette, harmony: HarmonyAudit): PaletteWarning[] {
  const warnings: PaletteWarning[] = [];

  // Balance (60-30-10): a palette is unbalanced when its brand families are all
  // highly saturated *and* there is no calm chromatic anchor — i.e. a strong
  // majority of the chromatic roles are vivid and the mean brand chroma is high.
  // Counts are taken over a fixed representative set (brand + semantic families
  // vs the core grounds) so the expanded role set's many neutral-derived tokens
  // don't dilute the ratio.
  const roles = palette.light.roles;
  const brandRoles = ["primary", "secondary", "accent"] as const;
  const chromaticCandidates = [
    ...brandRoles,
    "success",
    "warning",
    "danger",
  ] as const;
  const neutralCandidates = ["neutral", "background", "surface", "foreground"] as const;
  const vivid = chromaticCandidates.filter(
    (r) => roles[r].oklch.c > VIVID_CHROMA,
  ).length;
  const neutrals = neutralCandidates.filter(
    (r) => roles[r].oklch.c < NEUTRAL_CHROMA,
  ).length;
  const brandMean =
    brandRoles.reduce((s, r) => s + roles[r].oklch.c, 0) / brandRoles.length;
  // Majority of chromatic roles vivid, and the brand itself over-saturated.
  if (vivid >= Math.ceil(chromaticCandidates.length / 2) && brandMean > VIVID_BRAND_MEAN) {
    warnings.push({
      kind: "balance",
      message: `palette skews vivid: ${vivid} of ${chromaticCandidates.length} chromatic roles above C ${VIVID_CHROMA} with a high mean brand chroma (${brandMean.toFixed(3)}) and only ${neutrals} neutral ground(s) below C ${NEUTRAL_CHROMA} — the 60-30-10 guidance favors a calmer chromatic anchor.`,
    });
  }

  // Harmony outliers: only meaningful for fixed-offset harmonies with a known
  // expected-offset list. Single-hue (shades) and custom (user-defined) skip.
  if (!harmony.singleHue && palette.harmony !== "custom" && harmony.expectedOffsets.length > 0) {
    const tol = 20;
    CHROMATIC_ROLES.forEach((role, i) => {
      const exp = harmony.expectedOffsets[i];
      const got = harmony.measuredOffsets[i];
      if (exp === undefined || got === undefined) return;
      const diff = Math.abs(normalizeHue(got - exp + 180) - 180);
      if (diff > tol) {
        warnings.push({
          kind: "harmony-outlier",
          message: `${role} hue offset is ${Math.round(got)}° (expected ~${Math.round(exp)}°, off by ${Math.round(diff)}°).`,
        });
      }
    });
  }

  return warnings;
}

/** Run the full accessibility + harmony + gamut audit for a palette. */
export function auditPalette(input: { palette: Palette }): PaletteAudit {
  const { palette } = input;
  const light = auditMode(palette.light);
  const dark = auditMode(palette.dark);

  const bodyTextLabels = new Set([
    "foreground on background",
    "foreground on surface",
    "on-primary-container on primary-container",
    "on-secondary-container on secondary-container",
    "on-accent-container on accent-container",
  ]);
  const passesBodyApca = [light, dark].every((mode) =>
    mode.pairs
      .filter((p) => bodyTextLabels.has(p.label))
      .every((p) => p.apca.body),
  );

  const harmony = auditHarmony(palette);
  return {
    harmony,
    light,
    dark,
    passesBodyApca,
    warnings: compositionWarnings(palette, harmony),
  };
}

// --- Per-color harmony-fit outlier detection -------------------------------

/** Chromatic / key roles considered when measuring palette cohesion. */
const HARMONY_FIT_ROLES: Role[] = ["primary", "secondary", "accent"];

/** Deviation normalizers: how far on each axis counts as "one unit" of drift. */
const L_NORM = 0.18;
const C_NORM = 0.1;
const H_NORM = 40;

/** Shortest angular distance between two hues, in degrees (0..180). */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(d, 360 - d);
}

interface FitCandidate {
  role: Role;
  swatch: Swatch;
}

/**
 * Detect chromatic roles that do not fit the rest of the palette.
 *
 * Unlike {@link auditHarmony} (which only checks hue offset against the expected
 * harmony), this computes a per-color OKLCH centroid — using a CIRCULAR MEAN for
 * hue so wrap-around hues (e.g. 359° and 1°) average correctly — and flags each
 * candidate that drifts too far on lightness or hue. Neutrals and status roles
 * are excluded so a single loud brand color can't be "corrected" toward gray.
 * The suggested swatch moves ONLY the dominant axis back to the centroid and is
 * resolved through the engine's color authority (no hand-written hex).
 *
 * Pure + deterministic.
 */
export function auditHarmonyFit(input: { palette: Palette }): {
  outliers: HarmonyOutlier[];
} {
  const roles = input.palette.light.roles;

  // 1. Candidates = chromatic/key roles, skipping any that are missing.
  const candidates: FitCandidate[] = [];
  for (const role of HARMONY_FIT_ROLES) {
    const swatch = roles[role];
    if (swatch) candidates.push({ role, swatch });
  }

  // Need at least two colors to have a meaningful "rest of the palette".
  if (candidates.length < 2) return { outliers: [] };

  // 2. Centroid: mean L, mean C, circular mean of hue (atan2 of summed unit
  // vectors) so 359° and 1° average to ~0° rather than ~180°.
  const n = candidates.length;
  let sumL = 0;
  let sumC = 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const { swatch } of candidates) {
    sumL += swatch.oklch.l;
    sumC += swatch.oklch.c;
    const rad = (normalizeHue(swatch.oklch.h) * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  const meanL = sumL / n;
  const meanC = sumC / n;
  const meanH = normalizeHue((Math.atan2(sumSin, sumCos) * 180) / Math.PI);

  // 3. Per-candidate deviations.
  const deviations = candidates.map(({ role, swatch }) => ({
    role,
    swatch,
    dL: Math.abs(swatch.oklch.l - meanL),
    dC: Math.abs(swatch.oklch.c - meanC),
    dH: hueDistance(swatch.oklch.h, meanH),
  }));

  const maxDH = Math.max(...deviations.map((d) => d.dH));

  const outliers: HarmonyOutlier[] = [];
  for (const d of deviations) {
    // 4. Flag on lightness drift, or on being the single most hue-divergent color.
    const flagged = d.dL > L_NORM || (d.dH > H_NORM && d.dH === maxDH);
    if (!flagged) continue;

    // Dominant dimension = axis with the largest normalized deviation.
    const normL = d.dL / L_NORM;
    const normC = d.dC / C_NORM;
    const normH = d.dH / H_NORM;
    let dimension: HarmonyOutlier["dimension"];
    if (normL >= normC && normL >= normH) dimension = "lightness";
    else if (normH >= normC) dimension = "hue";
    else dimension = "chroma";

    // 5. Reason keyed off the signed deviation; 6. suggested moves ONLY the
    // dominant axis to the centroid value (the other two stay put), resolved
    // through the engine.
    const { l, c, h } = d.swatch.oklch;
    let reason: string;
    let suggested: Swatch;
    if (dimension === "lightness") {
      reason =
        l < meanL ? "sits darker than the rest" : "sits lighter than the rest";
      suggested = resolveSwatch(oklch(meanL, c, h));
    } else if (dimension === "chroma") {
      reason =
        c < meanC ? "more muted than the rest" : "more saturated than the rest";
      suggested = resolveSwatch(oklch(l, meanC, h));
    } else {
      reason = "pulls toward a different hue than the rest";
      suggested = resolveSwatch(oklch(l, c, meanH));
    }

    outliers.push({
      role: d.role,
      reason,
      dimension,
      current: d.swatch,
      suggested,
    });
  }

  return { outliers };
}
