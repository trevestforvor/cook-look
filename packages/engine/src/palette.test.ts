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

  describe("shades harmony (single hue, descending value)", () => {
    const shades = generatePalette({ baseColor: "#3b82f6", harmony: "shades" });

    it("holds one hue across primary/secondary/accent", () => {
      const h = shades.light.roles.primary.oklch.h;
      expect(shades.light.roles.secondary.oklch.h).toBeCloseTo(h, 0);
      expect(shades.light.roles.accent.oklch.h).toBeCloseTo(h, 0);
    });

    it("steps families monotonically darker in light mode (adds black)", () => {
      const p = shades.light.roles.primary.oklch.l;
      const s = shades.light.roles.secondary.oklch.l;
      const a = shades.light.roles.accent.oklch.l;
      expect(p).toBeGreaterThan(s);
      expect(s).toBeGreaterThan(a);
    });

    it("does NOT fan chroma the way monochromatic does (shades holds chroma)", () => {
      // Monochromatic deliberately drops secondary chroma to ~0.5x; shades keeps
      // the same intended chroma across families (value carries the difference).
      const mono = generatePalette({
        baseColor: "#3b82f6",
        harmony: "monochromatic",
      });
      const shadesIntent = shades.seeds.chroma;
      const monoIntent = mono.seeds.chroma;
      expect(shadesIntent.secondary).toBeCloseTo(shadesIntent.primary, 2);
      expect(monoIntent.secondary).toBeLessThan(monoIntent.primary);
    });
  });

  // Signed offset in (−180, 180]; small (<1°) drift from gamut-mapping is normal.
  const signedOff = (h: number, base: number) =>
    (((h - base) % 360) + 540) % 360 - 180;

  it("compound seeds primary/secondary/accent at base, +30, +180", () => {
    const c = generatePalette({ baseColor: "#3b82f6", harmony: "compound" });
    const base = c.baseColor.h;
    expect(signedOff(c.light.roles.primary.oklch.h, base)).toBeCloseTo(0, 0);
    expect(signedOff(c.light.roles.secondary.oklch.h, base)).toBeCloseTo(30, 0);
    expect(signedOff(c.light.roles.accent.oklch.h, base)).toBeCloseTo(180, 0);
  });

  it("custom echoes the supplied angles in the realized hues", () => {
    const c = generatePalette({
      baseColor: "#3b82f6",
      harmony: "custom",
      options: { customAngles: [0, 40, 180, 210] },
    });
    const base = c.baseColor.h;
    expect(signedOff(c.light.roles.primary.oklch.h, base)).toBeCloseTo(0, 0);
    expect(signedOff(c.light.roles.secondary.oklch.h, base)).toBeCloseTo(40, 0);
    expect(signedOff(c.light.roles.accent.oklch.h, base)).toBeCloseTo(180, 0);
    // Recorded offsets are persisted for audit verification.
    expect(c.seeds.harmonyOffsets?.slice(0, 3)).toEqual([0, 40, 180]);
  });

  it("custom throws when no angles are provided", () => {
    expect(() =>
      generatePalette({ baseColor: "#3b82f6", harmony: "custom" }),
    ).toThrow(/at least one angle/);
  });

  it("double-split-complementary seeds primary/secondary/accent at base, +30, +150", () => {
    const c = generatePalette({
      baseColor: "#3b82f6",
      harmony: "double-split-complementary",
    });
    const base = c.baseColor.h;
    expect(signedOff(c.light.roles.primary.oklch.h, base)).toBeCloseTo(0, 0);
    expect(signedOff(c.light.roles.secondary.oklch.h, base)).toBeCloseTo(30, 0);
    expect(signedOff(c.light.roles.accent.oklch.h, base)).toBeCloseTo(150, 0);
  });
});

