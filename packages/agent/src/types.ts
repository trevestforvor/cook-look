/**
 * Provider-agnostic agent type system.
 *
 * The single most important property of this package is enforced here, in the
 * types: the agent steers the engine through tool calls and never emits color
 * values itself. Every palette-producing tool input is a *design parameter* —
 * a hue angle, a qualitative chroma/lightness level, a harmony name — not a hex
 * string. The engine owns all color math and all final color values; the agent
 * reasons about intent. The one place a raw color string may enter is
 * {@link AnalyzeColorInput}, and only because that color comes *from the user*
 * (an existing brand color), to be read into design parameters by the engine.
 */
import type { HarmonyType, Palette } from "@chroma/engine";

/* --------------------------------------------------------- provider-neutral */

/** A tool call requested by the model, normalized across providers. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** A tool result handed back to the model. */
export interface ToolResult {
  id: string;
  name: string;
  /** JSON-encoded engine result. */
  content: string;
  isError?: boolean;
}

/** A provider-neutral conversation message. */
export interface NeutralMessage {
  role: "user" | "assistant";
  text?: string;
  /** Present on an assistant message that requested tools. */
  toolCalls?: ToolCall[];
  /** Present on a user message carrying tool results. */
  toolResults?: ToolResult[];
}

/** JSON-schema-ish tool parameter description (kept permissive on purpose). */
export type ToolParameters = Record<string, unknown>;

/** A provider-neutral tool definition. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

/** One assistant turn: free text plus any tool calls it requested. */
export interface AssistantTurn {
  text: string;
  toolCalls: ToolCall[];
}

/**
 * The provider abstraction. `OpenAIProvider` and `AnthropicProvider` implement
 * this; all tool-calling differences are normalized *inside* the adapters, so
 * the agent loop above is completely provider-neutral. Switching providers
 * requires zero changes to agent logic or tool definitions.
 */
export interface LLMProvider {
  readonly name: "openai" | "anthropic";
  readonly model: string;
  complete(input: {
    system: string;
    messages: NeutralMessage[];
    tools: ToolDefinition[];
  }): Promise<AssistantTurn>;
}

/* --------------------------------------------------------------- DesignBrief */

/**
 * The research artifact that drives every color decision. The agent produces it
 * during its investigation phase; the same findings are used twice — to steer
 * base-color/harmony selection and to justify the resulting palette. Palettes
 * reference the brief version that produced them, so decisions are traceable.
 */
export interface DesignBrief {
  /** Bumped each time the brief is (re)synthesized or revised. */
  version: number;
  brandName?: string;
  brandValues: string[];
  audience: string;
  /** Product domain / industry (e.g. "consumer fintech", "youth fitness"). */
  domain: string;
  /** Target platform(s): web / iOS / Android. */
  platform?: string;
  toneKeywords: string[];
  emotionalTargets: string[];
  /** Cultural color associations worth respecting or avoiding. */
  culturalNotes: string[];
  /** Competitive / category color landscape. */
  competitiveLandscape?: string;
  /** Hard constraints: existing brand colors, logo, must-keep colors. */
  constraints: string[];
  /** The stated direction, traced back to the findings above. */
  direction: {
    hueFamilies: string[];
    harmony: HarmonyType;
    rationale: string;
  };
}

/* ------------------------------------------------------- tool input contracts
 *
 * NOTE: none of these carry hex/RGB color values. The agent expresses intent
 * as hue angles and qualitative levels; the engine turns them into colors.
 */

export type ChromaLevel = "muted" | "balanced" | "vivid";
export type LightnessLevel = "light" | "medium" | "deep";

/** Input for the brief-setting tool — no colors, only research findings. */
export interface SetDesignBriefInput {
  brandName?: string;
  brandValues?: string[];
  audience: string;
  domain: string;
  platform?: string;
  toneKeywords: string[];
  emotionalTargets?: string[];
  culturalNotes?: string[];
  competitiveLandscape?: string;
  constraints?: string[];
  hueFamilies: string[];
  harmony: HarmonyType;
  rationale: string;
}

/**
 * The ONLY tool input that accepts a raw color string, and only because the
 * color is supplied by the user (an existing brand color). The engine reads it
 * into design parameters (hue/chroma/lightness) the agent can then reason with.
 */
export interface AnalyzeColorInput {
  color: string;
}

/** Generate a palette from design parameters — hue angle + qualitative levels. */
export interface GeneratePaletteInput {
  /** Base hue in OKLCH degrees, 0–360. */
  baseHue: number;
  harmony: HarmonyType;
  chroma?: ChromaLevel;
  lightness?: LightnessLevel;
  /** Analogous span in degrees, when harmony is "analogous". */
  analogousSpan?: number;
}

/** Perceptually adjust the whole palette (engine re-derives all values). */
export interface AdjustPaletteInput {
  lightness?: "lighter" | "darker";
  temperature?: "warmer" | "cooler";
  saturation?: "more" | "less";
  /** Perceptual magnitude 0–1 (default 0.1). */
  amount?: number;
}

/** Recolor while preserving role structure — new base hue and/or harmony. */
export interface RecolorInput {
  newBaseHue?: number;
  newHarmony?: HarmonyType;
}

/** Nudge colors to meet an accessibility target. */
export interface FixContrastInput {
  model?: "apca" | "wcag";
  use?: "body" | "large" | "nonText";
  level?: "AA" | "AAA";
}

/* ------------------------------------------------------------- agent surface */

/** Mutable state threaded through the tool loop. */
export interface AgentState {
  palette: Palette | null;
  brief: DesignBrief | null;
}

/** A recorded tool execution, surfaced to the UI so the user sees the steering. */
export interface ToolEvent {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  isError?: boolean;
}

/** A chat message in the assist panel transcript. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request into the agent (palette + brief are persisted in app state). */
export interface AgentRequest {
  messages: ChatMessage[];
  palette: Palette | null;
  brief: DesignBrief | null;
}

/** Response out of the agent. */
export interface AgentResponse {
  reply: string;
  palette: Palette | null;
  brief: DesignBrief | null;
  toolEvents: ToolEvent[];
  provider: "openai" | "anthropic";
}
