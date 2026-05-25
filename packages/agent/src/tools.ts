/**
 * The agent's tools — every one a thin wrapper over the deterministic engine.
 *
 * Tools own no color math; they translate the agent's structured intent into
 * engine calls and summarize the engine's output back to the model. Color
 * values in results come straight from the engine. The agent's text is
 * rationale only.
 */
import {
  adjustColor,
  auditPalette,
  fixContrast,
  generatePalette,
  nameColor,
  oklch,
  parseToOklch,
  recolor,
  type HarmonyType,
  type Palette,
  type Role,
  type ThemePalette,
} from "@chroma/engine";
import type {
  AdjustPaletteInput,
  AgentState,
  AnalyzeColorInput,
  ChromaLevel,
  DesignBrief,
  FixContrastInput,
  GeneratePaletteInput,
  LightnessLevel,
  RecolorInput,
  SetDesignBriefInput,
  ToolDefinition,
} from "./types.js";

/** A registered tool: its provider-neutral definition + an engine executor. */
export interface AgentTool {
  definition: ToolDefinition;
  execute: (
    args: Record<string, unknown>,
    state: AgentState,
  ) => { result: unknown; state: AgentState };
}

const CHROMA_VALUE: Record<ChromaLevel, number> = {
  muted: 0.06,
  balanced: 0.13,
  vivid: 0.2,
};
const LIGHTNESS_VALUE: Record<LightnessLevel, number> = {
  light: 0.78,
  medium: 0.62,
  deep: 0.48,
};

const HARMONIES: HarmonyType[] = [
  "complementary",
  "split-complementary",
  "analogous",
  "monochromatic",
  "triadic",
  "tetradic",
  "square",
  "rectangular",
];

/** Compact, model-friendly summary of a theme's key role colors. */
function themeSummary(theme: ThemePalette) {
  const roles: Role[] = [
    "primary",
    "secondary",
    "accent",
    "background",
    "surface",
    "foreground",
    "success",
    "warning",
    "danger",
  ];
  const out: Record<string, string> = {};
  for (const role of roles) out[role] = theme.roles[role].hex;
  return out;
}

/** Summarize a palette + its accessibility audit for the model to explain. */
export function paletteSummary(palette: Palette) {
  const audit = auditPalette({ palette });
  const failing = [...audit.light.pairs, ...audit.dark.pairs]
    .filter((p) => !p.apca.body)
    .map((p) => p.label);
  return {
    harmony: palette.harmony,
    baseHue: Math.round(palette.baseColor.h),
    light: themeSummary(palette.light),
    dark: themeSummary(palette.dark),
    accessibility: {
      passesBodyApca: audit.passesBodyApca,
      harmonyVerified: audit.harmony.ok,
      bodyTextPairsBelowApca75: failing,
    },
    gamutClamped: [...audit.light.clamped, ...audit.dark.clamped],
  };
}

function requirePalette(state: AgentState): Palette {
  if (!state.palette) {
    throw new Error(
      "No palette exists yet. Generate one with generate_palette first.",
    );
  }
  return state.palette;
}

/* ------------------------------------------------------------------- tools */

const setDesignBrief: AgentTool = {
  definition: {
    name: "set_design_brief",
    description:
      "Record or revise the structured design brief from your investigation. Call this in the synthesis phase BEFORE generating any palette, and again whenever the user redirects the design (e.g. 'make it more premium'). Captures research findings and the stated direction (hue families + harmony) with a rationale. Contains NO color values.",
    parameters: {
      type: "object",
      properties: {
        brandName: { type: "string" },
        brandValues: { type: "array", items: { type: "string" } },
        audience: { type: "string", description: "Who the product is for." },
        domain: {
          type: "string",
          description: "Product domain / industry, e.g. 'consumer fintech'.",
        },
        platform: { type: "string", description: "web / iOS / Android" },
        toneKeywords: { type: "array", items: { type: "string" } },
        emotionalTargets: { type: "array", items: { type: "string" } },
        culturalNotes: { type: "array", items: { type: "string" } },
        competitiveLandscape: { type: "string" },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "Hard constraints: must-keep colors, logo, brand colors.",
        },
        hueFamilies: {
          type: "array",
          items: { type: "string" },
          description: "Hue families the direction favors, e.g. ['green','teal'].",
        },
        harmony: { type: "string", enum: HARMONIES },
        rationale: {
          type: "string",
          description:
            "Why these hue families + this harmony, traced to the findings.",
        },
      },
      required: ["audience", "domain", "toneKeywords", "hueFamilies", "harmony", "rationale"],
    },
  },
  execute: (args, state) => {
    const input = args as unknown as SetDesignBriefInput;
    const brief: DesignBrief = {
      version: (state.brief?.version ?? 0) + 1,
      brandName: input.brandName,
      brandValues: input.brandValues ?? [],
      audience: input.audience,
      domain: input.domain,
      platform: input.platform,
      toneKeywords: input.toneKeywords,
      emotionalTargets: input.emotionalTargets ?? [],
      culturalNotes: input.culturalNotes ?? [],
      competitiveLandscape: input.competitiveLandscape,
      constraints: input.constraints ?? [],
      direction: {
        hueFamilies: input.hueFamilies,
        harmony: input.harmony,
        rationale: input.rationale,
      },
    };
    return { result: { brief }, state: { ...state, brief } };
  },
};

