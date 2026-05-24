"use client";

import { useEffect, useState } from "react";
import type { HarmonyType } from "@chroma/engine";
import { useChroma } from "@/lib/store";

const HARMONIES: { value: HarmonyType; label: string }[] = [
  { value: "complementary", label: "Complementary" },
  { value: "split-complementary", label: "Split-complementary" },
  { value: "analogous", label: "Analogous" },
  { value: "monochromatic", label: "Monochromatic" },
  { value: "triadic", label: "Triadic" },
  { value: "tetradic", label: "Tetradic" },
  { value: "square", label: "Square" },
  { value: "rectangular", label: "Rectangular" },
];

export function Controls() {
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const setHarmony = useChroma((s) => s.setHarmony);
  const setSpan = useChroma((s) => s.setSpan);
  const setBase = useChroma((s) => s.setBase);
  const setBaseFromString = useChroma((s) => s.setBaseFromString);

  const baseHex = useChroma((s) => s.palette.baseColor);
  const baseSwatchHex = useChroma((s) => s.palette.light.roles.primary.hex);

  const [hexInput, setHexInput] = useState("");
  const [invalid, setInvalid] = useState(false);

  // Keep the text field in sync with the wheel-derived base color.
  useEffect(() => {
    setHexInput(baseSwatchHex);
    setInvalid(false);
  }, [baseSwatchHex]);

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
            value={baseSwatchHex}
            onChange={(e) => setBaseFromString(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-neutral-700 bg-transparent"
          />
          <input
            aria-label="Base color hex"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === "Enter" && commitHex()}
            spellCheck={false}
            className={`w-full rounded border bg-neutral-900 px-2 py-1.5 font-mono text-sm text-neutral-100 outline-none ${
              invalid ? "border-red-500" : "border-neutral-700"
            }`}
          />
        </div>
        <p className="font-mono text-[11px] text-neutral-500">
          oklch({Math.round(baseHex.l * 100)}% {baseHex.c.toFixed(3)}{" "}
          {Math.round(baseHex.h)})
        </p>
      </Field>

      <Field label="Harmony">
        <select
          value={harmony}
          onChange={(e) => setHarmony(e.target.value as HarmonyType)}
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none"
        >
          {HARMONIES.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Chroma (OKLCH C) — ${base.c.toFixed(3)}`}>
        <input
          type="range"
          min={0}
          max={0.37}
          step={0.005}
          value={base.c}
          onChange={(e) => setBase({ ...base, c: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </Field>

      {harmony === "analogous" && (
        <Field label={`Analogous span — ±${span}°`}>
          <input
            type="range"
            min={10}
            max={60}
            step={1}
            value={span}
            onChange={(e) => setSpan(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}
