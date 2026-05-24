/**
 * OpenAI provider adapter.
 *
 * All OpenAI-specific tool-calling shape (tools/tool_calls, role:"tool"
 * results) is confined to this file. The mapping functions are pure and
 * unit-tested; the class is the thin IO wrapper. The agent loop above never
 * sees any of this.
 */
import OpenAI from "openai";
import type {
  AssistantTurn,
  LLMProvider,
  NeutralMessage,
  ToolCall,
  ToolDefinition,
} from "../types.js";

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Neutral transcript → OpenAI chat messages (system is prepended separately). */
export function toOpenAIMessages(messages: NeutralMessage[]): ChatMessageParam[] {
  const out: ChatMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "assistant") {
      const toolCalls = (m.toolCalls ?? []).map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: JSON.stringify(c.arguments) },
      }));
      out.push({
        role: "assistant",
        content: m.text ?? "",
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else if (m.toolResults && m.toolResults.length > 0) {
      // Each tool result is its own role:"tool" message.
      for (const r of m.toolResults) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    } else {
      out.push({ role: "user", content: m.text ?? "" });
    }
  }
  return out;
}

/** Neutral tool defs → OpenAI tools. */
export function toOpenAITools(
  tools: ToolDefinition[],
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** OpenAI response → neutral assistant turn. */
export function fromOpenAIResponse(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): AssistantTurn {
  const message = completion.choices[0]?.message;
  const text = message?.content ?? "";
  const toolCalls: ToolCall[] = [];
  for (const tc of message?.tool_calls ?? []) {
    if (tc.type !== "function") continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args });
  }
  return { text, toolCalls };
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(input: {
    system: string;
    messages: NeutralMessage[];
    tools: ToolDefinition[];
  }): Promise<AssistantTurn> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: input.system },
        ...toOpenAIMessages(input.messages),
      ],
      tools: toOpenAITools(input.tools),
    });
    return fromOpenAIResponse(completion);
  }
}
