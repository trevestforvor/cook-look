"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { adjustPalette, type AdjustIntent } from "@chroma/engine";
import { Button, Panel, PanelHeader } from "@/components/ui";
import { useChroma } from "@/lib/store";

/**
 * VariationsPanel — reversible, palette-wide adjustments.
 *
 * Intended rail: the RIGHT rail (adjustments column beside the palette grid).
 *
 * How it stays reversible (the important part): the panel keeps a frozen
 * BASELINE palette plus a signed net amount per axis (saturation / lightness /
 * temperature). Every click recomputes the palette from the baseline by applying
 * the net intents — it never compounds on the already-adjusted palette. So
 * Muted→Vibrant returns to the baseline, and repeated Muted can't ratchet chroma
 * into an unrecoverable gray (the net is clamped). If the palette changes from
 * elsewhere (wheel, harmony, a fix), the baseline re-syncs and the nets reset.
 *
 * Color rule: every value comes from the engine ({@link adjustPalette}); the
 * 3-dot previews run the SAME path as a click, so preview matches result.
 */

type Axis = "sat" | "light" | "temp";

type VariationChip = {
  readonly key: string;
  readonly label: string;
  readonly axis: Axis;
  /** +1 nudges the axis up (vibrant/lighter/warmer); -1 down. */
  readonly dir: 1 | -1;
};

const CHIPS: readonly VariationChip[] = [
  { key: "vibrant", label: "Vibrant", axis: "sat", dir: 1 },
  { key: "muted", label: "Muted", axis: "sat", dir: -1 },
  { key: "lighter", label: "Lighter", axis: "light", dir: 1 },
  { key: "darker", label: "Darker", axis: "light", dir: -1 },
  { key: "warmer", label: "Warmer", axis: "temp", dir: 1 },
  { key: "cooler", label: "Cooler", axis: "temp", dir: -1 },
] as const;

const DEFAULT_INTENSITY = 0.4;

type Net = { sat: number; light: number; temp: number };
const ZERO: Net = { sat: 0, light: 0, temp: 0 };

// Per-axis clamps on the accumulated net. The lower saturation bound keeps Muted
// from driving chroma to gray (factor = 1 − amount·1.5, so −0.5 → 0.25, never 0).
const CLAMP: Record<Axis, [number, number]> = {
  sat: [-0.5, 2],
  light: [-0.6, 0.6],
  temp: [-1, 1],
};

const clampAxis = (axis: Axis, v: number) =>
  Math.min(CLAMP[axis][1], Math.max(CLAMP[axis][0], v));

/** Turn the signed net into one intent per non-zero axis (applied from baseline). */
function netToIntents(net: Net): AdjustIntent[] {
  const out: AdjustIntent[] = [];
  if (net.sat !== 0)
    out.push({ saturation: net.sat > 0 ? "more" : "less", amount: Math.abs(net.sat) });
  if (net.light !== 0)
    out.push({ lightness: net.light > 0 ? "lighter" : "darker", amount: Math.abs(net.light) });
  if (net.temp !== 0)
    out.push({ temperature: net.temp > 0 ? "warmer" : "cooler", amount: Math.abs(net.temp) });
  return out;
}

export function VariationsPanel() {
  const livePalette = useChroma((s) => s.palette);
  const applyVariations = useChroma((s) => s.applyVariations);

  const [intensity, setIntensity] = useState(DEFAULT_INTENSITY);
  const [net, setNet] = useState<Net>(ZERO);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // The baseline we vary FROM, and the last palette WE produced (to tell our own
  // updates apart from external edits).
  const baselineRef = useRef(livePalette);
  const lastProducedRef = useRef(livePalette);

  // External change (wheel / harmony / fix / suggestion) → re-baseline + reset.
  useEffect(() => {
    if (livePalette !== lastProducedRef.current) {
      baselineRef.current = livePalette;
      lastProducedRef.current = livePalette;
      setNet(ZERO);
      setActiveKey(null);
    }
  }, [livePalette]);

  const sliderId = useId();
  const pct = Math.round(intensity * 100);

  const apply = (next: Net, key: string | null) => {
    applyVariations(baselineRef.current, netToIntents(next));
    lastProducedRef.current = useChroma.getState().palette;
    setNet(next);
    setActiveKey(key);
  };

  const handleChip = (chip: VariationChip) => {
    const cur = net[chip.axis];
    const next = clampAxis(chip.axis, cur + chip.dir * intensity);
    apply({ ...net, [chip.axis]: next }, chip.key);
  };

  const reset = () => apply(ZERO, null);
  const dirty = net.sat !== 0 || net.light !== 0 || net.temp !== 0;

  // 3-dot previews: run the SAME adjustPalette path a click would, from the
  // baseline at the CURRENT net plus one more step of this chip, then read
  // primary/secondary/accent. Preview therefore matches the click result.
  const previews = useMemo(() => {
    const base = baselineRef.current;
    const map: Record<string, string[]> = {};
    for (const chip of CHIPS) {
      const cur = net[chip.axis];
      const next = clampAxis(chip.axis, cur + chip.dir * intensity);
      const p = applyVariationsPreview(base, { ...net, [chip.axis]: next });
      map[chip.key] = [
        p.light.roles.primary.hex,
        p.light.roles.secondary.hex,
        p.light.roles.accent.hex,
      ];
    }
    return map;
    // livePalette in deps so previews refresh after re-baseline.
  }, [net, intensity, livePalette]);

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
            // Active = this axis is currently pushed in this chip's direction.
            const axisNet = net[chip.axis];
            const isActive =
              activeKey === chip.key ||
              (axisNet !== 0 && Math.sign(axisNet) === chip.dir);
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

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-3)]">
            {dirty ? "Adjusted from your palette" : "Matches your palette"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={!dirty}
            aria-label="Reset variations to your palette"
          >
            Reset
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Pure preview of what the net would produce, mirroring the store's
 * applyVariations loop (baseline → adjustPalette per intent). Kept here so the
 * 3-dot previews are exactly the click result, with no store mutation.
 */
function applyVariationsPreview(
  baseline: Parameters<typeof adjustPalette>[0]["palette"],
  net: Net,
) {
  let p = baseline;
  for (const intent of netToIntents(net)) {
    p = adjustPalette({ palette: p, intent });
  }
  return p;
}

export default VariationsPanel;
