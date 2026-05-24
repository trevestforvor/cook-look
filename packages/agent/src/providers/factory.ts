/**
 * Provider selection from configuration. This is the ONLY place that decides
 * which concrete provider to construct; everything above it is provider-neutral.
 * Switching providers is a single env var (LLM_PROVIDER) — zero code changes.
 */
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import type { LLMProvider } from "../types.js";

/** Thrown when the selected provider has no API key configured. */
export class MissingApiKeyError extends Error {
  constructor(public readonly provider: string) {
    super(
      `Missing API key for provider "${provider}". Set the corresponding *_API_KEY environment variable.`,
    );
    this.name = "MissingApiKeyError";
  }
}

/** Thrown when LLM_PROVIDER is not a recognized value. */
export class UnknownProviderError extends Error {
  constructor(public readonly provider: string) {
    super(`Unknown LLM_PROVIDER "${provider}". Use "openai" or "anthropic".`);
    this.name = "UnknownProviderError";
  }
}

export interface ProviderEnv {
  LLM_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-7";

/**
 * Construct the configured {@link LLMProvider} from environment variables.
 *
 * @throws {MissingApiKeyError} if the chosen provider's key is absent.
 * @throws {UnknownProviderError} if LLM_PROVIDER is unrecognized.
 */
export function createProvider(env: ProviderEnv): LLMProvider {
  const choice = (env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();

  if (choice === "openai") {
    if (!env.OPENAI_API_KEY) throw new MissingApiKeyError("openai");
    return new OpenAIProvider(
      env.OPENAI_API_KEY,
      env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    );
  }
  if (choice === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new MissingApiKeyError("anthropic");
    return new AnthropicProvider(
      env.ANTHROPIC_API_KEY,
      env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    );
  }
  throw new UnknownProviderError(choice);
}
