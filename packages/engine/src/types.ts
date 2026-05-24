/**
 * Core type system for the Chroma color engine.
 *
 * The engine's working color space is OKLCH. Every color value the engine
 * produces is resolved to a {@link Swatch}: it carries the canonical OKLCH
 * coordinates, the gamut-mapped sRGB hex used for display, a ready-to-use CSS
 * `oklch()` string, and a flag recording whether gamut mapping reduced chroma.
 */

/** A color in the OKLCH working space. */
export interface Oklch {
  /** Perceptual lightness, 0 (black) … 1 (white). */
  l: number;
  /** Chroma (colorfulness), 0 … ~0.4. Out-of-gamut values are mapped on output. */
  c: number;
  /** Hue angle in degrees, 0 … 360. */
  h: number;
}

/**
 * A fully resolved color produced by the engine. The OKLCH coordinates are the
 * source of truth; `hex`/`css` are display-boundary projections.
 */
export interface Swatch {
  /** Canonical OKLCH coordinates (may be out of sRGB gamut). */
  oklch: Oklch;
  /** Gamut-mapped sRGB hex (e.g. `#3b82f6`), safe for display. */
  hex: string;
  /** CSS color string in the original OKLCH space, e.g. `oklch(62% 0.19 256)`. */
  css: string;
  /** True when chroma was reduced to bring the color into sRGB gamut. */
  clamped: boolean;
}

/** Named color-theory harmonies, all computed in OKLCH hue space. */
export type HarmonyType =
  | "complementary"
  | "split-complementary"
  | "analogous"
  | "monochromatic"
  | "triadic"
  | "tetradic"
  | "square"
  | "rectangular";

/** Tonal ramp steps (Material-style), light → dark. */
export type RampStep =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950;

/** Ordered list of every ramp step. */
export const RAMP_STEPS: readonly RampStep[] = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

/** A perceptual tonal ramp for a single hue family. */
export interface TonalRamp {
  /** Resolved swatch per step. */
  steps: Record<RampStep, Swatch>;
}

/** Semantic color roles that make up a design system. */
export type Role =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "background"
  | "surface"
  | "foreground"
  | "success"
  | "warning"
  | "danger";

/** Roles that carry a full tonal ramp. */
export type RampRole =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

/** Roles for which an "on" (text/icon) color is computed. */
export type OnRole =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "surface"
  | "success"
  | "warning"
  | "danger";

export type ThemeMode = "light" | "dark";

/**
 * A single mode (light or dark) of a palette: the chosen main swatch per role,
 * the "on" color for each colored role, and the tonal ramps.
 */
export interface ThemePalette {
  mode: ThemeMode;
  roles: Record<Role, Swatch>;
  on: Record<OnRole, Swatch>;
  ramps: Record<RampRole, TonalRamp>;
}

/**
 * The deterministic seed description of a palette. Hues and intended chroma are
 * captured here so that a mode (light/dark) can be (re)derived perceptually
 * rather than by inversion.
 */
export interface PaletteSeeds {
  harmony: HarmonyType;
  base: Oklch;
  hues: Record<RampRole, number>;
  /** Intended maximum chroma per chromatic family. */
  chroma: Record<RampRole, number>;
}

/** A coherent light+dark palette plus the seeds that produced it. */
export interface Palette {
  harmony: HarmonyType;
  baseColor: Oklch;
  seeds: PaletteSeeds;
  light: ThemePalette;
  dark: ThemePalette;
}

/** Options for {@link generatePalette}. */
export interface GeneratePaletteOptions {
  /** Analogous span in degrees (default 30). */
  analogousSpan?: number;
  /** Target chroma for the primary family (default derived from base). */
  primaryChroma?: number;
  /** Chroma multiplier for neutral tinting (default 0.02 of primary). */
  neutralChroma?: number;
}

