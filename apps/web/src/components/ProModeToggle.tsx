"use client";

import { useChroma } from "@/lib/store";

/**
 * Pro-mode switch. Off (default): the UI stays clean — swatches show name + hex.
 * On: raw oklch()/APCA numbers are revealed across the editor (progressive
 * disclosure). A pressed-state pill so it reads as a toggle, not an action.
 */
export function ProModeToggle() {
  const proMode = useChroma((s) => s.proMode);
  const setProMode = useChroma((s) => s.setProMode);

  return (
    <button
      onClick={() => setProMode(!proMode)}
      role="switch"
      aria-checked={proMode}
      aria-label="Pro mode — show raw color numbers"
      title="Pro mode: reveal raw oklch()/APCA values"
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors duration-[120ms] ease-standard ${
        proMode
          ? "border-transparent chroma-spectrum-fill text-white shadow-1"
          : "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]"
      }`}
    >
      <span aria-hidden className="font-mono text-[11px]">
        {"{}"}
      </span>
      Pro
    </button>
  );
}
