import { describe, expect, it } from "vitest";
import { generatePalette } from "./palette.js";
import { toCssVariables, toJSON, toTailwindColors, toTailwindConfig } from "./tokens.js";

const palette = generatePalette({ baseColor: "#3b82f6", harmony: "complementary" });

describe("toCssVariables", () => {
  const css = toCssVariables(palette);

  it("declares a :root block and a dark block", () => {
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("emits a hex fallback followed by an oklch() value for each token", () => {
    // The primary token should appear once as hex and once as oklch().
    const hexLine = css.match(/--color-primary: #[0-9a-f]{6};/i);
    const oklchLine = css.match(/--color-primary: oklch\(/);
    expect(hexLine).not.toBeNull();
    expect(oklchLine).not.toBeNull();
  });

  it("includes ramp steps and on-colors", () => {
    expect(css).toContain("--color-primary-500");
    expect(css).toContain("--color-on-primary");
  });
});

describe("toTailwindColors", () => {
  const colors = toTailwindColors() as Record<string, Record<string, string>>;

  it("references CSS variables (theme-switchable)", () => {
    const primary = colors.primary as Record<string, string>;
    expect(colors.background).toBe("var(--color-background)");
    expect(primary.DEFAULT).toBe("var(--color-primary)");
    expect(primary["500"]).toBe("var(--color-primary-500)");
    expect(primary.foreground).toBe("var(--color-on-primary)");
  });
});

describe("toTailwindConfig", () => {
  it("produces a module.exports snippet", () => {
    const cfg = toTailwindConfig(palette);
    expect(cfg).toContain("module.exports");
    expect(cfg).toContain("colors:");
  });
});

describe("toJSON", () => {
  it("produces valid, structured JSON with both modes", () => {
    const json = JSON.parse(toJSON(palette));
    expect(json.harmony).toBe("complementary");
    expect(json.light.roles.primary.hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(json.dark.roles.background.oklch).toBeDefined();
    expect(json.light.ramps.primary["500"].css).toMatch(/^oklch\(/);
  });
});
