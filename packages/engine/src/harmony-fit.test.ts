import { describe, expect, it } from "vitest";
import { auditHarmonyFit } from "./audit.js";
import { oklch, resolveSwatch } from "./color.js";
import type { Oklch, Palette, Role, Swatch } from "./types.js";

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
  it("flags an obvious lightness outlier and snaps toward the MEDIAN (not mean)", () => {
    // primary L 0.6, secondary L 0.62, accent driven dark to L 0.2.
    // median L of {0.6, 0.62, 0.2} = 0.6 (robust — the outlier doesn't move it).
    const palette = mkPalette({ accent: sw(0.2, 0.13, 270) });
    const { outliers } = auditHarmonyFit({ palette });

    expect(outliers).toHaveLength(1);
    const outlier = outliers[0]!;
    expect(outlier.role).toBe("accent");
    expect(outlier.dimension).toBe("lightness");
    expect(outlier.reason).toBe("sits darker than the rest");

    // Suggested lightness pulls UP toward the median (0.6), not the mean (~0.47).
    expect(outlier.suggested.oklch.l).toBeGreaterThan(outlier.current.oklch.l);
    expect(outlier.suggested.oklch.l).toBeCloseTo(0.6, 2);

    // The engine resolved a real hex for the suggestion.
    expect(outlier.suggested.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns zero outliers for a balanced palette", () => {
    const { outliers } = auditHarmonyFit({ palette: mkPalette({}) });
    expect(outliers).toHaveLength(0);
  });

  it("is adaptive: a drift that flags in a tight palette is tolerated in a loose one", () => {
    // Tight palette (L all ~0.60) — a 0.10 lift on accent should flag.
    const tight = mkPalette({
      primary: sw(0.6, 0.12, 250),
      secondary: sw(0.6, 0.12, 235),
      accent: sw(0.7, 0.13, 270),
    });
    expect(auditHarmonyFit({ palette: tight }).outliers.length).toBeGreaterThan(
      0,
    );

    // Loose palette (L spans 0.55..0.75, median 0.65) — accent at 0.70 sits
    // within the palette's own spread and should NOT be flagged, even though the
    // identical absolute lift flagged it in the tight palette above.
    const loose = mkPalette({
      primary: sw(0.55, 0.12, 250),
      secondary: sw(0.65, 0.12, 235),
      accent: sw(0.7, 0.13, 270),
    });
    const accentFlagged = auditHarmonyFit({ palette: loose }).outliers.some(
      (o) => o.role === "accent",
    );
    expect(accentFlagged).toBe(false);
  });

  it("does not flag a deliberate wide-hue (triadic-style) spread", () => {
    // Hues 250 / 130 / 10 — spread ~120°, above HUE_SPREAD_MAX (90). Intentional
    // multi-hue harmony, so no hue outlier should be reported.
    const triadic = mkPalette({
      primary: sw(0.6, 0.13, 250),
      secondary: sw(0.6, 0.13, 130),
      accent: sw(0.6, 0.13, 10),
    });
    const hueOutliers = auditHarmonyFit({ palette: triadic }).outliers.filter(
      (o) => o.dimension === "hue",
    );
    expect(hueOutliers).toHaveLength(0);
  });

  it("snaps toward locked colors' median with a partial blend when colors are locked", () => {
    // primary + secondary locked near L 0.50; accent drifts dark to 0.20.
    const palette = mkPalette({
      primary: sw(0.5, 0.12, 250),
      secondary: sw(0.5, 0.12, 235),
      accent: sw(0.2, 0.13, 270),
    });
    const locked: Oklch[] = [oklch(0.5, 0.12, 250), oklch(0.5, 0.12, 235)];
    const { outliers } = auditHarmonyFit({ palette, locked });
    const accent = outliers.find((o) => o.role === "accent");
    expect(accent).toBeDefined();
    expect(accent!.dimension).toBe("lightness");

    // Target = locked median L (0.5); accent is unlocked, so it's a 60% blend:
    // 0.20 + (0.50 - 0.20) * 0.6 = 0.38.
    expect(accent!.suggested.oklch.l).toBeCloseTo(0.38, 2);
  });

  it("clamps suggested lightness away from pure black/white", () => {
    // Drag two roles extremely dark so the median target itself is very low,
    // and confirm any suggestion respects the [0.05, 0.95] clamp.
    const palette = mkPalette({
      primary: sw(0.02, 0.12, 250),
      secondary: sw(0.03, 0.12, 235),
      accent: sw(0.6, 0.13, 270),
    });
    for (const o of auditHarmonyFit({ palette }).outliers) {
      expect(o.suggested.oklch.l).toBeGreaterThanOrEqual(0.05);
      expect(o.suggested.oklch.l).toBeLessThanOrEqual(0.95);
    }
  });
});
