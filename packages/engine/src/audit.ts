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
  Oklch,
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

/**
 * Adaptive-threshold + suggestion constants. Outlier limits are derived from the
 * palette's own spread (median absolute deviation), so a tight palette flags small
 * drifts while a loose palette tolerates more — with a hard floor so a perfectly
 * uniform palette still has a sane minimum tolerance. This robust (median/MAD)
 * approach beats a fixed threshold off a mean, because the mean is itself dragged
 * toward the very outlier being measured.
 */
const L_MAD_FLOOR = 0.015; // floor on the lightness MAD
const C_MAD_FLOOR = 0.008; // floor on the chroma MAD
const L_THR_FLOOR = 0.05; // min lightness deviation that counts as an outlier
const C_THR_FLOOR = 0.025; // min chroma deviation that counts as an outlier
const HUE_SPREAD_MIN = 30; // hue disharmony only checked in a mid spread band…
const HUE_SPREAD_MAX = 90; // …(triadic/complementary wide spreads are intentional)
const HUE_DIST_FLOOR = 60; // min wrapped hue distance from center to flag
const LOCKED_BLEND = 0.6; // partial snap toward locked anchors (vs full snap)
const L_CLAMP_MIN = 0.05; // never suggest pure black…
const L_CLAMP_MAX = 0.95; // …or pure white

/** Shortest angular distance between two hues, in degrees (0..180). */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(d, 360 - d);
}

/** Median of a non-empty list. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Median absolute deviation about `med`, floored so it never collapses to 0. */
function medianAbsDev(xs: number[], med: number, floor: number): number {
  return Math.max(
    median(xs.map((x) => Math.abs(x - med))),
    floor,
  );
}