/** Structured, perceptual adjustment intent for {@link adjustColor}. */
export interface AdjustIntent {
  /** Move along the OKLCH lightness axis. */
  lightness?: "lighter" | "darker";
  /** Shift hue toward the warm (~60°) or cool (~250°) anchor. */
  temperature?: "warmer" | "cooler";
  /** Increase or decrease OKLCH chroma. */
  saturation?: "more" | "less";
  /**
   * Perceptual magnitude of the adjustment, 0 … 1 (default 0.1). Interpreted
   * per-axis: lightness ± (amount), chroma ± (amount * 0.2), temperature as a
   * fractional rotation toward the anchor.
   */
  amount?: number;
}

/** Result of {@link adjustColor}: the new swatch plus the per-axis delta. */
export interface AdjustResult {
  before: Swatch;
  after: Swatch;
  delta: { l: number; c: number; h: number };
  intent: AdjustIntent;
}

/** Accessibility models. */
export type ContrastModel = "apca" | "wcag";

/** Use-case for a foreground/background pairing. */
export type ContrastUse = "body" | "large" | "nonText";

/** APCA guidance thresholds (absolute Lc). */
export const APCA_THRESHOLDS: Record<ContrastUse, number> = {
  body: 75,
  large: 60,
  nonText: 45,
};

/** WCAG 2.2 contrast-ratio thresholds. */
export const WCAG_THRESHOLDS = {
  AA: { body: 4.5, large: 3.0, nonText: 3.0 },
  AAA: { body: 7.0, large: 4.5, nonText: 3.0 },
} as const;

/** Contrast assessment for one foreground-on-background pairing. */
export interface PairContrast {
  /** Label for the pairing, e.g. "foreground on background". */
  label: string;
  foreground: Swatch;
  background: Swatch;
  /** APCA Lc, signed (positive = dark text on light, negative = light on dark). */
  apcaLc: number;
  /** WCAG 2.2 contrast ratio (1 … 21). */
  wcagRatio: number;
  /** Pass/fail by APCA guidance per use-case. */
  apca: Record<ContrastUse, boolean>;
  /** Pass/fail by WCAG 2.2 per level + use-case. */
  wcag: { AA: Record<ContrastUse, boolean>; AAA: Record<ContrastUse, boolean> };
}

/** Harmony check: measured hue angles vs. expected for the palette's harmony. */
export interface HarmonyAudit {
  harmony: HarmonyType;
  /** Expected hue offsets from base, in degrees. */
  expectedOffsets: number[];
  /** Measured hue offsets from base, in degrees. */
  measuredOffsets: number[];
  /** True when every measured offset is within tolerance of an expected one. */
  ok: boolean;
}

/** Per-mode audit. */
export interface ModeAudit {
  mode: ThemeMode;
  pairs: PairContrast[];
  /** Swatches that were gamut-clamped. */
  clamped: string[];
}

/** Full palette audit returned by {@link auditPalette}. */
export interface PaletteAudit {
  harmony: HarmonyAudit;
  light: ModeAudit;
  dark: ModeAudit;
  /** True when every body-text pairing meets the APCA body threshold in both modes. */
  passesBodyApca: boolean;
}

/** Target spec for {@link fixContrast}. */
export interface ContrastTarget {
  /** Accessibility model to satisfy (default "apca"). */
  model?: ContrastModel;
  /** Use-case driving the threshold (default "body"). */
  use?: ContrastUse;
  /** WCAG level when model is "wcag" (default "AA"). */
  level?: "AA" | "AAA";
}

/** One change made by {@link fixContrast}. */
export interface ContrastFix {
  label: string;
  from: Swatch;
  to: Swatch;
  /** Human-readable reason, e.g. "darkened foreground to reach APCA Lc 75". */
  reason: string;
  /** Contrast before and after the fix (per the active model). */
  before: number;
  after: number;
}

/** A pairing where fixContrast could not reach the target (physics ceiling). */
export interface ContrastUnreachable {
  label: string;
  /** Best contrast actually achieved. */
  best: number;
  /** The target that could not be met. */
  target: number;
}

/** Result of {@link fixContrast}. */
export interface FixContrastResult {
  palette: Palette;
  changes: ContrastFix[];
  /** Pairings where the target contrast was unreachable (best-effort applied). */
  unreachable: ContrastUnreachable[];
}
