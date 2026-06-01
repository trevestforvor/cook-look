/**
 * @chroma/engine — a deterministic, OKLCH-based color-theory design engine.
 *
 * Public surface (these pure functions are exactly what the Part 2 AI agent will
 * call as tools). The engine owns all color math and all final color values; it
 * has no network, LLM, or React dependency.
 */

export * from "./types.js";

// Color boundary (OKLCH ↔ sRGB, gamut mapping).
export {
  oklch,
  resolveSwatch,
  parseToOklch,
  formatOklchCss,
  normalizeHue,
  clamp,
  isInGamut,
  displayRgb255,
  maxChroma,
} from "./color.js";

// Accessibility (APCA primary, WCAG 2.2 secondary).
export {
  apcaLc,
  apcaContrastRgb,
  apcaLuminance,
  apcaPasses,
  wcagRatio,
  wcagContrastRgb,
  wcagLuminance,
  wcagPasses,
} from "./accessibility.js";

// Harmonies.
export {
  harmonyOffsets,
  harmonyHues,
  harmonyKind,
  chromaticSeedHues,
  normalizeCustomAngles,
  COMPOUND_OFFSETS,
  type HarmonyKind,
  type HarmonyOptions,
} from "./harmony.js";

// Tonal ramps.
export { buildRamp, buildNeutralRamp, rampLightness } from "./ramps.js";

// Palette generation (the core tool).
export { generatePalette, buildTheme, buildSeeds } from "./palette.js";

// Adjustment.
export { adjustColor } from "./adjust.js";

// Contrast repair.
export { fixContrast } from "./contrast-fix.js";

// Light/dark derivation.
export { deriveDarkMode, deriveLightMode, extractSeeds } from "./darkmode.js";

// Auditing.
export {
  auditPalette,
  auditHarmonyFit,
  evaluatePair,
  expectedChromaticOffsets,
} from "./audit.js";

// Recolor.
export { recolor } from "./recolor.js";

// Naming.
export { nameColors, nameColor, hueFamily } from "./naming.js";

// Token export.
export {
  toCssVariables,
  toTailwindConfig,
  toTailwindColors,
  toJSON,
} from "./tokens.js";
