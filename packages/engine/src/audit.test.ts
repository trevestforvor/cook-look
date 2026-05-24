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

  it("lists gamut-clamped swatches (none expected for in-gamut ramps)", () => {
    expect(Array.isArray(report.light.clamped)).toBe(true);
  });
});
