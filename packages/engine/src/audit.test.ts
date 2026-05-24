import { describe, expect, it } from "vitest";
import { auditPalette } from "./audit.js";
import { generatePalette } from "./palette.js";
import type { HarmonyType } from "./types.js";

describe("auditPalette", () => {
  const palette = generatePalette({ baseColor: "#2f80ed", harmony: "triadic" });
  const report = auditPalette({ palette });

  it("reports both modes with contrast pairs", () => {
    expect(report.light.mode).toBe("light");
    expect(report.dark.mode).toBe("dark");
    expect(report.light.pairs.length).toBeGreaterThan(5);
    for (const pair of report.light.pairs) {
      expect(typeof pair.apcaLc).toBe("number");
      expect(pair.wcagRatio).toBeGreaterThanOrEqual(1);
    }
  });

  it("confirms body text passes APCA in both modes", () => {
    expect(report.passesBodyApca).toBe(true);
  });

  it("verifies the realized harmony matches the intended one", () => {
    expect(report.harmony.harmony).toBe("triadic");
    expect(report.harmony.ok).toBe(true);
    expect(report.harmony.expectedOffsets).toEqual([0, 120, 240]);
  });

  const harmonies: HarmonyType[] = [
    "complementary",
    "split-complementary",
    "analogous",
    "triadic",
    "tetradic",
    "square",
    "rectangular",
  ];

  it.each(harmonies)("harmony audit passes for %s", (harmony) => {
    const p = generatePalette({ baseColor: "#c1440e", harmony });
    expect(auditPalette({ palette: p }).harmony.ok).toBe(true);
  });

  it("compound harmony verifies against its expected offsets", () => {
    const p = generatePalette({ baseColor: "#c1440e", harmony: "compound" });
    const h = auditPalette({ palette: p }).harmony;
    expect(h.singleHue).toBe(false);
    expect(h.ok).toBe(true);
    expect(h.expectedOffsets).toEqual([0, 30, 180]);
  });

  it("shades harmony reports single-hue (offset check N/A) without failing", () => {
    const p = generatePalette({ baseColor: "#c1440e", harmony: "shades" });
    const h = auditPalette({ palette: p }).harmony;
    expect(h.singleHue).toBe(true);
    expect(h.ok).toBe(true);
    expect(h.expectedOffsets).toEqual([]);
  });

  it("custom harmony verifies the realized hues against the supplied angles", () => {
    const p = generatePalette({
      baseColor: "#c1440e",
      harmony: "custom",
      options: { customAngles: [0, 40, 180, 210] },
    });
    const h = auditPalette({ palette: p }).harmony;
    expect(h.singleHue).toBe(false);
    expect(h.expectedOffsets).toEqual([0, 40, 180]);
    expect(h.ok).toBe(true);
  });

  it("auditing shades and custom does not throw", () => {
    const shades = generatePalette({ baseColor: "#2f80ed", harmony: "shades" });
    const custom = generatePalette({
      baseColor: "#2f80ed",
      harmony: "custom",
      options: { customAngles: [0, 90, 270] },
    });
    expect(() => auditPalette({ palette: shades })).not.toThrow();
    expect(() => auditPalette({ palette: custom })).not.toThrow();
  });

  it("lists gamut-clamped swatches (none expected for in-gamut ramps)", () => {
    expect(Array.isArray(report.light.clamped)).toBe(true);
  });

  it("double-split-complementary verifies against its expected offsets (0, 30, 150)", () => {
    const p = generatePalette({
      baseColor: "#c1440e",
      harmony: "double-split-complementary",
    });
    const h = auditPalette({ palette: p }).harmony;
    expect(h.singleHue).toBe(false);
    expect(h.ok).toBe(true);
    expect(h.expectedOffsets).toEqual([0, 30, 150]);
  });

  it("enumerates the expanded text pairings (containers, elevated, foreground tiers)", () => {
    const labels = new Set(report.light.pairs.map((p) => p.label));
    expect(labels.has("on-primary-container on primary-container")).toBe(true);
    expect(labels.has("on-secondary-container on secondary-container")).toBe(true);
    expect(labels.has("on-accent-container on accent-container")).toBe(true);
    expect(labels.has("foreground on surface-elevated")).toBe(true);
    expect(labels.has("foreground-secondary on background")).toBe(true);
    expect(labels.has("foreground-tertiary on background")).toBe(true);
    expect(labels.has("outline on background")).toBe(true);
  });

  it("on-container pairings pass APCA body in both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      for (const label of [
        "on-primary-container on primary-container",
        "on-secondary-container on secondary-container",
        "on-accent-container on accent-container",
      ]) {
        const pair = report[mode].pairs.find((p) => p.label === label);
        expect(pair?.apca.body).toBe(true);
      }
    }
  });
});

describe("composition warnings", () => {
  it("emits no warnings for a well-balanced harmonious palette", () => {
    const p = generatePalette({ baseColor: "#2f80ed", harmony: "triadic" });
    expect(auditPalette({ palette: p }).warnings).toEqual([]);
  });

  it("warns when the palette skews vivid (many vivid roles, few neutrals)", () => {
    // A saturated red triadic palette pushes several brand families above the
    // vivid chroma threshold while keeping the neutral barely tinted.
    const p = generatePalette({
      baseColor: "#ff0000",
      harmony: "triadic",
      options: { primaryChroma: 0.3, neutralChroma: 0.01 },
    });
    const warnings = auditPalette({ palette: p }).warnings;
    expect(warnings.some((w) => w.kind === "balance")).toBe(true);
  });

  it("warns on a harmony outlier for fixed-offset harmonies", () => {
    // Start from a valid triadic palette, then corrupt the realized accent hue
    // so it drifts well beyond the ±20° tolerance of its expected 240° offset.
    const p = generatePalette({ baseColor: "#2f80ed", harmony: "triadic" });
    const base = p.baseColor.h;
    const accent = p.light.roles.accent;
    const corrupted = {
      ...p,
      light: {
        ...p.light,
        roles: {
          ...p.light.roles,
          accent: { ...accent, oklch: { ...accent.oklch, h: base + 90 } },
        },
      },
    };
    const warnings = auditPalette({ palette: corrupted }).warnings;
    expect(warnings.some((w) => w.kind === "harmony-outlier")).toBe(true);
  });

  it("skips the harmony-outlier check gracefully for shades and custom", () => {
    const shades = generatePalette({ baseColor: "#2f80ed", harmony: "shades" });
    const custom = generatePalette({
      baseColor: "#2f80ed",
      harmony: "custom",
      options: { customAngles: [0, 90, 270] },
    });
    expect(
      auditPalette({ palette: shades }).warnings.some(
        (w) => w.kind === "harmony-outlier",
      ),
    ).toBe(false);
    expect(
      auditPalette({ palette: custom }).warnings.some(
        (w) => w.kind === "harmony-outlier",
      ),
    ).toBe(false);
  });
});