describe("expanded role set (M3 + Apple HIG, adapted to OKLCH)", () => {
  const EXTENDED_ROLES: Role[] = [
    "primary-container",
    "secondary-container",
    "accent-container",
    "surface-elevated",
    "background-elevated",
    "outline",
    "outline-variant",
    "foreground-secondary",
    "foreground-tertiary",
  ];

  const bases = ["#3b82f6", "#1f9d55", "#c1440e", "#7c3aed"];

  it("emits every expanded role (with a valid hex) in both modes", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    for (const role of EXTENDED_ROLES) {
      expect(p.light.roles[role]?.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.dark.roles[role]?.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("emits an on-color for each brand container", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    for (const role of [
      "primary-container",
      "secondary-container",
      "accent-container",
    ] as const) {
      expect(p.light.on[role]?.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.dark.on[role]?.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(bases)(
    "on-container text clears APCA body (Lc 75) on its container for %s",
    (base) => {
      const p = generatePalette({ baseColor: base, harmony: "triadic" });
      for (const theme of [p.light, p.dark]) {
        for (const role of [
          "primary-container",
          "secondary-container",
          "accent-container",
        ] as const) {
          const lc = Math.abs(apcaLc(theme.on[role], theme.roles[role]));
          expect(lc).toBeGreaterThanOrEqual(75);
        }
      }
    },
  );

  it.each(bases)(
    "foreground-secondary clears APCA large-text (Lc 60) on background + surface for %s",
    (base) => {
      const p = generatePalette({ baseColor: base, harmony: "triadic" });
      for (const theme of [p.light, p.dark]) {
        const onBg = Math.abs(
          apcaLc(theme.roles["foreground-secondary"], theme.roles.background),
        );
        const onSurface = Math.abs(
          apcaLc(theme.roles["foreground-secondary"], theme.roles.surface),
        );
        expect(onBg).toBeGreaterThanOrEqual(60);
        expect(onSurface).toBeGreaterThanOrEqual(60);
      }
    },
  );

  it.each(bases)(
    "foreground-tertiary and outline clear the APCA non-text bar (Lc 45) on background for %s",
    (base) => {
      const p = generatePalette({ baseColor: base, harmony: "triadic" });
      for (const theme of [p.light, p.dark]) {
        expect(
          Math.abs(
            apcaLc(theme.roles["foreground-tertiary"], theme.roles.background),
          ),
        ).toBeGreaterThanOrEqual(45);
        expect(
          Math.abs(apcaLc(theme.roles.outline, theme.roles.background)),
        ).toBeGreaterThanOrEqual(45);
      }
    },
  );

  it("orders the foreground emphasis tiers (primary > secondary > tertiary contrast)", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    for (const theme of [p.light, p.dark]) {
      const bg = theme.roles.background;
      const fg = Math.abs(apcaLc(theme.roles.foreground, bg));
      const sec = Math.abs(apcaLc(theme.roles["foreground-secondary"], bg));
      const ter = Math.abs(apcaLc(theme.roles["foreground-tertiary"], bg));
      expect(fg).toBeGreaterThan(sec);
      expect(sec).toBeGreaterThan(ter);
    }
  });

  it("elevates surface-elevated above surface in dark mode", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    expect(p.dark.roles["surface-elevated"].oklch.l).toBeGreaterThan(
      p.dark.roles.surface.oklch.l,
    );
    // In light mode it sits at/above background lightness (the lightest neutral).
    expect(p.light.roles["surface-elevated"].oklch.l).toBeGreaterThanOrEqual(
      p.light.roles.surface.oklch.l,
    );
  });

  it("elevates background-elevated above background in dark mode", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    expect(p.dark.roles["background-elevated"].oklch.l).toBeGreaterThan(
      p.dark.roles.background.oklch.l,
    );
  });

  it("places containers near the light/dark ends of their family ramp", () => {
    const p = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    // Light container is high-lightness; dark container is low-lightness.
    expect(p.light.roles["primary-container"].oklch.l).toBeGreaterThan(0.8);
    expect(p.dark.roles["primary-container"].oklch.l).toBeLessThan(0.4);
  });
});

describe("neutralChroma option", () => {
  it("tints the neutral ramp by the requested chroma", () => {
    const tinted = generatePalette({
      baseColor: "#3b82f6",
      harmony: "triadic",
      options: { neutralChroma: 0.05 },
    });
    const plain = generatePalette({
      baseColor: "#3b82f6",
      harmony: "triadic",
      options: { neutralChroma: 0 },
    });
    expect(tinted.seeds.chroma.neutral).toBeCloseTo(0.05, 5);
    expect(plain.seeds.chroma.neutral).toBeCloseTo(0, 5);
    // The realized neutral ramp mid-step carries more chroma when tinted.
    expect(tinted.light.ramps.neutral.steps[500].oklch.c).toBeGreaterThan(
      plain.light.ramps.neutral.steps[500].oklch.c,
    );
  });
});
