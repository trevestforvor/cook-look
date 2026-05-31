"use client";

import { useEffect, useRef, useState } from "react";
import { useChroma } from "@/lib/store";
import { AGENT_ENABLED } from "@/lib/config";

const SUGGESTIONS = [
  "Design a calm fintech palette from our brand blue (#2f6df6).",
  "This CTA doesn't pop — fix it.",
  "Audit my dark mode for accessibility.",
  "Make the whole thing warmer but keep contrast.",
  "Give me a triadic version.",
];

export function AssistPanel() {
  const chat = useChroma((s) => s.chat);
  const toolEvents = useChroma((s) => s.toolEvents);
  const busy = useChroma((s) => s.agentBusy);
  const error = useChroma((s) => s.agentError);
  const sendToAgent = useChroma((s) => s.sendToAgent);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!AGENT_ENABLED) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">Design assistant</h3>
          <p className="text-xs text-neutral-400">
            Steers the engine via tool calls — it never writes color values itself.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-xs leading-relaxed text-neutral-400">
          <p className="mb-2 font-medium text-neutral-300">
            Not available in this build.
          </p>
          <p>
            The AI assistant needs a server-side endpoint (it holds the LLM API
            keys), which isn&apos;t part of this static deployment. Everything
            else in the editor — harmonies, palette generation, accessibility
            audits, and token export — works fully here.
          </p>
          <p className="mt-2">
            To enable it, run the app with a server (
            <code className="font-mono text-neutral-300">pnpm dev</code>) or
            deploy a host that supports the{" "}
            <code className="font-mono text-neutral-300">/api/agent</code> route.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat, toolEvents, busy]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    void sendToAgent(text);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-100">Design assistant</h3>
        <p className="text-xs text-neutral-400">
          Steers the engine via tool calls — it never writes color values itself.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[360px] min-h-[160px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/50 p-3"
      >
        {chat.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-neutral-400">Try:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void sendToAgent(s)}
                disabled={busy}
                className="rounded-md border border-neutral-800 px-2.5 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              m.role === "user"
                ? "self-end bg-blue-600 text-white"
                : "self-start bg-neutral-800 text-neutral-100"
            }`}
          >
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="self-start rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-400">
            Investigating &amp; steering the engine…
          </div>
        )}
      </div>

      {toolEvents.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Engine tool calls
          </div>
          <ul className="flex flex-col gap-0.5 text-[11px] text-neutral-400">
            {toolEvents.map((e, i) => (
              <li key={i}>
                <span
                  className={`font-mono ${e.isError ? "text-red-400" : "text-green-400"}`}
                >
                  {e.name}
                </span>
                {summarizeArgs(e.arguments)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-2.5 text-xs text-amber-300">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Describe the product, brand, audience…"
          disabled={busy}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function summarizeArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof args.baseHue === "number") parts.push(`hue ${Math.round(args.baseHue)}°`);
  if (typeof args.newBaseHue === "number")
    parts.push(`hue ${Math.round(args.newBaseHue)}°`);
  if (typeof args.harmony === "string") parts.push(String(args.harmony));
  if (typeof args.newHarmony === "string") parts.push(String(args.newHarmony));
  if (typeof args.temperature === "string") parts.push(String(args.temperature));
  if (typeof args.saturation === "string") parts.push(`${args.saturation} sat`);
  if (typeof args.lightness === "string") parts.push(String(args.lightness));
  if (typeof args.color === "string") parts.push(String(args.color));
  return parts.length > 0 ? ` — ${parts.join(", ")}` : "";
}
