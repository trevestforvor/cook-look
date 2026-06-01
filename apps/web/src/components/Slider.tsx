"use client";

import type { CSSProperties } from "react";

/**
 * Bespoke range slider — a styled `<input type="range">` (no native chrome).
 * Track + thumb are drawn via the global `.chroma-slider` CSS in globals.css
 * (appearance-none, WebKit + Firefox pseudo-elements). Pass `trackGradient`
 * to paint the track with a live OKLCH ramp; otherwise it falls back to the
 * tinted surface scale. All standard range props (value/min/max/step) plus the
 * live/commit handlers (onChange/onPointerUp/onKeyUp) pass straight through, so
 * the caller keeps its exact drag-live / release-commit logic.
 */
export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** A CSS background (e.g. a `linear-gradient(...)`) painted on the track. */
  trackGradient?: string;
  "aria-label"?: string;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onPointerUp,
  onKeyUp,
  trackGradient,
  className = "",
  ...aria
}: SliderProps) {
  // Filled-progress fallback when no gradient is supplied: accent up to the
  // thumb, surface beyond it.
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const trackBg =
    trackGradient ??
    `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface-2) ${pct}%, var(--surface-2) 100%)`;

  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      onPointerUp={onPointerUp}
      onKeyUp={onKeyUp}
      aria-label={aria["aria-label"]}
      style={{ "--track-bg": trackBg } as CSSProperties}
      className={`chroma-slider ${className}`}
    />
  );
}
