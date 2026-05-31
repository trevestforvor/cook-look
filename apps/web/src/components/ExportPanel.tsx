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
      <div className="flex items-center justify-between gap-2">
        {/* Tab buttons — min 36px height for touch targets */}
        <div role="tablist" aria-label="Export format" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`btn-press min-h-[36px] rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0 ${
                tab === t.id
                  ? "bg-ink-hi text-bg"
                  : "text-ink-mid hover:text-ink-hi"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={copy}
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            className="btn-press min-h-[36px] rounded-md border border-line px-2.5 py-1 text-xs text-ink-mid transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={download}
            aria-label={`Download ${active.label}`}
            className="btn-press min-h-[36px] rounded-md border border-line px-2.5 py-1 text-xs text-ink-mid transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0"
          >
            Download
          </button>
        </div>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface-1 p-3 font-mono text-xs leading-relaxed text-ink-mid">
        {content}
      </pre>
    </div>
  );
}
