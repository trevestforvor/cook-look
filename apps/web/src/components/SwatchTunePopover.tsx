"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatOklchCss, oklch, resolveSwatch } from "@chroma/engine";
import { useChroma, SRGB_MAX_C } from "@/lib/store";
import { Slider } from "@/components/Slider";
import type { Role } from "@chroma/engine";

/**
 * Per-swatch fine-tune popover: three OKLCH mini-sliders (Lightness / Chroma /
 * Hue) plus a live preview. Editing a role calls `setRoleColor`, which FREEZES
 * the role to the picked color (so it survives palette rebuilds) — hence the
 * lock note. The engine owns all color values: the preview/result come from
 * `resolveSwatch`, never hand-written hex.
 *
 * Anchored to its trigger by the caller (a positioned wrapper). Closes on Escape
 * or outside-click; respects reduced motion via global CSS.
 */
export function SwatchTunePopover({
  role,
  initial,
  onClose,
}: {
  role: Role;
  initial: { l: number; c: number; h: number };
  onClose: () => void;
}) {
  const setRoleColor = useChroma((s) => s.setRoleColor);
  const proMode = useChroma((s) => s.proMode);

  const [l, setL] = useState(initial.l);
  const [c, setC] = useState(initial.c);
  const [h, setH] = useState(initial.h);

  const ref = useRef<HTMLDivElement>(null);

  // Outside-click + Escape to dismiss.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const preview = resolveSwatch(oklch(l, c, h));

  // Push to the store live as the user drags (the role is frozen, so this is
  // safe and immediately visible everywhere the palette is shown).
  const commit = (nl: number, nc: number, nh: number) => {
    setRoleColor(role, oklch(nl, nc, nh));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Fine-tune ${role}`}
      onKeyDown={onKeyDown}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-3 shadow-2"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-7 w-7 shrink-0 rounded-md border border-[var(--border)]"
          style={{ backgroundColor: preview.css }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold capitalize text-[var(--text)]">
            {role}
          </div>
          <div className="truncate font-mono text-[11px] text-[var(--text-2)]">
            {proMode ? formatOklchCss(preview.oklch) : preview.hex}
          </div>
        </div>
      </div>

      <TuneRow
        label="Lightness"
        value={l}
        min={0}
        max={1}
        step={0.005}
        display={`${Math.round(l * 100)}%`}
        track={`linear-gradient(to right, oklch(0 ${c} ${h}), oklch(1 ${c} ${h}))`}
        onChange={(v) => {
          setL(v);
          commit(v, c, h);
        }}
      />
      <TuneRow
        label="Chroma"
        value={c}
        min={0}
        max={SRGB_MAX_C}
        step={0.005}
        display={c.toFixed(3)}
        track={`linear-gradient(to right, oklch(${l} 0 ${h}), oklch(${l} ${SRGB_MAX_C} ${h}))`}
        onChange={(v) => {
          setC(v);
          commit(l, v, h);
        }}
      />
      <TuneRow
        label="Hue"
        value={h}
        min={0}
        max={360}
        step={1}
        display={`${Math.round(h)}°`}
        track="linear-gradient(to right, oklch(0.7 0.15 0), oklch(0.7 0.15 60), oklch(0.7 0.15 120), oklch(0.7 0.15 180), oklch(0.7 0.15 240), oklch(0.7 0.15 300), oklch(0.7 0.15 360))"
        onChange={(v) => {
          setH(v);
          commit(l, c, v);
        }}
      />

      <p className="mt-1 text-[11px] leading-snug text-[var(--text-3)]">
        Fine-tuning locks {role} so rebuilds keep your color.
      </p>
    </div>
  );
}

function TuneRow({
  label,
  value,
  min,
  max,
  step,
  display,
  track,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  track: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-2 flex flex-col gap-1">
      <span className="flex items-center justify-between text-[11px] font-medium text-[var(--text-2)]">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-[var(--text-3)]">
          {display}
        </span>
      </span>
      <Slider
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        trackGradient={track}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