const analyzeColor: AgentTool = {
  definition: {
    name: "analyze_color",
    description:
      "Read a USER-PROVIDED color (e.g. an existing brand color or logo color) into design parameters: its OKLCH hue, chroma, lightness, and a descriptive family name. Use this to ground base-hue selection on a must-keep color. Do not invent the color — only pass a value the user gave you.",
    parameters: {
      type: "object",
      properties: {
        color: {
          type: "string",
          description: "A user-provided CSS color (hex, rgb(), or name).",
        },
      },
      required: ["color"],
    },
  },
  execute: (args, state) => {
    const { color } = args as unknown as AnalyzeColorInput;
    const o = parseToOklch(color);
    if (!o) {
      return {
        result: { error: `Could not parse color "${color}".` },
        state,
      };
    }
    return {
      result: {
        hue: Math.round(o.h),
        chroma: Number(o.c.toFixed(3)),
        lightness: Number(o.l.toFixed(3)),
        family: nameColor(o),
      },
      state,
    };
  },
};

const generatePaletteTool: AgentTool = {
  definition: {
    name: "generate_palette",
    description:
      "Generate a full role-based light+dark palette from DESIGN PARAMETERS. Provide a base hue (degrees, 0–360) chosen from the brief, a harmony, and qualitative chroma/lightness levels — never hex values. The engine produces all colors and a coherent dark mode. Returns the role colors and an accessibility audit. Only call after a design brief exists.",
    parameters: {
      type: "object",
      properties: {
        baseHue: {
          type: "number",
          description: "Base hue in OKLCH degrees (0–360), chosen per the brief.",
        },
        harmony: { type: "string", enum: HARMONIES },
        chroma: { type: "string", enum: ["muted", "balanced", "vivid"] },
        lightness: { type: "string", enum: ["light", "medium", "deep"] },
        analogousSpan: {
          type: "number",
          description: "Span in degrees when harmony is 'analogous'.",
        },
        unrestrictedChroma: {
          type: "boolean",
          description: "Allow brand chroma beyond the ~0.37 sRGB cap (rarely needed; default false).",
        },
      },
      required: ["baseHue", "harmony"],
    },
  },
  execute: (args, state) => {
    const input = args as unknown as GeneratePaletteInput;
    const chroma = CHROMA_VALUE[input.chroma ?? "balanced"];
    const lightness = LIGHTNESS_VALUE[input.lightness ?? "medium"];
    const base = oklch(lightness, chroma, input.baseHue);
    const palette = generatePalette({
      baseColor: base,
      harmony: input.harmony,
      options: {
        primaryChroma: chroma,
        analogousSpan: input.analogousSpan,
        unrestrictedChroma: input.unrestrictedChroma,
      },
    });
    return {
      result: { palette: paletteSummary(palette) },
      state: { ...state, palette },
    };
  },
};

const adjustPaletteTool: AgentTool = {
  definition: {
    name: "adjust_palette",
    description:
      "Perceptually adjust the whole palette while preserving its harmony — e.g. 'warmer', 'cooler', 'lighter', 'more saturated'. The engine shifts the base color and re-derives every role. Returns the updated palette + audit.",
    parameters: {
      type: "object",
      properties: {
        lightness: { type: "string", enum: ["lighter", "darker"] },
        temperature: { type: "string", enum: ["warmer", "cooler"] },
        saturation: { type: "string", enum: ["more", "less"] },
        amount: { type: "number", description: "Perceptual magnitude 0–1." },
      },
    },
  },
  execute: (args, state) => {
    const palette = requirePalette(state);
    const input = args as unknown as AdjustPaletteInput;
    const adjusted = adjustColor({
      color: palette.baseColor,
      intent: {
        lightness: input.lightness,
        temperature: input.temperature,
        saturation: input.saturation,
        amount: input.amount,
      },
    });
    const next = recolor({ palette, newBase: adjusted.after.oklch });
    return {
      result: { palette: paletteSummary(next), delta: adjusted.delta },
      state: { ...state, palette: next },
    };
  },
};

