"use client";

import { useState } from "react";
import { useChroma } from "@/lib/store";

/**
 * The DesignBrief as a visible, revisable artifact above the palette — so the
 * user can see WHY these colors were chosen and redirect the agent to re-derive.
 */
export function DesignBriefCard() {
  const brief = useChroma((s) => s.brief);
  const sendToAgent = useChroma((s) => s.sendToAgent);
  const busy = useChroma((s) => s.agentBusy);
  const [revision, setRevision] = useState("");

  if (!brief) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 p-4 text-xs leading-relaxed text-neutral-400">
        <span className="font-semibold text-neutral-200">No design brief yet.</span>{" "}
        Ask the assistant to design a palette (e.g. “a calm fintech palette from
        our brand blue”). It investigates first, synthesizes a brief here, and
        traces every color choice back to it.
      </div>
    );
  }

  const submitRevision = () => {
    const text = revision.trim();
    if (!text) return;
    void sendToAgent(`Revise the brief: ${text}. Then re-derive the palette.`);
    setRevision("");
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">Design brief</h3>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
          v{brief.version}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <Field label="Audience" value={brief.audience} />
        <Field label="Domain" value={brief.domain} />
        {brief.platform && <Field label="Platform" value={brief.platform} />}
        <Chips label="Tone" items={brief.toneKeywords} />
        {brief.emotionalTargets.length > 0 && (
          <Chips label="Emotional targets" items={brief.emotionalTargets} />
        )}
        {brief.brandValues.length > 0 && (
          <Chips label="Brand values" items={brief.brandValues} />
        )}
        {brief.culturalNotes.length > 0 && (
          <Chips label="Cultural notes" items={brief.culturalNotes} />
        )}
        {brief.constraints.length > 0 && (
          <Chips label="Constraints" items={brief.constraints} />
        )}
        <Chips label="Hue families" items={brief.direction.hueFamilies} />
        <Field label="Harmony" value={brief.direction.harmony} />
      </div>

      <div className="mt-3 rounded-lg bg-neutral-950/60 p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Rationale
        </div>
        <p className="text-xs leading-relaxed text-neutral-300">
          {brief.direction.rationale}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitRevision()}
          placeholder="Redirect the brief, e.g. “more premium”"
          disabled={busy}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 outline-none disabled:opacity-50"
        />
        <button
          onClick={submitRevision}
          disabled={busy}
          className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Re-derive
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="capitalize text-neutral-200">{value}</div>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
