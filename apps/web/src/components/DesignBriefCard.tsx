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
      <div className="rounded-xl border border-dashed border-line bg-surface-0 p-4 text-xs leading-relaxed text-ink-mid">
        <span className="font-semibold text-ink-hi">No design brief yet.</span>{" "}
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
    <div className="rounded-xl border border-line bg-surface-0 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-medium text-ink-hi">
          Design brief
        </h3>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-mid">
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

      <div className="mt-3 rounded-lg bg-surface-1 p-2.5">
        <div className="mb-1 font-display text-[10px] font-medium uppercase tracking-wide text-ink-lo">
          Rationale
        </div>
        <p className="text-xs leading-relaxed text-ink-mid">
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
          className="flex-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink-hi outline-none disabled:opacity-50"
        />
        <button
          onClick={submitRevision}
          disabled={busy}
          className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
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
      <div className="font-display text-[10px] font-medium uppercase tracking-wide text-ink-lo">
        {label}
      </div>
      <div className="capitalize text-ink-hi">{value}</div>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="font-display text-[10px] font-medium uppercase tracking-wide text-ink-lo">
        {label}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-hi"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
