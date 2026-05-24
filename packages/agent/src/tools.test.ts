import { describe, expect, it } from "vitest";
import { executeTool, paletteSummary, TOOL_DEFINITIONS } from "./tools.js";
import type { AgentState } from "./types.js";

const EMPTY: AgentState = { palette: null, brief: null };

describe("tool definitions", () => {
  it("exposes the expected tool surface", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "adjust_palette",
        "analyze_color",
        "audit_palette",
        "fix_contrast",
        "generate_palette",
        "recolor_palette",
        "set_design_brief",
      ].sort(),
    );
  });

  it("no palette-producing tool input accepts a color value (engine owns colors)", () => {
    // The only tool whose schema mentions a color is analyze_color (user input).
    for (const def of TOOL_DEFINITIONS) {
      const props = (def.parameters as { properties?: Record<string, unknown> })
        .properties;
      const keys = Object.keys(props ?? {});
      if (def.name === "analyze_color") {
        expect(keys).toContain("color");
      } else {
        expect(keys).not.toContain("color");
        expect(keys.join(" ")).not.toMatch(/hex|rgb/i);
      }
    }
  });
});

describe("set_design_brief", () => {
  it("records a brief and bumps its version", () => {
    const r1 = executeTool(
      "set_design_brief",
      {
        audience: "young athletes",
        domain: "youth fitness",
        toneKeywords: ["fresh", "energetic"],
        hueFamilies: ["green"],
        harmony: "split-complementary",
        rationale: "fresh green base with energetic split-complement accents",
      },
      EMPTY,
    );
    expect(r1.isError).toBe(false);
    expect(r1.state.brief?.version).toBe(1);
    expect(r1.state.brief?.direction.harmony).toBe("split-complementary");

    const r2 = executeTool(
      "set_design_brief",
      {
        audience: "young athletes",
        domain: "youth fitness",
        toneKeywords: ["premium"],
        hueFamilies: ["green"],
        harmony: "analogous",
        rationale: "more premium redirect",
      },
      r1.state,
    );
    expect(r2.state.brief?.version).toBe(2);
  });
});

describe("analyze_color", () => {
  it("reads a user-provided color into OKLCH design parameters", () => {
    const r = executeTool("analyze_color", { color: "#3b82f6" }, EMPTY);
    const result = r.result as { hue: number; family: string };
    expect(r.isError).toBe(false);
    expect(result.hue).toBeGreaterThan(220);
    expect(result.hue).toBeLessThan(280);
    expect(result.family).toContain("Blue");
  });

  it("errors gracefully on an unparseable color", () => {
    const r = executeTool("analyze_color", { color: "not-a-color" }, EMPTY);
    expect((r.result as { error?: string }).error).toBeTruthy();
  });
});

describe("generate_palette", () => {
  it("builds a palette from a hue + qualitative levels and sets state", () => {
    const r = executeTool(
      "generate_palette",
      { baseHue: 145, harmony: "analogous", chroma: "balanced", lightness: "medium" },
      EMPTY,
    );
    expect(r.isError).toBe(false);
    expect(r.state.palette).not.toBeNull();
    expect(Math.round(r.state.palette!.baseColor.h)).toBe(145);
    const summary = (r.result as { palette: ReturnType<typeof paletteSummary> })
      .palette;
    expect(summary.harmony).toBe("analogous");
    expect(summary.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(typeof summary.accessibility.passesBodyApca).toBe("boolean");
  });
});

describe("fix_contrast and audit_palette require a palette", () => {
  it("returns an error result when no palette exists", () => {
    const r = executeTool("fix_contrast", {}, EMPTY);
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/generate_palette/);
  });

  it("audits an existing palette", () => {
    const gen = executeTool(
      "generate_palette",
      { baseHue: 256, harmony: "triadic" },
      EMPTY,
    );
    const audit = executeTool("audit_palette", {}, gen.state);
    const result = audit.result as { harmony: { ok: boolean } };
    expect(result.harmony.ok).toBe(true);
  });
});

describe("adjust_palette and recolor_palette", () => {
  it("warmer adjustment shifts the base hue and re-derives", () => {
    const gen = executeTool(
      "generate_palette",
      { baseHue: 256, harmony: "complementary" },
      EMPTY,
    );
    const before = gen.state.palette!.baseColor.h;
    const adj = executeTool(
      "adjust_palette",
      { temperature: "warmer", amount: 0.5 },
      gen.state,
    );
    expect(adj.state.palette!.baseColor.h).not.toBeCloseTo(before, 0);
  });

  it("recolor to a triadic version preserves role structure", () => {
    const gen = executeTool(
      "generate_palette",
      { baseHue: 256, harmony: "complementary" },
      EMPTY,
    );
    const re = executeTool(
      "recolor_palette",
      { newHarmony: "triadic" },
      gen.state,
    );
    expect(re.state.palette!.harmony).toBe("triadic");
    expect(Object.keys(re.state.palette!.light.roles)).toContain("primary");
  });
});

describe("unknown tool", () => {
  it("returns an error result", () => {
    const r = executeTool("does_not_exist", {}, EMPTY);
    expect(r.isError).toBe(true);
  });
});
