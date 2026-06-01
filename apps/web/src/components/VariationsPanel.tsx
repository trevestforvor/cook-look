"use client";

import { useId, useMemo, useState } from "react";
import { adjustColor, resolveSwatch, type AdjustIntent } from "@chroma/engine";
import { Panel, PanelHeader } from "@/components/ui";
import { useChroma } from "@/lib/store";

/**
 * VariationsPanel — palette-wide adjustments.
 *
 * Intended rail: the RIGHT rail (the adjustments / tools column alongside the
 * palette grid).
 *
 * Color rule: every color VALUE shown here is produced by the engine. The
 * mini-previews call {@link adjustColor} on the live palette's role OKLCH values
 * and convert the result to a display string via {@link resolveSwatch} (which
 * owns OKLCH→hex). No hex is hand-written and no color math happens in React.
 */

type VariationChip = {
  readonly key: string;
  readonly label: string;
  /** The adjustment axis for this chip (combined with the live intensity). */
  readonly intent: AdjustIntent;
};

const CHIPS: readonly VariationChip[] = [
  { key: "vibrant", label: "Vibrant", intent: { saturation: "more" } },
  { key: "muted", label: "Muted", intent: { saturation: "less" } },
  { key: "lighter", label: "Lighter", intent: { lightness: "lighter" } },
  { key: "darker", label: "Darker", intent: { lightness: "darker" } },
  { key: "warmer", label: "Warmer", intent: { temperature: "warmer" } },
  { key: "cooler", label: "Cooler", intent: { temperature: "cooler" } },
] as const;

const DEFAULT_INTENSITY = 0.2;

export function VariationsPanel() {
  // Read the live role OKLCH values straight off the engine palette. The
  // light-mode roles seed the previews; the adjustment itself runs through the
  // store's base color (applyAdjust), which rebuilds both modes.
  const roles = useChroma((s) => s.palette.light.roles);
  const applyAdjust = useChroma((s) => s.applyAdjust);

  const [intensity, setIntensity] = useState(DEFAULT_INTENSITY);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const sliderId = useId();
  const pct = Math.round(intensity * 100);

  // Three representative role colors (primary / secondary / accent) seed the
  // 3-dot previews. These are engine OKLCH values, never hand-written.
  const seeds = useMemo(
    () => [roles.primary.oklch, roles.secondary.oklch, roles.accent.oklch],
    [roles.primary, roles.secondary, roles.accent],
  );

  // Memoized 3-dot previews per chip at the current intensity. Each dot is the
  // engine's adjustColor result, converted to a display hex by resolveSwatch.
  const previews = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const chip of CHIPS) {
      const intent: AdjustIntent = { ...chip.intent, amount: intensity };
      map[chip.key] = seeds.map((color) => {
        const after = adjustColor({ color, intent }).after.oklch;
        return resolveSwatch(after).hex;
      });
    }
    return map;
  }, [seeds, intensity]);

  const handleChip = (chip: VariationChip) => {
    setActiveKey(chip.key);
    applyAdjust({ ...chip.intent, amount: intensity });
  };

  return (
    <Panel>
      <PanelHeader title="Variations" subtitle="Adjust the whole palette" />

      <div className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="Palette variations"
          className="grid grid-cols-2 gap-2"
        >
          {CHIPS.map((chip) => {
            const dots = previews[chip.key] ?? [];
            const isActive = activeKey === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleChip(chip)}
                aria-pressed={isActive}
                className={[
                  "group flex items-center justify-between gap-2 rounded-md",
                  "border bg-[var(--surface-2)] px-3 py-2 text-left text-sm",
                  "text-[var(--text)] transition-colors",
                  "hover:bg-[var(--surface-3)]",
                  "focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                  "focus-visible:ring-offset-[var(--surface-1)]",
                  "motion-reduce:transition-none",
                  isActive
                    ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--border)]",
                ].join(" ")}
              >
                <span className="font-medium">{chip.label}</span>
                <span
                  className="flex shrink-0 items-center gap-1"
                  aria-hidden="true"
                >
                  {dots.map((hex, i) => (
                    <span
                      key={i}
                      className="block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={sliderId}
            className="flex items-center justify-between text-xs text-[var(--text-2)]"
          >
            <span>Intensity</span>
            <span className="tabular-nums text-[var(--text)]" aria-hidden="true">
              {pct}%
            </span>
          </label>
          <input
            id={sliderId}
            type="range"
            className="chroma-slider"
            min={0}
            max={1}
            step={0.05}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            aria-label="Variation intensity"
            aria-valuetext={`${pct} percent`}
          />
        </div>
      </div>
    </Panel>
  );
}

export default VariationsPanel;
