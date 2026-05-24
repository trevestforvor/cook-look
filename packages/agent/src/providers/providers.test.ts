import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import {
  AnthropicProvider,
  fromAnthropicResponse,
  toAnthropicMessages,
  toAnthropicTools,
} from "./anthropic.js";
import {
  fromOpenAIResponse,
  OpenAIProvider,
  toOpenAIMessages,
  toOpenAITools,
} from "./openai.js";
import {
  createProvider,
  MissingApiKeyError,
  UnknownProviderError,
} from "./factory.js";
import type { NeutralMessage, ToolDefinition } from "../types.js";

const transcript: NeutralMessage[] = [
  { role: "user", text: "hello" },
  {
    role: "assistant",
    text: "calling a tool",
    toolCalls: [{ id: "t1", name: "generate_palette", arguments: { baseHue: 145 } }],
  },
  {
    role: "user",
    toolResults: [{ id: "t1", name: "generate_palette", content: '{"ok":true}' }],
  },
];

const tools: ToolDefinition[] = [
  {
    name: "generate_palette",
    description: "desc",
    parameters: { type: "object", properties: { baseHue: { type: "number" } } },
  },
];

describe("Anthropic adapter mapping", () => {
  it("maps neutral messages to tool_use / tool_result blocks", () => {
    const msgs = toAnthropicMessages(transcript);
    expect(msgs[0]).toEqual({ role: "user", content: "hello" });

    const assistant = msgs[1]!;
    expect(assistant.role).toBe("assistant");
    const blocks = assistant.content as Anthropic.ContentBlockParam[];
    expect(blocks.some((b) => b.type === "text")).toBe(true);
    const toolUse = blocks.find((b) => b.type === "tool_use");
    expect(toolUse).toMatchObject({ type: "tool_use", id: "t1", name: "generate_palette" });

    const toolResultMsg = msgs[2]!;
    const rblocks = toolResultMsg.content as Anthropic.ContentBlockParam[];
    expect(rblocks[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
  });

  it("maps tool definitions to input_schema", () => {
    const t = toAnthropicTools(tools)[0]!;
    expect(t.name).toBe("generate_palette");
    expect(t.input_schema).toEqual(tools[0]!.parameters);
  });

  it("normalizes a response into a neutral assistant turn", () => {
    const fake = {
      content: [
        { type: "text", text: "here you go" },
        { type: "tool_use", id: "u1", name: "fix_contrast", input: { model: "apca" } },
      ],
    } as unknown as Anthropic.Message;
    const turn = fromAnthropicResponse(fake);
    expect(turn.text).toBe("here you go");
    expect(turn.toolCalls).toEqual([
      { id: "u1", name: "fix_contrast", arguments: { model: "apca" } },
    ]);
  });
});

describe("OpenAI adapter mapping", () => {
  it("maps neutral messages to tool_calls / role:tool messages", () => {
    const msgs = toOpenAIMessages(transcript);
    expect(msgs[0]).toEqual({ role: "user", content: "hello" });

    const assistant = msgs[1] as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
    expect(assistant.role).toBe("assistant");
    expect(assistant.tool_calls?.[0]).toMatchObject({
      id: "t1",
      type: "function",
      function: { name: "generate_palette" },
    });

    const toolMsg = msgs[2] as OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.tool_call_id).toBe("t1");
  });

  it("maps tool definitions to function tools", () => {
    const t = toOpenAITools(tools)[0]!;
    expect(t.type).toBe("function");
    if (t.type !== "function") throw new Error("expected function tool");
    expect(t.function.name).toBe("generate_palette");
  });

  it("normalizes a response into a neutral assistant turn", () => {
    const fake = {
      choices: [
        {
          message: {
            content: "done",
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: { name: "audit_palette", arguments: '{"x":2}' },
              },
            ],
          },
        },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletion;
    const turn = fromOpenAIResponse(fake);
    expect(turn.text).toBe("done");
    expect(turn.toolCalls).toEqual([
      { id: "c1", name: "audit_palette", arguments: { x: 2 } },
    ]);
  });

  it("tolerates malformed tool arguments JSON", () => {
    const fake = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "audit_palette", arguments: "{bad" } },
            ],
          },
        },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletion;
    const turn = fromOpenAIResponse(fake);
    expect(turn.toolCalls[0]!.arguments).toEqual({});
  });
});

describe("provider factory", () => {
  it("selects OpenAI by env and defaults the model", () => {
    const p = createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
    expect(p.name).toBe("openai");
    expect(p.model).toBe("gpt-4o");
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  it("selects Anthropic by env and defaults the model", () => {
    const p = createProvider({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(p.name).toBe("anthropic");
    expect(p.model).toBe("claude-opus-4-7");
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it("respects model overrides", () => {
    const p = createProvider({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "k",
      ANTHROPIC_MODEL: "claude-sonnet-4-6",
    });
    expect(p.model).toBe("claude-sonnet-4-6");
  });

  it("throws a typed error when the key is missing", () => {
    expect(() => createProvider({ LLM_PROVIDER: "openai" })).toThrow(
      MissingApiKeyError,
    );
  });

  it("throws on an unknown provider", () => {
    expect(() => createProvider({ LLM_PROVIDER: "gemini" })).toThrow(
      UnknownProviderError,
    );
  });

  it("both providers satisfy the same interface (zero-change switching)", () => {
    const a = createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "k" });
    const b = createProvider({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    expect(typeof a.complete).toBe("function");
    expect(typeof b.complete).toBe("function");
  });
});
