/**
 * The provider-neutral agent loop.
 *
 * model → tool call → execute against the ENGINE → return result → model
 * explains/iterates. This loop knows nothing about OpenAI vs. Anthropic; the
 * {@link LLMProvider} adapter normalizes all tool-calling differences below it.
 */
import { buildSystemPrompt } from "./system-prompt.js";
import { executeTool, paletteSummary, TOOL_DEFINITIONS } from "./tools.js";
import type {
  AgentRequest,
  AgentResponse,
  AgentState,
  LLMProvider,
  NeutralMessage,
  ToolEvent,
  ToolResult,
} from "./types.js";

const MAX_ITERATIONS = 8;

/** A compact, model-facing snapshot of the current brief + palette. */
function contextMessage(state: AgentState): string {
  const brief = state.brief
    ? JSON.stringify(state.brief)
    : "none yet — investigate and synthesize one before generating colors";
  const palette = state.palette
    ? JSON.stringify(paletteSummary(state.palette))
    : "none yet";
  return [
    "CURRENT DESIGN STATE (persisted in the app; build on it).",
    `Design brief: ${brief}`,
    `Palette: ${palette}`,
    "Remember: investigate → brief → translate → generate → audit. Never output color values; call engine tools.",
  ].join("\n\n");
}

/** Build the initial neutral transcript: state context, then the chat history. */
function buildMessages(req: AgentRequest, state: AgentState): NeutralMessage[] {
  const messages: NeutralMessage[] = [
    { role: "user", text: contextMessage(state) },
  ];
  for (const m of req.messages) {
    messages.push({ role: m.role, text: m.content });
  }
  return messages;
}

/**
 * Run one agent turn: drive the model through tool calls against the engine
 * until it produces a final text reply (or hits the iteration cap). Pure with
 * respect to the engine — all randomness/IO is inside the provider.
 */
export async function runDesignAgent(
  req: AgentRequest,
  provider: LLMProvider,
): Promise<AgentResponse> {
  const system = buildSystemPrompt();
  let state: AgentState = { palette: req.palette, brief: req.brief };
  const messages = buildMessages(req, state);
  const toolEvents: ToolEvent[] = [];
  let lastText = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const turn = await provider.complete({
      system,
      messages,
      tools: TOOL_DEFINITIONS,
    });
    if (turn.text) lastText = turn.text;

    if (turn.toolCalls.length === 0) {
      return {
        reply: turn.text || lastText,
        palette: state.palette,
        brief: state.brief,
        toolEvents,
        provider: provider.name,
      };
    }

    messages.push({
      role: "assistant",
      text: turn.text,
      toolCalls: turn.toolCalls,
    });

    const toolResults: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      const { result, state: next, isError } = executeTool(
        call.name,
        call.arguments,
        state,
      );
      state = next;
      toolEvents.push({
        name: call.name,
        arguments: call.arguments,
        result,
        isError,
      });
      toolResults.push({
        id: call.id,
        name: call.name,
        content: JSON.stringify(result),
        isError,
      });
    }
    messages.push({ role: "user", toolResults });
  }

  return {
    reply:
      lastText ||
      "I reached the tool-iteration limit. Here is the current state of the palette.",
    palette: state.palette,
    brief: state.brief,
    toolEvents,
    provider: provider.name,
  };
}
