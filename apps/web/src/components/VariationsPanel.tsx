"use client";

import { useEffect, useRef, useState } from "react";
import { adjustPalette, type AdjustIntent, type Palette } from "@chroma/engine";
import { Button, Panel, PanelHeader } from "@/components/ui";
import { useChroma } from "@/lib/store";

/**
 * VariationsPanel — reversible, palette-wide adjustments via three bipolar
 * sliders (Muted↔Vibrant, Darker↔Lighter, Cooler↔Warmer), each centered at 0 =
 * "your palette".
 *
 * Why sliders, not buttons: a button accumulator made it easy to slam an axis
 * into its clamp and feel "stuck" (e.g. two Lighter clicks at high intensity →
 * primary pinned at pure white, unrecoverable-feeling). A slider shows its
 * position and you just drag back to center.
 *
 * Why it stays safe: the panel keeps a frozen BASELINE palette and recomputes
 * from it on every change by applying the net per-axis intents — it never
 * compounds on the already-adjusted palette, so the baseline is preserved and
 * every move is reversible. External edits (wheel, harmony, a fix) re-sync the
 * baseline and recenter the sliders. The engine additionally clamps adjusted
 * lightness to a usable band so primary can't be stranded at white/black.
 *
 * Color rule: every value comes from the engine ({@link adjustPalette}); the
 * preview dots run the SAME path as committing, so preview matches result.
 */

type Axis = "sat" | "light" | "temp";

interface AxisDef {
  readonly axis: Axis;
  readonly label: string;
  readonly low: string; // label at slider min (−1)
  readonly high: string; // label at slider max (+1)
  /** CSS gradient painted on the track (low → center → high). */
  readonly track: string;
}

// Max |amount| each slider end reaches. Saturation's negative side stays > 0 so
// "fully muted" is a soft gray-ish, never a dead flat gray; lightness is modest
// so the band clamp is rarely hit; temperature can rotate fully to the anchor.
const AXIS_RANGE: Record<Axis, number> = { sat: 1.2, light: 0.45, temp: 1 };

// Slider positions within ±this of center snap to exactly 0 (your palette), so
// returning to base values is a reliable catch, not a pixel hunt. The step is
// 0.02, so this is ~3 steps of magnetism around the midpoint.
const MIDPOINT_SNAP = 0.06;

const AXES: readonly AxisDef[] = [
  {
    axis: "sat",
    label: "Saturation",
    low: "Muted",
    high: "Vibrant",
    track:
      "linear-gradient(to right, var(--surface-3), var(--palette-primary, var(--accent)))",
  },
  {
    axis: "light",
    label: "Lightness",
    low: "Darker",
    high: "Lighter",
    track: "linear-gradient(to right, #14121a, #8c86a8, #f4f2fb)",
  },
  {
    axis: "temp",
    label: "Temperature",
    low: "Cooler",
    high: "Warmer",
    track:
      "linear-gradient(to right, oklch(0.7 0.16 250), oklch(0.85 0.04 200), oklch(0.78 0.16 60))",
  },
];

type Net = { sat: number; light: number; temp: number };
const ZERO: Net = { sat: 0, light: 0, temp: 0 };

/** Slider position (−1…1) → signed amount for that axis. */
function posToAmount(axis: Axis, pos: number): number {
  return pos * AXIS_RANGE[axis];
}

/** The signed net (in amount units) → one intent per non-zero axis. */
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

function buildFromNet(baseline: Palette, net: Net): Palette {
  let p = baseline;
  for (const intent of netToIntents(net)) p = adjustPalette({ palette: p, intent });
  return p;
}

export function VariationsPanel() {
  const livePalette = useChroma((s) => s.palette);
  const applyVariations = useChroma((s) => s.applyVariations);

  // Slider positions, −1…1, 0 = baseline. Net amounts are derived from these.
  const [pos, setPos] = useState<Net>(ZERO);

  const baselineRef = useRef(livePalette);
  const lastProducedRef = useRef(livePalette);

  // External change (wheel / harmony / fix / suggestion / fine-tune) → adopt it
  // as the new baseline and recenter the sliders.
  useEffect(() => {
    if (livePalette !== lastProducedRef.current) {
      baselineRef.current = livePalette;
      lastProducedRef.current = livePalette;
      setPos(ZERO);
    }
  }, [livePalette]);

  const netFromPos = (p: Net): Net => ({
    sat: posToAmount("sat", p.sat),
    light: posToAmount("light", p.light),
    temp: posToAmount("temp", p.temp),
  });

  const commit = (nextPos: Net) => {
    applyVariations(baselineRef.current, netToIntents(netFromPos(nextPos)));
    lastProducedRef.current = useChroma.getState().palette;
    setPos(nextPos);
  };

  // Snap to the midpoint (0 = your palette) when the user lands close to it, so
  // they can reliably return to base values without pixel-hunting for dead center.
  const onAxis = (axis: Axis, value: number) => {
    const snapped = Math.abs(value) <= MIDPOINT_SNAP ? 0 : value;
    commit({ ...pos, [axis]: snapped });
  };
  const reset = () => commit(ZERO);

  const dirty = pos.sat !== 0 || pos.light !== 0 || pos.temp !== 0;

  // Preview dots at each slider end, from the baseline (so they read as "what
  // this direction does"). Same engine path as commit.
  const endPreview = (axis: Axis, dir: 1 | -1): string[] => {
    const p = buildFromNet(baselineRef.current, {
      ...netFromPos(pos),
      [axis]: posToAmount(axis, dir),
    });
    return [
      p.light.roles.primary.hex,
      p.light.roles.secondary.hex,
      p.light.roles.accent.hex,
    ];
  };

  return (
    <Panel>
      <PanelHeader title="Variations" subtitle="Adjust the whole palette" />

      <div className="flex flex-col gap-4">
        {AXES.map((a) => (
          <div key={a.axis} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <EndLabel text={a.low} dots={endPreview(a.axis, -1)} />
              <EndLabel text={a.high} dots={endPreview(a.axis, 1)} alignEnd />
            </div>
            <input
              type="range"
              className="chroma-slider"
              min={-1}
              max={1}
              step={0.02}
              value={pos[a.axis]}
              onChange={(e) => onAxis(a.axis, Number(e.target.value))}
              aria-label={`${a.label}: ${a.low} to ${a.high}`}
              aria-valuetext={
                pos[a.axis] === 0
                  ? "your palette"
                  : `${Math.round(Math.abs(pos[a.axis]) * 100)}% ${
                      pos[a.axis] > 0 ? a.high : a.low
                    }`
              }
              style={{ ["--track-bg" as string]: a.track }}
            />
          </div>
        ))}

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

function EndLabel({
  text,
  dots,
  alignEnd = false,
}: {
  text: string;
  dots: string[];
  alignEnd?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[var(--text-2)] ${
        alignEnd ? "flex-row-reverse" : ""
      }`}
    >
      <span className="font-medium">{text}</span>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {dots.map((hex, i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: hex }}
          />
        ))}
      </span>
    </span>
  );
}

export default VariationsPanel;
