"use client";

import { useEffect, useRef, useState } from "react";
import { resolveSwatch, type HarmonyType } from "@chroma/engine";
import { useChroma, SRGB_MAX_C, UNRESTRICTED_MAX_C } from "@/lib/store";
import { useRafThrottle } from "@/lib/use-raf-throttle";
import { Dropdown } from "@/components/Dropdown";
import { Slider } from "@/components/Slider";

const HARMONIES: { value: HarmonyType; label: string }[] = [
  { value: "complementary", label: "Complementary" },
  { value: "split-complementary", label: "Split-complementary" },
  { value: "double-split-complementary", label: "Double-split-complementary" },
  { value: "analogous", label: "Analogous" },
  { value: "monochromatic", label: "Monochromatic" },
  { value: "triadic", label: "Triadic" },
  { value: "tetradic", label: "Tetradic" },
  { value: "square", label: "Square" },
  { value: "rectangular", label: "Rectangular" },
  { value: "compound", label: "Compound" },
  { value: "shades", label: "Shades" },
];

export function Controls() {
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const setHarmony = useChroma((s) => s.setHarmony);
  const setSpan = useChroma((s) => s.setSpan);
  const setSpanLive = useChroma((s) => s.setSpanLive);
  const setBase = useChroma((s) => s.setBase);
  const setBaseLive = useChroma((s) => s.setBaseLive);
  const setBaseFromString = useChroma((s) => s.setBaseFromString);
  const unrestricted = useChroma((s) => s.unrestrictedChroma);
  const setUnrestrictedChroma = useChroma((s) => s.setUnrestrictedChroma);
  const maxC = unrestricted ? UNRESTRICTED_MAX_C : SRGB_MAX_C;

  // While dragging a slider, update only the cheap "live" state (no palette
  // rebuild), coalesced to one frame; commit the full rebuild once on release.
  const liveBase = useRafThrottle(setBaseLive);
  const liveSpan = useRafThrottle(setSpanLive);
  const pendingC = useRef(base.c);
  const pendingSpan = useRef(span);

  const baseHex = useChroma((s) => s.palette.baseColor);
  // The field shows the actual BASE color you set (round-trips your input), not
  // the derived primary role swatch (which is a fixed mid-tone ramp step and
  // would otherwise "rewrite" your hex to a different lightness/chroma).
  const baseColorHex = resolveSwatch(baseHex).hex;

  const [hexInput, setHexInput] = useState("");
  const [invalid, setInvalid] = useState(false);

  // Keep the text field in sync with the committed base color.
  useEffect(() => {
    setHexInput(baseColorHex);
    setInvalid(false);
  }, [baseColorHex]);

  const commitHex = () => {
    const ok = setBaseFromString(hexInput);
    setInvalid(!ok);
  };

  return (
    <div className="flex flex-col gap-5">
      <Field label="Base color">
        <div className="flex items-center gap-2">
          <input
            aria-label="Base color picker"
            type="color"
            value={baseColorHex}
            onChange={(e) => setBaseFromString(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-line bg-transparent"
          />
          <input
            aria-label="Base color hex"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === "Enter" && commitHex()}
            spellCheck={false}
            className={`w-full rounded border bg-surface-2 px-2 py-1.5 font-mono text-sm text-ink-hi outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0 ${
              invalid ? "border-red-500" : "border-line"
            }`}
          />
        </div>
        <p className="font-mono text-xs text-ink-lo">
          oklch({Math.round(baseHex.l * 100)}% {baseHex.c.toFixed(3)}{" "}
          {Math.round(baseHex.h)})
        </p>
      </Field>

      <Field label="Harmony">
        <Dropdown
          aria-label="Harmony"
          value={harmony}
          options={HARMONIES}
          onChange={(v) => setHarmony(v as HarmonyType)}
        />
      </Field>

      <Field
        label="Chroma (OKLCH C)"
        value={<span className="font-mono">{base.c.toFixed(3)}</span>}
      >
        <Slider
          aria-label="Chroma"
          min={0}
          max={maxC}
          step={0.005}
          value={base.c}
          trackGradient={`linear-gradient(to right, oklch(${base.l} 0 ${base.h}), oklch(${base.l} ${maxC} ${base.h}))`}
          onChange={(e) => {
            const c = Number(e.target.value);
            pendingC.current = c;
            liveBase({ ...base, c });
          }}
          onPointerUp={() => setBase({ ...base, c: pendingC.current })}
          onKeyUp={() => setBase({ ...base, c: pendingC.current })}
        />
        <label
          className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-ink-lo"
          title="Allow chroma beyond the sRGB-safe cap (colors past it gamut-map for display)."
        >
          <input
            type="checkbox"
            checked={unrestricted}
            onChange={(e) => setUnrestrictedChroma(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          <span>Unrestricted gamut</span>
        </label>
      </Field>

      {harmony === "analogous" && (
        <Field
          label="Analogous span"
          value={<span className="font-mono">±{span}°</span>}
        >
          <Slider
            aria-label="Analogous span"
            min={10}
            max={60}
            step={1}
            value={span}
            onChange={(e) => {
              const s = Number(e.target.value);
              pendingSpan.current = s;
              liveSpan(s);
            }}
            onPointerUp={() => setSpan(pendingSpan.current)}
            onKeyUp={() => setSpan(pendingSpan.current)}
          />
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-lo">
        <span>{label}</span>
        {value && <span className="text-ink-hi">{value}</span>}
      </span>
      {children}
    </label>
  );
}
