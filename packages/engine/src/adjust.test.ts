import { describe, expect, it } from "vitest";
import { adjustColor } from "./adjust.js";
import type { Oklch } from "./types.js";

const base: Oklch = { l: 0.6, c: 0.12, h: 256 };

describe("adjustColor", () => {
  it("lighten increases OKLCH lightness", () => {
    const r = adjustColor({ color: base, intent: { lightness: "lighter", amount: 0.1 } });
    expect(r.after.oklch.l).toBeGreaterThan(base.l);
    expect(r.delta.l).toBeGreaterThan(0);
  });

  it("darken decreases OKLCH lightness", () => {
    const r = adjustColor({ color: base, intent: { lightness: "darker", amount: 0.1 } });
    expect(r.after.oklch.l).toBeLessThan(base.l);
    expect(r.delta.l).toBeLessThan(0);
  });

  it("more saturation increases chroma; less decreases it", () => {
    const more = adjustColor({ color: base, intent: { saturation: "more", amount: 0.5 } });
    const less = adjustColor({ color: base, intent: { saturation: "less", amount: 0.5 } });
    expect(more.after.oklch.c).toBeGreaterThan(base.c);
    expect(less.after.oklch.c).toBeLessThan(base.c);
  });

  const arcDist = (from: number, to: number): number => {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return Math.abs(d);
  };

  it("cooler reduces the angular distance to the cool anchor (~250)", () => {
    const warm: Oklch = { l: 0.6, c: 0.12, h: 30 };
    const r = adjustColor({ color: warm, intent: { temperature: "cooler", amount: 0.5 } });
    expect(arcDist(r.after.oklch.h, 250)).toBeLessThan(arcDist(warm.h, 250));
  });

  it("warmer reduces the angular distance to the warm anchor (~60)", () => {
    const cool: Oklch = { l: 0.6, c: 0.12, h: 256 };
    const r = adjustColor({ color: cool, intent: { temperature: "warmer", amount: 0.5 } });
    expect(arcDist(r.after.oklch.h, 60)).toBeLessThan(arcDist(cool.h, 60));
  });

  it("accepts a Swatch as input", () => {
    const r = adjustColor({
      color: { oklch: base, hex: "#000000", css: "", clamped: false },
      intent: { lightness: "lighter" },
    });
    expect(r.after.oklch.l).toBeGreaterThan(base.l);
  });

  it("defaults amount to 0.1", () => {
    const r = adjustColor({ color: base, intent: { lightness: "lighter" } });
    expect(r.after.oklch.l).toBeCloseTo(0.7, 5);
  });
});
