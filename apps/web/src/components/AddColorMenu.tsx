// apps/web/src/components/AddColorMenu.tsx
"use client";

import { useState } from "react";
import { parseToOklch } from "@chroma/engine";
import { useChroma, MAX_CUSTOM_SWATCHES } from "@/lib/store";
import { ALL_ROLES } from "@/lib/roles";

export function AddColorMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorInput, setColorInput] = useState("#6b21a8");
  const [error, setError] = useState<string | null>(null);

  const visibleRoles = useChroma((s) => s.visibleRoles);
  const showRole = useChroma((s) => s.showRole);
  const addCustomSwatch = useChroma((s) => s.addCustomSwatch);
  const addBrandColor = useChroma((s) => s.addBrandColor);
  const customCount = useChroma((s) => s.customSwatches.length);

  const hidden = ALL_ROLES.filter((r) => !visibleRoles.includes(r));
  const atCap = customCount >= MAX_CUSTOM_SWATCHES;
  const capHint = `Max ${MAX_CUSTOM_SWATCHES} extra brand colors`;

  const submitCustom = () => {
    if (atCap) return;
    const parsed = parseToOklch(colorInput.trim());
    if (!parsed) {
      setError("Enter a valid color (hex, rgb(), or oklch()).");
      return;
    }
    addCustomSwatch(name, parsed);
    setName("");
    setColorInput("#6b21a8");
    setError(null);
    setOpen(false);
  };

  const addBrand = () => {
    if (atCap) return;
    addBrandColor();
    // Keep the popover open so several can be added quickly; the button
    // disables itself at the cap.
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-press min-h-[32px] rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
      >
        + Add color
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-line bg-surface-0 p-3 shadow-lg">
          <div className="mb-3">
            <button
              onClick={addBrand}
              disabled={atCap}
              title={atCap ? capHint : "Auto-fill an open harmony slot (or a spaced default)"}
              className="btn-press w-full rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-bg transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add brand color
            </button>
            {atCap && (
              <div className="mt-1 text-[11px] text-ink-low">{capHint}</div>
            )}
          </div>

          {hidden.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-low">
                Re-add engine roles
              </div>
              <div className="flex flex-wrap gap-1">
                {hidden.map((r) => (
                  <button
                    key={r}
                    onClick={() => showRole(r)}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-mid hover:bg-surface-2"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-low">
            Custom color
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded border border-line bg-surface-1 px-2 py-1 text-xs text-ink-hi"
            />
            <input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
              placeholder="#6b21a8 or oklch(0.5 0.2 305)"
              className="rounded border border-line bg-surface-1 px-2 py-1 font-mono text-xs text-ink-hi"
            />
            {error && <div className="text-[11px] text-amber-400">{error}</div>}
            <button
              onClick={submitCustom}
              disabled={atCap}
              title={atCap ? capHint : undefined}
              className="btn-press rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add custom color
            </button>
            {atCap && (
              <div className="text-[11px] text-ink-low">{capHint}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
