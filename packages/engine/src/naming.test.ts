import { describe, expect, it } from "vitest";
import { hueFamily, nameColor, nameColors } from "./naming.js";
import { generatePalette } from "./palette.js";

describe("hueFamily", () => {
  it("maps representative OKLCH hues to families", () => {
    expect(hueFamily(27)).toBe("Orange");
    expect(hueFamily(150)).toBe("Green");
    expect(hueFamily(256)).toBe("Blue");
    expect(hueFamily(10)).toBe("Red");
  });

  it("wraps out-of-range hues", () => {
    expect(hueFamily(370)).toBe("Red");
    expect(hueFamily(-90)).toBe(hueFamily(270));
  });
});

describe("nameColor", () => {
  it("calls very low chroma a gray", () => {
    expect(nameColor({ l: 0.5, c: 0.005, h: 256 })).toContain("Gray");
  });

  it("describes lightness and chroma for a vivid mid blue", () => {
    const name = nameColor({ l: 0.6, c: 0.18, h: 256 });
    expect(name).toContain("Vivid");
    expect(name).toContain("Blue");
  });

  it("is deterministic", () => {
    const c = { l: 0.42, c: 0.16, h: 27 };
    expect(nameColor(c)).toBe(nameColor(c));
  });
});

describe("nameColors", () => {
  it("names every role", () => {
    const palette = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
    const names = nameColors({ palette });
    expect(names.primary).toBeTruthy();
    expect(names.neutral).toContain("Gray");
    expect(Object.keys(names)).toContain("danger");
  });
});
