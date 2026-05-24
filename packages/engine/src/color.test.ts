import { describe, expect, it } from "vitest";
import {
  isInGamut,
  maxChroma,
  normalizeHue,
  oklch,
  parseToOklch,
  resolveSwatch,
} from "./color.js";

describe("normalizeHue", () => {
  it("wraps into [0,360)", () => {
    expect(normalizeHue(370)).toBe(10);
    expect(normalizeHue(-30)).toBe(330);
    expect(normalizeHue(360)).toBe(0);
  });
});

describe("resolveSwatch", () => {
  it("round-trips a known sRGB blue", () => {
    const o = parseToOklch("#3b82f6");
    expect(o).not.toBeNull();
    const swatch = resolveSwatch(o!);
    expect(swatch.hex.toLowerCase()).toBe("#3b82f6");
    expect(swatch.clamped).toBe(false);
    expect(swatch.css).toMatch(/^oklch\(/);
  });

  it("produces #ffffff for L=1 and #000000 for L=0", () => {
    expect(resolveSwatch(oklch(1, 0, 0)).hex.toLowerCase()).toBe("#ffffff");
    expect(resolveSwatch(oklch(0, 0, 0)).hex.toLowerCase()).toBe("#000000");
  });

  it("gamut-maps an impossible high-chroma color and flags it", () => {
    // Very high chroma at mid lightness is far outside sRGB.
    const swatch = resolveSwatch(oklch(0.6, 0.4, 150));
    expect(swatch.clamped).toBe(true);
    expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/i);
    // Hue is preserved by chroma reduction (within rounding).
    const remapped = parseToOklch(swatch.hex)!;
    expect(Math.abs(remapped.h - 150)).toBeLessThan(6);
  });

  it("does not flag an in-gamut color", () => {
    const swatch = resolveSwatch(oklch(0.6, 0.05, 150));
    expect(swatch.clamped).toBe(false);
  });
});

describe("maxChroma", () => {
  it("returns a positive chroma for a mid-lightness hue", () => {
    const c = maxChroma(0.6, 256);
    expect(c).toBeGreaterThan(0.05);
    expect(isInGamut(oklch(0.6, c, 256))).toBe(true);
    // Just beyond the found ceiling should be out of gamut.
    expect(isInGamut(oklch(0.6, c + 0.02, 256))).toBe(false);
  });

  it("is ~0 at pure white", () => {
    expect(maxChroma(1, 256)).toBeLessThan(0.01);
  });
});

describe("parseToOklch", () => {
  it("parses hex, rgb, and named colors", () => {
    expect(parseToOklch("#ff0000")).not.toBeNull();
    expect(parseToOklch("rgb(0, 128, 255)")).not.toBeNull();
    expect(parseToOklch("rebeccapurple")).not.toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseToOklch("not-a-color")).toBeNull();
  });
});
