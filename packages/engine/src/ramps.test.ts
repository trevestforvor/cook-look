import { describe, expect, it } from "vitest";
import { isInGamut } from "./color.js";
import { buildNeutralRamp, buildRamp, rampLightness } from "./ramps.js";
import { RAMP_STEPS } from "./types.js";

describe("buildRamp", () => {
  const ramp = buildRamp(256, 0.16);

  it("has all 11 steps", () => {
    expect(Object.keys(ramp.steps)).toHaveLength(11);
  });

  it("lightness decreases monotonically from 50 → 950", () => {
    let prev = Infinity;
    for (const step of RAMP_STEPS) {
      const l = ramp.steps[step].oklch.l;
      expect(l).toBeLessThan(prev);
      prev = l;
    }
  });

  it("every step is in sRGB gamut (ramp hugs the boundary)", () => {
    for (const step of RAMP_STEPS) {
      expect(isInGamut(ramp.steps[step].oklch)).toBe(true);
    }
  });

  it("flags steps whose intended chroma the gamut compressed", () => {
    // buildRamp now reports honest clamping: where the intended chroma
    // (chroma * envelope) exceeds what the gamut allows at that lightness/hue,
    // the realized swatch is reduced and `clamped` is true. The hue 256 / 0.16
    // ramp pushes its mid tones past the blue gamut boundary, so at least one
    // step is legitimately clamped while every step stays in gamut.
    const anyClamped = RAMP_STEPS.some((step) => ramp.steps[step].clamped);
    expect(anyClamped).toBe(true);
  });

  it("peak chroma sits in the mid tones, not the extremes", () => {
    const c50 = ramp.steps[50].oklch.c;
    const c500 = ramp.steps[500].oklch.c;
    const c950 = ramp.steps[950].oklch.c;
    expect(c500).toBeGreaterThan(c50);
    expect(c500).toBeGreaterThan(c950);
  });

  it("preserves the hue across all steps (within rounding)", () => {
    for (const step of RAMP_STEPS) {
      const c = ramp.steps[step].oklch.c;
      if (c > 0.001) {
        expect(Math.abs(ramp.steps[step].oklch.h - 256)).toBeLessThan(2);
      }
    }
  });
});

describe("buildNeutralRamp", () => {
  it("keeps chroma very low at every step", () => {
    const ramp = buildNeutralRamp(256, 0.01);
    for (const step of RAMP_STEPS) {
      expect(ramp.steps[step].oklch.c).toBeLessThanOrEqual(0.012);
    }
  });
});

describe("rampLightness", () => {
  it("exposes the perceptual targets", () => {
    expect(rampLightness(50)).toBeGreaterThan(0.95);
    expect(rampLightness(950)).toBeLessThan(0.3);
    expect(rampLightness(500)).toBeGreaterThan(rampLightness(600));
  });
});