const recolorTool: AgentTool = {
  definition: {
    name: "recolor_palette",
    description:
      "Re-derive the palette with a new base hue and/or a new harmony, preserving the role structure (e.g. 'give me a triadic version'). Provide a hue in degrees, not a color value.",
    parameters: {
      type: "object",
      properties: {
        newBaseHue: { type: "number", description: "New base hue in degrees." },
        newHarmony: { type: "string", enum: HARMONIES },
      },
    },
  },
  execute: (args, state) => {
    const palette = requirePalette(state);
    const input = args as unknown as RecolorInput;
    const newBase =
      input.newBaseHue === undefined
        ? undefined
        : oklch(palette.baseColor.l, palette.baseColor.c, input.newBaseHue);
    const next = recolor({
      palette,
      newBase,
      newHarmony: input.newHarmony,
    });
    return {
      result: { palette: paletteSummary(next) },
      state: { ...state, palette: next },
    };
  },
};

const fixContrastTool: AgentTool = {
  definition: {
    name: "fix_contrast",
    description:
      "Minimally nudge colors (in OKLCH) so text/background pairings meet an accessibility target. Defaults to APCA Lc 75 for body text. Returns exactly what changed and why, plus the updated palette.",
    parameters: {
      type: "object",
      properties: {
        model: { type: "string", enum: ["apca", "wcag"] },
        use: { type: "string", enum: ["body", "large", "nonText"] },
        level: { type: "string", enum: ["AA", "AAA"] },
      },
    },
  },
  execute: (args, state) => {
    const palette = requirePalette(state);
    const input = args as unknown as FixContrastInput;
    const { palette: fixed, changes } = fixContrast({
      palette,
      target: { model: input.model, use: input.use, level: input.level },
    });
    return {
      result: {
        changes: changes.map((c) => ({
          label: c.label,
          reason: c.reason,
          before: c.before,
          after: c.after,
        })),
        palette: paletteSummary(fixed),
      },
      state: { ...state, palette: fixed },
    };
  },
};

const auditPaletteTool: AgentTool = {
  definition: {
    name: "audit_palette",
    description:
      "Run the full accessibility (APCA + WCAG), harmony, and gamut audit on the current palette. Use this to answer 'audit my dark mode' or to verify a fix. Read-only.",
    parameters: { type: "object", properties: {} },
  },
  execute: (_args, state) => {
    const palette = requirePalette(state);
    const audit = auditPalette({ palette });
    const summarizeMode = (mode: "light" | "dark") => ({
      pairs: audit[mode].pairs.map((p) => ({
        label: p.label,
        apcaLc: p.apcaLc,
        wcagRatio: p.wcagRatio,
        apcaBodyPass: p.apca.body,
        wcagAA: p.wcag.AA.body,
      })),
      clamped: audit[mode].clamped,
    });
    return {
      result: {
        passesBodyApca: audit.passesBodyApca,
        harmony: audit.harmony,
        light: summarizeMode("light"),
        dark: summarizeMode("dark"),
      },
      state,
    };
  },
};

/** The full tool registry the agent loop exposes. */
export const AGENT_TOOLS: AgentTool[] = [
  setDesignBrief,
  analyzeColor,
  generatePaletteTool,
  adjustPaletteTool,
  recolorTool,
  fixContrastTool,
  auditPaletteTool,
];

/** Tool definitions only (what gets sent to the provider). */
export const TOOL_DEFINITIONS: ToolDefinition[] = AGENT_TOOLS.map(
  (t) => t.definition,
);

const TOOL_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.definition.name, t]));

/** Execute a tool by name; unknown tools and engine errors return error results. */
export function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: AgentState,
): { result: unknown; state: AgentState; isError: boolean } {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return { result: { error: `Unknown tool: ${name}` }, state, isError: true };
  }
  try {
    const { result, state: next } = tool.execute(args, state);
    return { result, state: next, isError: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { result: { error: message }, state, isError: true };
  }
}
