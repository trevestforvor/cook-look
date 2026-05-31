"use client";

import { useEffect, useRef, useState } from "react";
import { useChroma } from "@/lib/store";

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
        <h3 className="font-display text-sm font-medium text-ink-hi">
          Design assistant
        </h3>
        <p className="text-xs text-ink-mid">
          Steers the engine via tool calls — it never writes color values itself.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[360px] min-h-[160px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-surface-1 p-3"
      >
        {chat.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-mid">Try:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void sendToAgent(s)}
                disabled={busy}
                className="rounded-md border border-line px-2.5 py-1.5 text-left text-xs text-ink-mid transition hover:bg-surface-2 disabled:opacity-50"
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
                ? "self-end bg-accent text-bg"
                : "self-start bg-surface-2 text-ink-hi"
            }`}
          >
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="self-start rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-mid">
            Investigating &amp; steering the engine…
          </div>
        )}
      </div>

      {toolEvents.length > 0 && (
        <div className="rounded-lg border border-line bg-surface-1 p-2.5">
          <div className="mb-1 font-display text-[10px] font-medium uppercase tracking-wide text-ink-lo">
            Engine tool calls
          </div>
          <ul className="flex flex-col gap-0.5 text-[11px] text-ink-mid">
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
          className="flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-hi outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
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
