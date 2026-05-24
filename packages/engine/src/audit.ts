/**
 * Palette auditing: contrast (APCA + WCAG), harmony verification, and gamut.
 *
 * The audit enumerates the foreground/background pairings a real UI relies on,
 * in both light and dark mode, and reports APCA Lc + WCAG ratio with pass/fail
 * per use-case. It also checks that the realized hues match the intended
 * harmony and lists any swatch that required gamut mapping.
 */
import { apcaLc, apcaPasses, wcagPasses, wcagRatio } from "./accessibility.js";
import { normalizeHue } from "./color.js";
import { chromaticSeedHues, type HarmonyOptions } from "./harmony.js";
import type {
  HarmonyAudit,
  HarmonyType,
  ModeAudit,
  Palette,
  PairContrast,
  PaletteAudit,
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

/** Expected primary/secondary/accent hue offsets from base, per harmony. */
export function expectedChromaticOffsets(
  harmony: HarmonyType,
  options: HarmonyOptions = {},
): number[] {
  const hues = chromaticSeedHues({ l: 0.6, c: 0.15, h: 0 }, harmony, options);
  return [hues.primary, hues.secondary, hues.accent];
}

function auditHarmony(palette: Palette): HarmonyAudit {
  const baseHue = palette.baseColor.h;
  const expected = expectedChromaticOffsets(palette.harmony, {
    analogousSpan: undefined,
  });
  const measured = (["primary", "secondary", "accent"] as const).map((role) =>
    normalizeHue(palette.light.roles[role].oklch.h - baseHue),
  );
  const tol = 1.0;
  const ok = expected.every((exp, i) => {
    const got = measured[i] ?? Number.NaN;
    const diff = Math.abs(normalizeHue(got - exp + 180) - 180);
    return diff <= tol;
  });
  return { harmony: palette.harmony, expectedOffsets: expected, measuredOffsets: measured, ok };
}

/** Run the full accessibility + harmony + gamut audit for a palette. */
export function auditPalette(input: { palette: Palette }): PaletteAudit {
  const { palette } = input;
  const light = auditMode(palette.light);
  const dark = auditMode(palette.dark);

  const bodyTextLabels = new Set([
    "foreground on background",
    "foreground on surface",
  ]);
  const passesBodyApca = [light, dark].every((mode) =>
    mode.pairs
      .filter((p) => bodyTextLabels.has(p.label))
      .every((p) => p.apca.body),
  );

  return {
    harmony: auditHarmony(palette),
    light,
    dark,
    passesBodyApca,
  };
}
