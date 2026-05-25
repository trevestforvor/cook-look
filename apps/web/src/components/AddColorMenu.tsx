// apps/web/src/components/AddColorMenu.tsx
"use client";

import { useState } from "react";
import { parseToOklch } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { ALL_ROLES } from "@/lib/roles";

export function AddColorMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorInput, setColorInput] = useState("#6b21a8");
  const [error, setError] = useState<string | null>(null);

  const visibleRoles = useChroma((s) => s.visibleRoles);
  const showRole = useChroma((s) => s.showRole);
  const addCustomSwatch = useChroma((s) => s.addCustomSwatch);

  const hidden = ALL_ROLES.filter((r) => !visibleRoles.includes(r));

  const submitCustom = () => {
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
              className="btn-press rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg"
            >
              Add custom color
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
