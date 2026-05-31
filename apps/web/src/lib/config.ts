/**
 * Build-time flag for whether the AI design assistant is available.
 *
 * The assistant depends on the server-side `/api/agent` route (it holds the
 * LLM API keys and runs the agent loop), which can't exist in a fully static
 * export. Static builds set NEXT_PUBLIC_AGENT_ENABLED="false" so the UI can
 * degrade gracefully; everything else in the editor is pure client-side and
 * keeps working. Unset (the default) means enabled — `pnpm dev` and any
 * server deployment behave exactly as before.
 */
export const AGENT_ENABLED = process.env.NEXT_PUBLIC_AGENT_ENABLED !== "false";
