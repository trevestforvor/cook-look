import { describe, expect, it } from "vitest";
import { deriveDarkMode, deriveLightMode } from "./darkmode.js";
import { generatePalette } from "./palette.js";

describe("deriveDarkMode / deriveLightMode", () => {
  const palette = generatePalette({
    baseColor: "#1f9d55",
    harmony: "analogous",
  });

  it("derives a dark theme coherent with the engine's own dark mode", () => {
    const derived = deriveDarkMode({ lightPalette: palette.light });
    expect(derived.mode).toBe("dark");
    // Same hue family as the light primary.
    expect(
      Math.abs(derived.roles.primary.oklch.h - palette.light.roles.primary.oklch.h),
    ).toBeLessThan(2);
    // Dark background is dark.
    expect(derived.roles.background.oklch.l).toBeLessThan(0.3);
  });

  it("derived dark matches generatePalette's dark mode (same seeds)", () => {
    const derived = deriveDarkMode({ lightPalette: palette.light });
    expect(derived.roles.primary.hex).toBe(palette.dark.roles.primary.hex);
    expect(derived.roles.background.hex).toBe(palette.dark.roles.background.hex);
  });

  it("round-trips light → dark → light preserving hue", () => {
    const dark = deriveDarkMode({ lightPalette: palette.light });
    const backToLight = deriveLightMode({ darkPalette: dark });
    expect(backToLight.mode).toBe("light");
    expect(
      Math.abs(
        backToLight.roles.primary.oklch.h - palette.light.roles.primary.oklch.h,
      ),
    ).toBeLessThan(2);
    expect(backToLight.roles.background.oklch.l).toBeGreaterThan(0.9);
  });
});
