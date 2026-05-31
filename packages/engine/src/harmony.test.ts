import { describe, expect, it } from "vitest";
import {
  chromaticSeedHues,
  harmonyHues,
  harmonyKind,
  harmonyOffsets,
  normalizeCustomAngles,
} from "./harmony.js";
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

  it("compound is analogous + complementary (0, 30, 180, 210)", () => {
    expect(harmonyOffsets("compound")).toEqual([0, 30, 180, 210]);
  });

  it("double-split-complementary orders the chromatic triple first (0, 30, 150, -30, 210)", () => {
    expect(harmonyOffsets("double-split-complementary")).toEqual([
      0, 30, 150, -30, 210,
    ]);
  });

  it("double-split-complementary maps primary/secondary/accent to 0/+30/+150", () => {
    const base: Oklch = { l: 0.6, c: 0.15, h: 0 };
    const { primary, secondary, accent } = chromaticSeedHues(
      base,
      "double-split-complementary",
    );
    expect(primary).toBeCloseTo(0, 5);
    expect(secondary).toBeCloseTo(30, 5);
    expect(accent).toBeCloseTo(150, 5);
  });

  it("shades is a single hue (degenerate offset list)", () => {
    expect(harmonyOffsets("shades")).toEqual([0]);
  });

  it("custom echoes the provided angles (anchored at 0)", () => {
    expect(harmonyOffsets("custom", { customAngles: [0, 40, 180, 210] })).toEqual([
      0, 40, 180, 210,
    ]);
  });

  it("custom prepends the base (0) when the caller omits it", () => {
    expect(harmonyOffsets("custom", { customAngles: [40, 180] })).toEqual([
      0, 40, 180,
    ]);
  });

  it("custom throws when no angles are supplied", () => {
    expect(() => harmonyOffsets("custom")).toThrow(/at least one angle/);
  });
});

describe("harmonyKind", () => {
  it("classifies shades as single-hue", () => {
    expect(harmonyKind("shades")).toBe("single-hue");
  });

  it("classifies hue-rotating harmonies as hue-offsets", () => {
    for (const h of ["complementary", "compound", "custom", "monochromatic"] as const) {
      expect(harmonyKind(h)).toBe("hue-offsets");
    }
  });
});

describe("normalizeCustomAngles", () => {
  it("rejects empty input", () => {
    expect(() => normalizeCustomAngles([])).toThrow(/at least one angle/);
    expect(() => normalizeCustomAngles(undefined)).toThrow(/at least one angle/);
  });

  it("rejects non-finite numbers", () => {
    expect(() => normalizeCustomAngles([0, Number.NaN])).toThrow(/finite/);
  });

  it("rejects more than 12 angles", () => {
    expect(() => normalizeCustomAngles(Array(13).fill(0))).toThrow(/at most 12/);
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

  it("compound maps primary/secondary/accent to 0, +30, +180", () => {
    const s = chromaticSeedHues(base, "compound");
    expect(s.primary).toBe(256);
    expect(s.secondary).toBe((256 + 30) % 360);
    expect(s.accent).toBe((256 + 180) % 360);
  });

  it("shades reuses the base hue for all three families (single-hue)", () => {
    const s = chromaticSeedHues(base, "shades");
    expect(s).toEqual({ primary: 256, secondary: 256, accent: 256 });
  });

  it("custom maps the first three provided angles to the families", () => {
    const s = chromaticSeedHues(base, "custom", {
      customAngles: [0, 40, 180, 210],
    });
    expect(s.primary).toBe(256);
    expect(s.secondary).toBe((256 + 40) % 360);
    expect(s.accent).toBe((256 + 180) % 360);
  });

  // Harmonies that don't require extra options.
  const allHarmonies: HarmonyType[] = [
    "complementary",
    "split-complementary",
    "analogous",
    "monochromatic",
    "triadic",
    "tetradic",
    "square",
    "rectangular",
    "compound",
    "shades",
  ];

  it.each(allHarmonies)("produces in-range hues for %s", (harmony) => {
    const s = chromaticSeedHues(base, harmony);
    for (const hue of [s.primary, s.secondary, s.accent]) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("produces in-range hues for custom", () => {
    const s = chromaticSeedHues(base, "custom", { customAngles: [0, 95, 250] });
    for (const hue of [s.primary, s.secondary, s.accent]) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
