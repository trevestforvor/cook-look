/**
 * Anthropic provider adapter.
 *
 * All Anthropic-specific tool-calling shape (tool_use / tool_result content
 * blocks, system-as-blocks with prompt caching) is confined to this file. The
 * mapping functions are pure and unit-tested; the class is the thin IO wrapper.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  AssistantTurn,
  LLMProvider,
  NeutralMessage,
  ToolCall,
  ToolDefinition,
} from "../types.js";

/** Neutral transcript → Anthropic message params. */
export function toAnthropicMessages(
  messages: NeutralMessage[],
): Anthropic.MessageParam[] {
  return messages.map((m): Anthropic.MessageParam => {
    if (m.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const call of m.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }
      return { role: "assistant", content };
    }
    // user
    if (m.toolResults && m.toolResults.length > 0) {
      const content: Anthropic.ContentBlockParam[] = m.toolResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.content,
        is_error: r.isError ?? false,
      }));
      return { role: "user", content };
    }
    return { role: "user", content: m.text ?? "" };
  });
}

/** Neutral tool defs → Anthropic tools. */
export function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));
}

/** Anthropic response → neutral assistant turn. */
export function fromAnthropicResponse(message: Anthropic.Message): AssistantTurn {
  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: (block.input ?? {}) as Record<string, unknown>,
      });
    }
  }
  return { text, toolCalls };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(input: {
    system: string;
    messages: NeutralMessage[];
    tools: ToolDefinition[];
  }): Promise<AssistantTurn> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      // The methodology + rules are stable, so cache the system prefix.
      system: [
        { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
      ],
      tools: toAnthropicTools(input.tools),
      messages: toAnthropicMessages(input.messages),
    });
    return fromAnthropicResponse(message);
  }
}
