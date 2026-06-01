"use client";

import { useMemo, useState } from "react";
import { Panel, PanelHeader, IconButton } from "@/components/ui";
import { useChroma, paletteSuggestions } from "@/lib/store";
import { resolveSwatch } from "@chroma/engine";
import type { Oklch } from "@chroma/engine";

/**
 * SmartSuggestionsPanel
 * Intended rail: RIGHT rail (inspector / tools column).
 *
 * Surfaces engine-derived "colors that fit" the current palette. Every color
 * VALUE comes from the engine: `paletteSuggestions(palette)` composes neutral
 * ramp steps, `adjustColor` variants, and `harmonyHues` partners into Oklch[],
 * which we resolve to hex via `resolveSwatch`. The UI never hand-writes hex or
 * does color math. Clicking a swatch adds it via the store's
 * `addCustomSwatch(name, color)`.
 *
 * Shuffle is deterministic (SSR-safe): a React state counter rotates which/what
 * order of swatches show — both globally (group order) and per-group (swatch
 * order/offset). No random/time APIs are called at module scope or during render.
 */

const MAX_PER_GROUP = 6;

/** Pure, non-mutating rotation of `arr` left by `offset` (handles negatives). */
function rotate<T>(arr: readonly T[], offset: number): T[] {
  const n = arr.length;
  if (n === 0) return [];
  const k = ((offset % n) + n) % n;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

export function SmartSuggestionsPanel() {
  const palette = useChroma((s) => s.palette);
  const addCustomSwatch = useChroma((s) => s.addCustomSwatch);

  // The shuffle counter is bumped ONLY by the user action below — never from
  // random/time at render, so SSR and the first client render agree.
  const [shuffleTick, setShuffleTick] = useState(0);

  const groups = useMemo(() => paletteSuggestions(palette), [palette]);

  // Global rotation reorders the groups; a per-group offset (index + tick)
  // shifts each group's swatch order differently on every shuffle.
  const rotatedGroups = useMemo(() => {
    const globalOrder = rotate(groups, shuffleTick);
    return globalOrder.map((group, gi) => ({
      category: group.category,
      swatches: rotate(group.swatches, shuffleTick + gi).slice(0, MAX_PER_GROUP),
    }));
  }, [groups, shuffleTick]);

  const isEmpty = rotatedGroups.every((g) => g.swatches.length === 0);

  return (
    <Panel>
      <PanelHeader
        title="Smart Palette Suggestions"
        subtitle="Add colors that fit"
        action={
          <IconButton
            label="Shuffle suggestions"
            size="sm"
            onClick={() => setShuffleTick((t) => t + 1)}
          >
            <ShuffleIcon />
          </IconButton>
        }
      />

      {isEmpty ? (
        <p className="text-[13px] leading-5 text-[var(--text-3)]" role="status">
          No suggestions for this palette yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rotatedGroups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {group.category}
              </h3>
              <ul
                className="flex gap-2 overflow-x-auto pb-1"
                style={{ scrollbarWidth: "thin" }}
              >
                {group.swatches.map((color: Oklch, i) => {
                  const hex = resolveSwatch(color).hex;
                  const name = `${group.category} ${i + 1}`;
                  return (
                    <li key={`${group.category}-${i}-${hex}`} className="shrink-0">
                      <button
                        type="button"
                        aria-label={`Add ${hex} to palette`}
                        title={hex}
                        onClick={() => addCustomSwatch(name, color)}
                        className="h-12 w-12 rounded-lg border border-[var(--border)] outline-none transition-transform duration-[120ms] ease-standard hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] motion-reduce:transition-none motion-reduce:hover:scale-100"
                        style={{ backgroundColor: hex }}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ShuffleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export default SmartSuggestionsPanel;
