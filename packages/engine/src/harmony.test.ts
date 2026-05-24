import { describe, expect, it } from "vitest";
import { chromaticSeedHues, harmonyHues, harmonyOffsets } from "./harmony.js";
import type { HarmonyType, Oklch } from "./types.js";

describe("harmony offsets", () => {
  it("complementary is 0 and 180", () => {
    expect(harmonyOffsets("complementary")).toEqual([0, 180]);
  });

  it("split-complementary is 0, 150, 210 (±30 around the complement)", () => {
    expect(harmonyOffsets("split-complementary")).toEqual([0, 150, 210]);
  });

  it("triadic is 0, 120, 240", () => {
    expect(harmonyOffsets("triadic")).toEqual([0, 120, 240]);
  });

  it("square is 0, 90, 180, 270", () => {
    expect(harmonyOffsets("square")).toEqual([0, 90, 180, 270]);
  });

  it("analogous uses the configured span", () => {
    expect(harmonyOffsets("analogous", { analogousSpan: 25 })).toEqual([
      0, 25, -25,
    ]);
  });

  it("monochromatic is a single hue", () => {
    expect(harmonyOffsets("monochromatic")).toEqual([0]);
  });
});

describe("harmonyHues", () => {
  it("applies offsets to the base hue and normalizes to [0,360)", () => {
    // base 200 complementary → 200, 20
    expect(harmonyHues(200, "complementary")).toEqual([200, 20]);
  });

  it("wraps negative analogous hues", () => {
    // base 10, analogous ±30 → 10, 40, 340
    expect(harmonyHues(10, "analogous")).toEqual([10, 40, 340]);
  });

  it("triadic hue angles are exactly 120 apart", () => {
    const hues = harmonyHues(30, "triadic");
    expect(hues).toEqual([30, 150, 270]);
    expect((hues[1] ?? 0) - (hues[0] ?? 0)).toBe(120);
    expect((hues[2] ?? 0) - (hues[1] ?? 0)).toBe(120);
  });
});

describe("chromaticSeedHues", () => {
  const base: Oklch = { l: 0.6, c: 0.15, h: 256 };

  it("monochromatic reuses the base hue for all three families", () => {
    const s = chromaticSeedHues(base, "monochromatic");
    expect(s).toEqual({ primary: 256, secondary: 256, accent: 256 });
  });

  it("complementary maps accent to the complement and synthesizes a secondary", () => {
    const s = chromaticSeedHues(base, "complementary");
    expect(s.primary).toBe(256);
    expect(s.accent).toBe((256 + 180) % 360);
    expect(s.secondary).toBe((256 + 30) % 360);
  });

  it("triadic maps the three hues directly", () => {
    const s = chromaticSeedHues(base, "triadic");
    expect(s.primary).toBe(256);
    expect(s.secondary).toBe((256 + 120) % 360);
    expect(s.accent).toBe((256 + 240) % 360);
  });

  const allHarmonies: HarmonyType[] = [
    "complementary",
    "split-complementary",
    "analogous",
    "monochromatic",
    "triadic",
    "tetradic",
    "square",
    "rectangular",
  ];

  it.each(allHarmonies)("produces in-range hues for %s", (harmony) => {
    const s = chromaticSeedHues(base, harmony);
    for (const hue of [s.primary, s.secondary, s.accent]) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
