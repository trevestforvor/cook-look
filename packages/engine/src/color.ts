/**
 * Color conversion and gamut mapping — the engine's boundary to sRGB.
 *
 * All OKLCH↔sRGB math is delegated to `culori`; the engine never hand-rolls
 * color conversions. Out-of-gamut OKLCH colors are mapped into sRGB by reducing
 * chroma while preserving hue and lightness, and we record whether that
 * happened so the rest of the engine (and the UI) can surface it.
 */
import {
  clampChroma,
  converter,
  formatHex,
  inGamut,
  parse,
  type Oklch as CuloriOklch,
  type Rgb,
} from "culori";
import type { Oklch, Swatch } from "./types.js";

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const rgbInGamut = inGamut("rgb");

/** Round to a fixed number of decimals (stable, deterministic output). */
function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  // `+ 0` normalizes -0 to 0.
  return Math.round(n * f) / f + 0;
}

/** Normalize a hue angle into [0, 360). */
export function normalizeHue(h: number): number {
  const r = h % 360;
  return r < 0 ? r + 360 : r;
}

/** Clamp a numeric value into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Build a normalized {@link Oklch} from raw components. */
export function oklch(l: number, c: number, h: number): Oklch {
  return {
    l: clamp(l, 0, 1),
    c: Math.max(0, c),
    h: normalizeHue(h),
  };
}

/** Convert our {@link Oklch} to a culori OKLCH object. */
function toCulori(o: Oklch): CuloriOklch {
  return { mode: "oklch", l: o.l, c: o.c, h: o.h };
}

/**
 * Convert an OKLCH color to display sRGB, gamut-mapping if necessary.
 *
 * @returns the gamut-mapped sRGB color (0…1 channels) and whether chroma was reduced.
 */
function toDisplayRgb(o: Oklch): { rgb: Rgb; clamped: boolean } {
  const culori = toCulori(o);
  const within = rgbInGamut(culori);
  const mapped = within ? culori : clampChroma(culori, "oklch", "rgb");
  const rgb = toRgb(mapped) as Rgb;
  return { rgb, clamped: !within };
}

/** Format an OKLCH color as a CSS `oklch()` string. */
export function formatOklchCss(o: Oklch): string {
  const l = round(o.l * 100, 2);
  const c = round(o.c, 4);
  const h = round(o.h, 2);
  return `oklch(${l}% ${c} ${h})`;
}

/**
 * Resolve an OKLCH color into a full {@link Swatch}: canonical OKLCH, a
 * gamut-mapped hex, a CSS `oklch()` string, and the clamp flag.
 */
export function resolveSwatch(o: Oklch): Swatch {
  const normalized = oklch(o.l, o.c, o.h);
  const { rgb, clamped } = toDisplayRgb(normalized);
  return {
    oklch: {
      l: round(normalized.l, 4),
      c: round(normalized.c, 4),
      h: round(normalized.h, 2),
    },
    hex: formatHex(rgb),
    css: formatOklchCss(normalized),
    clamped,
  };
}

/** A small margin below the true gamut boundary so rounded swatches stay verifiably in-gamut. */
const GAMUT_MARGIN = 0.0016;

/**
 * Resolve a swatch at `l`/`hue` capped to `intendedChroma`, reducing further when
 * the gamut requires it. `clamped` is true when the gamut forced the realized
 * chroma below the intended value — surfacing real gamut compression that a bare
 * resolveSwatch() misses because builders pre-clamp their input.
 */
export function resolveGamutClamped(l: number, intendedChroma: number, hue: number): Swatch {
  const ceiling = Math.max(0, maxChroma(l, hue) - GAMUT_MARGIN);
  const c = Math.min(intendedChroma, ceiling);
  const sw = resolveSwatch(oklch(l, c, hue));
  return c < intendedChroma - 1e-4 ? { ...sw, clamped: true } : sw;
}

/** True when an OKLCH color fits inside the sRGB gamut without chroma reduction. */
export function isInGamut(o: Oklch): boolean {
  return rgbInGamut(toCulori(o));
}

/**
 * Fast OKLCH→sRGB conversion for dense visualization work (e.g. drawing the
 * color wheel pixel by pixel). Does a single conversion and clamps each channel
 * to [0,255] instead of gamut-mapping by chroma reduction — out-of-gamut pixels
 * get an approximate color plus an `inGamut: false` flag so the UI can dim them.
 *
 * Use {@link resolveSwatch} for any actual color value (tokens, the palette);
 * this trades exactness for ~20× less work and is display-only.
 */
export function displayRgb255(o: Oklch): {
  r: number;
  g: number;
  b: number;
  inGamut: boolean;
} {
  const rgb = toRgb(toCulori(o)) as Rgb;
  const eps = 1e-4;
  const inGamut =
    rgb.r >= -eps &&
    rgb.r <= 1 + eps &&
    rgb.g >= -eps &&
    rgb.g <= 1 + eps &&
    rgb.b >= -eps &&
    rgb.b <= 1 + eps;
  return {
    r: Math.round(clamp(rgb.r, 0, 1) * 255),
    g: Math.round(clamp(rgb.g, 0, 1) * 255),
    b: Math.round(clamp(rgb.b, 0, 1) * 255),
    inGamut,
  };
}

/**
 * Largest chroma that keeps (l, h) inside the sRGB gamut, found by binary
 * search. Useful for building ramps that hug the gamut boundary.
 */
export function maxChroma(l: number, h: number, maxSearch = 0.5): number {
  if (!rgbInGamut(toCulori(oklch(l, 0, h)))) return 0;
  let lo = 0;
  let hi = maxSearch;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (rgbInGamut(toCulori(oklch(l, mid, h)))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Parse any CSS color string (hex, rgb(), named, oklch(), …) into OKLCH.
 * Returns `null` when the string is not a valid color.
 */
export function parseToOklch(input: string): Oklch | null {
  const parsed = parse(input);
  if (!parsed) return null;
  const o = toOklch(parsed) as CuloriOklch;
  return oklch(o.l ?? 0, o.c ?? 0, o.h ?? 0);
}

/** Convert sRGB 0…1 channels to gamma-corrected linear luminance helpers. */
export function toRgbChannels(o: Oklch): { r: number; g: number; b: number } {
  const { rgb } = toDisplayRgb(o);
  return {
    r: clamp(rgb.r, 0, 1),
    g: clamp(rgb.g, 0, 1),
    b: clamp(rgb.b, 0, 1),
  };
}

/** Parse a hex string to sRGB 0…1 channels (used by accessibility math). */
export function hexToRgbChannels(
  hex: string,
): { r: number; g: number; b: number } | null {
  const parsed = parse(hex);
  if (!parsed) return null;
  const rgb = toRgb(parsed) as Rgb;
  return {
    r: clamp(rgb.r, 0, 1),
    g: clamp(rgb.g, 0, 1),
    b: clamp(rgb.b, 0, 1),
  };
}