/** Circular mean of hues (degrees) via atan2 of summed unit vectors. */
function circularMeanHue(hues: number[]): number {
  let sumSin = 0;
  let sumCos = 0;
  for (const h of hues) {
    const rad = (normalizeHue(h) * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  return normalizeHue((Math.atan2(sumSin, sumCos) * 180) / Math.PI);
}

/** Largest wrapped hue distance of any hue from `center`. */
function circularSpread(hues: number[], center: number): number {
  return Math.max(...hues.map((h) => hueDistance(h, center)));
}

interface FitCandidate {
  role: Role;
  swatch: Swatch;
}

/**
 * Detect chromatic roles that do not fit the rest of the palette.
 *
 * Unlike {@link auditHarmony} (which only checks hue offset against the expected
 * harmony), this measures per-color cohesion in OKLCH using ROBUST statistics:
 * per-channel **median + MAD** (median absolute deviation) rather than a mean and
 * a fixed threshold. Two reasons that's better — and why it matches/extends the
 * approach a leading commercial palette fixer uses:
 *   1. The mean is dragged toward the very outlier you're hunting, so deviations
 *      look smaller and a fix undershoots. The median ignores the outlier.
 *   2. MAD makes the flag threshold ADAPTIVE: a tight palette flags small drifts,
 *      a loose palette tolerates more (with a hard floor so uniform palettes still
 *      have a sane minimum tolerance).
 * Hue uses circular math throughout (atan2 mean + wrapped distance) so 359°/1°
 * behave correctly. Neutrals and status roles are excluded so a single loud brand
 * color can't be "corrected" toward gray.
 *
 * Suggestions snap the offending axis toward the palette median — or, when the
 * user has LOCKED colors, toward the locked colors' median (a {@link LOCKED_BLEND}
 * partial snap, since locked anchors are the intended target), with suggested
 * lightness clamped to [{@link L_CLAMP_MIN}, {@link L_CLAMP_MAX}]. Resolved through
 * the engine's color authority (no hand-written hex). Pure + deterministic.
 *
 * @param input.locked Optional OKLCH colors the user has locked. When present,
 *   their per-channel median becomes the snap target and the move is a partial
 *   (60%) blend, mirroring "harmonize toward the colors you've committed to".
 */
export function auditHarmonyFit(input: {
  palette: Palette;
  locked?: Oklch[];
}): {
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

  // 2. Robust per-channel centers + spreads over the candidate set.
  const Ls = candidates.map((c) => c.swatch.oklch.l);
  const Cs = candidates.map((c) => c.swatch.oklch.c);
  const Hs = candidates.map((c) => normalizeHue(c.swatch.oklch.h));

  const medL = median(Ls);
  const medC = median(Cs);
  const madL = medianAbsDev(Ls, medL, L_MAD_FLOOR);
  const madC = medianAbsDev(Cs, medC, C_MAD_FLOOR);
  const centerH = circularMeanHue(Hs);
  const spreadH = candidates.length > 1 ? circularSpread(Hs, centerH) : 0;

  // Adaptive thresholds: scale with the palette's own spread, floored.
  const thrL = Math.max(2 * madL, L_THR_FLOOR);
  const thrC = Math.max(2 * madC, C_THR_FLOOR);

  // 3. Snap targets. Default to the palette medians; if the user locked colors,
  // aim L/C at the LOCKED colors' medians instead (the committed anchors).
  const locked = (input.locked ?? []).filter(Boolean);
  const hasLocked = locked.length > 0;
  const targetL = hasLocked ? median(locked.map((o) => o.l)) : medL;
  const targetC = hasLocked ? median(locked.map((o) => o.c)) : medC;
  const targetH = hasLocked
    ? circularMeanHue(locked.map((o) => normalizeHue(o.h)))
    : centerH;
  // Blend a locked swatch's own correction partially; everything else snaps fully.
  const blend = (from: number, to: number, role: Role) =>
    hasLocked && !isLockedRole(role, locked, roles)
      ? from + (to - from) * LOCKED_BLEND
      : to;

  const outliers: HarmonyOutlier[] = [];
  for (const { role, swatch } of candidates) {
    const { l, c, h } = swatch.oklch;
    const dL = Math.abs(l - medL);
    const dC = Math.abs(c - medC);
    const dH = hueDistance(h, centerH);

    // 4. Flag rules (each adaptive): lightness drift, chroma drift, or — only in
    // a mid hue-spread band (so deliberate triadic/complementary spreads aren't
    // "fixed") — a lone hue that diverges past the palette's own spread.
    const flagL = dL > thrL;
    const flagC = dC > thrC;
    const flagH =
      spreadH > HUE_SPREAD_MIN &&
      spreadH < HUE_SPREAD_MAX &&
      dH > Math.max(spreadH, HUE_DIST_FLOOR);
    if (!flagL && !flagC && !flagH) continue;

    // Dominant dimension = axis with the largest deviation relative to its
    // adaptive threshold (hue normalized against its own flag distance).
    const sevL = flagL ? dL / thrL : 0;
    const sevC = flagC ? dC / thrC : 0;
    const sevH = flagH ? dH / Math.max(spreadH, HUE_DIST_FLOOR) : 0;
    let dimension: HarmonyOutlier["dimension"];
    if (sevL >= sevC && sevL >= sevH) dimension = "lightness";
    else if (sevH >= sevC) dimension = "hue";
    else dimension = "chroma";

    // 5. Reason + 6. suggestion: move ONLY the dominant axis toward the target,
    // clamp lightness, resolve through the engine.
    let reason: string;
    let suggested: Swatch;
    if (dimension === "lightness") {
      reason =
        l < medL ? "sits darker than the rest" : "sits lighter than the rest";
      const nl = clampL(blend(l, targetL, role));
      suggested = resolveSwatch(oklch(nl, c, h));
    } else if (dimension === "chroma") {
      reason =
        c < medC ? "more muted than the rest" : "more saturated than the rest";
      const nc = Math.max(0.01, blend(c, targetC, role));
      suggested = resolveSwatch(oklch(l, nc, h));
    } else {
      reason = "pulls toward a different hue than the rest";
      // Hue always snaps to the center (a partial hue blend reads as "still off").
      suggested = resolveSwatch(oklch(l, c, targetH));
    }

    outliers.push({ role, reason, dimension, current: swatch, suggested });
  }

  return { outliers };
}

/** Clamp a suggested lightness away from pure black/white. */
function clampL(l: number): number {
  return Math.max(L_CLAMP_MIN, Math.min(L_CLAMP_MAX, l));
}

/** Whether this role's current color is (approximately) one of the locked anchors. */
function isLockedRole(
  role: Role,
  locked: Oklch[],
  roles: ThemePalette["roles"],
): boolean {
  const swatch = roles[role];
  if (!swatch) return false;
  const { l, c, h } = swatch.oklch;
  return locked.some(
    (o) =>
      Math.abs(o.l - l) < 1e-3 &&
      Math.abs(o.c - c) < 1e-3 &&
      hueDistance(o.h, h) < 0.5,
  );
}
