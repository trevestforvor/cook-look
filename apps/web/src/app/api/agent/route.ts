import { NextResponse } from "next/server";
import {
  createProvider,
  MissingApiKeyError,
  runDesignAgent,
  UnknownProviderError,
  type AgentRequest,
} from "@chroma/agent";

// The agent must run server-side: it reads provider API keys from the
// environment, which must never reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: AgentRequest;
  try {
    body = (await request.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "Request must include at least one message." },
      { status: 400 },
    );
  }

  let provider;
  try {
    provider = createProvider({
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError || err instanceof UnknownProviderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await runDesignAgent(
      {
        messages: body.messages,
        palette: body.palette ?? null,
        brief: body.brief ?? null,
      },
      provider,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error.";
    return NextResponse.json(
      { error: `Agent failed: ${message}` },
      { status: 502 },
    );
  }
}
