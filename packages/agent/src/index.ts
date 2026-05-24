/**
 * @chroma/agent — a provider-agnostic AI design agent for the Chroma engine.
 *
 * The agent reasons about design intent and steers the engine via tool calls.
 * It never emits color values directly (enforced in the tool input types). One
 * LLMProvider interface sits over OpenAI and Anthropic adapters that normalize
 * all tool-calling differences; the agent loop above is provider-neutral.
 */

export * from "./types.js";
export { runDesignAgent } from "./agent.js";
export { buildSystemPrompt } from "./system-prompt.js";
export { METHODOLOGY, METHODOLOGY_VERSION } from "./methodology.js";
export {
  AGENT_TOOLS,
  TOOL_DEFINITIONS,
  executeTool,
  paletteSummary,
  type AgentTool,
} from "./tools.js";

export {
  createProvider,
  MissingApiKeyError,
  UnknownProviderError,
  type ProviderEnv,
} from "./providers/factory.js";
export {
  OpenAIProvider,
  toOpenAIMessages,
  toOpenAITools,
  fromOpenAIResponse,
} from "./providers/openai.js";
export {
  AnthropicProvider,
  toAnthropicMessages,
  toAnthropicTools,
  fromAnthropicResponse,
} from "./providers/anthropic.js";
