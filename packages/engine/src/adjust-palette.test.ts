import { describe, expect, it } from "vitest";
import { adjustPalette } from "./adjust.js";
import { generatePalette } from "./palette.js";
import type { RampRole, Role } from "./types.js";

// Typed as RampRole so they can index seeds.chroma (Record<RampRole, number>)
// as well as the role swatch maps.
const BRAND: RampRole[] = ["primary", "secondary", "accent"];
const SEMANTIC: RampRole[] = ["success", "warning", "danger"];

function mk() {
  // A mid-lightness base whose families sit inside the sRGB gamut, so a chroma
  // increase resolves to a different color (a very light/vivid base can already
  // be gamut-pinned, where "more saturated" is legitimately a no-op).
  return generatePalette({ baseColor: { l: 0.6, c: 0.12, h: 280 }, harmony: "triadic" });
}

/** How many of the given roles changed hex between two palettes (light mode). */
function changedCount(a: ReturnType<typeof mk>, b: ReturnType<typeof mk>, roles: Role[]) {
  return roles.filter((r) => a.light.roles[r].hex !== b.light.roles[r].hex).length;
}

describe("adjustPalette", () => {
  it("'more saturation' raises chroma for ALL brand families, not just one", () => {
    const p0 = mk();
    const p1 = adjustPalette({ palette: p0, intent: { saturation: "more", amount: 0.3 } });
    // The original bug: base-only adjust touched 0–1 brand roles. Seed chroma is
    // the gamut-independent truth — every brand family must increase.
    for (const r of BRAND) {
      expect(p1.seeds.chroma[r]).toBeGreaterThan(p0.seeds.chroma[r]);
    }
    // And the resolved colors actually change for this in-gamut base.
    expect(changedCount(p0, p1, BRAND)).toBe(3);
  });

  it("'lighter' moves all brand families", () => {
    const p0 = mk();
    const p1 = adjustPalette({ palette: p0, intent: { lightness: "lighter", amount: 0.2 } });
    expect(changedCount(p0, p1, BRAND)).toBe(3);
  });

  it("'warmer' shifts brand AND semantic family hues", () => {
    const p0 = mk();
    const p1 = adjustPalette({ palette: p0, intent: { temperature: "warmer", amount: 0.3 } });
    expect(changedCount(p0, p1, BRAND)).toBe(3);
    expect(changedCount(p0, p1, SEMANTIC)).toBeGreaterThan(0);
  });

  it("compounds: two 'more' clicks are more saturated than one", () => {
    const p0 = mk();
    const p1 = adjustPalette({ palette: p0, intent: { saturation: "more", amount: 0.2 } });
    const p2 = adjustPalette({ palette: p1, intent: { saturation: "more", amount: 0.2 } });
    expect(p2.seeds.chroma.primary).toBeGreaterThan(p1.seeds.chroma.primary);
    expect(p1.seeds.chroma.primary).toBeGreaterThan(p0.seeds.chroma.primary);
  });

  it("keeps the palette in gamut (resolved hex on every brand role)", () => {
    const p1 = adjustPalette({
      palette: mk(),
      intent: { saturation: "more", amount: 0.9 },
    });
    for (const r of BRAND) {
      expect(p1.light.roles[r].hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("clamps lightness to a usable band — primary never becomes pure white/black", () => {
    const p0 = mk();
    // Extreme lighten then extreme darken; primary must stay off the rails so it
    // can always move back (white can't get lighter, etc.).
    const lighter = adjustPalette({ palette: p0, intent: { lightness: "lighter", amount: 1 } });
    const darker = adjustPalette({ palette: p0, intent: { lightness: "darker", amount: 1 } });
    expect(lighter.seeds.base.l).toBeLessThanOrEqual(0.92);
    expect(lighter.light.roles.primary.hex).not.toBe("#ffffff");
    expect(darker.seeds.base.l).toBeGreaterThanOrEqual(0.2);
    expect(darker.light.roles.primary.hex).not.toBe("#000000");
  });

  it("'more saturation' visibly moves a gamut-capped family via a cusp shift", () => {
    // Vivid Violet 305 triadic: secondary (amber) + accent (teal) render at the
    // shared brand lightness where they're already at the sRGB ceiling, so a
    // chroma bump alone is invisible. The cusp lightness-shift must make them
    // actually change, and record a per-family lightness OFFSET.
    const p0 = generatePalette({
      baseColor: { l: 0.648, c: 0.23, h: 305 },
      harmony: "triadic",
    });
    const p1 = adjustPalette({ palette: p0, intent: { saturation: "more", amount: 0.4 } });
    expect(p1.light.roles.secondary.hex).not.toBe(p0.light.roles.secondary.hex);
    expect(p1.light.roles.accent.hex).not.toBe(p0.light.roles.accent.hex);
    expect(p1.seeds.mainLOffset).toBeDefined();
  });

  it("'less saturation' drops any per-family lightness offset (rejoins cohesion)", () => {
    const p0 = generatePalette({
      baseColor: { l: 0.648, c: 0.23, h: 305 },
      harmony: "triadic",
    });
    const vivid = adjustPalette({ palette: p0, intent: { saturation: "more", amount: 0.4 } });
    expect(vivid.seeds.mainLOffset).toBeDefined();
    const muted = adjustPalette({ palette: vivid, intent: { saturation: "less", amount: 0.4 } });
    expect(muted.seeds.mainLOffset).toBeUndefined();
  });

  it("lightness axis moves secondary/accent EVEN when vibrant set a cusp offset", () => {
    // The interaction bug: a vibrant cusp shift used to pin secondary/accent to
    // an absolute lightness, so the lightness axis then only moved primary. With
    // an OFFSET that composes with base L, all three must respond to lightness.
    const p0 = generatePalette({
      baseColor: { l: 0.648, c: 0.23, h: 305 },
      harmony: "triadic",
    });
    const vivid = adjustPalette({ palette: p0, intent: { saturation: "more", amount: 0.6 } });
    const darker = adjustPalette({ palette: vivid, intent: { lightness: "darker", amount: 0.3 } });
    for (const r of ["primary", "secondary", "accent"] as const) {
      expect(darker.light.roles[r].hex).not.toBe(vivid.light.roles[r].hex);
    }
  });
});
