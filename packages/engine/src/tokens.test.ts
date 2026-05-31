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

  it("emits the full ramp scale per role (every step) plus the canonical default", () => {
    for (const role of ["primary", "secondary", "accent", "neutral"]) {
      // canonical/default single value
      expect(css).toContain(`--color-${role}:`);
      // every ramp step
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        expect(css).toContain(`--color-${role}-${step}:`);
      }
    }
  });

  it("declares the expanded role set and its container on-colors", () => {
    for (const role of [
      "primary-container",
      "secondary-container",
      "accent-container",
      "surface-elevated",
      "background-elevated",
      "outline",
      "outline-variant",
      "foreground-secondary",
      "foreground-tertiary",
    ]) {
      expect(css).toContain(`--color-${role}:`);
    }
    expect(css).toContain("--color-on-primary-container:");
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

  it("emits each ramp role as a nested scale (50..950 + DEFAULT)", () => {
    for (const role of ["primary", "secondary", "accent", "neutral"]) {
      const entry = colors[role] as Record<string, string>;
      expect(entry.DEFAULT).toBe(`var(--color-${role})`);
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        expect(entry[String(step)]).toBe(`var(--color-${role}-${step})`);
      }
    }
  });

  it("emits containers as { DEFAULT, foreground } and elevated/outline roles flat", () => {
    const container = colors["primary-container"] as Record<string, string>;
    expect(container.DEFAULT).toBe("var(--color-primary-container)");
    expect(container.foreground).toBe("var(--color-on-primary-container)");
    expect(colors["surface-elevated"]).toBe("var(--color-surface-elevated)");
    expect(colors.outline).toBe("var(--color-outline)");
    expect(colors["foreground-secondary"]).toBe(
      "var(--color-foreground-secondary)",
    );
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

  it("includes the full ramp scale (steps) plus the canonical role value", () => {
    const json = JSON.parse(toJSON(palette));
    for (const role of ["primary", "secondary", "accent", "neutral"]) {
      // canonical value
      expect(json.light.roles[role].hex).toMatch(/^#[0-9a-f]{6}$/i);
      // full ramp
      const ramp = json.light.ramps[role];
      for (const step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) {
        expect(ramp[step].hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("includes the expanded roles in the token tree", () => {
    const json = JSON.parse(toJSON(palette));
    for (const role of [
      "primary-container",
      "surface-elevated",
      "background-elevated",
      "outline",
      "outline-variant",
      "foreground-secondary",
      "foreground-tertiary",
    ]) {
      expect(json.light.roles[role].hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(json.light.on["primary-container"].hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("annotates role usage weight (60-30-10) in a meta block (JSON only)", () => {
    const json = JSON.parse(toJSON(palette));
    expect(json.meta.usage.primary.weight).toBe("dominant");
    expect(json.meta.usage.accent.weight).toBe("accent");
    expect(json.meta.usage.neutral.weight).toBe("supporting");
    // The meta block must not leak into CSS / Tailwind output.
    expect(toCssVariables(palette)).not.toContain("usage");
    expect(toTailwindConfig(palette)).not.toContain("usage");
  });
});
