/**
 * Minimal-change contrast repair.
 *
 * Failing text/background pairings are fixed by nudging the *foreground*
 * lightness in OKLCH — the smallest perceptual move that reaches the target —
 * while preserving hue and chroma. APCA is directional, so the nudge direction
 * is chosen from the background lightness (darken text on light surfaces, lift
 * it on dark ones). Each change is reported with a human-readable reason.
 */
import { apcaLc, wcagRatio } from "./accessibility.js";
import { oklch, resolveSwatch } from "./color.js";
import {
  APCA_THRESHOLDS,
  WCAG_THRESHOLDS,
  type ContrastFix,
  type ContrastModel,
  type ContrastTarget,
  type ContrastUnreachable,
  type ContrastUse,
  type FixContrastResult,
  type OnRole,
  type Palette,
  type Swatch,
  type ThemeMode,
  type ThemePalette,
} from "./types.js";

function thresholdFor(target: Required<ContrastTarget>): number {
  if (target.model === "apca") return APCA_THRESHOLDS[target.use];
  return WCAG_THRESHOLDS[target.level][target.use];
}

/** Worst-case contrast of a foreground against several backgrounds (per model). */
function minContrast(
  fg: Swatch,
  bgs: Swatch[],
  model: ContrastModel,
): number {
  return Math.min(
    ...bgs.map((bg) =>
      model === "apca" ? Math.abs(apcaLc(fg, bg)) : wcagRatio(fg, bg),
    ),
  );
}

/**
 * Nudge a foreground's OKLCH lightness until it clears `threshold` against all
 * backgrounds, or until it hits the lightness limit. Returns the best swatch
 * found and the contrast before/after.
 */
function nudgeForeground(
  fg: Swatch,
  bgs: Swatch[],
  model: ContrastModel,
  threshold: number,
): { swatch: Swatch; before: number; after: number } {
  const before = minContrast(fg, bgs, model);
  if (before >= threshold) return { swatch: fg, before, after: before };

  const avgBgL = bgs.reduce((s, b) => s + b.oklch.l, 0) / bgs.length;
  const dir = avgBgL >= 0.5 ? -1 : 1; // darken text on light bg, lift on dark bg

  let best = fg;
  let bestContrast = before;
  let l = fg.oklch.l;
  for (let i = 0; i < 60; i++) {
    l += dir * 0.02;
    if (l <= 0 || l >= 1) {
      l = Math.max(0, Math.min(1, l));
    }
    const candidate = resolveSwatch(oklch(l, fg.oklch.c, fg.oklch.h));
    const contrast = minContrast(candidate, bgs, model);
    if (contrast > bestContrast) {
      bestContrast = contrast;
      best = candidate;
    }
    if (contrast >= threshold) {
      return { swatch: candidate, before, after: contrast };
    }
    if (l <= 0 || l >= 1) break;
  }
  return { swatch: best, before, after: bestContrast };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Fix one theme in place-style (returns a new theme + the changes made). */
function fixTheme(
  theme: ThemePalette,
  model: ContrastModel,
  threshold: number,
  modeLabel: ThemeMode,
): { theme: ThemePalette; changes: ContrastFix[]; unreachable: ContrastUnreachable[] } {
  const changes: ContrastFix[] = [];
  const unreachable: ContrastUnreachable[] = [];
  const roles = { ...theme.roles };
  const on = { ...theme.on };

  // Body text (foreground) must clear both background and surface.
  const fgResult = nudgeForeground(
    roles.foreground,
    [roles.background, roles.surface],
    model,
    threshold,
  );
  if (fgResult.after >= threshold) {
    if (fgResult.swatch !== roles.foreground) {
      changes.push({
        label: `${modeLabel}: foreground`,
        from: roles.foreground,
        to: fgResult.swatch,
        reason: directionReason(roles.foreground, fgResult.swatch, model, threshold),
        before: round1(fgResult.before),
        after: round1(fgResult.after),
      });
      roles.foreground = fgResult.swatch;
    }
  } else if (fgResult.before < threshold) {
    // Target unreachable — apply best-effort and report.
    if (fgResult.swatch !== roles.foreground && fgResult.after > fgResult.before) {
      changes.push({
        label: `${modeLabel}: foreground`,
        from: roles.foreground,
        to: fgResult.swatch,
        reason: directionReason(roles.foreground, fgResult.swatch, model, threshold),
        before: round1(fgResult.before),
        after: round1(fgResult.after),
      });
      roles.foreground = fgResult.swatch;
    }
    unreachable.push({
      label: `${modeLabel}: foreground`,
      best: round1(fgResult.after),
      target: threshold,
    });
  }

  // On-colors for each colored role.
  const onRoles: OnRole[] = [
    "primary",
    "secondary",
    "accent",
    "success",
    "warning",
    "danger",
    "primary-container",
    "secondary-container",
    "accent-container",
  ];
  for (const role of onRoles) {
    const bg = roles[role];
    const result = nudgeForeground(on[role], [bg], model, threshold);
    if (result.after >= threshold) {
      if (result.swatch !== on[role]) {
        changes.push({
          label: `${modeLabel}: on-${role}`,
          from: on[role],
          to: result.swatch,
          reason: directionReason(on[role], result.swatch, model, threshold),
          before: round1(result.before),
          after: round1(result.after),
        });
        on[role] = result.swatch;
      }
    } else if (result.before < threshold) {
      // Target unreachable — apply best-effort and report.
      if (result.swatch !== on[role] && result.after > result.before) {
        changes.push({
          label: `${modeLabel}: on-${role}`,
          from: on[role],
          to: result.swatch,
          reason: directionReason(on[role], result.swatch, model, threshold),
          before: round1(result.before),
          after: round1(result.after),
        });
        on[role] = result.swatch;
      }
      unreachable.push({
        label: `${modeLabel}: on-${role}`,
        best: round1(result.after),
        target: threshold,
      });
    }
  }

  return { theme: { ...theme, roles, on }, changes, unreachable };
}

function directionReason(
  from: Swatch,
  to: Swatch,
  model: ContrastModel,
  threshold: number,
): string {
  const dir = to.oklch.l < from.oklch.l ? "darkened" : "lightened";
  const unit = model === "apca" ? `APCA Lc ${threshold}` : `WCAG ${threshold}:1`;
  return `${dir} foreground in OKLCH to reach ${unit}`;
}

/**
 * Nudge palette colors to meet an accessibility {@link ContrastTarget} with the
 * smallest perceptual change, in both light and dark mode. Returns the repaired
 * palette and a per-change audit trail.
 */
export function fixContrast(input: {
  palette: Palette;
  target?: ContrastTarget;
}): FixContrastResult {
  const target: Required<ContrastTarget> = {
    model: input.target?.model ?? "apca",
    use: input.target?.use ?? "body",
    level: input.target?.level ?? "AA",
  };
  const threshold = thresholdFor(target);

  const light = fixTheme(input.palette.light, target.model, threshold, "light");
  const dark = fixTheme(input.palette.dark, target.model, threshold, "dark");

  return {
    palette: { ...input.palette, light: light.theme, dark: dark.theme },
    changes: [...light.changes, ...dark.changes],
    unreachable: [...light.unreachable, ...dark.unreachable],
  };
}

/** Re-export for callers that want the raw use→threshold map. */
export const apcaThresholdFor = (use: ContrastUse): number =>
  APCA_THRESHOLDS[use];
