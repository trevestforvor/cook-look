/**
 * Accessibility math: APCA (primary) and WCAG 2.2 (secondary).
 *
 * Both models operate on the *displayed* sRGB color (the gamut-mapped hex), so
 * the numbers match what a user actually sees. APCA is directional — swapping
 * text and background changes the result — so callers must pass foreground and
 * background in the correct order.
 */
import { hexToRgbChannels } from "./color.js";
import {
  APCA_THRESHOLDS,
  WCAG_THRESHOLDS,
  type ContrastUse,
  type Swatch,
} from "./types.js";

type Rgb = { r: number; g: number; b: number };

/* ------------------------------------------------------------------ WCAG 2.2 */

/** sRGB → linear-light channel (WCAG 2.x piecewise transfer function). */
function wcagLinearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0…1) of an sRGB color. */
export function wcagLuminance(rgb: Rgb): number {
  return (
    0.2126 * wcagLinearize(rgb.r) +
    0.7152 * wcagLinearize(rgb.g) +
    0.0722 * wcagLinearize(rgb.b)
  );
}

/**
 * WCAG 2.2 contrast ratio (1 … 21) between two colors. Order-independent.
 */
export function wcagContrastRgb(fg: Rgb, bg: Rgb): number {
  const l1 = wcagLuminance(fg);
  const l2 = wcagLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ---------------------------------------------------------------------- APCA */
/*
 * APCA-W3 (SAPC) constants — version 0.1.9 "0.0.98G-4g". Implemented directly
 * from the published algorithm rather than hand-tuned. Verified against the
 * canonical reference pairs (black-on-white ≈ 106.04, white-on-black ≈ -107.88).
 */
const SA98 = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
} as const;

/** APCA screen luminance Y of an sRGB color (simple 2.4 power, per spec). */
export function apcaLuminance(rgb: Rgb): number {
  return (
    SA98.sRco * rgb.r ** SA98.mainTRC +
    SA98.sGco * rgb.g ** SA98.mainTRC +
    SA98.sBco * rgb.b ** SA98.mainTRC
  );
}

/** Soft-clamp very dark luminances toward the black threshold. */
function blackSoftClamp(y: number): number {
  return y > SA98.blkThrs ? y : y + (SA98.blkThrs - y) ** SA98.blkClmp;
}

/**
 * APCA lightness contrast (Lc) for text foreground on a background.
 *
 * Directional: positive Lc means dark text on a light background (BoW),
 * negative means light text on a dark background (WoB). The absolute value is
 * compared against the guidance thresholds.
 */
export function apcaContrastRgb(textRgb: Rgb, bgRgb: Rgb): number {
  let txtY = blackSoftClamp(apcaLuminance(textRgb));
  let bgY = blackSoftClamp(apcaLuminance(bgRgb));

  if (Math.abs(bgY - txtY) < SA98.deltaYmin) return 0;

  let outputContrast: number;
  if (bgY > txtY) {
    // Normal polarity: dark text on light background.
    const sapc = (bgY ** SA98.normBG - txtY ** SA98.normTXT) * SA98.scaleBoW;
    outputContrast = sapc < SA98.loClip ? 0 : sapc - SA98.loBoWoffset;
  } else {
    // Reverse polarity: light text on dark background.
    const sapc = (bgY ** SA98.revBG - txtY ** SA98.revTXT) * SA98.scaleWoB;
    outputContrast = sapc > -SA98.loClip ? 0 : sapc + SA98.loWoBoffset;
  }
  return outputContrast * 100;
}

/* ----------------------------------------------------------- swatch wrappers */

function channels(s: Swatch): Rgb {
  return hexToRgbChannels(s.hex) ?? { r: 0, g: 0, b: 0 };
}

/** APCA Lc for a foreground swatch on a background swatch (directional). */
export function apcaLc(foreground: Swatch, background: Swatch): number {
  return apcaContrastRgb(channels(foreground), channels(background));
}

/** WCAG 2.2 contrast ratio between two swatches. */
export function wcagRatio(a: Swatch, b: Swatch): number {
  return wcagContrastRgb(channels(a), channels(b));
}

/** Evaluate APCA pass/fail across all use-cases for a given |Lc|. */
export function apcaPasses(lc: number): Record<ContrastUse, boolean> {
  const abs = Math.abs(lc);
  return {
    body: abs >= APCA_THRESHOLDS.body,
    large: abs >= APCA_THRESHOLDS.large,
    nonText: abs >= APCA_THRESHOLDS.nonText,
  };
}

/** Evaluate WCAG AA/AAA pass/fail across use-cases for a given ratio. */
export function wcagPasses(ratio: number): {
  AA: Record<ContrastUse, boolean>;
  AAA: Record<ContrastUse, boolean>;
} {
  return {
    AA: {
      body: ratio >= WCAG_THRESHOLDS.AA.body,
      large: ratio >= WCAG_THRESHOLDS.AA.large,
      nonText: ratio >= WCAG_THRESHOLDS.AA.nonText,
    },
    AAA: {
      body: ratio >= WCAG_THRESHOLDS.AAA.body,
      large: ratio >= WCAG_THRESHOLDS.AAA.large,
      nonText: ratio >= WCAG_THRESHOLDS.AAA.nonText,
    },
  };
}
