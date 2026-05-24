import { describe, expect, it } from "vitest";
import { apcaLc, wcagRatio } from "./accessibility.js";
import { fixContrast } from "./contrast-fix.js";
import { oklch, resolveSwatch } from "./color.js";
import { generatePalette } from "./palette.js";
import type { Palette } from "./types.js";

/** Build a palette and force a low-contrast foreground to exercise the fixer. */
function paletteWithWeakForeground(): Palette {
  const p = generatePalette({ baseColor: "#3b82f6", harmony: "complementary" });
  // Mid-gray text on a light background → fails APCA body.
  const weak = resolveSwatch(oklch(0.62, 0.01, 256));
  return {
    ...p,
    light: { ...p.light, roles: { ...p.light.roles, foreground: weak } },
  };
}

describe("fixContrast", () => {
  it("makes body text clear APCA Lc 75 and reports the change", () => {
    const broken = paletteWithWeakForeground();
    const before = Math.abs(
      apcaLc(broken.light.roles.foreground, broken.light.roles.background),
    );
    expect(before).toBeLessThan(75);

    const { palette, changes } = fixContrast({ palette: broken });

    const after = Math.abs(
      apcaLc(palette.light.roles.foreground, palette.light.roles.background),
    );
    expect(after).toBeGreaterThanOrEqual(75);

    const fgChange = changes.find((c) => c.label.includes("foreground"));
    expect(fgChange).toBeDefined();
    expect(fgChange!.after).toBeGreaterThan(fgChange!.before);
    expect(fgChange!.reason).toMatch(/OKLCH/);
  });

  it("preserves foreground hue while only nudging lightness", () => {
    const broken = paletteWithWeakForeground();
    const beforeHue = broken.light.roles.foreground.oklch.h;
    const { palette } = fixContrast({ palette: broken });
    expect(Math.abs(palette.light.roles.foreground.oklch.h - beforeHue)).toBeLessThan(2);
  });

  it("can target WCAG AA instead of APCA", () => {
    const broken = paletteWithWeakForeground();
    const { palette } = fixContrast({
      palette: broken,
      target: { model: "wcag", use: "body", level: "AA" },
    });
    expect(
      wcagRatio(palette.light.roles.foreground, palette.light.roles.background),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("is a no-op (no changes) for an already-accessible palette", () => {
    const good = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    const { changes } = fixContrast({ palette: good });
    const fgChanges = changes.filter((c) => c.label.includes("foreground"));
    expect(fgChanges).toHaveLength(0);
  });
});
