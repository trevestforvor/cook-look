import { describe, expect, it } from "vitest";
import { auditHarmonyFit } from "./audit.js";
import { oklch, resolveSwatch } from "./color.js";
import type { Palette, Role, Swatch } from "./types.js";

/** Build a real engine Swatch from OKLCH coords (so .oklch/.hex/.css are valid). */
function sw(l: number, c: number, h: number): Swatch {
  return resolveSwatch(oklch(l, c, h));
}

/**
 * Minimal palette whose `light.roles` carry the chromatic brand roles plus
 * representative neutrals/status. auditHarmonyFit only reads `light.roles`, so a
 * partial-but-typed roles map is sufficient for these tests.
 */
function mkPalette(roles: Partial<Record<Role, Swatch>>): Palette {
  const base: Record<Role, Swatch> = {
    primary: sw(0.6, 0.12, 250),
    secondary: sw(0.62, 0.12, 235),
    accent: sw(0.61, 0.13, 270),
    neutral: sw(0.5, 0.01, 250),
    background: sw(0.98, 0.005, 250),
    surface: sw(0.95, 0.005, 250),
    foreground: sw(0.2, 0.01, 250),
    success: sw(0.6, 0.15, 150),
    warning: sw(0.7, 0.15, 70),
    danger: sw(0.55, 0.18, 27),
    "primary-container": sw(0.9, 0.05, 250),
    "secondary-container": sw(0.9, 0.05, 235),
    "accent-container": sw(0.9, 0.05, 270),
    "surface-elevated": sw(0.97, 0.005, 250),
    "background-elevated": sw(0.96, 0.005, 250),
    outline: sw(0.52, 0.02, 250),
    "outline-variant": sw(0.8, 0.02, 250),
    "foreground-secondary": sw(0.42, 0.02, 250),
    "foreground-tertiary": sw(0.5, 0.01, 250),
    ...roles,
  };
  // Only `light.roles` is consulted; cast the rest of the palette shape.
  return {
    light: { roles: base },
  } as unknown as Palette;
}

describe("auditHarmonyFit", () => {
  it("flags an obvious lightness outlier", () => {
    // primary L 0.6, secondary L 0.62, accent driven very dark to L 0.2.
    // mean L = (0.6 + 0.62 + 0.2) / 3 ≈ 0.4733; accent dL ≈ 0.273 > 0.18.
    const palette = mkPalette({ accent: sw(0.2, 0.13, 270) });
    const { outliers } = auditHarmonyFit({ palette });

    expect(outliers).toHaveLength(1);
    const outlier = outliers[0]!;
    expect(outlier.role).toBe("accent");
    expect(outlier.dimension).toBe("lightness");
    expect(outlier.reason).toBe("sits darker than the rest");

    // Suggested lightness pulls toward the centroid (lighter than the current,
    // and closer to the mean than the current was).
    expect(outlier.suggested.oklch.l).toBeGreaterThan(outlier.current.oklch.l);
    const meanL = 0.4733;
    expect(Math.abs(outlier.suggested.oklch.l - meanL)).toBeLessThan(
      Math.abs(outlier.current.oklch.l - meanL),
    );
    expect(outlier.suggested.oklch.l).toBeCloseTo(meanL, 2);

    // The engine resolved a real hex for the suggestion.
    expect(outlier.suggested.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns zero outliers for a balanced palette", () => {
    const { outliers } = auditHarmonyFit({ palette: mkPalette({}) });
    expect(outliers).toHaveLength(0);
  });
});
