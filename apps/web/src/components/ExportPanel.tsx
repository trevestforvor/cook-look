"use client";

import { useMemo, useState } from "react";
import { toCssVariables, toJSON, toTailwindConfig } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { Button, SegmentedControl } from "@/components/ui";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<Tab>
          ariaLabel="Export format"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.id, label: t.label }))}
        />
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={copy}
            aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={download}
            aria-label={`Download ${active.label}`}
          >
            Download
          </Button>
        </div>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface-1 p-3 font-mono text-xs leading-relaxed text-ink-mid">
        {content}
      </pre>
    </div>
  );
}
