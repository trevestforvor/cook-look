import { describe, expect, it } from "vitest";
import { apcaLc } from "./accessibility.js";
import { generatePalette } from "./palette.js";
import { RAMP_STEPS, type HarmonyType, type Role } from "./types.js";

const ALL_ROLES: Role[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "background",
  "surface",
  "foreground",
  "success",
  "warning",
  "danger",
];

describe("generatePalette", () => {
  const palette = generatePalette({
    baseColor: "#3b82f6",
    harmony: "complementary",
  });

  it("accepts a CSS string base color", () => {
    expect(palette.baseColor.h).toBeGreaterThan(0);
    expect(palette.harmony).toBe("complementary");
  });

  it("emits every semantic role in both modes", () => {
    for (const role of ALL_ROLES) {
      expect(palette.light.roles[role]).toBeDefined();
      expect(palette.dark.roles[role]).toBeDefined();
      expect(palette.light.roles[role].hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("ships full tonal ramps for chromatic + neutral roles", () => {
    for (const role of ["primary", "secondary", "accent", "neutral"] as const) {
      expect(Object.keys(palette.light.ramps[role].steps)).toHaveLength(
        RAMP_STEPS.length,
      );
    }
  });

  it("throws on an unparseable base color", () => {
    expect(() =>
      generatePalette({ baseColor: "nonsense", harmony: "triadic" }),
    ).toThrow();
  });

  describe("light/dark coherence (a derived pair, not an inversion)", () => {
    it("shares the primary hue across modes", () => {
      expect(
        Math.abs(
          palette.light.roles.primary.oklch.h -
            palette.dark.roles.primary.oklch.h,
        ),
      ).toBeLessThan(2);
    });

    it("light background is light and dark background is dark", () => {
      expect(palette.light.roles.background.oklch.l).toBeGreaterThan(0.9);
      expect(palette.dark.roles.background.oklch.l).toBeLessThan(0.3);
    });

    it("lifts surface above background in dark mode", () => {
      expect(palette.dark.roles.surface.oklch.l).toBeGreaterThan(
        palette.dark.roles.background.oklch.l,
      );
    });

    it("dark-mode primary is lighter than light-mode primary", () => {
      expect(palette.dark.roles.primary.oklch.l).toBeGreaterThan(
        palette.light.roles.primary.oklch.l,
      );
    });
  });

  describe("on-colors and body text contrast (APCA)", () => {
    const harmonies: HarmonyType[] = [
      "complementary",
      "analogous",
      "triadic",
      "monochromatic",
      "square",
    ];

    it.each(harmonies)(
      "body text clears APCA Lc 75 on background and surface for %s",
      (harmony) => {
        const p = generatePalette({ baseColor: "#2f80ed", harmony });
        for (const theme of [p.light, p.dark]) {
          expect(
            Math.abs(apcaLc(theme.roles.foreground, theme.roles.background)),
          ).toBeGreaterThanOrEqual(75);
          expect(
            Math.abs(apcaLc(theme.roles.foreground, theme.roles.surface)),
          ).toBeGreaterThanOrEqual(75);
        }
      },
    );

    it("on-colors give meaningful contrast against their role", () => {
      for (const role of ["primary", "secondary", "accent"] as const) {
        const lc = Math.abs(
          apcaLc(palette.light.on[role], palette.light.roles[role]),
        );
        expect(lc).toBeGreaterThan(45);
      }
    });
  });

  it("monochromatic differentiates families by chroma", () => {
    const mono = generatePalette({
      baseColor: "#2f80ed",
      harmony: "monochromatic",
    });
    expect(mono.light.roles.primary.oklch.h).toBeCloseTo(
      mono.light.roles.secondary.oklch.h,
      0,
    );
    expect(mono.light.roles.secondary.oklch.c).toBeLessThan(
      mono.light.roles.primary.oklch.c,
    );
  });
});
