"use client";

import { useMemo, useState } from "react";
import { toCssVariables, toJSON, toTailwindConfig } from "@chroma/engine";
import { useChroma } from "@/lib/store";

type Tab = "css" | "tailwind" | "json";

const TABS: { id: Tab; label: string; ext: string; mime: string }[] = [
  { id: "css", label: "CSS variables", ext: "css", mime: "text/css" },
  { id: "tailwind", label: "Tailwind", ext: "js", mime: "text/javascript" },
  { id: "json", label: "JSON", ext: "json", mime: "application/json" },
];

export function ExportPanel() {
  const palette = useChroma((s) => s.palette);
  const [tab, setTab] = useState<Tab>("css");
  const [copied, setCopied] = useState(false);

  const outputs = useMemo(
    () => ({
      css: toCssVariables(palette),
      tailwind: toTailwindConfig(palette),
      json: toJSON(palette),
    }),
    [palette],
  );

  const active = TABS.find((t) => t.id === tab)!;
  const content = outputs[tab];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const download = () => {
    const blob = new Blob([content], { type: active.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chroma-tokens.${active.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={copy}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={download}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            Download
          </button>
        </div>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
        {content}
      </pre>
    </div>
  );
}
