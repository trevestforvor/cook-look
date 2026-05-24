import { describe, expect, it } from "vitest";
import { runDesignAgent } from "./agent.js";
import type {
  AgentRequest,
  AssistantTurn,
  LLMProvider,
  NeutralMessage,
  ToolDefinition,
} from "./types.js";

/**
 * A scripted provider that returns a fixed sequence of assistant turns,
 * recording every request. Because it implements the same LLMProvider
 * interface, the agent loop is exercised identically to a real provider —
 * which is exactly the provider-agnostic property we want to verify.
 */
class MockProvider implements LLMProvider {
  readonly model = "mock-1";
  public calls: { system: string; messages: NeutralMessage[]; tools: ToolDefinition[] }[] = [];
  private index = 0;

  constructor(
    readonly name: "openai" | "anthropic",
    private readonly script: AssistantTurn[],
  ) {}

  async complete(input: {
    system: string;
    messages: NeutralMessage[];
    tools: ToolDefinition[];
  }): Promise<AssistantTurn> {
    this.calls.push(input);
    const turn = this.script[this.index] ?? { text: "(done)", toolCalls: [] };
    this.index += 1;
    return turn;
  }
}

/** The canonical research-first flow: brief → generate → justify. */
function researchFirstScript(): AssistantTurn[] {
  return [
    {
      text: "Let me capture the brief.",
      toolCalls: [
        {
          id: "c1",
          name: "set_design_brief",
          arguments: {
            audience: "young athletes",
            domain: "youth fitness",
            toneKeywords: ["fresh", "energetic"],
            emotionalTargets: ["motivated"],
            hueFamilies: ["green"],
            harmony: "split-complementary",
            rationale:
              "fresh green base for vitality; split-complement for energetic contrast suited to a youth-fitness audience",
          },
        },
      ],
    },
    {
      text: "Now generating from the brief.",
      toolCalls: [
        {
          id: "c2",
          name: "generate_palette",
          arguments: {
            baseHue: 145,
            harmony: "split-complementary",
            chroma: "vivid",
            lightness: "medium",
          },
        },
      ],
    },
    {
      text: "Here is your palette: a fresh green primary chosen for the brand's vitality, with energetic split-complementary accents reserved for calls to action. Body text clears APCA Lc 75 in both modes.",
      toolCalls: [],
    },
  ];
}

const baseRequest: AgentRequest = {
  messages: [
    { role: "user", content: "Make me a palette for a youth fitness app." },
  ],
  palette: null,
  brief: null,
};

describe("runDesignAgent", () => {
  it("runs the research-first loop: brief, then generate, then justify", async () => {
    const provider = new MockProvider("anthropic", researchFirstScript());
    const res = await runDesignAgent(baseRequest, provider);

    // Brief synthesized before the palette.
    expect(res.brief?.version).toBe(1);
    expect(res.brief?.direction.harmony).toBe("split-complementary");

    // Palette produced by the engine via the tool call.
    expect(res.palette).not.toBeNull();
    expect(Math.round(res.palette!.baseColor.h)).toBe(145);

    // Tool events surfaced in order.
    expect(res.toolEvents.map((e) => e.name)).toEqual([
      "set_design_brief",
      "generate_palette",
    ]);

    // Final reply is rationale, not raw color values.
    expect(res.reply).toMatch(/youth-fitness|fitness|vitality/i);
    expect(res.reply).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("is provider-agnostic: the same script yields the same result for openai", async () => {
    const anth = await runDesignAgent(
      baseRequest,
      new MockProvider("anthropic", researchFirstScript()),
    );
    const oai = await runDesignAgent(
      baseRequest,
      new MockProvider("openai", researchFirstScript()),
    );
    expect(oai.palette!.light.roles.primary.hex).toBe(
      anth.palette!.light.roles.primary.hex,
    );
    expect(oai.brief).toEqual(anth.brief);
    expect(oai.provider).toBe("openai");
    expect(anth.provider).toBe("anthropic");
  });

  it("feeds the current state into the first message so the agent builds on it", async () => {
    const provider = new MockProvider("anthropic", [{ text: "ok", toolCalls: [] }]);
    await runDesignAgent(baseRequest, provider);
    const first = provider.calls[0]!;
    expect(first.messages[0]!.role).toBe("user");
    expect(first.messages[0]!.text).toMatch(/CURRENT DESIGN STATE/);
    // The methodology + rules are in the (cacheable) system prompt.
    expect(first.system).toMatch(/never output color values/i);
    expect(first.tools.length).toBeGreaterThan(5);
  });

  it("continues after a tool error and still returns a reply", async () => {
    // adjust_palette with no palette → engine-guarded error, then the model wraps up.
    const provider = new MockProvider("anthropic", [
      {
        text: "",
        toolCalls: [{ id: "c1", name: "adjust_palette", arguments: { temperature: "warmer" } }],
      },
      { text: "I need to generate a palette first.", toolCalls: [] },
    ]);
    const res = await runDesignAgent(baseRequest, provider);
    expect(res.toolEvents[0]!.isError).toBe(true);
    expect(res.reply).toMatch(/generate/i);
  });
});
