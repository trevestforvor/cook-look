import { describe, expect, it } from "vitest";
import { generatePalette } from "./palette.js";
import { recolor } from "./recolor.js";

describe("recolor", () => {
  const original = generatePalette({ baseColor: "#3b82f6", harmony: "complementary" });

  it("changes the harmony while preserving role structure", () => {
    const recolored = recolor({ palette: original, newHarmony: "triadic" });
    expect(recolored.harmony).toBe("triadic");
    // Same set of roles still present.
    expect(Object.keys(recolored.light.roles).sort()).toEqual(
      Object.keys(original.light.roles).sort(),
    );
    // Triadic accent differs from complementary accent.
    expect(recolored.light.roles.accent.oklch.h).not.toBeCloseTo(
      original.light.roles.accent.oklch.h,
      0,
    );
  });

  it("changes the base color and shifts the primary hue", () => {
    const recolored = recolor({ palette: original, newBase: "#e11d48" });
    expect(recolored.light.roles.primary.oklch.h).not.toBeCloseTo(
      original.light.roles.primary.oklch.h,
      0,
    );
  });

  it("preserves the primary chroma intent", () => {
    const recolored = recolor({ palette: original, newHarmony: "analogous" });
    expect(recolored.seeds.chroma.primary).toBeCloseTo(
      original.seeds.chroma.primary,
      3,
    );
  });

  it("keeps conventional semantic hues", () => {
    const recolored = recolor({ palette: original, newBase: "#e11d48" });
    expect(recolored.seeds.hues.success).toBe(150);
    expect(recolored.seeds.hues.danger).toBe(27);
  });
});
